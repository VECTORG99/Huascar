import { useState } from "react";
import { useStep } from "../context/StepContext";

export default function ReviewStep() {
  const { answers } = useStep();
  const [generated, setGenerated] = useState(null);
  const [loading, setLoading] = useState(false);

  const buildAgentConfig = () => {
    const mcps = Object.entries(answers.tools)
      .filter(([, v]) => v)
      .map(([k]) => k);

    const hooks = [];
    if (answers.security.requireApproval) hooks.push("human_approval");
    if (answers.security.blockDestructive) hooks.push("block_destructive");

    return {
      steering: {
        role: answers.role === "CUSTOM" ? answers.roleCustom : answers.role,
        system_prompt: `Eres un agente experto en productividad para desarrolladores. Tu rol: ${
          answers.role === "CUSTOM" ? answers.roleCustom : answers.role
        }. Tu tarea principal: ${answers.task}.`,
      },
      rag: {
        sources: [
          answers.knowledge.localRepo && "./repo",
          answers.knowledge.webDocs && answers.knowledge.webDocs,
          answers.knowledge.conventions && "./docs/CONVENTIONS.md",
        ].filter(Boolean),
      },
      mcps,
      hooks,
    };
  };

  const handleGenerate = async () => {
    setLoading(true);
    const config = buildAgentConfig();

    // Try to send to backend, fallback to local generation
    try {
      const res = await fetch("http://localhost:3001/api/agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: answers.task,
          role: answers.role === "CUSTOM" ? answers.roleCustom : answers.role,
        }),
      });
      const data = await res.json();
      setGenerated({ config, backendResponse: data });
    } catch {
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
            {answers.security.requireApproval && "Aprobaci&oacute;n humana "}
            {answers.security.blockDestructive && "+ Protecci&oacute;n destructiva"}
          </div>
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-3 px-8 rounded-lg transition"
      >
        {loading ? "Generando agente..." : "Generar Configuraci&oacute;n"}
      </button>

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
        </div>
      )}
    </div>
  );
}
