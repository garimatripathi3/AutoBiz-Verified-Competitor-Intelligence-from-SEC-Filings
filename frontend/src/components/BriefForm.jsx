import { useRef, useState } from "react";
import { FileUp, FileSpreadsheet, FileText, X, Play, Loader2 } from "lucide-react";
import CompetitorPicker from "./CompetitorPicker";

const DEFAULT_QUERY =
  "Compare our quarterly revenue and margins against our main competitor.";

export default function BriefForm({ onRun, running, uploadedFile, onUpload, onClearFile, uploadError }) {
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [competitor, setCompetitor] = useState("Acme Corp");
  const fileRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  function handleFiles(files) {
    const file = files?.[0];
    if (!file) return;
    onUpload(file);
  }

  function submit(e) {
    e.preventDefault();
    onRun({ query, competitor: competitor.trim() || null });
  }

  const fileIcon = uploadedFile?.filename?.toLowerCase().endsWith(".csv") ? (
    <FileSpreadsheet size={16} />
  ) : (
    <FileText size={16} />
  );

  return (
    <form className="brief-form" onSubmit={submit}>
      <div className="form-field">
        <label htmlFor="query">
          <span className="field-label-text">Business question</span>
          <span className="field-label-rule" />
        </label>
        <textarea
          id="query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={4}
          placeholder="What do you want the agent team to investigate?"
        />
      </div>

      <div className="form-row">
        <div className="form-field">
          <label htmlFor="competitor">
            <span className="field-label-text">Competitor to research</span>
            <span className="field-label-rule" />
          </label>
          <CompetitorPicker value={competitor} onChange={setCompetitor} />
        </div>
      </div>

      <div className="form-field">
        <label>
          <span className="field-label-text">Financial document</span>
          <span className="field-label-rule" />
        </label>

        {!uploadedFile ? (
          <div
            className={`dropzone ${dragOver ? "drag" : ""}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFiles(e.dataTransfer.files);
            }}
          >
            <FileUp size={20} />
            <div>
              <strong>Upload a PDF or CSV</strong>
              <span>Drop a file here or click to browse</span>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.csv"
              hidden
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>
        ) : (
          <div className="file-chip">
            {fileIcon}
            <span className="file-chip-name">{uploadedFile.filename}</span>
            <span className="file-chip-size">{Math.ceil(uploadedFile.size / 1024)} KB</span>
            <button type="button" className="file-chip-remove" onClick={onClearFile} aria-label="Remove file">
              <X size={14} />
            </button>
          </div>
        )}
        {uploadError && <p className="field-error">{uploadError}</p>}
      </div>

      <button className="run-btn" type="submit" disabled={running || !query.trim()}>
        {running ? <Loader2 size={16} className="spin" /> : <Play size={15} />}
        {running ? "Agents working…" : "Run agent team"}
      </button>
    </form>
  );
}
