"use client";

import { useRef, useState, useEffect, useCallback } from "react";

interface ExecutionResponse {
  status: string;
  agent_role: string;
  response: string;
  error?: string;
  session_id?: string;
}

interface HistoryRecord {
  id: number;
  role: string;
  task: string;
  response: string;
  created_at: string;
}

interface AgentConfig {
  steering?: { role?: string; system_prompt?: string };
  rag?: { sources?: unknown[] };
  mcps?: string[];
  hooks?: string[];
  tools?: string[];
  knowledge?: unknown[];
}

interface AgentRole {
  id: string;
  name: string;
}

type Tab = "terminal" | "history";

export default function Home() {
  const [role, setRole] = useState("PR_REVIEWER");
  const [roles, setRoles] = useState<AgentRole[]>([
    { id: "PR_REVIEWER", name: "PR_REVIEWER" },
    { id: "SCAFFOLDER", name: "SCAFFOLDER" }
  ]);
  const [task, setTask] = useState("");
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null);
  const [logs, setLogs] = useState<string[]>([
    "[HuascarEngine] Sistema inicializado.",
    "[HuascarEngine] Esperando instrucciones..."
  ]);
  const [jsonResponse, setJsonResponse] = useState<ExecutionResponse | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("terminal");
  const logEndRef = useRef<HTMLDivElement>(null);
  const lastSessionKey = useRef(`${role}:${JSON.stringify(agentConfig)}`);

  // History state
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    const key = `${role}:${JSON.stringify(agentConfig)}`;
    if (lastSessionKey.current !== key) setSessionId(null);
    lastSessionKey.current = key;
  }, [role, agentConfig]);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://huascar.onrender.com';
    try {
      const res = await fetch(`${apiUrl}/api/history`);
      const data = await res.json();
      setHistory(data.history || []);
    } catch {
      // Silently fail — history is non-critical
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://huascar.onrender.com';
    fetch(`${apiUrl}/api/roles`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (Array.isArray(data?.roles) && data.roles.length > 0) {
          setRoles(data.roles);
          setRole(current =>
            data.roles.some((agentRole: AgentRole) => agentRole.id === current) ? current : data.roles[0].id
          );
        }
      })
      .catch(() => {});
  }, []);

  // Read role/task/config from URL query params (e.g. from Agent Creator redirect)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roleParam = params.get('role');
    const taskParam = params.get('task');
    const configParam = params.get('config');
    if (roleParam) setRole(roleParam);
    if (taskParam) setTask(taskParam);
    if (configParam) {
      try { setAgentConfig(JSON.parse(configParam)); }
      catch { /* ignore malformed config */ }
    }
    // Clean URL params after reading to avoid stale state on re-execute
    if (roleParam || taskParam || configParam) {
      window.history.replaceState({}, '', '/');
    }
  }, []);

  // Fetch history on mount
  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleDeploy = async () => {
    if (!task.trim()) return;

    setLoading(true);
    setJsonResponse(null);
    setLogs(prev => [...prev,
      `[HuascarEngine] Desplegando agente con rol: ${role}...`,
      `[HOOK] Validando tarea: "${task}"...`
    ]);

    try {
      const body: Record<string, unknown> = { task, role };
      if (sessionId) body.session_id = sessionId;
      if (agentConfig) {
        body.config = agentConfig;
        // Transform Agent Creator format to backend format if needed
        if (agentConfig.steering?.system_prompt) body.system_prompt = agentConfig.steering.system_prompt;
      }
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://huascar.onrender.com';
      const res = await fetch(`${apiUrl}/api/agent/execute/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
            setLogs(prev => [...prev, `[HuascarEngine] Sesión iniciada: ${payload.session_id}`]);
          }
          if (event === "complete") data = payload;
          if (event === "error") throw new Error(payload.error?.message || "stream error");
        }
      }
      if (!data) throw new Error("stream ended without result");
      setSessionId(data.session_id || null);
      const msg = data.status === "success"
        ? "[HuascarEngine] Ejecución completada."
        : "[HuascarEngine] Ejecución bloqueada por hook.";
      setLogs(prev => [...prev, msg]);
      setJsonResponse(data);
      fetchHistory(); // refresh after execution
    } catch (err: any) {
      setLogs(prev => [...prev, `[ERROR] No se pudo conectar con el backend: ${err.message}`]);
      setJsonResponse({ status: "error", agent_role: role, response: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleReexecute = (record: HistoryRecord) => {
    setRole(record.role);
    setTask(record.task);
    setActiveTab("terminal");
    setExpandedId(null);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("es-ES", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  };

  const tabClass = (tab: Tab) =>
    `px-4 py-2 text-sm font-medium rounded-t-lg transition-colors cursor-pointer ${
      activeTab === tab
        ? "bg-black text-emerald-400 border-b-2 border-emerald-500"
        : "text-zinc-500 hover:text-zinc-300"
    }`;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 p-8 font-sans">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-emerald-400 tracking-tight">Huascar Builder</h1>
        <p className="text-zinc-400">Agent Deployment Dashboard</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Config form */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 flex flex-col gap-6">
          <h2 className="text-xl font-semibold text-zinc-100">Configuración del Agente</h2>

          <div className="flex flex-col gap-2">
            <label htmlFor="role" className="text-sm font-medium text-zinc-300">Rol del Agente</label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="bg-zinc-950 border border-zinc-700 rounded-md p-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {roles.map(agentRole => (
                <option key={agentRole.id} value={agentRole.id}>{agentRole.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2 flex-1">
            <label htmlFor="task" className="text-sm font-medium text-zinc-300">Tarea a Ejecutar</label>
            <textarea
              id="task"
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="Describe la tarea que el agente debe realizar..."
              className="bg-zinc-950 border border-zinc-700 rounded-md p-3 text-zinc-100 h-48 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            onClick={handleDeploy}
            disabled={loading || !task.trim()}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-md transition-colors mt-auto"
          >
            {loading ? "Ejecutando..." : "Desplegar y Ejecutar"}
          </button>
        </div>

        {/* Right: Terminal + History tabs */}
        <div className="flex flex-col gap-6">
          {/* Tab bar */}
          <div className="flex gap-1 border-b border-zinc-800">
            <div className={tabClass("terminal")} onClick={() => setActiveTab("terminal")}>
              Terminal
            </div>
            <div className={tabClass("history")} onClick={() => setActiveTab("history")}>
              Historial
              {history.length > 0 && (
                <span className="ml-2 text-xs bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full">
                  {history.length}
                </span>
              )}
            </div>
          </div>

          {/* Terminal tab */}
          {activeTab === "terminal" && (
            <>
              <div className="bg-black border border-zinc-800 rounded-lg p-4 flex-1 font-mono text-sm overflow-hidden flex flex-col min-h-[300px]">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-zinc-800">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="ml-2 text-zinc-500 text-xs">terminal - bash</span>
                </div>
                <div className="flex-1 overflow-y-auto space-y-1">
                  {logs.map((log, i) => (
                    <div key={i} className={`${log.includes('[HOOK]') ? 'text-blue-400' : log.includes('completada') ? 'text-green-400' : log.includes('[ERROR]') ? 'text-red-400' : 'text-zinc-300'}`}>
                      <span className="text-zinc-600 mr-2">{'>'}</span>{log}
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              </div>

              {jsonResponse && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-zinc-400 mb-2">Respuesta JSON</h3>
                  <pre className="bg-black p-3 rounded-md overflow-x-auto text-xs text-emerald-300 font-mono">
                    {JSON.stringify(jsonResponse, null, 2)}
                  </pre>
                </div>
              )}
            </>
          )}

          {/* History tab */}
          {activeTab === "history" && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 min-h-[300px] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-zinc-400">Ejecuciones anteriores</h3>
                <button
                  onClick={fetchHistory}
                  disabled={historyLoading}
                  className="text-xs text-emerald-500 hover:text-emerald-400 disabled:text-zinc-600"
                >
                  {historyLoading ? "Cargando..." : "Refrescar"}
                </button>
              </div>

              {history.length === 0 && !historyLoading && (
                <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
                  No hay ejecuciones registradas
                </div>
              )}

              <div className="flex-1 overflow-y-auto space-y-2">
                {history.map((record) => {
                  const isOpen = expandedId === record.id;
                  return (
                    <div key={record.id} className="border border-zinc-800 rounded-md">
                      <button
                        onClick={() => setExpandedId(isOpen ? null : record.id)}
                        className="w-full flex items-center justify-between p-3 text-left hover:bg-zinc-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-2 h-2 rounded-full shrink-0 bg-emerald-500" />
                          <span className="text-sm font-medium text-zinc-200 truncate">{record.role}</span>
                        </div>
                        <span className="text-xs text-zinc-500 shrink-0 ml-3">{formatDate(record.created_at)}</span>
                      </button>

                      {isOpen && (
                        <div className="px-3 pb-3 space-y-3 border-t border-zinc-800 pt-3">
                          <div>
                            <span className="text-xs text-zinc-500 block mb-1">Tarea</span>
                            <p className="text-sm text-zinc-300 whitespace-pre-wrap line-clamp-3">{record.task}</p>
                          </div>
                          <div>
                            <span className="text-xs text-zinc-500 block mb-1">Respuesta</span>
                            <pre className="text-xs text-emerald-300 font-mono bg-black p-2 rounded max-h-32 overflow-y-auto whitespace-pre-wrap">
                              {record.response}
                            </pre>
                          </div>
                          <button
                            onClick={() => handleReexecute(record)}
                            className="text-xs text-emerald-500 hover:text-emerald-400 flex items-center gap-1"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Re-ejecutar
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
