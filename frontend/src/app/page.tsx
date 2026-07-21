"use client";

import { useRef, useState, useEffect } from "react";

interface ExecutionResponse {
  status: string;
  agent_role: string;
  response: string;
  error?: string;
}

export default function Home() {
  const [role, setRole] = useState("PR_REVIEWER");
  const [task, setTask] = useState("");
  const [logs, setLogs] = useState<string[]>([
    "[HuascarEngine] Sistema inicializado.",
    "[HuascarEngine] Esperando instrucciones..."
  ]);
  const [jsonResponse, setJsonResponse] = useState<ExecutionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleDeploy = async () => {
    if (!task.trim()) return;

    setLoading(true);
    setJsonResponse(null);
    setLogs(prev => [...prev,
      `[HuascarEngine] Desplegando agente con rol: ${role}...`,
      `[HOOK] Validando tarea: "${task}"...`
    ]);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/agent/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, role })
      });

      const data: ExecutionResponse = await res.json();
      const msg = data.status === "success"
        ? "[HuascarEngine] Ejecución completada."
        : "[HuascarEngine] Ejecución bloqueada por hook.";
      setLogs(prev => [...prev, msg]);
      setJsonResponse(data);
    } catch (err: any) {
      setLogs(prev => [...prev, `[ERROR] No se pudo conectar con el backend: ${err.message}`]);
      setJsonResponse({ status: "error", agent_role: role, response: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 p-8 font-sans">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-emerald-400 tracking-tight">Huascar Builder</h1>
        <p className="text-zinc-400">Agent Deployment Dashboard</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
              <option value="PR_REVIEWER">PR_REVIEWER</option>
              <option value="SCAFFOLDER">SCAFFOLDER</option>
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

        <div className="flex flex-col gap-6">
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
        </div>
      </div>
    </div>
  );
}
