# AutoBiz: Verified Competitor Intelligence from SEC Filings

AutoBiz is a multi-agent competitor intelligence system that reads SEC filings, preserves source provenance for every figure, verifies reported numbers against the original filing, and clearly states when reliable data cannot be found.

Kaggle Capstone: 5-Day AI Agents Intensive Vibe Coding  
Track: Agents for Business

AutoBiz is built with Google ADK, Gemini, a deterministic offline fallback model, FastAPI, React, SEC EDGAR, XBRL data, source verification, and bidirectional MCP support. It can run locally, in Colab, or on Kaggle without paid APIs.

---

## The problem

Most AI research tools are built to sound right. AutoBiz is built to be checked.

Ask an AI system to research a competitor and it may return a fluent answer with unsupported numbers. The issue is not only the model. The issue is that many systems never check whether a figure corresponds to anything the company actually filed.

For business decisions, this distinction matters. A revenue growth figure from a regulatory filing means something. The same number generated because it sounded plausible means nothing, even if both look identical in a report.

AutoBiz treats every number as guilty until sourced. If a figure cannot be traced to a filing, it is not treated as fact.

---

## Table of contents

1. [What AutoBiz does](#what-autobiz-does "What AutoBiz does")
2. [Why five agents](#why-five-agents "Why five agents")
3. [Course concepts demonstrated](#course-concepts-demonstrated "Course concepts demonstrated")
4. [Architecture](#architecture "Architecture")
5. [Verification](#verification "Verification")
6. [Quick start](#quick-start "Quick start")
7. [Running the web app](#running-the-web-app "Running the web app")
8. [Running on Colab or Kaggle](#running-on-colab-or-kaggle "Running on Colab or Kaggle")
9. [Using Gemini](#using-gemini "Using Gemini")
10. [Agent Skills and CLI](#agent-skills-and-cli "Agent Skills and CLI")
11. [Generating financial data from SEC](#generating-financial-data-from-sec "Generating financial data from SEC")
12. [Bidirectional MCP](#bidirectional-mcp "Bidirectional MCP")
13. [Project structure](#project-structure "Project structure")
14. [Subsystem details](#subsystem-details "Subsystem details")
15. [Security](#security "Security")
16. [Observability](#observability "Observability")
17. [Evaluation](#evaluation "Evaluation")
18. [Testing](#testing "Testing")
19. [Limitations](#limitations "Limitations")
20. [Roadmap](#roadmap "Roadmap")
21. [License](#license "License")

---

## What AutoBiz does

AutoBiz takes a user question, an optional financial document, and a competitor name. It then produces a sourced executive brief.

The system can:

- parse uploaded CSV or PDF financials;
- generate a real financials CSV for any SEC-registered company directly from XBRL data, so public-company numbers never have to be typed by hand;
- research competitors using SEC 10-K filings first;
- fall back to web search only when SEC filings are unavailable;
- pull multi-year financial trends from SEC XBRL data;
- compute CAGR from reported figures;
- flag risks from filings and data gaps;
- preserve filing source lines in the final report;
- verify reported numbers against cached filing text;
- report uncertainty instead of inventing unsupported data.

The final output is a markdown brief with source provenance and an execution trace showing which agents and tools ran.

---

## Why five agents

A single model call asked to parse financials, research a competitor, flag risks, and write a report does everything in one pass. There is no clear checkpoint where a wrong number is likely to be caught.

AutoBiz breaks the work into five specialist agents that run in a fixed sequence:

```text
PeriodPlanner -> FinancialAnalyst -> CompetitorMonitor -> RiskFlaggingAnalyst -> ReportWriter
```

1. PeriodPlanner decides which sections are needed and how many fiscal years matter.
2. FinancialAnalyst parses uploaded financials and pulls structured SEC trends when required.
3. CompetitorMonitor checks SEC 10-K filings first and uses web search only as fallback.
4. RiskFlaggingAnalyst identifies unusual growth, litigation language, regulatory signals, and real data gaps.
5. ReportWriter writes the final brief while preserving source lines for filing-backed figures.

This design lets planning decisions change what actually runs. For example, if the user asks only about a competitor, the FinancialAnalyst is skipped rather than called and discarded.

---

## Course concepts demonstrated

| Concept            | Implementation                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| Multi-agent system | `autobiz/agents/pipeline.py` uses a Google ADK `SequentialAgent` with five `LlmAgent`s          |
| MCP server         | `server/mcp_server.py` exposes AutoBiz tools to MCP-compatible clients                          |
| MCP client         | `autobiz/tools/mcp_client.py` consumes a second independent MCP server                          |
| Agent skills       | `autobiz/skills/` contains standalone, typed, independently runnable skills                     |
| Security           | `autobiz/core/security.py` performs PII redaction, prompt-injection detection, and sanitization |
| Tool use           | `autobiz/agents/adk_tools.py` wraps SEC, XBRL, document parsing, and web search functions       |
| SEC data generation| `eval/make_csv_from_sec.py` builds a real multi-year financials CSV from the SEC XBRL API        |
| Deployability      | Dockerfiles, `docker-compose.yml`, FastAPI backend, React frontend, and Colab/Kaggle notebook   |

---

## Architecture

AutoBiz is a full-stack application with three main layers:

- React and Vite frontend;
- FastAPI backend;
- Google ADK agent pipeline.

The React frontend collects the user question, competitor name, and optional financial file. The FastAPI backend handles uploads, security checks, session state, memory, orchestration, and trace output. The agent pipeline performs planning, analysis, competitor research, risk review, and report writing.

```text
React UI
   |
   | REST API
   v
FastAPI backend
   |
   v
Orchestrator: security, memory, trace, session state
   |
   v
Google ADK SequentialAgent
   |
   | PeriodPlanner
   | FinancialAnalyst
   | CompetitorMonitor
   | RiskFlaggingAnalyst
   | ReportWriter
   v
Verified executive brief
```

The backend calls the same orchestrator used by the CLI. Business logic does not live in the web layer.

The system also includes:

- SQLite for session history;
- ChromaDB for semantic recall;
- SEC filing cache keyed by accession number;
- JSON trace logs;
- source verification;
- MCP server and MCP client support.

---

## Verification

Verification is the core safeguard in AutoBiz.

When a competitor filing is fetched, AutoBiz caches the stripped filing text by SEC accession number. The source verification skill takes a claim and the accession number it was supposedly sourced from, then checks whether every numeric figure in the claim appears in the cached filing text.

Example:

```bash
python -m autobiz.cli skill run source_verification \
  --claim "Revenue was \$416,161 million" \
  --accession_number 0000320193-25-000079
```

A fabricated figure is flagged:

```bash
python -m autobiz.cli skill run source_verification \
  --claim "Revenue was \$999,999 million" \
  --accession_number 0000320193-25-000079
```

Verification runs in two ways:

1. as a standalone skill through the CLI;
2. as a post-report gate after `ReportWriter` finishes.

A verified number means the number is present in the cited filing. It does not mean the surrounding interpretation is automatically correct. AutoBiz is explicit about that boundary.

---

## Quick start

```bash
git clone https://github.com/garimatripathi3/AutoBiz-Verified-Competitor-Intelligence-from-SEC-Filings.git
cd AutoBiz-Verified-Competitor-Intelligence-from-SEC-Filings
python -m venv .venv
source .venv/bin/activate
# Windows: .venv\Scripts\activate
pip install -r requirements-minimal.txt
python -m autobiz.cli \
  --file data/sample/financials.csv \
  --competitor "Apple Inc." \
  --query "Compare our revenue and margins to our competitor" \
  --show-trace
```

Financial document analysis can run offline. Competitor research requires network access because it checks SEC EDGAR and, when needed, web fallback sources.

---

## Running the web app

Run the backend:

```bash
pip install -r requirements.txt
uvicorn server.main:app --reload --host 0.0.0.0 --port 8000
```

Run the frontend:

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL, usually:

```text
http://localhost:5173
```

The UI supports file upload, competitor selection, question input, live agent trace, report viewing, and markdown download.

For production frontend build:

```bash
cd frontend
npm run build
```

Run backend and MCP server with Docker:

```bash
docker compose up --build
```

---

## Running on Colab or Kaggle

A notebook is available at:

```text
notebook/autobiz_capstone.ipynb
```

The notebook installs dependencies and runs the system in offline mock mode. To enable Gemini, set:

```python
import os
os.environ["GEMINI_API_KEY"] = "your-key-here"
```

The React and FastAPI web app is not required in Kaggle. The notebook demonstrates the same backend capabilities through cells.

---

## Using Gemini

AutoBiz uses Gemini when a key is available. Without a key, it falls back to `MockLlm`.

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Set:

```env
GEMINI_API_KEY=your-key-here
GEMINI_MODEL=gemini-flash-latest
```

Check the active provider:

```bash
python -c "from autobiz.core.config import settings; print(settings.provider)"
```

If the Gemini key is missing or a call fails, the offline mock keeps the demo runnable.

---

## Agent Skills and CLI

Every core capability is also available as a standalone Skill. Skills return a typed result containing:

- `ok`;
- `summary`;
- `confidence`;
- `sources`;
- `raw_data`.

The skills use the same underlying tool functions as the agent pipeline, so fixes and tests apply to both.

```bash
python -m autobiz.cli skill list
python -m autobiz.cli skill run financial_analysis \
  --file_path data/sample/financials.csv
python -m autobiz.cli skill run competitor_research \
  --company_name "Apple Inc."
python -m autobiz.cli skill run financial_trend \
  --company_name "Apple Inc." \
  --metric revenue \
  --years 4
python -m autobiz.cli skill run source_verification \
  --claim "Revenue was \$416,161 million" \
  --accession_number 0000320193-25-000079
```

`financial_trend` pulls annual reported values from the SEC XBRL company-concept API and computes CAGR. It tries multiple XBRL concept tags because companies may report revenue under different tags across years.

---

## Generating financial data from SEC

For public companies, you do not need to prepare a financials spreadsheet by hand. A helper pulls real multi-year figures straight from the SEC XBRL company-concept API and writes a ready-to-use CSV:

```bash
python -m eval.make_csv_from_sec --company "Apple Inc." --out apple_financials.csv
```

The output has one row per fiscal year with `period`, `revenue`, `gross_profit`, `operating_income`, and `net_income` — every value taken from what the company reported to the SEC. For Apple, FY2025 produces revenue of \$416,161M, gross profit of \$195,201M, operating income of \$133,050M, and net income of \$112,010M, each traceable to Apple's 10-K. A metric a company does not report under a supported XBRL tag is left blank rather than estimated, consistent with the project's rule that a number appears only when it is genuinely filed.

Private companies upload their own CSV instead; the parser reads whatever columns it contains and summarizes each numeric one.

---

## Bidirectional MCP

AutoBiz supports MCP in both directions.

Outward server:

```text
server/mcp_server.py
```

This exposes AutoBiz tools to MCP-compatible clients, including:

- `parse_financial_document`;
- `get_10k_filing`;
- `web_search`;
- `fetch_rss_feed`.

Inward client:

```text
autobiz/tools/mcp_client.py
```

AutoBiz also calls a second independent MCP server:

```text
server/sentiment_mcp_server.py
```

That server exposes a market sentiment tool. The returned sentiment data is clearly labeled as simulated, because presenting simulated data as real would violate the project principle of honest sourcing.

Run the MCP servers:

```bash
uvicorn server.mcp_server:http_app --port 8765
uvicorn server.sentiment_mcp_server:http_app --port 8766
```

---

## Project structure

```text
autobiz/
├── server/
│   ├── main.py
│   ├── mcp_server.py
│   └── sentiment_mcp_server.py
├── frontend/
│   ├── src/
│   ├── package.json
│   └── vite.config.js
├── autobiz/
│   ├── cli.py
│   ├── agents/
│   ├── skills/
│   ├── tools/
│   └── core/
├── eval/
│   ├── make_csv_from_sec.py
│   └── verification_accuracy.py
├── data/sample/
├── notebook/autobiz_capstone.ipynb
├── tests/test_suite.py
├── Dockerfile.backend
├── Dockerfile.mcp
├── docker-compose.yml
├── requirements.txt
├── requirements-minimal.txt
├── .env.example
└── LICENSE
```

---

## Subsystem details

### ADK pipeline

`autobiz/agents/pipeline.py` defines five `LlmAgent`s and wires them into a `SequentialAgent`. Each agent writes to a state key such as `period_plan`, `financial_summary`, `competitor_summary`, `anomaly_flags`, or `final_report`.

### Orchestrator

`autobiz/agents/orchestrator.py` sanitizes the request, recalls related memory, seeds ADK session state, runs the ADK `Runner`, collects outputs, saves the markdown report, and records trace events. Each question gets its own scoped ADK session to prevent context leakage.

### Tools

`autobiz/agents/adk_tools.py` exposes Python functions as ADK `FunctionTool`s. The tools return structured failure results instead of fabricated data.

### Model factory

`autobiz/agents/model_factory.py` selects either Gemini or `MockLlm`. The mock model is deterministic and implemented as a real ADK `BaseLlm` subclass, making tests reproducible.

---

## Security

Security checks run before any model call:

- PII redaction for emails, phone numbers, card-like strings, and SSN-like patterns;
- prompt-injection detection for common override attempts;
- input sanitization and length limits.

The MCP server also includes DNS rebinding protection and host allow-listing.

---

## Observability

AutoBiz writes structured trace events to:

```text
data/agent_traces.jsonl
```

The React frontend displays these events in a live agent trace panel. The `/api/trace` endpoint is backed by an in-memory ring buffer.

---

## Evaluation

Run the evaluation harness:

```bash
python -m autobiz.core.evaluation
```

or:

```bash
python -m autobiz.cli --eval
```

The evaluation includes financial-only, competitor-only, and combined scenarios. It scores required section structure and keyword coverage.

For source verification accuracy on real filings:

```bash
python -m eval.verification_accuracy --company "Apple Inc."
python -m eval.verification_accuracy --company "Microsoft"
```

---

## Testing

```bash
pip install pytest
pytest -q
```

The test suite includes 67 offline tests covering:

- security;
- SEC CIK resolution;
- 10-K section extraction;
- XBRL trend computation;
- tag fallback;
- skills and CLI subprocesses;
- MCP server and MCP client paths;
- period planning;
- risk flagging;
- memory;
- orchestrator behavior;
- verification for correct, fabricated, and partial claims.

The tests run without an API key and without network access.

---

## Limitations

AutoBiz is explicit about its limits:

- Verification checks whether a number appears in the filing, not whether it is used in the right context.
- Verification uses cached filings from the original fetch.
- Number matching is presence-based.
- Section extraction depends on filing format; when a 10-K's HTML hides the section headers, AutoBiz falls back rather than failing.
- SEC filings are available only for SEC-registered companies.
- Private and foreign companies may require web fallback or may return no reliable data.

These limits are stated because a tool built on sourced claims should hold itself to the same standard.

---

## Roadmap

- Context-aware number verification.
- Deeper regulatory and compliance scanning.
- Better retrieval over uploaded documents.
- PDF and presentation export from the UI.
- Optional human approval before final report generation.

---

## License

MIT. See [LICENSE](LICENSE).
