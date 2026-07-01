import { ChevronDown, Plus, Radio, MoonStar } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export default function Header({
  settings,
  sessions,
  activeSession,
  onSelectSession,
  onNewSession,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const isLive = settings?.live;

  return (
    <header className="hdr">
      <div className="hdr-mark">
        <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
          <rect x="1" y="1" width="28" height="28" rx="6" stroke="var(--ink)" strokeWidth="1.4" />
          <path d="M7 21.5 L12.5 11 L16.5 17 L23 8" stroke="var(--copper)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="23" cy="8" r="1.8" fill="var(--copper)" />
        </svg>
        <div className="hdr-titleblock">
          <h1 className="hdr-title">AutoBiz</h1>
          <span className="hdr-kicker">Verified Competitor Intelligence</span>
        </div>
      </div>

      <div className="hdr-right">
        <div className={`provider-pill ${isLive ? "live" : "mock"}`} title={settings?.summary}>
          {isLive ? <Radio size={13} /> : <MoonStar size={13} />}
          <span>{isLive ? "Gemini live" : "Offline mock"}</span>
        </div>

        <div className="session-picker" ref={ref}>
          <button className="session-trigger" onClick={() => setOpen((v) => !v)}>
            <span className="session-trigger-label">Session</span>
            <span className="session-trigger-value">{activeSession || "—"}</span>
            <ChevronDown size={14} />
          </button>
          {open && (
            <div className="session-menu">
              <button
                className="session-menu-item new"
                onClick={() => {
                  onNewSession();
                  setOpen(false);
                }}
              >
                <Plus size={14} /> New session
              </button>
              {sessions.length > 0 && <div className="session-menu-divider" />}
              {sessions.map((s) => (
                <button
                  key={s}
                  className={`session-menu-item ${s === activeSession ? "active" : ""}`}
                  onClick={() => {
                    onSelectSession(s);
                    setOpen(false);
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
