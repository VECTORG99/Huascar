import { useStep } from "../context/stepContextValue";

export default function WelcomeStep() {
  const { tutorial, tutorialIndex, continueTutorial, skipTutorial } = useStep();
  const stage = tutorial?.stages?.[tutorialIndex];
  if (!tutorial || !stage) return null;
  const last = tutorialIndex === tutorial.stages.length - 1;

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-3xl">
        <div className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-emerald-400">Huascar Academy</h1>
            <p className="text-sm text-zinc-500">Tutorial interactivo · puedes omitirlo</p>
          </div>
          <button onClick={skipTutorial} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200">Saltar tutorial</button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl shadow-emerald-950/20">
          <div className="border-b border-zinc-800 bg-gradient-to-r from-emerald-950/70 to-zinc-900 p-8 sm:p-12">
            <div className="mb-5 flex items-center gap-2">
              {tutorial.stages.map((item, index) => (
                <span key={item.id} className={`h-2 flex-1 rounded-full ${index <= tutorialIndex ? "bg-emerald-500" : "bg-zinc-700"}`} />
              ))}
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">Misión {tutorialIndex + 1} de {tutorial.stages.length}</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">{stage.title}</h2>
            <p className="mt-4 text-lg leading-relaxed text-zinc-300">{stage.narrative}</p>
          </div>

          <div className="p-8 sm:p-12">
            <div className="rounded-xl border border-blue-900/50 bg-blue-950/20 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">Aprendizaje desbloqueado</p>
              <p className="mt-2 text-zinc-300">{stage.learning}</p>
            </div>

            <div className="mt-8 flex items-center justify-between gap-4">
              <p className="text-sm text-zinc-500">{tutorial.title}</p>
              <button onClick={continueTutorial} className="rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white hover:bg-emerald-500">
                {last ? "Abrir Creator →" : "Siguiente misión →"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
