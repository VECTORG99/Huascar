import { useStep } from "../context/StepContext";

export default function KnowledgeStep() {
  const { answers, updateAnswer } = useStep();

  const toggleLocalRepo = () => {
    updateAnswer("knowledge", {
      ...answers.knowledge,
      localRepo: !answers.knowledge.localRepo,
    });
  };

  const toggleWebDocs = (val) => {
    updateAnswer("knowledge", {
      ...answers.knowledge,
      webDocs: { ...answers.knowledge.webDocs, enabled: val },
    });
  };

  const setWebDocsUrl = (url) => {
    updateAnswer("knowledge", {
      ...answers.knowledge,
      webDocs: { ...answers.knowledge.webDocs, url },
    });
  };

  const toggleConventions = (val) => {
    updateAnswer("knowledge", {
      ...answers.knowledge,
      conventions: { ...answers.knowledge.conventions, enabled: val },
    });
  };

  const setConventionsText = (text) => {
    updateAnswer("knowledge", {
      ...answers.knowledge,
      conventions: { ...answers.knowledge.conventions, text },
    });
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">¿Qué conocimiento necesita tu agente?</h2>
      <p className="text-gray-400 mb-6">
        El agente usar&aacute; estas fuentes para tomar decisiones informadas.
      </p>

      <div className="space-y-4">
        <label className="flex items-center gap-3 p-4 bg-gray-900 rounded-lg border border-gray-800 cursor-pointer hover:border-gray-700 transition">
          <input
            type="checkbox"
            checked={answers.knowledge.localRepo}
            onChange={toggleLocalRepo}
            className="w-5 h-5 accent-emerald-500"
          />
          <div>
            <div className="font-medium">Repositorio local</div>
            <div className="text-sm text-gray-400">El agente leer&aacute; el c&oacute;digo fuente del proyecto</div>
          </div>
        </label>

        <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
          <label className="flex items-center gap-3 mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={answers.knowledge.webDocs.enabled}
              onChange={(e) => toggleWebDocs(e.target.checked)}
              className="w-5 h-5 accent-emerald-500"
            />
            <div className="font-medium">Documentaci&oacute;n web</div>
          </label>
          {answers.knowledge.webDocs.enabled && (
            <input
              type="url"
              value={answers.knowledge.webDocs.url}
              onChange={(e) => setWebDocsUrl(e.target.value)}
              placeholder="https://docs.ejemplo.com"
              className="w-full bg-gray-950 border border-gray-700 rounded-lg p-2 text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          )}
        </div>

        <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
          <label className="flex items-center gap-3 mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={answers.knowledge.conventions.enabled}
              onChange={(e) => toggleConventions(e.target.checked)}
              className="w-5 h-5 accent-emerald-500"
            />
            <div className="font-medium">Convenciones del equipo</div>
          </label>
          {answers.knowledge.conventions.enabled && (
            <textarea
              value={answers.knowledge.conventions.text}
              onChange={(e) => setConventionsText(e.target.value)}
              placeholder="Describe las convenciones que debe respetar..."
              className="w-full bg-gray-950 border border-gray-700 rounded-lg p-2 text-gray-100 text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          )}
        </div>
      </div>
    </div>
  );
}
