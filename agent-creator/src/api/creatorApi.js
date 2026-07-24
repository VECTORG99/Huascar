import {
  validateCatalogResponse,
  validateWorkflowResponse,
  validateTutorialResponse,
  validateEvaluateResponse,
  validatePreviewResponse,
} from './validateResponse.js';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');
const API_KEY = import.meta.env.VITE_API_KEY || '';
const CREATOR_BASE = `${API_URL}/api/v1/creator`;

function authHeaders() {
  if (!API_KEY) return {};
  return { Authorization: `Bearer ${API_KEY}` };
}

async function request(path, options = {}) {
  const response = await fetch(`${CREATOR_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...options.headers },
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
  return Promise.all([request('/catalog'), request('/workflow'), request('/tutorial')]).then(
    ([catalog, workflow, tutorial]) => {
      // Validate response shapes (#288)
      const validCatalog = validateCatalogResponse(catalog);
      if (!validCatalog) throw new Error('Invalid catalog response from API');
      const validWorkflow = validateWorkflowResponse(workflow);
      if (!validWorkflow) throw new Error('Invalid workflow response from API');
      const validTutorial = validateTutorialResponse(tutorial);
      if (!validTutorial) throw new Error('Invalid tutorial response from API');
      return { catalog: validCatalog, workflow: validWorkflow, tutorial: validTutorial };
    },
  );
}

export function evaluateCreator(answers, versions) {
  return request('/evaluate', {
    method: 'POST',
    body: JSON.stringify({
      answers,
      workflowVersion: versions.workflowVersion,
      catalogVersion: versions.catalogVersion,
    }),
  }).then((data) => {
    const valid = validateEvaluateResponse(data);
    if (!valid) throw new Error('Invalid evaluate response from API');
    return valid;
  });
}

export function previewCreator(answers, versions) {
  return request('/preview', {
    method: 'POST',
    body: JSON.stringify({
      answers,
      workflowVersion: versions.workflowVersion,
      catalogVersion: versions.catalogVersion,
    }),
  }).then((data) => {
    const valid = validatePreviewResponse(data);
    if (!valid) throw new Error('Invalid preview response from API');
    return valid;
  });
}

export { API_URL };
