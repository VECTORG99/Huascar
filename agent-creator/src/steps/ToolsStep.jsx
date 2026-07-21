import { useEffect } from "react";
import { useStep } from "../context/StepContext";

const TOOLS = [
  { id: "github", label: "GitHub", desc: "Leer PRs, comentar, hacer merge" },
  { id: "terminal", label: "Terminal", desc: "Ejecutar tests, compilar, instalar dependencias" },
  { id: "filesystem", label: "Sistema de Archivos", desc: "Leer y escribir archivos en el repositorio" },
];

export default function ToolsStep() {
  const { answers, updateAnswer, registerValidation } = useStep();

  const anyToolSelected = Object.values(answers.tools).some(Boolean);

  useEffect(() => {
    registerValidation("tools", () => anyToolSelected);
  }, [anyToolSelected, registerValidation]);

  const toggleTool = (id) => {
    updateAnswer("tools", {
      ...answers.tools,
      [id]: !answers.tools[id],
    });
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">¿Qué herramientas puede usar tu agente?</h2>
      <p className="text-gray-400 mb-6">
        Las herramientas (MCPs) le permiten al agente interactuar con tu entorno.
      </p>

      <div className="space-y-3">
        {TOOLS.map((t) => (
          <label
            key={t.id}
            className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition ${
              answers.tools[t.id]
                ? "border-emerald-500 bg-emerald-900/20"
                : "border-gray-800 bg-gray-900 hover:border-gray-700"
            }`}
          >
            <input
              type="checkbox"
              checked={answers.tools[t.id]}
              onChange={() => toggleTool(t.id)}
              className="w-5 h-5 accent-emerald-500"
            />
            <div>
              <div className="font-medium">{t.label}</div>
              <div className="text-sm text-gray-400">{t.desc}</div>
            </div>
          </label>
        ))}
      </div>

      {!anyToolSelected && (
        <p className="text-yellow-500 text-sm mt-4">
          Selecciona al menos una herramienta para que el agente pueda trabajar.
        </p>
      )}
    </div>
  );
}
