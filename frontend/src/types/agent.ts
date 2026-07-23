export interface ExecutionResponse {
  status: string;
  agent_role: string;
  response: string;
  error?: string;
  session_id?: string;
}

export interface HistoryRecord {
  id: number;
  role: string;
  task: string;
  response: string;
  created_at: string;
}

export interface AgentConfig {
  steering?: {
    role?: string;
    system_prompt?: string;
    roles?: Record<string, { name?: string; prompt?: string; system_prompt?: string }> | { id: string; prompt?: string; system_prompt?: string }[];
  };
  rag?: { sources?: unknown[] };
  mcps?: string[];
  hooks?: string[];
  tools?: string[];
  knowledge?: unknown[];
}

export interface AgentRole {
  id: string;
  name: string;
}

export type Tab = "terminal" | "history";
