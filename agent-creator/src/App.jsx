import { StepProvider } from "./context/StepContext";
import { useStep } from "./context/stepContextValue";
import StepContainer from "./components/StepContainer";
import DynamicQuestion from "./components/DynamicQuestion";
import WelcomeStep from "./steps/WelcomeStep";
import ReviewStep from "./steps/ReviewStep";
import CompletionScreen from "./steps/CompletionScreen";

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-zinc-100">
      <div role="status" aria-live="polite" className="text-center">
        <div className="mx-auto mb-5 flex w-fit gap-2">
          {[0, 1, 2].map(index => <span key={index} className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse-dot" style={{ animationDelay: `${index * 0.15}s` }} />)}
        </div>
        <h1 className="text-2xl font-bold text-emerald-400">Preparando el Creator</h1>
        <p className="mt-2 text-sm text-zinc-500">Cargando catálogo y árbol de decisiones...</p>
      </div>
    </div>
  );
}

function ErrorScreen() {
  const { error, initialize } = useStep();
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-zinc-100">
      <div role="alert" aria-live="assertive" className="max-w-md rounded-2xl border border-red-900/60 bg-red-950/20 p-8 text-center">
        <h1 className="text-2xl font-bold text-red-300">No pudimos conectar con Huascar</h1>
        <p className="mt-3 text-sm text-zinc-400">{error}</p>
        <p className="mt-2 text-xs text-zinc-600">Verifica `VITE_API_URL` y que el backend exponga `/api/v1/creator`.</p>
        <button onClick={initialize} className="mt-6 rounded-lg bg-red-700 px-5 py-2.5 font-medium hover:bg-red-600">Reintentar</button>
      </div>
    </div>
  );
}

function CreatorRenderer() {
  const { phase } = useStep();
  if (phase === "loading") return <LoadingScreen />;
  if (phase === "error") return <ErrorScreen />;
  if (phase === "tutorial") return <WelcomeStep />;
  if (phase === "review") return <ReviewStep />;
  if (phase === "complete") return <CompletionScreen />;
  return <StepContainer><DynamicQuestion /></StepContainer>;
}

export default function App() {
  return <StepProvider><CreatorRenderer /></StepProvider>;
}
