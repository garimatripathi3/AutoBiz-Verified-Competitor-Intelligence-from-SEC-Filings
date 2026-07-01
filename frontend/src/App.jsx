import { useEffect, useState, useCallback } from "react";
import { AlertTriangle } from "lucide-react";
import Header from "./components/Header";
import BriefForm from "./components/BriefForm";
import PlanStrip from "./components/PlanStrip";
import ReportPanel from "./components/ReportPanel";
import AgentLedger from "./components/AgentLedger";
import EmptyState from "./components/EmptyState";
import {
  getSettings,
  listSessions,
  newSession,
  uploadFile,
  runAgents,
  getTrace,
} from "./api";
import "./app.css";

export default function App() {
  const [settings, setSettings] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);

  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState(null);
  const [result, setResult] = useState(null);
  const [trace, setTrace] = useState([]);
  const [highlightAgent, setHighlightAgent] = useState(null);

  const [bootError, setBootError] = useState(null);

  // ---- initial load: settings + sessions + a fresh session id -----------
  useEffect(() => {
    (async () => {
      try {
        const [s, sess, ns] = await Promise.all([
          getSettings(),
          listSessions(),
          newSession(),
        ]);
        setSettings(s);
        setSessions(sess.sessions || []);
        setActiveSession(ns.session_id);
      } catch (err) {
        setBootError(
          "Could not reach the AutoBiz API. Make sure the FastAPI middleware " +
            "is running (uvicorn server.main:app) on the configured host."
        );
      }
    })();
  }, []);

  const handleSelectSession = useCallback((id) => {
    setActiveSession(id);
    setResult(null);
    setTrace([]);
    setHighlightAgent(null);
  }, []);

  const handleNewSession = useCallback(async () => {
    const ns = await newSession();
    setActiveSession(ns.session_id);
    setResult(null);
    setTrace([]);
    setHighlightAgent(null);
  }, []);

  const handleUpload = useCallback(async (file) => {
    setUploadError(null);
    try {
      const res = await uploadFile(file);
      setUploadedFile(res);
    } catch (err) {
      setUploadError(err.message || "Upload failed");
    }
  }, []);

  const handleClearFile = useCallback(() => {
    setUploadedFile(null);
    setUploadError(null);
  }, []);

  const handleRun = useCallback(
    async ({ query, competitor }) => {
      setRunning(true);
      setRunError(null);
      setHighlightAgent(null);
      try {
        const res = await runAgents({
          query,
          competitor,
          filePath: uploadedFile?.file_path,
          sessionId: activeSession,
        });
        setResult(res);
        const t = await getTrace(60);
        setTrace(t.trace || []);
        const sess = await listSessions();
        setSessions(sess.sessions || []);
      } catch (err) {
        setRunError(err.message || "The agent pipeline failed.");
      } finally {
        setRunning(false);
      }
    },
    [uploadedFile, activeSession]
  );

  return (
    <div className="shell">
      <Header
        settings={settings}
        sessions={sessions}
        activeSession={activeSession}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
      />

      {bootError && (
        <div className="banner banner-error">
          <AlertTriangle size={15} />
          <span>{bootError}</span>
        </div>
      )}

      <main className="workbench">
        <aside className="workbench-left">
          <p className="intro-copy">
            A <strong>Financial Analyst</strong>, a <strong>Competitor Monitor</strong>,
            and a <strong>Report Writer</strong>, coordinated by an orchestrator,
            turn your documents and a competitor name into a board-ready brief.
          </p>
          <BriefForm
            onRun={handleRun}
            running={running}
            uploadedFile={uploadedFile}
            onUpload={handleUpload}
            onClearFile={handleClearFile}
            uploadError={uploadError}
          />
          {runError && (
            <div className="banner banner-error inline">
              <AlertTriangle size={15} />
              <span>{runError}</span>
            </div>
          )}
        </aside>

        <section className="workbench-right">
          {result ? (
            <>
              <PlanStrip result={result} />
              <div className="result-columns">
                <ReportPanel result={result} onSectionClick={setHighlightAgent} />
                <AgentLedger trace={trace} plan={result.plan} highlightAgent={highlightAgent} />
              </div>
            </>
          ) : (
            <EmptyState />
          )}
        </section>
      </main>
    </div>
  );
}
