import { useEffect, useRef } from "react";

import type { ExecutionResponse } from "@/types/agent";

interface TerminalOutputProps {
  logs: string[];
  jsonResponse: ExecutionResponse | null;
  loading: boolean;
}

const logClass = (log: string) =>
  log.includes("[HOOK]") ? "text-blue-400"
    : log.includes("completada") ? "text-green-400"
      : log.includes("[ERROR]") ? "text-red-400"
        : "text-zinc-300";

export function TerminalOutput({ logs, jsonResponse, loading }: TerminalOutputProps) {
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <>
      <section id="panel-terminal" role="tabpanel" aria-labelledby="tab-terminal" className="bg-black border border-zinc-800 rounded-lg p-4 flex-1 font-mono text-sm overflow-hidden flex flex-col min-h-[300px]">
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-zinc-800">
          <div className="w-3 h-3 rounded-full bg-red-500" aria-hidden="true"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500" aria-hidden="true"></div>
          <div className="w-3 h-3 rounded-full bg-green-500" aria-hidden="true"></div>
          <span className="ml-2 text-zinc-500 text-xs">terminal - bash</span>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1" role="log" aria-live="polite" aria-relevant="additions text" aria-busy={loading} aria-label="Registro de ejecución del agente">
          {logs.map((log, i) => (
            <div key={i} className={logClass(log)}>
              <span className="text-zinc-600 mr-2" aria-hidden="true">{'>'}</span>{log}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      </section>

      {jsonResponse && (
        <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-4" aria-labelledby="json-response-title">
          <h3 id="json-response-title" className="text-sm font-medium text-zinc-400 mb-2">Respuesta JSON</h3>
          <pre className="bg-black p-3 rounded-md overflow-x-auto text-xs text-emerald-300 font-mono">
            {JSON.stringify(jsonResponse, null, 2)}
          </pre>
        </section>
      )}
    </>
  );
}
