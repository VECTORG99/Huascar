import { useEffect } from "react";
import { useStep } from "../context/stepContextValue";

export default function StepContainer({ children }) {
  const {
    evaluation, currentQuestion, answers, loading, error, canContinue,
    continueFlow, goBack, goToQuestion,
  } = useStep();
  const questions = evaluation?.visibleQuestions || [];
  const currentIndex = questions.findIndex(question => question.id === currentQuestion?.id);
  const progress = evaluation?.progress || { answered: 0, total: 1, percent: 0 };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentQuestion?.id]);

  useEffect(() => {
    const handler = event => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && canContinue && !loading) continueFlow();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [canContinue, continueFlow, loading]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-950/90 px-5 py-4 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-emerald-400">Huascar Creator</h1>
            <p className="text-xs text-zinc-500">Workflow dinámico · {evaluation?.workflowVersion || "cargando"}</p>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-zinc-300">{progress.percent}%</div>
            <div className="text-xs text-zinc-500">{progress.answered} de {progress.total} decisiones</div>
          </div>
        </div>
      </header>

      <div className="h-1 bg-zinc-900">
        <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${progress.percent}%` }} />
      </div>

      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto pr-2">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-600">Decisiones visibles</p>
            <nav className="space-y-1">
              {questions.map((question, index) => {
                const value = answers[question.id];
                const answered = typeof value === "boolean" || (typeof value === "string" && value.trim()) || (Array.isArray(value) && value.length > 0);
                const active = question.id === currentQuestion?.id;
                return (
                  <button
                    key={question.id}
                    onClick={() => (answered || index <= currentIndex) && goToQuestion(question.id)}
                    disabled={!answered && index > currentIndex}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition ${active ? "bg-emerald-950 text-emerald-300" : answered ? "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200" : "cursor-not-allowed text-zinc-700"}`}
                  >
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${answered ? "border-emerald-800 text-emerald-500" : "border-zinc-800"}`}>{answered ? "✓" : index + 1}</span>
                    <span className="truncate">{question.section}</span>
                  </button>
                );
              })}
            </nav>

            {evaluation?.recommendations?.length > 0 && (
              <div className="mt-6 rounded-xl border border-blue-900/60 bg-blue-950/20 p-3">
                <p className="text-xs font-medium text-blue-300">{evaluation.recommendations.length} recomendaciones activas</p>
                <p className="mt-1 text-xs text-zinc-500">Las podrás revisar antes de generar.</p>
              </div>
            )}
          </div>
        </aside>

        <main className="min-w-0 pb-28">
          <div className="mx-auto max-w-3xl">{children}</div>
        </main>
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-800 bg-zinc-950/95 px-5 py-4 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 lg:ml-[calc((100vw-72rem)/2+17rem)] lg:mr-[calc((100vw-72rem)/2)]">
          <button onClick={goBack} disabled={currentIndex <= 0 || loading} className="rounded-lg border border-zinc-700 px-5 py-2.5 text-sm text-zinc-300 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-30">← Anterior</button>
          <div className="min-w-0 flex-1 text-center">
            {error && <p role="alert" aria-live="polite" className="truncate text-xs text-red-400" title={error}>{error}</p>}
            {loading && <p role="status" aria-live="polite" className="text-xs text-zinc-500">Evaluando respuestas...</p>}
            {!error && !loading && <p className="hidden text-xs text-zinc-600 sm:block">Ctrl/⌘ + Enter para continuar</p>}
          </div>
          <button onClick={continueFlow} disabled={!canContinue || loading} aria-busy={loading} className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500">
            {loading ? "Evaluando..." : "Continuar →"}
          </button>
        </div>
      </footer>
    </div>
  );
}
