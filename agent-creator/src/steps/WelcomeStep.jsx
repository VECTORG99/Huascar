import { useStep } from "../context/StepContext";

export default function WelcomeStep() {
  const { nextStep } = useStep();
  return (
    <div className="text-center py-12">
      <div className="text-6xl mb-6">🤖</div>
      <h2 className="text-3xl font-bold mb-4">
        Crea tu Agente de Productividad
      </h2>
      <p className="text-gray-400 text-lg mb-8 max-w-lg mx-auto">
        Responde unas preguntas y Huascar generar&aacute; la configuraci&oacute;n
        completa de tu agente. No necesitas escribir c&oacute;digo.
      </p>
      <div className="grid grid-cols-2 gap-4 text-left max-w-md mx-auto mb-8">
        <div className="bg-gray-900 p-4 rounded-lg border border-gray-800">
          <div className="text-emerald-400 text-lg font-bold">1</div>
          <div className="text-sm text-gray-400">Define su rol</div>
        </div>
        <div className="bg-gray-900 p-4 rounded-lg border border-gray-800">
          <div className="text-emerald-400 text-lg font-bold">2</div>
          <div className="text-sm text-gray-400">Describe la tarea</div>
        </div>
        <div className="bg-gray-900 p-4 rounded-lg border border-gray-800">
          <div className="text-emerald-400 text-lg font-bold">3</div>
          <div className="text-sm text-gray-400">Con&eacute;ctale herramientas</div>
        </div>
        <div className="bg-gray-900 p-4 rounded-lg border border-gray-800">
          <div className="text-emerald-400 text-lg font-bold">4</div>
          <div className="text-sm text-gray-400">A&ntilde;ade seguridad</div>
        </div>
      </div>
      <button
        onClick={nextStep}
        className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 px-8 rounded-lg transition"
      >
        Comenzar
      </button>
    </div>
  );
}
