import { LineChart, Search, NotebookPen, ArrowRight } from "lucide-react";

const STEPS = [
  { icon: <LineChart size={17} />, label: "Financial Analyst", desc: "Parses your PDF or CSV and extracts the figures that matter." },
  { icon: <Search size={17} />, label: "Competitor Monitor", desc: "Scans the web and RSS for what your competitor is doing." },
  { icon: <NotebookPen size={17} />, label: "Report Writer", desc: "Synthesises both into one board-ready brief." },
];

export default function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-kicker">A team of agents, not a single prompt</div>
      <h2 className="empty-title">
        Three specialists, one
        <br />
        coordinated brief.
      </h2>
      <p className="empty-copy">
        Configure your request on the left. The orchestrator sanitises the
        input, recalls relevant memory, runs the pipeline below, then hands
        back a downloadable executive brief with a full trace of every step.
      </p>

      <div className="empty-steps">
        {STEPS.map((s, i) => (
          <div className="empty-step" key={s.label}>
            <div className="empty-step-icon">{s.icon}</div>
            <div className="empty-step-text">
              <strong>{s.label}</strong>
              <span>{s.desc}</span>
            </div>
            {i < STEPS.length - 1 && <ArrowRight size={14} className="empty-step-arrow" />}
          </div>
        ))}
      </div>
    </div>
  );
}
