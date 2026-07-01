import { Users, ShieldCheck, ShieldAlert, BrainCircuit } from "lucide-react";

export default function PlanStrip({ result }) {
  if (!result) return null;

  const { plan, security, recalled_count } = result;

  const items = [
    {
      icon: <Users size={15} />,
      label: "Agents run",
      value: plan?.length ?? 0,
      tone: "neutral",
    },
    {
      icon: security.redactions > 0 ? <ShieldAlert size={15} /> : <ShieldCheck size={15} />,
      label: "PII redacted",
      value: security.redactions,
      tone: security.redactions > 0 ? "amber" : "green",
    },
    {
      icon: security.injection_flagged ? <ShieldAlert size={15} /> : <ShieldCheck size={15} />,
      label: "Injection flagged",
      value: security.injection_flagged ? "Yes" : "No",
      tone: security.injection_flagged ? "red" : "green",
    },
    {
      icon: <BrainCircuit size={15} />,
      label: "Memory recalled",
      value: recalled_count ?? 0,
      tone: "neutral",
    },
  ];

  return (
    <div className="plan-strip">
      {items.map((it) => (
        <div className={`plan-metric tone-${it.tone}`} key={it.label}>
          <div className="plan-metric-icon">{it.icon}</div>
          <div>
            <div className="plan-metric-value">{it.value}</div>
            <div className="plan-metric-label">{it.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
