import { useStep } from "../context/stepContextValue";

const severityStyle = {
  info: "border-blue-900/60 bg-blue-950/20 text-blue-300",
  recommended: "border-emerald-900/60 bg-emerald-950/20 text-emerald-300",
  warning: "border-amber-900/60 bg-amber-950/20 text-amber-300",
};

export default function ReviewStep() {
  const { answers, evaluation, catalog, generate, goBack, goToQuestion, loading, error } = useStep();
  const itemById = new Map(catalog.items.map(item => [item.id, item.label]));

  const display = (question, value) => {
    if (value === undefined || (Array.isArray(value) && value.length === 0)) return "No definido (opcional)";
    if (typeof value === "boolean") return value ? "Sí" : "No";
    const values = Array.isArray(value) ? value : [value];
    const optionMap = new Map((question?.options || []).map(option => [option.id, option.label]));
    return values.map(item => itemById.get(item) || optionMap.get(item) || String(item).replace("custom:", "Personalizado: ")).join(", ");
  };

  return (
    <div className="min-h-screen bg-zinc-950 px-5 py-8 text-zinc-100 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500">Revisión final</p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Tu agente está listo para compilarse</h1>
            <p className="mt-3 max-w-2xl text-zinc-400">Revisa decisiones y recomendaciones. Generar crea un preview descargable; no ejecuta herramientas ni modifica tu proyecto.</p>
          </div>
          <button onClick={goBack} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900">← Volver al flujo</button>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-7">
            <h2 className="mb-5 text-lg font-semibold">Decisiones</h2>
            <div className="divide-y divide-zinc-800">
              {evaluation.visibleQuestions.map(question => {
                const id = question.id;
                const value = answers[id];
                return (
                  <button key={id} onClick={() => goToQuestion(id)} className="group flex w-full items-start justify-between gap-4 py-4 text-left">
                    <span className="min-w-0">
                      <span className="block text-xs uppercase tracking-wider text-zinc-600">{question.section}</span>
                      <span className="mt-1 block text-sm text-zinc-400">{question.prompt}</span>
                      <span className="mt-1 block break-words font-medium text-zinc-100">{display(question, value)}</span>
                    </span>
                    <span className="text-xs text-zinc-600 group-hover:text-emerald-400">Editar</span>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-7">
              <h2 className="mb-4 text-lg font-semibold">Recomendaciones</h2>
              {evaluation.recommendations.length === 0 ? (
                <p className="text-sm text-zinc-500">No se activaron recomendaciones adicionales.</p>
              ) : (
                <div className="space-y-3">
                  {evaluation.recommendations.map(item => (
                    <article key={item.id} className={`rounded-xl border p-4 ${severityStyle[item.severity]}`}>
                      <h3 className="font-semibold">{item.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-zinc-300">{item.reason}</p>
                      <details className="mt-3 text-xs text-zinc-400">
                        <summary className="cursor-pointer">Beneficios y trade-offs</summary>
                        <p className="mt-2"><strong>Beneficios:</strong> {item.benefits.join("; ")}</p>
                        <p className="mt-1"><strong>Trade-offs:</strong> {item.tradeoffs.join("; ")}</p>
                        <p className="mt-1"><strong>Alternativas:</strong> {item.alternatives.join("; ")}</p>
                      </details>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {evaluation.warnings.length > 0 && (
              <section className="rounded-2xl border border-amber-900/60 bg-amber-950/20 p-5">
                <h2 className="font-semibold text-amber-300">Advertencias</h2>
                <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                  {evaluation.warnings.map(message => <li key={message}>• {message}</li>)}
                </ul>
              </section>
            )}

            <button onClick={generate} disabled={loading} aria-busy={loading} className="w-full rounded-xl bg-emerald-600 px-6 py-4 font-semibold text-white shadow-lg shadow-emerald-950/30 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500">
              {loading ? "Compilando bundle..." : "Generar configuración →"}
            </button>
            {loading && <p role="status" aria-live="polite" className="sr-only">Generando el preview y sus artefactos.</p>}
            {error && <p role="alert" aria-live="polite" className="text-sm text-red-400">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
