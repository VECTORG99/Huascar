import { useStep } from "../context/StepContext";

export default function CompletionScreen() {
  const { reset } = useStep();

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="text-5xl mb-6 font-bold text-emerald-400">DONE</div>
        <h2 className="text-3xl font-bold mb-4 text-emerald-400">
          Agente Creado
        </h2>
        <p className="text-gray-400 mb-8">
          La configuraci&oacute;n de tu agente Huascar est&aacute; lista.
          Puedes revisar el JSON generado o crear otro agente.
        </p>
        <button
          onClick={reset}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 px-8 rounded-lg transition"
        >
          Crear otro agente
        </button>
      </div>
    </div>
  );
}
