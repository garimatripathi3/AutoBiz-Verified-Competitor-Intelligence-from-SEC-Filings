"""
MCP server for AutoBiz.

Exposes the project's existing, tested tool functions over the Model
Context Protocol so any MCP-compatible client (Claude Desktop, Claude Code,
other agent frameworks) can call them directly — completely independent of
the React/FastAPI app and the ADK agent pipeline in autobiz/agents/, both of
which keep working unchanged whether or not this server is running.

This is NOT a reimplementation. Every tool here is a thin wrapper around the
exact same functions in autobiz/agents/adk_tools.py that the ADK pipeline
already calls — same parsing logic, same SEC EDGAR caching, same "never
fabricate data on failure" contract. A fix to the underlying tool fixes it
for both the ADK pipeline and this MCP server at once.

Run standalone (stdio, e.g. for Claude Desktop's local config):
    python -m server.mcp_server --transport stdio

Run as a network server (streamable-http, e.g. inside Docker):
    python -m server.mcp_server --transport streamable-http
    # or just: uvicorn server.mcp_server:http_app --host 0.0.0.0 --port 8765
"""
from __future__ import annotations

import argparse
import json

from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings

from autobiz.agents import adk_tools
from autobiz.core.config import settings

_allowed_hosts = [h.strip() for h in settings.mcp_allowed_hosts.split(",") if h.strip()]
_transport_security = (
    TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=_allowed_hosts,
        allowed_origins=[f"http://{h}" for h in _allowed_hosts] + [f"https://{h}" for h in _allowed_hosts],
    )
    if _allowed_hosts
    else None  # leave protection off (the FastMCP/Starlette default) for open/local use
)

mcp = FastMCP(
    name="autobiz-intelligence-suite",
    instructions=(
        "Tools from the AutoBiz: financial document parsing, "
        "SEC 10-K filing lookup (with web-search fallback for private companies), "
        "and general web search. None of these fabricate results on failure — a "
        "failed lookup returns ok: false with a reason rather than invented data."
    ),
    host=settings.mcp_host,
    port=settings.mcp_port,
    transport_security=_transport_security,
)


def _as_dict(json_str: str) -> dict:
    """adk_tools functions return JSON strings (sized/truncated for LLM
    context windows). MCP clients expect structured data back, not a string
    containing JSON, so we deserialize here at the boundary. If truncation
    ever produced invalid JSON (the 4000/8000 char caps in adk_tools.py),
    surface that as an explicit error rather than silently returning a raw
    string the caller would have to re-parse themselves."""
    try:
        return json.loads(json_str)
    except json.JSONDecodeError:
        return {
            "ok": False,
            "reason": "truncated_response",
            "detail": "The underlying tool's response was truncated and is not valid JSON.",
        }


@mcp.tool()
def parse_financial_document(file_path: str) -> dict:
    """Parse a financial PDF or CSV and return extracted figures and summary
    statistics (numeric column sums/means/min/max for CSVs, detected
    currency figures for PDFs).

    Args:
        file_path: Path to a .pdf or .csv financial document, accessible
            from wherever this MCP server process is running.
    """
    return _as_dict(adk_tools.analyze_financial_document(file_path))


@mcp.tool()
def get_10k_filing(company_name: str) -> dict:
    """Look up a public company's most recent SEC 10-K filing and return its
    Risk Factors (Item 1A) and Management's Discussion and Analysis (Item 7)
    sections, with full source attribution (filing date, accession number,
    document URL). Only works for SEC-registered public companies — private
    or foreign companies will get ok: false with reason "no_sec_filer"; use
    web_search as a fallback in that case.

    Args:
        company_name: The company name to look up (e.g. "Apple Inc.").
            Matched against SEC's public company name/ticker list.
    """
    return _as_dict(adk_tools.get_10k_filing_excerpt(company_name))


@mcp.tool()
def web_search(query: str) -> dict:
    """Search the web for general information. Returns ok: false with a
    reason if no search backend succeeded — never fabricates results.

    Args:
        query: The search query.
    """
    return _as_dict(adk_tools.search_competitor_news(query))


@mcp.tool()
def fetch_rss_feed(url: str) -> dict:
    """Fetch recent headlines from an RSS feed URL.

    Args:
        url: The RSS feed URL to fetch.
    """
    return _as_dict(adk_tools.fetch_news_feed(url))


# Exposes the underlying Starlette ASGI app for `uvicorn server.mcp_server:http_app`
# (used by the Dockerfile) without needing to go through mcp.run().
http_app = mcp.streamable_http_app()


def main() -> None:
    parser = argparse.ArgumentParser(description="AutoBiz MCP server")
    parser.add_argument(
        "--transport",
        choices=["stdio", "streamable-http"],
        default="stdio",
        help="stdio for local clients (Claude Desktop/Code); "
        "streamable-http to run as a network server (used in Docker).",
    )
    args = parser.parse_args()
    mcp.run(transport=args.transport)


if __name__ == "__main__":
    main()
