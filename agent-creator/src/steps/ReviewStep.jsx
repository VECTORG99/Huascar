import { useState } from "react";
import { useStep } from "../context/StepContext";

export default function ReviewStep() {
  const { answers, nextStep } = useStep();
  const [generated, setGenerated] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const hasSecurity = answers.security.requireApproval || answers.security.blockDestructive;

  const buildAgentConfig = () => {
    const mcps = Object.entries(answers.tools)
      .filter(([, v]) => v)
      .map(([k]) => k);

    const hooks = [];
    if (answers.security.requireApproval) hooks.push("human_approval");
    if (answers.security.blockDestructive) hooks.push("block_destructive");

    const ragSources = [];
    if (answers.knowledge.localRepo) ragSources.push("./repo");
    if (answers.knowledge.webDocs.enabled && answers.knowledge.webDocs.url) {
      ragSources.push(answers.knowledge.webDocs.url);
    }
    if (answers.knowledge.conventions.enabled && answers.knowledge.conventions.text) {
      ragSources.push("./docs/CONVENTIONS.md");
    }

    return {
      steering: {
        role: answers.role === "CUSTOM" ? answers.roleCustom : answers.role,
        system_prompt: `Eres un agente experto en productividad para desarrolladores. Tu rol: ${
          answers.role === "CUSTOM" ? answers.roleCustom : answers.role
        }. Tu tarea principal: ${answers.task}.`,
      },
      rag: { sources: ragSources },
      mcps,
      hooks,
    };
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    const config = buildAgentConfig();

    try {
      const res = await fetch("http://localhost:3001/api/agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: answers.task,
          role: answers.role === "CUSTOM" ? answers.roleCustom : answers.role,
        }),
      });

      if (!res.ok) {
        throw new Error(`El backend respondió con código ${res.status}. Asegúrate de que el servidor esté corriendo.`);
      }

      const data = await res.json();
      setGenerated({ config, backendResponse: data });
    } catch (err) {
      setError(err.message || "No se pudo conectar con el backend.");
      setGenerated({ config, backendResponse: null });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Revisa tu agente</h2>
      <p className="text-gray-400 mb-6">
        Este es el resumen de la configuraci&oacute;n de tu agente Huascar.
      </p>

      <div className="space-y-3 mb-6">
        <div className="bg-gray-900 p-4 rounded-lg border border-gray-800">
          <span className="text-sm text-gray-500">Rol</span>
          <div className="font-medium">
            {answers.role === "CUSTOM" ? answers.roleCustom : answers.role}
          </div>
        </div>
        <div className="bg-gray-900 p-4 rounded-lg border border-gray-800">
          <span className="text-sm text-gray-500">Tarea</span>
          <div className="font-medium">{answers.task}</div>
        </div>
        <div className="bg-gray-900 p-4 rounded-lg border border-gray-800">
          <span className="text-sm text-gray-500">Herramientas</span>
          <div className="font-medium">
            {Object.entries(answers.tools)
              .filter(([, v]) => v)
              .map(([k]) => k)
              .join(", ") || "Ninguna"}
          </div>
        </div>
        <div className="bg-gray-900 p-4 rounded-lg border border-gray-800">
          <span className="text-sm text-gray-500">Seguridad</span>
          <div className="font-medium">
            {hasSecurity
              ? [
                  answers.security.requireApproval && "Aprobaci\u00f3n humana",
                  answers.security.blockDestructive && "Protecci\u00f3n destructiva",
                ]
                  .filter(Boolean)
                  .join(" + ")
              : "Sin reglas adicionales"}
          </div>
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-3 px-8 rounded-lg transition"
      >
        {loading ? "Generando agente..." : "Generar Configuraci\u00f3n"}
      </button>

      {error && (
        <div className="mt-4 p-3 bg-red-900/30 border border-red-800 rounded-lg">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {generated && (
        <div className="mt-6 space-y-4">
          <div className="bg-black border border-emerald-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-emerald-400 mb-2">
              Configuraci&oacute;n Generada
            </h3>
            <pre className="text-xs text-emerald-300 font-mono overflow-x-auto">
              {JSON.stringify(generated.config, null, 2)}
            </pre>
          </div>

          {generated.backendResponse && (
            <div className="bg-black border border-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-400 mb-2">
                Respuesta del Motor
              </h3>
              <pre className="text-xs text-gray-300 font-mono overflow-x-auto">
                {JSON.stringify(generated.backendResponse, null, 2)}
              </pre>
            </div>
          )}

          <button
            onClick={nextStep}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 px-8 rounded-lg transition"
          >
            Finalizar
          </button>
        </div>
      )}
    </div>
  );
}
