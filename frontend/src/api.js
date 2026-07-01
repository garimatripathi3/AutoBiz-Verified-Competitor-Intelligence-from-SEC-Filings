// Thin fetch wrapper around the FastAPI middleware that fronts the
// existing (unmodified) `autobiz` Python package.
const BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

async function handle(res) {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      /* ignore parse failure */
    }
    throw new Error(detail);
  }
  return res.json();
}

export async function getSettings() {
  return handle(await fetch(`${BASE}/api/settings`));
}

export async function listSessions() {
  return handle(await fetch(`${BASE}/api/sessions`));
}

export async function newSession() {
  return handle(await fetch(`${BASE}/api/sessions/new`));
}

export async function uploadFile(file) {
  const form = new FormData();
  form.append("file", file);
  return handle(await fetch(`${BASE}/api/upload`, { method: "POST", body: form }));
}

export async function searchCompetitors(query) {
  return handle(await fetch(`${BASE}/api/competitors/search?q=${encodeURIComponent(query)}`));
}

export async function runAgents({ query, competitor, filePath, sessionId }) {
  const form = new FormData();
  form.append("query", query);
  if (competitor) form.append("competitor", competitor);
  if (filePath) form.append("file_path", filePath);
  if (sessionId) form.append("session_id", sessionId);
  return handle(await fetch(`${BASE}/api/run`, { method: "POST", body: form }));
}

export async function getTrace(n = 40) {
  return handle(await fetch(`${BASE}/api/trace?n=${n}`));
}

export function reportDownloadUrl(path) {
  return `${BASE}/api/report/download?path=${encodeURIComponent(path)}`;
}
