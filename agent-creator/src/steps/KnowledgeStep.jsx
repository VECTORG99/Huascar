import { useStep } from "../context/StepContext";

export default function KnowledgeStep() {
  const { answers, updateAnswer } = useStep();

  const toggleKnowledge = (key) => {
    updateAnswer("knowledge", {
      ...answers.knowledge,
      [key]: !answers.knowledge[key],
    });
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">&iquest;Qu&eacute; conocimiento necesita tu agente?</h2>
      <p className="text-gray-400 mb-6">
        El agente usar&aacute; estas fuentes para tomar decisiones informadas.
      </p>

      <div className="space-y-4">
        <label className="flex items-center gap-3 p-4 bg-gray-900 rounded-lg border border-gray-800 cursor-pointer hover:border-gray-700 transition">
          <input
            type="checkbox"
            checked={answers.knowledge.localRepo}
            onChange={() => toggleKnowledge("localRepo")}
            className="w-5 h-5 accent-emerald-500"
          />
          <div>
            <div className="font-medium">Repositorio local</div>
            <div className="text-sm text-gray-400">El agente leer&aacute; el c&oacute;digo fuente del proyecto</div>
          </div>
        </label>

        <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
          <label className="flex items-center gap-3 mb-3">
            <input
              type="checkbox"
              checked={!!answers.knowledge.webDocs}
              onChange={() =>
                updateAnswer("knowledge", {
                  ...answers.knowledge,
                  webDocs: answers.knowledge.webDocs ? "" : "https://",
                })
              }
              className="w-5 h-5 accent-emerald-500"
            />
            <div className="font-medium">Documentaci&oacute;n web</div>
          </label>
          {answers.knowledge.webDocs && (
            <input
              type="url"
              value={answers.knowledge.webDocs}
              onChange={(e) =>
                updateAnswer("knowledge", {
                  ...answers.knowledge,
                  webDocs: e.target.value,
                })
              }
              placeholder="https://docs.ejemplo.com"
              className="w-full bg-gray-950 border border-gray-700 rounded-lg p-2 text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          )}
        </div>

        <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
          <label className="flex items-center gap-3 mb-3">
            <input
              type="checkbox"
              checked={!!answers.knowledge.conventions}
              onChange={() =>
                updateAnswer("knowledge", {
                  ...answers.knowledge,
                  conventions: answers.knowledge.conventions ? "" : "Usar convenciones de estilo...",
                })
              }
              className="w-5 h-5 accent-emerald-500"
            />
            <div className="font-medium">Convenciones del equipo</div>
          </label>
          {answers.knowledge.conventions && (
            <textarea
              value={answers.knowledge.conventions}
              onChange={(e) =>
                updateAnswer("knowledge", {
                  ...answers.knowledge,
                  conventions: e.target.value,
                })
              }
              placeholder="Describe las convenciones que debe respetar..."
              className="w-full bg-gray-950 border border-gray-700 rounded-lg p-2 text-gray-100 text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          )}
        </div>
      </div>
    </div>
  );
}
