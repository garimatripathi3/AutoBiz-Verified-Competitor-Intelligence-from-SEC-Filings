"""
FastAPI middleware for AutoBiz.

This is a thin REST layer in front of the existing, unmodified `autobiz`
package (Orchestrator, sessions, tracer, settings). It exists purely so the
React frontend has HTTP endpoints to call instead of Streamlit's
server-rendered widgets. No logic inside `autobiz/` is changed.

Run with:  uvicorn server.main:app --reload --port 8000
"""
from __future__ import annotations

import uuid
from pathlib import Path
from typing import Optional

import anyio
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse

from autobiz.agents.orchestrator import Orchestrator
from autobiz.core.config import REPORTS_DIR, UPLOADS_DIR, settings
from autobiz.core.logger import tracer
from autobiz.core.memory import session_store
from autobiz.tools import research as research_tools
from autobiz.tools import sec_filings

app = FastAPI(title="AutoBiz API", version="1.0.0")

# Allow the Vite dev server / built frontend to call this API from any origin.
# Tighten allow_origins in production if serving from a known domain.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Single shared orchestrator instance, mirroring the @st.cache_resource pattern.
_orchestrator: Optional[Orchestrator] = None


def get_orchestrator() -> Orchestrator:
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = Orchestrator()
    return _orchestrator


# --------------------------------------------------------------------------- meta
@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/settings")
def get_settings():
    """Mirrors the sidebar 'Provider' panel in the old Streamlit app."""
    return {
        "provider": settings.provider,
        "model": settings.gemini_model,
        "summary": settings.summary(),
        "live": settings.provider != "mock",
    }


# --------------------------------------------------------------------------- sessions
@app.get("/api/sessions")
def list_sessions():
    """Mirrors the sidebar session picker."""
    return {"sessions": session_store.sessions()}


@app.get("/api/sessions/new")
def new_session():
    return {"session_id": f"sess_{uuid.uuid4().hex[:8]}"}


@app.get("/api/sessions/{session_id}/history")
def session_history(session_id: str, limit: int = 50):
    return {"session_id": session_id, "history": session_store.history(session_id, limit=limit)}


# --------------------------------------------------------------------------- upload
@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """Stores the uploaded financial document and returns its server-side path,
    mirroring the old `st.file_uploader` -> UPLOADS_DIR write."""
    if not file.filename:
        raise HTTPException(400, "No filename provided")
    safe_name = Path(file.filename).name  # strip any directory components
    suffix = Path(safe_name).suffix.lower()
    if suffix not in (".pdf", ".csv"):
        raise HTTPException(400, "Only .pdf and .csv files are supported")

    dest = UPLOADS_DIR / safe_name
    content = await file.read()
    dest.write_bytes(content)
    return {"file_path": str(dest), "filename": safe_name, "size": len(content)}


# --------------------------------------------------------------------------- competitor search
def _web_fallback_candidates(query: str, limit: int = 5) -> list[dict]:
    """Best-effort candidates for companies that aren't SEC-registered
    (private, foreign-private, too small to file). Pulled from a plain web
    search rather than a structured company database, so these are weaker
    signals than the SEC matches — the frontend should label them as such
    (e.g. "found via web search, not SEC-registered") rather than presenting
    them with equal confidence."""
    result = research_tools.web_search(f"{query} company")
    if not result.get("ok"):
        return []
    seen_titles = set()
    out = []
    for hit in result.get("results", [])[:limit]:
        title = (hit.get("title") or "").strip()
        if not title or title.lower() in seen_titles:
            continue
        seen_titles.add(title.lower())
        out.append({"title": title, "url": hit.get("url", ""), "snippet": hit.get("snippet", "")})
    return out


@app.get("/api/competitors/search")
async def search_competitors(q: str):
    """Live autocomplete for the competitor field. Returns every plausible
    match instead of silently picking one — the whole point is to surface
    the ambiguity (e.g. "Acme" matching several unrelated companies) so the
    user picks the right one before the agent pipeline ever runs, rather
    than the pipeline guessing and writing a report about the wrong company.

    Response shape:
      {
        "query": "...",
        "sec_matches": [{"cik": "...", "title": "...", "ticker": "..."}, ...],
        "web_matches": [{"title": "...", "url": "...", "snippet": "..."}, ...]
      }
    sec_matches are SEC-registered public companies — these are the ones
    that will hit the 10-K filing tool. web_matches are weaker, found via
    plain web search, included for private/foreign companies that have no
    SEC filing (these will fall back to news search in the pipeline).
    """
    query = (q or "").strip()
    if len(query) < 2:
        return {"query": query, "sec_matches": [], "web_matches": []}

    def _search() -> dict:
        sec_matches = sec_filings.search_companies(query, limit=8)
        # Only bother with the (slower) web fallback if SEC didn't already
        # give a strong, small set of confident matches.
        web_matches = [] if len(sec_matches) >= 3 else _web_fallback_candidates(query)
        return {"query": query, "sec_matches": sec_matches, "web_matches": web_matches}

    return await anyio.to_thread.run_sync(_search)


# --------------------------------------------------------------------------- run
@app.post("/api/run")
async def run_agents(
    query: str = Form(...),
    competitor: Optional[str] = Form(None),
    file_path: Optional[str] = Form(None),
    session_id: Optional[str] = Form(None),
):
    """Runs the full agent pipeline. Equivalent to clicking 'Run agent team'."""
    orch = get_orchestrator()
    try:
        # Orchestrator.handle() is a synchronous method that internally calls
        # asyncio.run() to drive the ADK pipeline. That call would raise
        # "asyncio.run() cannot be called from a running event loop" if
        # executed directly inside this async endpoint, since FastAPI/uvicorn
        # already has a loop running. Running it in a worker thread gives it
        # its own thread (and therefore its own event loop) to run in,
        # without touching any orchestrator/autobiz code.
        result = await anyio.to_thread.run_sync(
            lambda: orch.handle(
                query=query,
                file_path=file_path or None,
                competitor=competitor or None,
                session_id=session_id or None,
            )
        )
    except Exception as exc:  # surface a clean error to the UI
        raise HTTPException(500, f"Agent pipeline failed: {exc}") from exc
    return result


# --------------------------------------------------------------------------- trace
@app.get("/api/trace")
def get_trace(n: int = 40):
    """Mirrors the 'Agent trace' panel."""
    return {"trace": tracer.tail(n)}


# --------------------------------------------------------------------------- report download
@app.get("/api/report/download", response_class=PlainTextResponse)
def download_report(path: str):
    p = Path(path).resolve()
    reports_root = REPORTS_DIR.resolve()
    if reports_root not in p.parents and p != reports_root:
        raise HTTPException(403, "Refusing to serve a path outside the reports directory")
    if not p.exists() or p.suffix != ".md":
        raise HTTPException(404, "Report not found")
    return PlainTextResponse(
        p.read_text(encoding="utf-8"),
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{p.name}"'},
    )
