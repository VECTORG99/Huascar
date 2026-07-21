import { useStep } from "../context/StepContext";

const TASK_EXAMPLES = [
  "Revisar cada PR en busca de secretos y vulnerabilidades",
  "Generar tests unitarios automáticamente para cada nuevo archivo",
  "Crear el scaffolding de un microservicio con Express + MongoDB",
  "Auditar dependencias y sugerir actualizaciones de seguridad",
];

export default function TaskStep() {
  const { answers, updateAnswer } = useStep();

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">&iquest;Qu&eacute; tarea debe automatizar?</h2>
      <p className="text-gray-400 mb-6">
        Describe la tarea repetitiva que quieres que el agente haga por ti.
      </p>

      <textarea
        value={answers.task}
        onChange={(e) => updateAnswer("task", e.target.value)}
        placeholder="Ej: Revisar cada PR en busca de vulnerabilidades de seguridad..."
        className="w-full bg-gray-900 border border-gray-700 rounded-lg p-4 text-gray-100 h-36 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-4"
      />

      <p className="text-sm text-gray-500 mb-2">Sugerencias:</p>
      <div className="flex flex-wrap gap-2">
        {TASK_EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => updateAnswer("task", ex)}
            className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-full border border-gray-700 transition"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
