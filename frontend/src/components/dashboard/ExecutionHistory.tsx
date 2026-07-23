import type { HistoryRecord } from "@/types/agent";

interface ExecutionHistoryProps {
  history: HistoryRecord[];
  loading: boolean;
  expandedId: number | null;
  onRefresh: () => void;
  onToggle: (id: number | null) => void;
  onReexecute: (record: HistoryRecord) => void;
}

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString("es-ES", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
};

export function ExecutionHistory({ history, loading, expandedId, onRefresh, onToggle, onReexecute }: ExecutionHistoryProps) {
  return (
    <section id="panel-history" role="tabpanel" aria-labelledby="tab-history" className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 min-h-[300px] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-zinc-400">Ejecuciones anteriores</h3>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          aria-label="Refrescar historial de ejecuciones"
          aria-busy={loading}
          className="text-xs text-emerald-500 hover:text-emerald-400 disabled:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-900 rounded"
        >
          {loading ? "Cargando..." : "Refrescar"}
        </button>
      </div>

      <div className="sr-only" role="status" aria-live="polite">
        {loading ? "Cargando historial" : `${history.length} ejecuciones en el historial`}
      </div>

      {history.length === 0 && !loading && (
        <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm" role="status">
          No hay ejecuciones registradas
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-2" aria-label="Lista de ejecuciones anteriores">
        {history.map((record) => {
          const isOpen = expandedId === record.id;
          const panelId = `history-record-${record.id}`;
          return (
            <div key={record.id} className="border border-zinc-800 rounded-md">
              <button
                type="button"
                onClick={() => onToggle(isOpen ? null : record.id)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-zinc-800/50 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-inset"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0 bg-emerald-500" aria-hidden="true" />
                  <span className="text-sm font-medium text-zinc-200 truncate">{record.role}</span>
                </div>
                <span className="text-xs text-zinc-500 shrink-0 ml-3">{formatDate(record.created_at)}</span>
              </button>

              {isOpen && (
                <div id={panelId} className="px-3 pb-3 space-y-3 border-t border-zinc-800 pt-3">
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
                    type="button"
                    onClick={() => onReexecute(record)}
                    aria-label={`Re-ejecutar tarea de ${record.role}`}
                    className="text-xs text-emerald-500 hover:text-emerald-400 flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-900 rounded"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
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
    </section>
  );
}
