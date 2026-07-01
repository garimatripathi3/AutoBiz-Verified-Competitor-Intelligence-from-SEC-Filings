import { useEffect, useRef, useState } from "react";
import { Activity, ChevronRight, Circle } from "lucide-react";

const LEVEL_TONE = {
  INFO: "green",
  WARN: "amber",
  ERROR: "red",
};

function formatTime(iso) {
  if (!iso) return "";
  const t = iso.split("T")[1];
  return t || iso;
}

export default function AgentLedger({ trace, plan, highlightAgent }) {
  const [rawOpen, setRawOpen] = useState(false);
  const highlightedRowRef = useRef(null);

  useEffect(() => {
    if (highlightAgent && highlightedRowRef.current) {
      highlightedRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightAgent]);

  return (
    <section className="ledger">
      <div className="ledger-head">
        <div className="ledger-title">
          <Activity size={15} />
          <h2>Agent trace</h2>
        </div>
        <span className="ledger-sub">
          {highlightAgent ? `showing: ${highlightAgent}` : "live observability"}
        </span>
      </div>

      <div className="ledger-tape">
        {trace.length === 0 && (
          <div className="ledger-empty">No events yet — run the agent team to populate the tape.</div>
        )}
        {trace.map((ev, i) => {
          const isMatch = highlightAgent && ev.agent === highlightAgent;
          return (
            <div
              className={`ledger-row ${isMatch ? "ledger-row-highlighted" : ""}`}
              key={i}
              ref={isMatch ? highlightedRowRef : null}
            >
              <Circle size={7} className={`ledger-dot tone-${LEVEL_TONE[ev.level] || "neutral"}`} fill="currentColor" />
              <span className="ledger-time">{formatTime(ev.iso)}</span>
              <span className="ledger-agent">{ev.agent}</span>
              <span className="ledger-event">{ev.event}</span>
            </div>
          );
        })}
      </div>

      {plan && plan.length > 0 && (
        <div className="ledger-plan">
          <h3>Plan</h3>
          <ol>
            {plan.map((step, i) => (
              <li key={i}>
                <ChevronRight size={12} />
                <code>{step}</code>
              </li>
            ))}
          </ol>
        </div>
      )}

      {trace.length > 0 && (
        <button className="ledger-raw-toggle" onClick={() => setRawOpen((v) => !v)}>
          {rawOpen ? "Hide raw JSON trace" : "Show raw JSON trace"}
        </button>
      )}
      {rawOpen && (
        <pre className="ledger-raw">
          {trace.map((e) => JSON.stringify(e)).join("\n")}
        </pre>
      )}
    </section>
  );
}
