import type {
  ApiProblem,
  Catalog,
  CreatorAnswers,
  DecisionEvaluation,
  EvaluateRequest,
  ExecuteRequest,
  ExecuteResponse,
  GeneratedAgentBundle,
  HealthResponse,
  HistoryRecord,
  PreviewRequest,
  Tutorial,
  Workflow,
} from "@huascar/types";

// ─── Config ───────────────────────────────────────────────────────────────────

const API_URL = (
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_API_URL
    : process.env.NEXT_PUBLIC_API_URL
) || "http://localhost:3001";

const CREATOR_BASE = `${API_URL}/api/v1/creator`;
const RUNTIME_BASE = `${API_URL}/api`;

// ─── Error ────────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  readonly status: number;
  readonly problem: ApiProblem | null;

  constructor(status: number, problem: ApiProblem | null, message?: string) {
    super(message || problem?.title || `Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.problem = problem;
  }
}

// ─── Fetch wrapper ────────────────────────────────────────────────────────────

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(response.status, data as ApiProblem | null);
  }

  return data as T;
}

// ─── Creator API ──────────────────────────────────────────────────────────────

export const creator = {
  getCatalog: () => request<Catalog>(`${CREATOR_BASE}/catalog`),

  getWorkflow: () => request<Workflow>(`${CREATOR_BASE}/workflow`),

  getTutorial: () => request<Tutorial>(`${CREATOR_BASE}/tutorial`),

  evaluate: (answers: CreatorAnswers, versions: { workflowVersion: string; catalogVersion: string }) =>
    request<DecisionEvaluation>(`${CREATOR_BASE}/evaluate`, {
      method: "POST",
      body: JSON.stringify({
        answers,
        workflowVersion: versions.workflowVersion,
        catalogVersion: versions.catalogVersion,
      } satisfies EvaluateRequest),
    }),

  preview: (answers: CreatorAnswers, versions: { workflowVersion: string; catalogVersion: string }) =>
    request<GeneratedAgentBundle>(`${CREATOR_BASE}/preview`, {
      method: "POST",
      body: JSON.stringify({
        answers,
        workflowVersion: versions.workflowVersion,
        catalogVersion: versions.catalogVersion,
      } satisfies PreviewRequest),
    }),
};

// ─── Runtime API ──────────────────────────────────────────────────────────────

export const runtime = {
  health: () => request<HealthResponse>(`${RUNTIME_BASE}/health`),

  execute: (payload: ExecuteRequest) =>
    request<ExecuteResponse>(`${RUNTIME_BASE}/agent/execute`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  history: () =>
    request<{ history: HistoryRecord[] }>(`${RUNTIME_BASE}/history`).then(
      (r) => r.history
    ),
};
