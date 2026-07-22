import { useStep } from "../context/StepContext";

const ROLES = [
  { id: "PR_REVIEWER", name: "Revisor de PR", desc: "Analiza pull requests buscando vulnerabilidades y malas prácticas.", icon: "🔍" },
  { id: "SCAFFOLDER", name: "Generador de Código Base", desc: "Crea estructuras de proyecto, módulos y boilerplate.", icon: "⚡" },
  { id: "CUSTOM", name: "Rol Personalizado", desc: "Describe tú mismo el rol del agente.", icon: "✨" },
];

export default function RoleStep() {
  const { answers, updateAnswer } = useStep();

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">¿Qué rol tendrá tu agente?</h2>
      <p className="text-gray-400 mb-6">
        El rol define la personalidad y el comportamiento del agente.
      </p>

      <div className="space-y-3 mb-6">
        {ROLES.map((r) => (
          <label
            key={r.id}
            className={`block p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
              answers.role === r.id
                ? "border-emerald-500 bg-emerald-900/20 scale-[1.02]"
                : "border-gray-800 bg-gray-900 hover:border-gray-700 hover:scale-[1.01]"
            }`}
          >
            <input
              type="radio"
              name="role"
              value={r.id}
              checked={answers.role === r.id}
              onChange={(e) => updateAnswer("role", e.target.value)}
              className="sr-only"
            />
            <div className="flex items-center gap-3">
              <span className="text-2xl">{r.icon}</span>
              <div>
                <div className="font-medium">{r.name}</div>
                <div className="text-sm text-gray-400">{r.desc}</div>
              </div>
            </div>
          </label>
        ))}
      </div>

      {answers.role === "CUSTOM" && (
        <textarea
          value={answers.roleCustom}
          onChange={(e) => updateAnswer("roleCustom", e.target.value)}
          placeholder="Describe el rol que necesitas, ej: 'Un agente experto en migraciones de bases de datos'..."
          className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-gray-100 h-24 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      )}
    </div>
  );
}
