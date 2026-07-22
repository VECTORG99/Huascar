const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3001").replace(/\/$/, "");
const CREATOR_BASE = `${API_URL}/api/v1/creator`;

async function request(path, options = {}) {
  const response = await fetch(`${CREATOR_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.title || data?.error || `El backend respondió con código ${response.status}.`;
    const error = new Error(message);
    error.status = response.status;
    error.issues = data?.issues || [];
    throw error;
  }
  return data;
}

export function loadCreatorDefinition() {
  return Promise.all([
    request("/catalog"),
    request("/workflow"),
    request("/tutorial"),
  ]).then(([catalog, workflow, tutorial]) => ({ catalog, workflow, tutorial }));
}

export function evaluateCreator(answers, versions) {
  return request("/evaluate", {
    method: "POST",
    body: JSON.stringify({
      answers,
      workflowVersion: versions.workflowVersion,
      catalogVersion: versions.catalogVersion,
    }),
  });
}

export function previewCreator(answers, versions) {
  return request("/preview", {
    method: "POST",
    body: JSON.stringify({
      answers,
      workflowVersion: versions.workflowVersion,
      catalogVersion: versions.catalogVersion,
    }),
  });
}

export { API_URL };
