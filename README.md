# AutoBiz — Verified Competitor Intelligence from SEC Filings

> A multi-agent system that reads a competitor's SEC filings, preserves the
> source behind every figure, re-checks each number against the original
> document, and states plainly in the report when reliable data can't be found.

**Kaggle Capstone — "5-Day AI Agents: Intensive Vibe Coding" · Track: Agents for Business**

Built on a **Google ADK multi-agent architecture**, powered by **Gemini**
(free tier) with a **fully-offline deterministic fallback** so it runs
anywhere — local, Google Colab, or Kaggle — with **zero paid APIs**.

---

## The problem

Ask most AI tools to research a competitor and you get a confident, fluent
answer. It's often wrong — not because the model is incapable, but because
nothing in the system checks whether the figures it produced correspond to
anything the company actually filed.

For a business decision, that gap is the whole problem. A 23% revenue-growth
figure pulled from a regulatory filing means something; the same figure
generated because it seemed plausible means nothing — and the two look
identical on the page.

**AutoBiz treats every number as guilty until sourced: if a figure can't be
traced to a filing, it doesn't appear as fact.** Small and mid-sized teams
often can't afford an analyst to read annual filings, track competitor changes
across reporting periods, and flag what warrants attention. AutoBiz does that
job.

---

## Table of contents

1. [What it does](#what-it-does)
2. [Why agents, not a chatbot](#why-agents-not-a-chatbot)
3. [Course concepts demonstrated](#course-concepts-demonstrated)
4. [Architecture](#architecture)
5. [The verification mechanism](#the-verification-mechanism)
6. [Quick start](#quick-start)
7. [Running the web app](#running-the-web-app)
8. [Running on Colab / Kaggle](#running-on-colab--kaggle)
9. [Using live Gemini](#using-live-gemini)
10. [Agent Skills (the Agents CLI)](#agent-skills-the-agents-cli)
11. [Bidirectional MCP](#bidirectional-mcp)
12. [Project structure](#project-structure)
13. [How each subsystem works](#how-each-subsystem-works)
14. [Security](#security)
15. [Observability](#observability)
16. [Evaluation](#evaluation)
17. [Testing](#testing)
18. [Limitations (by design)](#limitations-by-design)
19. [Roadmap](#roadmap)
20. [License](#license)

---

## What it does

You give AutoBiz two things:

- A **financial document** (PDF or CSV), and/or
- A **competitor name**

A team of **five specialist agents** then runs, strictly in order:

1. **Period Planner** — decides whether financial analysis and/or competitor
   research are relevant to the question (defaulting to both, conservatively),
   and how many fiscal years are needed: most recent year by default, or a
   multi-year trend if the question asks for one.
2. **Financial Analyst** — parses and analyses your financials, single-year or
   multi-year.
3. **Competitor Monitor** — researches the competitor: **SEC 10-K filing
   first**, web search only as a fallback for private/foreign companies, and an
   honest "no reliable data" if both fail. Never fabricates.
4. **Risk Flagging Analyst** — reviews the competitor analysis for anomalies:
   sharp CAGR swings, litigation/regulatory language, or missing data.
5. **Report Writer** — synthesises everything into a clean executive brief with
   a source line attached to the filing-derived figures.

Around that pipeline, AutoBiz **remembers** the interaction for follow-up
questions, **secures** every input (PII redaction + injection detection),
**logs** every step, and **scores** its own output.

The result is a downloadable markdown brief plus a live trace of exactly what
the agents did — and, for any numeric claim, a verification path back to the
filing it came from.

---

## Why agents, not a chatbot

A single chatbot answers one prompt with one call. This problem genuinely needs
a **coordinated team**, because the failure it's built to prevent — an
unsourced number stated as fact — happens precisely when one model does
research, interpretation, and writing in a single undifferentiated pass.

| Need | Why a chatbot can't | How AutoBiz solves it |
|------|--------------------|----------------------|
| Different expertise per task | One prompt can't be a great financial analyst *and* a competitive researcher *and* a risk reviewer *and* an editor | Five dedicated agents, each with a focused instruction + tools |
| Multi-step planning | No notion of "decide scope, then analyse, then research, then review, then synthesise" | A Period Planner sets scope; a `SequentialAgent` routes the rest |
| Tool use | Can't pull a 10-K or query XBRL by itself | ADK `FunctionTool`s per agent, hitting live SEC EDGAR |
| Source discipline | Treats its own output as ground truth | A separate verification skill re-checks figures against the filing |
| Continuity | Forgets across turns | SQLite session store + ChromaDB semantic recall |
| Trust & safety | No input governance | Security layer redacts PII and flags injection before any LLM call |
| Reliability | No self-checking | Evaluation harness scores outputs; 67 offline tests |

---

## Course concepts demonstrated

The capstone requires **at least 3** course concepts. AutoBiz demonstrates
**six**, each mapped to where a judge can find it:

| # | Concept | Where in the code |
|---|---------|-------------------|
| 1 | **Multi-agent system (ADK)** | `autobiz/agents/pipeline.py` — a `SequentialAgent` orchestrating five `LlmAgent`s, state passed via each agent's `output_key` |
| 2 | **MCP Server** | `server/mcp_server.py` (serves AutoBiz tools out) **and** `server/sentiment_mcp_server.py` + `autobiz/tools/mcp_client.py` (AutoBiz consumes a second server) — bidirectional |
| 3 | **Agent skills** | `autobiz/skills/` — named, independently-runnable skills with a typed `SkillResult`, driven by the Agents CLI (`python -m autobiz.cli skill run ...`) |
| 4 | **Security features** | `autobiz/core/security.py` — PII redaction, prompt-injection detection, input sanitisation, wired into the orchestrator before anything runs |
| 5 | **Deployability** | `Dockerfile.backend`, `Dockerfile.mcp`, `docker-compose.yml`; FastAPI + React split; Colab/Kaggle notebook |
| 6 | **Tool use** | `autobiz/agents/adk_tools.py` — plain Python functions auto-wrapped as ADK `FunctionTool`s (10-K fetch, XBRL trend, web search, financial parsing) |

---

## Architecture

Built on **Google ADK** primitives. Five specialist `LlmAgent`s are
orchestrated by a `SequentialAgent`; state flows between stages via each
agent's `output_key` into the shared ADK session state. The `Runner` +
`InMemorySessionService` execute the pipeline. A thin **FastAPI** layer
(`server/main.py`) exposes that pipeline over REST so the **React** frontend
(`frontend/`) can drive it — no agent code changed to support the UI.

```
   ┌──────────────┐     REST/JSON      ┌───────────────────────────┐
   │  React UI    │ ─────────────────▶ │  FastAPI middleware        │
   │  (frontend/) │ ◀───────────────── │  (server/main.py)          │
   └──────────────┘                    └─────────────┬──────────────┘
                                                      ▼
                 ┌──────────────────────────────────────────────┐
                 │  Orchestrator (security · memory · trace)     │
                 └─────────────────┬────────────────────────────┘
                                   ▼
   ┌────────────────────────────────────────────────────────────────────┐
   │        ADK SequentialAgent: "BusinessIntelPipeline"                 │
   │                                                                    │
   │  PeriodPlanner ▶ FinancialAnalyst ▶ CompetitorMonitor ▶            │
   │       │                │                   │                        │
   │       ▼                ▼                   ▼                        │
   │  period_plan     financial_summary   competitor_summary            │
   │                                                                    │
   │            ▶ RiskFlaggingAnalyst ▶ ReportWriter                    │
   │                     │                    │                         │
   │                     ▼                    ▼                         │
   │               anomaly_flags         final_report                   │
   │                                                                    │
   │  Tools (ADK FunctionTools, tried in priority order):               │
   │   get_10k_filing_excerpt · get_financial_trend (XBRL) ·            │
   │   search_competitor_news · analyze_financial_document              │
   └────────────────────────────────────────────────────────────────────┘
                                   ▼
   Shared layer:  SQLite sessions · ChromaDB recall · JSON traces ·
                  Security guard · Evaluation harness · Source verification

   Two-way MCP:   server/mcp_server.py  ── serves AutoBiz tools outward ▶ (Claude Desktop, etc.)
                  autobiz/tools/mcp_client.py ── consumes ▶ server/sentiment_mcp_server.py
```

Orchestration is deterministic (`SequentialAgent`); each step's reasoning and
tool use is LLM-driven — the canonical ADK "assembly line" pattern. The FastAPI
layer is a pure adapter: it calls the same `Orchestrator.handle()` the CLI uses,
offloading to a worker thread (since `handle()` internally calls `asyncio.run()`
to drive the ADK `Runner`). No business logic lives in `server/`.

> **Offline by design — with one honest exception.** Without a `GEMINI_API_KEY`,
> the agents use `MockLlm`, a real `google.adk.models.BaseLlm` subclass, so ADK
> orchestration (agents, `SequentialAgent`, `Runner`, sessions) runs with no key
> and no network. Financial-document analysis is fully offline. Competitor
> research is the exception: `MockLlm` genuinely calls the live SEC EDGAR API
> (web search as fallback) rather than fabricating data, so a competitor query
> still needs network access even in mock mode. If SEC EDGAR and web search are
> both unreachable, the agent reports that honestly instead of inventing a
> briefing. Add a Gemini key and the same agents call Gemini for everything else.

---

## The verification mechanism

This is the differentiator, so it's worth being precise about what it does and
doesn't do.

When a competitor's 10-K is fetched, its stripped plain text is cached on disk,
keyed by SEC **accession number** (a filed 10-K is immutable, so the cache
never goes stale). The `source_verification` skill takes a **claim** (a sentence
from the report) and the **accession number** it was sourced from, then:

1. Extracts every checkable numeric token from the claim (dollar figures,
   percentages, large numbers).
2. Re-extracts numeric tokens from the cached filing text the same way.
3. Normalises both sides (strips `$`, commas, whitespace) and compares as sets.
4. Returns `ok: true` **only if every checked number is genuinely present** in
   the source. A fabricated or mistyped figure is flagged, with a confidence
   score = (matched numbers / total checked).

```bash
# A figure that IS in Apple's FY2025 10-K → verified
python -m autobiz.cli skill run source_verification \
  --claim "Revenue was \$416,161 million" \
  --accession_number 0000320193-25-000079

# A plausible-but-invented figure → flagged, not trusted
python -m autobiz.cli skill run source_verification \
  --claim "Revenue was \$999,999 million" \
  --accession_number 0000320193-25-000079
```

**What "verified" means here:** the cited figures are genuinely present in the
source filing — *not* that the sentence's interpretation is true. That
distinction is deliberate and is reflected in the confidence score and wording
of every result. Validating natural-language claims against natural-language
source text reliably is a much harder problem than number matching, so AutoBiz
verifies numbers and says so plainly rather than overclaiming.

---

## Quick start

```bash
# 1. Clone
git clone https://github.com/garimatripathi3/AutoBiz-Verified-Competitor-Intelligence-from-SEC-Filings.git
cd AutoBiz-Verified-Competitor-Intelligence-from-SEC-Filings

# 2. (Recommended) create a virtual environment
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate

# 3. Install — minimal (offline mode) OR full
pip install -r requirements-minimal.txt    # ADK + pandas + FastAPI/uvicorn + requests
# pip install -r requirements.txt          # full: gemini, chroma, pdf, search...

# 4. Run the pipeline from the CLI
#    (financial analysis is offline, no key needed; competitor research needs network)
python -m autobiz.cli \
  --file data/sample/financials.csv \
  --competitor "Apple Inc." \
  --query "Compare our revenue and margins to our competitor" \
  --show-trace
```

> Use a real SEC-registered public company (e.g. "Apple Inc.", "Tesla, Inc.")
> to see the 10-K path. A fictional or private name will correctly fall back to
> web search, and report honestly if that's also unavailable rather than
> fabricate a briefing.

You'll see the executed plan, the generated brief, the security summary, and the
agent trace — all without any API key.

---

## Running the web app

A **React frontend** talks to a **FastAPI middleware** over REST. Run both:

```bash
# Terminal 1 — API middleware (wraps the existing Orchestrator)
pip install -r requirements.txt
uvicorn server.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 — React frontend
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (typically <http://localhost:5173>). The UI lets you
upload a PDF/CSV, name a competitor, run the agent team, read/download the brief,
and watch the **live agent trace** and **plan** in the right-hand panel. Clicking
a report section highlights the matching agent's entries in the trace — a visual
link between a claim and the step that produced it. If your API runs elsewhere,
set `VITE_API_BASE` in `frontend/.env`.

Production build:

```bash
cd frontend && npm run build   # static files → frontend/dist
```

### Docker

```bash
docker compose up --build      # backend + MCP server per docker-compose.yml
```

---

## Running on Colab / Kaggle

A ready-to-run notebook lives at **`notebook/autobiz_capstone.ipynb`**.

- It installs the minimal deps and runs the **full pipeline in offline mock mode**.
- To enable live Gemini, set `os.environ["GEMINI_API_KEY"] = "..."` near the top.
- The React/FastAPI web app isn't available inside Kaggle; the notebook
  demonstrates every subsystem in cells instead (the recommended Kaggle artifact).

> **Note:** Colab and Kaggle block local LLM daemons, which is why AutoBiz uses
> Gemini's free API for live mode and a deterministic mock for offline mode —
> both work everywhere.

---

## Using live Gemini

1. Get a **free** API key (no credit card) at
   <https://aistudio.google.com/app/apikey>.
2. Copy `.env.example` to `.env` and paste your key:
   ```env
   GEMINI_API_KEY=your-key-here
   GEMINI_MODEL=gemini-flash-latest
   ```
   > `gemini-1.5-flash` was retired by Google. The default is the
   > `gemini-flash-latest` alias so it won't go stale; override `GEMINI_MODEL`
   > to pin an exact version.
3. Run anything — the provider auto-switches to `gemini`. Confirm with:
   ```bash
   python -c "from autobiz.core.config import settings; print(settings.provider)"
   ```

If the key is missing or a call fails, the system **automatically falls back** to
the offline mock so a demo never breaks.

---

## Agent Skills (the Agents CLI)

`autobiz/skills/` is a layer above raw tool functions: each `Skill` is a named,
independently-runnable capability returning a typed `SkillResult`
(`ok`, `summary`, `confidence`, `sources`, `raw_data`) instead of a bare dict.
Skills wrap the **same** underlying tool functions the ADK pipeline uses — no
duplicated logic — but run standalone, with no LLM and no pipeline:

```bash
python -m autobiz.cli skill list
python -m autobiz.cli skill run financial_analysis   --file_path data/sample/financials.csv
python -m autobiz.cli skill run competitor_research  --company_name "Apple Inc."
python -m autobiz.cli skill run financial_trend      --company_name "Apple Inc." --metric revenue --years 4
python -m autobiz.cli skill run source_verification  --claim "Revenue was \$416,161 million" --accession_number 0000320193-25-000079
```

`financial_trend` pulls structured annual figures from SEC's `companyconcept`
**XBRL** API — real reported numbers, not narrative text — and computes a true
CAGR. It tries multiple XBRL tag candidates in order (companies change which tag
they report revenue under, notably around the 2018 ASC 606 transition) and keeps
only true ~365-day annual periods, filtering out quarterly entries.

---

## Bidirectional MCP

- **Outward:** `server/mcp_server.py` exposes AutoBiz's tools to any MCP client
  (Claude Desktop, Claude Code, other frameworks). Every tool is a thin wrapper
  around the same `adk_tools.py` functions the pipeline uses — a fix to the tool
  fixes both at once. Ships with DNS-rebinding protection and host allow-listing.
- **Inward:** `server/sentiment_mcp_server.py` is a second, independent MCP
  server with its own tool (`market_sentiment_snapshot`), and
  `autobiz/tools/mcp_client.py` makes AutoBiz's pipeline call it *as an MCP
  client* — genuine two-way protocol interoperability, not just exporting tools.

The sentiment data is explicitly labelled simulated (`is_simulated: true` with a
disclaimer) rather than sourced from an unreliable third-party feed — consistent
with the project's honest-sourcing principle.

```bash
uvicorn server.mcp_server:http_app --port 8765            # serve AutoBiz tools
uvicorn server.sentiment_mcp_server:http_app --port 8766  # the second server AutoBiz consumes
```

---

## Project structure

```
autobiz/
├── server/
│   ├── main.py                  # FastAPI middleware (REST layer for the React UI)
│   ├── mcp_server.py            # MCP server — exposes AutoBiz tools outward
│   └── sentiment_mcp_server.py  # second MCP server AutoBiz consumes as a client
├── frontend/                    # React + Vite single-page app
│   ├── src/
│   │   ├── App.jsx              # top-level layout + state orchestration
│   │   ├── api.js               # fetch wrapper around the FastAPI endpoints
│   │   └── components/          # Header, BriefForm, PlanStrip, ReportPanel, AgentLedger, ...
│   ├── package.json
│   └── vite.config.js
├── autobiz/
│   ├── cli.py                   # command-line entry point + Agents CLI (skill subcommand)
│   ├── agents/
│   │   ├── pipeline.py          # 5 LlmAgents + SequentialAgent pipeline
│   │   ├── orchestrator.py      # drives ADK Runner + security/memory/trace
│   │   ├── adk_tools.py         # ADK FunctionTool wrappers
│   │   └── model_factory.py     # Gemini model OR offline MockLlm (BaseLlm)
│   ├── skills/
│   │   ├── base.py              # Skill / SkillResult contract
│   │   ├── financial_analysis.py
│   │   ├── competitor_research.py
│   │   ├── financial_trend.py   # multi-year XBRL trend + CAGR
│   │   └── source_verification.py  # re-checks figures against the cited filing
│   ├── tools/
│   │   ├── documents.py         # PDF + CSV parsing
│   │   ├── sec_filings.py       # SEC EDGAR: CIK resolve, 10-K fetch, section extraction, XBRL
│   │   ├── research.py          # web search + RSS (no fabricated fallback)
│   │   └── mcp_client.py        # consumes the sentiment MCP server
│   └── core/
│       ├── config.py            # settings / provider + ADK key wiring
│       ├── memory.py            # SQLite + ChromaDB (cross-run memory)
│       ├── security.py          # PII redaction + injection guard
│       ├── logger.py            # structured JSON tracing
│       └── evaluation.py        # scoring harness
├── data/sample/                 # financials.csv, sample_report.txt
├── notebook/autobiz_capstone.ipynb
├── tests/test_suite.py          # 67 offline pytest tests
├── Dockerfile.backend · Dockerfile.mcp · docker-compose.yml
├── requirements.txt · requirements-minimal.txt · .env.example
└── LICENSE
```

---

## How each subsystem works

**ADK pipeline** (`agents/pipeline.py`) — five `LlmAgent`s wired into a
`SequentialAgent`. Each writes to a state key (`period_plan`, `financial_summary`,
`competitor_summary`, `anomaly_flags`, `final_report`) and downstream agents read
upstream output via `{placeholder}` references in their instructions.

**Orchestrator** (`agents/orchestrator.py`) — sanitises the request, recalls
related prior findings, seeds ADK session state, runs the `Runner` to completion,
reads outputs from session state, saves a markdown report, and persists
everything. Each question gets its **own** scoped ADK session, so prior turns
don't bleed into unrelated follow-ups (continuity flows only through the explicit
semantic-memory channel). Every ADK event is logged to the trace.

**Tools** (`agents/adk_tools.py`) — plain Python functions ADK auto-wraps as
`FunctionTool`s. None fabricate data on failure: a failed lookup returns
`{"ok": false, "reason": "..."}` and `CompetitorMonitor`'s instruction requires
reporting that honestly.

**Model factory** (`agents/model_factory.py`) — one interface, two models. With a
key, agents use the configured Gemini model string. Without one, agents use
`MockLlm`, a real `BaseLlm` whose deterministic output is keyed on task markers —
so demos and tests are perfectly reproducible.

---

## Security

The security guard (`core/security.py`) runs on **every** request, before any LLM
call or log write:

- **PII redaction** — emails, phone numbers, card-like and SSN-like strings are
  replaced with typed placeholders.
- **Prompt-injection detection** — flags common override patterns ("ignore all
  previous instructions", "reveal your system prompt", …) and treats the input as
  untrusted data.
- **Input sanitisation** — strips control characters and caps length.

The MCP server adds transport-level protection: DNS-rebinding protection and host
allow-listing.

---

## Observability

Every action appends a structured JSON line to `data/agent_traces.jsonl`:

```json
{"ts": 1782.4, "agent": "orchestrator", "event": "plan_built", "steps": ["period_planner", "financial_analyst", "..."]}
```

Load it into pandas, replay a run, or watch it live in the React UI's **Agent
trace** panel (a terminal-style ledger). An in-memory ring buffer (`tracer.tail(n)`)
powers the live view via the `/api/trace` endpoint.

---

## Evaluation

```bash
python -m autobiz.core.evaluation
# or
python -m autobiz.cli --eval
```

Three end-to-end cases (financial-only, competitor-only, combined) are scored on
**keyword coverage** and **required-section structure**. Offline mode passes all
three, giving a baseline to compare live-Gemini runs against.

---

## Testing

```bash
pip install pytest
pytest -q
```

**67 tests** cover security, tools (SEC EDGAR CIK resolution, 10-K section
extraction and TOC disambiguation, XBRL trend computation with tag fallback), the
skills layer (including the Agents CLI as a subprocess), the MCP server (both
directions — serving tools and consuming the second server), the Period Planner's
section-relevance and period-detection logic, the Risk Flagging agent, memory, the
orchestrator paths (the 10-K → news → honest-failure priority chain, multi-turn
sessions), and the eval harness. They run **fully offline** (no key, no network)
in a few seconds.

---

## Limitations (by design)

AutoBiz is deliberately honest about its own boundaries — the same principle it
applies to competitor data:

- **Verification checks numbers, not prose.** A "verified" claim means its cited
  figures appear in the source filing, not that its interpretation is correct.
- **Verification runs against cached filings** — the exact filing a figure was
  originally sourced from. It won't re-download just to verify.
- **Number matching is presence-based:** it confirms a figure appears in the
  filing, not that it appears in the right context. This is a conservative floor,
  not a ceiling.
- **Only SEC-registered filers** get the primary 10-K path; private and foreign
  companies fall back to web search (clearly marked as a weaker source) or an
  honest "no reliable data".

These are stated up front because a tool built on "guilty until sourced" should
hold itself to the same standard.

---

## Roadmap

- Context-aware number verification (right figure, right section).
- A dedicated Risk/Compliance agent for regulatory scanning.
- Vector-embed uploaded documents for cross-report retrieval.
- Export to PDF/PPTX directly from the UI.
- Optional human-in-the-loop approval before a brief is finalised.

---

## License

MIT — see [LICENSE](LICENSE).
