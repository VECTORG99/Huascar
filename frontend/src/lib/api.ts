import type { AgentConfig, AgentRole, HistoryRecord } from "@/types/agent";
import type { CreatorAnswers, CreatorCatalog, CreatorEvaluation, CreatorWorkflow, GeneratedAgentBundle, RegisteredAgent } from "@/types/creator";

export const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://huascar.onrender.com";

export async function getRoles(): Promise<AgentRole[] | null> {
  const res = await fetch(`${apiUrl}/api/roles`);
  if (!res.ok) return null;
  const data = await res.json();
  return Array.isArray(data?.roles) ? data.roles : null;
}

export async function getHistory(): Promise<HistoryRecord[]> {
  const res = await fetch(`${apiUrl}/api/history`);
  const data = await res.json();
  return data.history || [];
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${apiUrl}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = data?.error;
    const message = typeof error === "object" && error ? error.message : error;
    const issues = Array.isArray(data?.issues) ? ` ${data.issues.map((issue: { message?: string }) => issue.message).filter(Boolean).join(" ")}` : "";
    throw new Error(`${data?.title || message || data?.message || `Backend error ${res.status}`}${issues}`);
  }
  return data as T;
}

export function getCreatorCatalog() {
  return request<CreatorCatalog>("/api/v1/creator/catalog");
}

export function getCreatorWorkflow() {
  return request<CreatorWorkflow>("/api/v1/creator/workflow");
}

export function evaluateCreator(answers: CreatorAnswers, workflow: CreatorWorkflow) {
  return request<CreatorEvaluation>("/api/v1/creator/evaluate", {
    method: "POST",
    body: JSON.stringify({ answers, workflowVersion: workflow.version, catalogVersion: workflow.catalogVersion })
  });
}

export function generateCreator(answers: CreatorAnswers, workflow: CreatorWorkflow) {
  return request<GeneratedAgentBundle>("/api/v1/creator/generate", {
    method: "POST",
    body: JSON.stringify({ answers, workflowVersion: workflow.version, catalogVersion: workflow.catalogVersion })
  });
}

export function registerAgent(name: string, config: AgentConfig) {
  return request<RegisteredAgent>("/api/agents", {
    method: "POST",
    body: JSON.stringify({ name, config })
  });
}
