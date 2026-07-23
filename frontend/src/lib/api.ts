import type { AgentRole, HistoryRecord } from "@/types/agent";

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
