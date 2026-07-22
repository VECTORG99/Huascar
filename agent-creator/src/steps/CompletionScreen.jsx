import { useStep } from "../context/StepContext";

function loadAgent() {
  const saved = typeof window !== 'undefined' && sessionStorage.getItem('huascar_last_agent');
  return saved ? JSON.parse(saved) : null;
}

export default function CompletionScreen() {
  const { reset, answers } = useStep();
  const agent = loadAgent();
  // Use sessionStorage fallback if context was lost (page refresh)
  const role = agent?.role || (answers.role === "CUSTOM" ? answers.roleCustom : answers.role);
  const task = agent?.task || answers.task;
  const config = agent?.config;

  const openDashboard = () => {
    const dashUrl = import.meta.env.VITE_DASHBOARD_URL || 'http://localhost:3000';
    const params = new URLSearchParams({ role, task });
    if (config) {
      const configJson = JSON.stringify(config);
      if (configJson.length < 8000) {
        params.set('config', configJson);
      }
    }
    window.open(`${dashUrl}/?${params}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center px-6">
      <div className="text-center max-w-md animate-fade-in">
        <div className="text-5xl mb-2 font-bold text-emerald-400 animate-check-pop">DONE</div>
        <div className="text-3xl mb-6 animate-slide-up">🎉</div>
        <h2 className="text-3xl font-bold mb-4 text-emerald-400">
          Agente Creado
        </h2>
        <p className="text-gray-400 mb-8">
          La configuraci&oacute;n de tu agente Huascar est&aacute; lista.
          Puedes ejecutarlo en el Dashboard o crear otro agente.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={openDashboard}
            className="bg-zinc-700 hover:bg-zinc-600 text-white font-medium py-3 px-8 rounded-lg transition"
          >
            Abrir en Dashboard
          </button>
          <button
            onClick={reset}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 px-8 rounded-lg transition hover:scale-105 active:scale-95"
          >
            Crear otro agente
          </button>
        </div>
      </div>
    </div>
  );
}
