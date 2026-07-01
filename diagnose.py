"""Diagnose why gross_profit / operating_income come back empty.
Run from project root:  python diagnose_metrics.py"""
from autobiz.tools import sec_filings
from autobiz.tools.sec_filings import _get, _XBRL_CONCEPT_URL

cik = "0000320193"  # Apple

for concept in ["GrossProfit", "OperatingIncomeLoss"]:
    print(f"\n=== {concept} ===")
    data = _get(_XBRL_CONCEPT_URL.format(cik=cik.zfill(10), concept=concept))
    if not data:
        print("  NO DATA returned from SEC for this tag (tag name wrong or 404)")
        continue
    usd = data.get("units", {}).get("USD", [])
    print(f"  total USD entries: {len(usd)}")
    tens = [e for e in usd if e.get("form") == "10-K"]
    print(f"  10-K entries: {len(tens)}")
    # show a few 10-K entries with their span
    import datetime as dt
    shown = 0
    for e in tens[-6:]:
        try:
            span = (dt.date.fromisoformat(e["end"]) - dt.date.fromisoformat(e["start"])).days
        except Exception:
            span = "?"
        print(f"    fy={e.get('fy')} end={e.get('end')} span_days={span} val={e.get('val')}")
        shown += 1
    if shown == 0:
        print("  (no 10-K entries to show)")

# And what get_financial_trend actually returns:
for m in ["revenue", "gross_profit", "operating_income", "net_income"]:
    r = sec_filings.get_financial_trend(cik, metric=m, years=5)
    print(f"\n{m}: ok={r.get('ok')} reason={r.get('reason','')} concept={r.get('concept_used','')}")
    if r.get("ok"):
        for t in r["trend"]:
            print(f"    FY{t['fiscal_year']}: {t['value']}")