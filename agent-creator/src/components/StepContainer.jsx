import { useEffect } from "react";
import { useStep } from "../context/StepContext";

export default function StepContainer({ children }) {
  const { currentStep, STEPS, nextStep, prevStep, isFirst, isLast, canProceed } = useStep();
  const progress = ((currentStep + 1) / STEPS.length) * 100;

  // ponytail: keyboard nav, enough for hackathon UX
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        const tag = e.target.tagName;
        if (tag !== "TEXTAREA" && tag !== "INPUT") {
          if (isLast) return;
          if (canProceed) nextStep();
        }
      }
      if (e.key === "ArrowRight" && !e.shiftKey) {
        if (!isLast && canProceed) nextStep();
      }
      if (e.key === "ArrowLeft" && !e.shiftKey) {
        if (!isFirst) prevStep();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [nextStep, prevStep, isFirst, isLast, canProceed]);

  // ponytail: scroll-to-top on step change
  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [currentStep]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans">
      <header className="border-b border-gray-800 px-6 py-4">
        <h1 className="text-2xl font-bold text-emerald-400">Huascar</h1>
        <p className="text-sm text-gray-500">Creador de Agentes</p>
      </header>

      <div className="w-full bg-gray-900 h-2">
        <div
          className="h-full bg-emerald-500 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step indicator */}
      <div className="flex justify-center items-center gap-0 px-6 py-4 text-xs">
        {STEPS.map((s, i) => (
          <span key={s.id} className="flex items-center gap-1">
            <span
              className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium transition-all duration-300 ${
                i === currentStep
                  ? "bg-emerald-600 text-white scale-110"
                  : i < currentStep
                    ? "bg-emerald-900/60 text-emerald-400"
                    : "bg-gray-800 text-gray-600"
              }`}
            >
              {i < currentStep ? (
                <span className="animate-check-pop">✓</span>
              ) : (
                i + 1
              )}
            </span>
            <span className={`hidden sm:inline ${i === currentStep ? "text-emerald-400 font-semibold" : i < currentStep ? "text-emerald-700" : "text-gray-600"}`}>
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <span className={`mx-1 ${i < currentStep ? "text-emerald-800" : "text-gray-800"}`}>›</span>
            )}
          </span>
        ))}
      </div>

      <main className="max-w-2xl mx-auto px-6 py-8 pb-24">
        <div key={currentStep} className="animate-fade-in">
          {children}
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 border-t border-gray-800 bg-gray-950/95 backdrop-blur-sm px-6 py-4">
        <div className="max-w-2xl mx-auto flex justify-between">
          <button
            onClick={prevStep}
            disabled={isFirst}
            className="px-6 py-2 rounded-lg border border-gray-700 text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-900 hover:border-gray-600 transition"
          >
            &larr; Anterior
          </button>
          {!isLast && (
            <button
              onClick={nextStep}
              disabled={!canProceed}
              className="px-6 py-2 rounded-lg bg-emerald-600 text-white disabled:bg-gray-700 disabled:cursor-not-allowed hover:bg-emerald-500 transition"
            >
              Siguiente &rarr;
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
