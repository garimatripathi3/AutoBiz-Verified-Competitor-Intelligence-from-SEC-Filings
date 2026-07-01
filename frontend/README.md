# AutoBiz — Frontend

A React (Vite) single-page app that replaces the original Streamlit UI. It
talks to the FastAPI middleware in `../server/main.py`, which wraps the
unmodified `autobiz` Python package (Orchestrator, agents, memory, security,
tracing) over REST.

## Setup

```bash
npm install
npm run dev
```

This starts the Vite dev server (default http://localhost:5173). By
default it talks to the API at http://localhost:8000 -- start that first:

```bash
# from the project root, in a separate terminal
uvicorn server.main:app --reload --port 8000
```

To point the frontend at a different API URL, set VITE_API_BASE in a
.env file in this folder:

```env
VITE_API_BASE=http://localhost:8000
```

## Build

```bash
npm run build
```

Outputs static files to dist/, which can be served by any static host or
by the FastAPI app itself.

## Structure

```
src/
├── App.jsx               top-level layout + state orchestration
├── api.js                fetch wrapper around the FastAPI endpoints
├── index.css              design tokens (color, type, spacing)
├── app.css                component + layout styles
└── components/
    ├── Header.jsx         logo, provider status pill, session picker
    ├── BriefForm.jsx      business question, competitor, file upload, run
    ├── PlanStrip.jsx      run metrics: agents run / PII redacted / etc.
    ├── ReportPanel.jsx    rendered markdown brief + download button
    ├── AgentLedger.jsx    live trace tape, plan, raw JSON toggle
    └── EmptyState.jsx     landing panel shown before the first run
```

## Design notes

The visual direction is a financial-publication aesthetic -- ledger-paper
background, hairline rules, a serif display face (Fraunces) for headings, a
grotesk (Inter) for UI text, and a monospace (JetBrains Mono) for the live
agent trace, styled like a terminal tape. Two accents are used with
intention: copper for financial/primary actions, teal for competitive/
secondary information. No card-shadow-everywhere "AI demo" look -- sections
are separated with rules and whitespace, the way a real report is.
