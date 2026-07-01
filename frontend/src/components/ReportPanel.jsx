import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Download, FileText, MousePointerClick } from "lucide-react";
import { reportDownloadUrl } from "../api";

// Maps a report's markdown section heading to the agent whose trace events
// produced that section. This is intentionally a small, explicit lookup
// (not inferred) since the section <-> agent relationship is fixed by
// pipeline.py's STATE_FINANCIAL/STATE_COMPETITOR/STATE_REPORT structure —
// guessing would be both unnecessary and less reliable than just stating it.
const SECTION_TO_AGENT = {
  "financial position": "FinancialAnalyst",
  "competitive position": "CompetitorMonitor",
  "risk flags": "RiskFlaggingAnalyst",
  "summary": "ReportWriter",
  "recommended actions": "ReportWriter",
};

function splitIntoSections(markdown) {
  // Split on markdown ## headings, keeping the heading with its body so
  // each chunk can be wrapped in its own clickable region.
  const lines = (markdown || "").split("\n");
  const sections = [];
  let current = { heading: null, lines: [] };
  for (const line of lines) {
    const match = line.match(/^##\s+(.+)/);
    if (match) {
      if (current.heading || current.lines.length) sections.push(current);
      current = { heading: match[1].trim(), lines: [line] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.heading || current.lines.length) sections.push(current);
  return sections;
}

export default function ReportPanel({ result, onSectionClick }) {
  const sections = useMemo(() => splitIntoSections(result?.report_md), [result?.report_md]);

  if (!result) return null;

  function handleSectionClick(heading) {
    if (!heading || !onSectionClick) return;
    const agent = SECTION_TO_AGENT[heading.toLowerCase()];
    if (agent) onSectionClick(agent);
  }

  return (
    <section className="report-panel">
      <div className="report-panel-head">
        <div className="report-panel-title">
          <FileText size={16} />
          <h2>Executive brief</h2>
        </div>
        <a
          className="download-btn"
          href={reportDownloadUrl(result.report_path)}
          download
        >
          <Download size={14} />
          Download .md
        </a>
      </div>

      {onSectionClick && (
        <div className="report-trace-hint">
          <MousePointerClick size={13} />
          Click a section heading to see which agent produced it in the trace panel
        </div>
      )}

      <div className="report-body">
        {sections.map((section, i) => {
          const agent = section.heading ? SECTION_TO_AGENT[section.heading.toLowerCase()] : null;
          const clickable = Boolean(agent && onSectionClick);
          return (
            <div
              key={i}
              className={`report-section ${clickable ? "report-section-clickable" : ""}`}
              onClick={clickable ? () => handleSectionClick(section.heading) : undefined}
              title={clickable ? `Sourced from: ${agent}` : undefined}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.lines.join("\n")}</ReactMarkdown>
            </div>
          );
        })}
      </div>
    </section>
  );
}

