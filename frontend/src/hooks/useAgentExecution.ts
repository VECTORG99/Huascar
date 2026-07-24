import { useEffect, useRef, useState } from "react";

import { apiUrl, authHeaders } from "@/lib/api";
import type { AgentConfig, ExecutionResponse } from "@/types/agent";

const initialLogs = [
  "[HuascarEngine] Sistema inicializado.",
  "[HuascarEngine] Esperando instrucciones..."
];

const limitLogs = (logs: string[]) => logs.slice(-500);

export function useAgentExecution(
  role: string,
  task: string,
  agentConfig: AgentConfig | null,
  onComplete: () => void
) {
  const [logs, setLogs] = useState<string[]>(initialLogs);
  const [jsonResponse, setJsonResponse] = useState<ExecutionResponse | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const lastSessionKey = useRef(`${role}:${JSON.stringify(agentConfig)}`);

  useEffect(() => {
    const key = `${role}:${JSON.stringify(agentConfig)}`;
    if (lastSessionKey.current !== key) setSessionId(null);
    lastSessionKey.current = key;
  }, [role, agentConfig]);

  const addLogs = (...nextLogs: string[]) => setLogs(prev => limitLogs([...prev, ...nextLogs]));

  const execute = async () => {
    if (!task.trim()) return;

    setLoading(true);
    setJsonResponse(null);
    addLogs(
      `[HuascarEngine] Desplegando agente con rol: ${role}...`,
      `[HOOK] Validando tarea: "${task}"...`
    );

    try {
      const body: Record<string, unknown> = { task, role };
      if (sessionId) body.session_id = sessionId;
      if (agentConfig) {
        body.config = agentConfig;
        if (agentConfig.steering?.system_prompt) body.system_prompt = agentConfig.steering.system_prompt;
      }
      const res = await fetch(`${apiUrl}/api/agent/execute/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body)
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let data: ExecutionResponse | null = null;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() || "";
        for (const chunk of chunks) {
          const event = chunk.match(/^event: (.+)$/m)?.[1];
          const raw = chunk.match(/^data: (.+)$/m)?.[1];
          if (!event || !raw) continue;
          const payload = JSON.parse(raw);
          if (event === "start") {
            setSessionId(payload.session_id);
            addLogs(`[HuascarEngine] Sesión iniciada: ${payload.session_id}`);
          }
          if (event === "complete") data = payload;
          if (event === "error") throw new Error(payload.error?.message || "stream error");
        }
      }
      if (!data) throw new Error("stream ended without result");
      setSessionId(data.session_id || null);
      addLogs(data.status === "success"
        ? "[HuascarEngine] Ejecución completada."
        : "[HuascarEngine] Ejecución bloqueada por hook."
      );
      setJsonResponse(data);
      onComplete();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "unknown error";
      addLogs(`[ERROR] No se pudo conectar con el backend: ${message}`);
      setJsonResponse({ status: "error", agent_role: role, response: message });
    } finally {
      setLoading(false);
    }
  };

  return { logs, jsonResponse, loading, execute };
}
