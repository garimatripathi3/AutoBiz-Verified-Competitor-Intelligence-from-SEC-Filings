import { useState, useRef, useEffect, useCallback } from "react";
import { Building2, Check, Globe, Loader2 } from "lucide-react";
import { searchCompetitors } from "../api";

const DEBOUNCE_MS = 300;

/**
 * Competitor name field with live disambiguation.
 *
 * Why this exists: a plain text box lets the user type "Acme" and have the
 * backend silently guess which "Acme" they meant (see CompetitorMonitor /
 * sec_filings.resolve_cik), which previously produced reports about the
 * wrong company entirely. This component surfaces every plausible match —
 * SEC-registered public companies first, web-search hits for private
 * companies as a fallback — so the user picks the right one before running
 * the pipeline, instead of the pipeline guessing.
 */
export default function CompetitorPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [secMatches, setSecMatches] = useState([]);
  const [webMatches, setWebMatches] = useState([]);
  const [highlighted, setHighlighted] = useState(-1);
  const [error, setError] = useState(null);

  const debounceRef = useRef(null);
  const containerRef = useRef(null);
  const requestIdRef = useRef(0);

  const runSearch = useCallback((query) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSecMatches([]);
      setWebMatches([]);
      setLoading(false);
      setError(null);
      return;
    }
    const thisRequestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    searchCompetitors(trimmed)
      .then((res) => {
        if (thisRequestId !== requestIdRef.current) return; // a newer keystroke superseded this request
        setSecMatches(res.sec_matches || []);
        setWebMatches(res.web_matches || []);
        setHighlighted(-1);
      })
      .catch((err) => {
        if (thisRequestId !== requestIdRef.current) return;
        setError(err.message || "Search failed");
        setSecMatches([]);
        setWebMatches([]);
      })
      .finally(() => {
        if (thisRequestId === requestIdRef.current) setLoading(false);
      });
  }, []);

  function handleInputChange(e) {
    const next = e.target.value;
    onChange(next);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(next), DEBOUNCE_MS);
  }

  function pick(name) {
    onChange(name);
    setOpen(false);
    setSecMatches([]);
    setWebMatches([]);
  }

  const allOptions = [...secMatches.map((m) => ({ ...m, kind: "sec" })), ...webMatches.map((m) => ({ ...m, kind: "web" }))];

  function handleKeyDown(e) {
    if (!open || allOptions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((i) => Math.min(i + 1, allOptions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && highlighted >= 0) {
      e.preventDefault();
      const opt = allOptions[highlighted];
      pick(opt.kind === "sec" ? opt.title : opt.title);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  // Close the dropdown on outside click.
  useEffect(() => {
    function onDocClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => () => debounceRef.current && clearTimeout(debounceRef.current), []);

  const showDropdown = open && (loading || error || allOptions.length > 0 || value.trim().length >= 2);

  return (
    <div className="competitor-picker" ref={containerRef}>
      <div className="input-with-icon">
        <Building2 size={15} />
        <input
          id="competitor"
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Leave blank to skip"
          autoComplete="off"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="competitor-listbox"
        />
        {loading && <Loader2 size={14} className="spin" />}
      </div>

      {showDropdown && (
        <div className="competitor-dropdown" id="competitor-listbox" role="listbox">
          {error && <div className="competitor-dropdown-msg competitor-dropdown-error">{error}</div>}

          {!error && !loading && allOptions.length === 0 && value.trim().length >= 2 && (
            <div className="competitor-dropdown-msg">
              No matches found. You can still type a name and run as-is.
            </div>
          )}

          {secMatches.length > 0 && (
            <div className="competitor-dropdown-group">
              <div className="competitor-dropdown-label">SEC-registered public companies</div>
              {secMatches.map((m, i) => (
                <button
                  type="button"
                  key={m.cik}
                  role="option"
                  aria-selected={highlighted === i}
                  className={`competitor-option ${highlighted === i ? "highlighted" : ""}`}
                  onMouseEnter={() => setHighlighted(i)}
                  onClick={() => pick(m.title)}
                >
                  <Check size={13} className="competitor-option-icon sec" />
                  <span className="competitor-option-title">{m.title}</span>
                  {m.ticker && <span className="competitor-option-meta">{m.ticker}</span>}
                </button>
              ))}
            </div>
          )}

          {webMatches.length > 0 && (
            <div className="competitor-dropdown-group">
              <div className="competitor-dropdown-label">
                Found via web search — not SEC-registered
              </div>
              {webMatches.map((m, i) => {
                const idx = secMatches.length + i;
                return (
                  <button
                    type="button"
                    key={m.url || m.title}
                    role="option"
                    aria-selected={highlighted === idx}
                    className={`competitor-option ${highlighted === idx ? "highlighted" : ""}`}
                    onMouseEnter={() => setHighlighted(idx)}
                    onClick={() => pick(m.title)}
                  >
                    <Globe size={13} className="competitor-option-icon web" />
                    <span className="competitor-option-title">{m.title}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
