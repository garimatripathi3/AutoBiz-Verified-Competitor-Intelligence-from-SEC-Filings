"""
A second, independent MCP server — used to demonstrate BIDIRECTIONAL MCP.

server/mcp_server.py (the main one) exposes AutoBiz's tools OUTWARD to
external clients. This module is the other direction: a small, separate
MCP server with its own distinct capability, which AutoBiz's own pipeline
then calls AS A CLIENT via mcp_client.py — proving the project understands
MCP as genuine two-way interoperability, not just an export mechanism.

This server exposes one tool: market_sentiment_snapshot. It returns a
SIMULATED sentiment indicator, clearly labeled as such. This is a
deliberate choice, not a corner cut: there is no reliable, genuinely
keyless, no-signup real-time market-sentiment API available as of this
writing (the honest free options either require a key, have very low
rate limits, or have been deprecated — see the research behind this
decision). Rather than depend on a third-party API likely to break a demo,
or silently fabricate something that LOOKS real, this tool is explicit
about being synthetic data, consistent with the project's existing
"never silently fabricate, always be honest about data provenance"
principle used throughout autobiz/tools/.

Run standalone:
    python -m server.sentiment_mcp_server --transport stdio
    uvicorn server.sentiment_mcp_server:http_app --host 0.0.0.0 --port 8766
"""
from __future__ import annotations

import argparse
import hashlib
import random
from datetime import datetime, timezone

from mcp.server.fastmcp import FastMCP

mcp = FastMCP(
    name="autobiz-market-sentiment-demo",
    instructions=(
        "Demonstration MCP server exposing a single tool: a SIMULATED market "
        "sentiment snapshot for a named company. This is synthetic data, "
        "deterministically derived from the company name and the current "
        "date (so repeated calls on the same day are stable), NOT a real "
        "market feed. It exists to demonstrate bidirectional MCP: AutoBiz's "
        "main pipeline (a separate process) calls this server as an MCP "
        "client, alongside its own server/mcp_server.py exposing tools "
        "outward."
    ),
    host="0.0.0.0",
    port=8766,
)


@mcp.tool()
def market_sentiment_snapshot(company_name: str) -> dict:
    """Return a SIMULATED market sentiment snapshot for a company.

    This is synthetic/demo data — deterministically generated from the
    company name and today's date so it's stable within a day, but it is
    NOT sourced from any real market feed. Clearly labeled as such in the
    response so no caller could mistake it for real sentiment data.

    Args:
        company_name: The company name to generate a sentiment snapshot for.
    """
    if not company_name.strip():
        return {"ok": False, "reason": "missing_company_name"}

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    seed_str = f"{company_name.strip().lower()}:{today}"
    seed = int(hashlib.sha256(seed_str.encode()).hexdigest()[:8], 16)
    rng = random.Random(seed)

    score = round(rng.uniform(-1.0, 1.0), 2)
    label = "positive" if score > 0.2 else "negative" if score < -0.2 else "neutral"
    mentions = rng.randint(50, 5000)

    return {
        "ok": True,
        "is_simulated": True,
        "disclaimer": (
            "SIMULATED DATA — deterministically generated for demonstration "
            "purposes, not sourced from any real market feed or news service."
        ),
        "company_name": company_name,
        "date": today,
        "sentiment_score": score,  # -1.0 (very negative) to 1.0 (very positive)
        "sentiment_label": label,
        "simulated_mention_count": mentions,
    }


http_app = mcp.streamable_http_app()


def main() -> None:
    parser = argparse.ArgumentParser(description="AutoBiz demo market-sentiment MCP server")
    parser.add_argument("--transport", choices=["stdio", "streamable-http"], default="stdio")
    args = parser.parse_args()
    mcp.run(transport=args.transport)


if __name__ == "__main__":
    main()
