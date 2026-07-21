import { useStep } from "../context/StepContext";

export default function StepContainer({ children }) {
  const { currentStep, STEPS, nextStep, prevStep, isFirst, isLast, canProceed } = useStep();
  const progress = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans">
      <header className="border-b border-gray-800 px-6 py-4">
        <h1 className="text-2xl font-bold text-emerald-400">Huascar</h1>
        <p className="text-sm text-gray-500">Creador de Agentes</p>
      </header>

      <div className="w-full bg-gray-900 h-2">
        <div
          className="h-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex justify-center gap-2 px-6 py-4 text-xs text-gray-500">
        {STEPS.map((s, i) => (
          <span
            key={s.id}
            className={
              i === currentStep
                ? "text-emerald-400 font-semibold"
                : i < currentStep
                  ? "text-emerald-700"
                  : ""
            }
          >
            {i + 1}. {s.label}
            {i < STEPS.length - 1 && (
              <span className="mx-2 text-gray-700">&rarr;</span>
            )}
          </span>
        ))}
      </div>

      <main className="max-w-2xl mx-auto px-6 py-8 pb-24">{children}</main>

      <footer className="fixed bottom-0 left-0 right-0 border-t border-gray-800 bg-gray-950 px-6 py-4">
        <div className="max-w-2xl mx-auto flex justify-between">
          <button
            onClick={prevStep}
            disabled={isFirst}
            className="px-6 py-2 rounded-lg border border-gray-700 text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-900 transition"
          >
            &larr; Anterior
          </button>
          <button
            onClick={nextStep}
            disabled={!canProceed && !isLast}
            className="px-6 py-2 rounded-lg bg-emerald-600 text-white disabled:bg-gray-700 disabled:cursor-not-allowed hover:bg-emerald-500 transition"
          >
            {isLast ? "Finalizar" : "Siguiente &rarr;"}
          </button>
        </div>
      </footer>
    </div>
  );
}
