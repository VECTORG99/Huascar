import { useStep } from "../context/stepContextValue";

function download(name, content, mediaType) {
  const blob = new Blob([content], { type: mediaType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function CompletionScreen() {
  const { bundle, reset, error, loading } = useStep();
  if (!bundle) return null;

  const downloadBundle = () => {
    download(`${bundle.blueprint.identity.slug}-huascar-bundle.json`, JSON.stringify(bundle, null, 2), "application/json");
  };

  return (
    <div className="min-h-screen bg-zinc-950 px-5 py-8 text-zinc-100 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="rounded-2xl border border-emerald-900/60 bg-gradient-to-br from-emerald-950/50 to-zinc-900 p-7 sm:p-10">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-2xl font-bold text-zinc-950">✓</div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">Bundle generado</p>
              <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{bundle.blueprint.identity.name}</h1>
              <p className="mt-3 max-w-2xl text-zinc-300">{bundle.applicationGuide.summary}</p>
            </div>
            <button onClick={downloadBundle} className="rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white hover:bg-emerald-500">Descargar bundle JSON</button>
          </div>
          <div className="mt-7 grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-xl bg-black/20 p-4"><span className="block text-zinc-500">Artefactos</span><strong className="text-2xl">{bundle.artifacts.length}</strong></div>
            <div className="rounded-xl bg-black/20 p-4"><span className="block text-zinc-500">Targets</span><strong>{bundle.blueprint.agent.targets.join(", ")}</strong></div>
            <div className="rounded-xl bg-black/20 p-4"><span className="block text-zinc-500">Entorno</span><strong>{bundle.blueprint.environments.target}</strong></div>
          </div>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-7">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Archivos generados</h2>
                <p className="text-sm text-zinc-500">Revisa cada archivo antes de copiarlo al proyecto.</p>
              </div>
            </div>
            <div className="space-y-2">
              {bundle.artifacts.map(artifact => (
                <div key={artifact.path} className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-sm text-emerald-300">{artifact.path}</p>
                    <p className="mt-1 text-xs text-zinc-500">{artifact.description}</p>
                    <p className="mt-1 truncate font-mono text-[10px] text-zinc-700">sha256:{artifact.sha256}</p>
                  </div>
                  <button onClick={() => download(artifact.path.replaceAll("/", "__"), artifact.content, artifact.mediaType)} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800">Descargar</button>
                </div>
              ))}
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
              <h2 className="font-semibold">Cómo aplicarlo</h2>
              <ol className="mt-4 space-y-3 text-sm text-zinc-300">
                {bundle.applicationGuide.steps.map((step, index) => (
                  <li key={step} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs text-emerald-400">{index + 1}</span><span>{step}</span></li>
                ))}
              </ol>
            </section>

            {bundle.applicationGuide.productionChecklist.length > 0 && (
              <section className="rounded-2xl border border-amber-900/60 bg-amber-950/20 p-5">
                <h2 className="font-semibold text-amber-300">Checklist de producción</h2>
                <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                  {bundle.applicationGuide.productionChecklist.map(item => <li key={item}>□ {item}</li>)}
                </ul>
              </section>
            )}

            {bundle.warnings.length > 0 && (
              <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <h2 className="font-semibold">Antes de usar</h2>
                <ul className="mt-3 space-y-2 text-sm text-zinc-400">
                  {bundle.warnings.map(item => <li key={item}>• {item}</li>)}
                </ul>
              </section>
            )}

            {error && <p role="alert" aria-live="polite" className="text-sm text-red-400">{error}</p>}
            <button onClick={reset} disabled={loading} aria-busy={loading} className="w-full rounded-xl border border-zinc-700 px-5 py-3 font-medium text-zinc-300 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Reiniciando..." : "Crear otro agente"}</button>
            {loading && <p role="status" aria-live="polite" className="sr-only">Reiniciando el Creator.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
