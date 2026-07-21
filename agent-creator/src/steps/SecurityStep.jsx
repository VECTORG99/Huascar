import { useStep } from "../context/StepContext";

export default function SecurityStep() {
  const { answers, updateAnswer } = useStep();

  const toggleSecurity = (key) => {
    updateAnswer("security", {
      ...answers.security,
      [key]: !answers.security[key],
    });
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">&iquest;Qu&eacute; reglas de seguridad debe seguir?</h2>
      <p className="text-gray-400 mb-6">
        Define los l&iacute;mites de tu agente para evitar acciones no deseadas.
      </p>

      <div className="space-y-3">
        <label
          className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition ${
            answers.security.requireApproval
              ? "border-emerald-500 bg-emerald-900/20"
              : "border-gray-800 bg-gray-900 hover:border-gray-700"
          }`}
        >
          <input
            type="checkbox"
            checked={answers.security.requireApproval}
            onChange={() => toggleSecurity("requireApproval")}
            className="w-5 h-5 accent-emerald-500"
          />
          <div>
            <div className="font-medium">Requiere aprobaci&oacute;n humana para commits</div>
            <div className="text-sm text-gray-400">
              El agente prepara el cambio pero espera tu confirmaci&oacute;n antes de hacer commit
            </div>
          </div>
        </label>

        <label
          className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition ${
            answers.security.blockDestructive
              ? "border-emerald-500 bg-emerald-900/20"
              : "border-gray-800 bg-gray-900 hover:border-gray-700"
          }`}
        >
          <input
            type="checkbox"
            checked={answers.security.blockDestructive}
            onChange={() => toggleSecurity("blockDestructive")}
            className="w-5 h-5 accent-emerald-500"
          />
          <div>
            <div className="font-medium">Bloquear comandos destructivos</div>
            <div className="text-sm text-gray-400">
              Impide que el agente ejecute rm -rf, drop table, push --force, etc.
            </div>
          </div>
        </label>
      </div>

      <div className="mt-6 p-4 bg-gray-900 rounded-lg border border-gray-800">
        <div className="text-sm font-medium text-gray-300 mb-2">
          Resumen de seguridad
        </div>
        <ul className="text-sm text-gray-400 space-y-1">
          <li>
            &bull; Human-in-the-loop:{" "}
            {answers.security.requireApproval ? (
              <span className="text-emerald-400">Activado</span>
            ) : (
              <span className="text-gray-600">Desactivado</span>
            )}
          </li>
          <li>
            &bull; Protecci&oacute;n destructiva:{" "}
            {answers.security.blockDestructive ? (
              <span className="text-emerald-400">Activada</span>
            ) : (
              <span className="text-gray-600">Desactivada</span>
            )}
          </li>
        </ul>
      </div>
    </div>
  );
}
