"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { evaluateCreator, generateCreator, getCreatorCatalog, getCreatorWorkflow, registerAgent } from "@/lib/api";
import type { AgentConfig } from "@/types/agent";
import type { CreatorAnswers, CreatorCatalog, CreatorQuestion, CreatorWorkflow, GeneratedAgentBundle, RegisteredAgent } from "@/types/creator";

function defaultAnswer(question: CreatorQuestion): string | boolean | string[] {
  if (question.type === "boolean") return false;
  if (question.type === "multiselect" || question.type === "catalog-multiselect") return [];
  return "";
}

function parseJsonArtifact<T>(bundle: GeneratedAgentBundle, path: string): T | null {
  const artifact = bundle.artifacts.find(item => item.path === path);
  if (!artifact) return null;
  try { return JSON.parse(artifact.content) as T; } catch { return null; }
}

function buildRegistryConfig(bundle: GeneratedAgentBundle, answers: CreatorAnswers): AgentConfig {
  const steering = parseJsonArtifact<AgentConfig["steering"]>(bundle, "huascar/steering.json");
  const rag = parseJsonArtifact<{ knowledge_bases?: unknown[] }>(bundle, "huascar/rag.json");
  const mcps = parseJsonArtifact<Record<string, unknown>>(bundle, "huascar/mcps.json");
  const prompt = typeof answers.objective === "string" ? answers.objective : "Agente generado desde Creator.";
  return {
    steering: steering ?? { roles: { GENERATED_AGENT: { system_prompt: prompt } } },
    ...(rag ? { rag: { sources: rag.knowledge_bases ?? [] } } : {}),
    ...(mcps ? { mcps: Object.keys(mcps.mcpServers && typeof mcps.mcpServers === "object" ? mcps.mcpServers : mcps) } : {})
  };
}

export default function NewAgentPage() {
  const [catalog, setCatalog] = useState<CreatorCatalog | null>(null);
  const [workflow, setWorkflow] = useState<CreatorWorkflow | null>(null);
  const [answers, setAnswers] = useState<CreatorAnswers>({});
  const [question, setQuestion] = useState<CreatorQuestion | null>(null);
  const [progress, setProgress] = useState(0);
  const [bundle, setBundle] = useState<GeneratedAgentBundle | null>(null);
  const [registered, setRegistered] = useState<RegisteredAgent | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getCreatorCatalog(), getCreatorWorkflow()])
      .then(([catalogData, workflowData]) => {
        setCatalog(catalogData);
        setWorkflow(workflowData);
        return evaluateCreator({}, workflowData);
      })
      .then(evaluation => {
        setQuestion(evaluation.nextQuestion);
        setProgress(evaluation.progress.percent);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const value = question ? answers[question.id] ?? defaultAnswer(question) : "";
  const options = useMemo(() => {
    if (!question) return [];
    if (question.options) return question.options;
    return (catalog?.items ?? []).filter(item => question.catalogCategories?.includes(item.category));
  }, [catalog, question]);

  async function submitAnswer() {
    if (!workflow || !question) return;
    setError("");
    const nextAnswers = { ...answers, [question.id]: value };
    try {
      const evaluation = await evaluateCreator(nextAnswers, workflow);
      setAnswers(evaluation.answers);
      setProgress(evaluation.progress.percent);
      if (evaluation.progress.complete) {
        const generated = await generateCreator(evaluation.answers, workflow);
        setBundle(generated);
        setQuestion(null);
      } else {
        setQuestion(evaluation.nextQuestion);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo evaluar la respuesta.");
    }
  }

  async function registerGeneratedAgent() {
    if (!bundle) return;
    setError("");
    try {
      const name = bundle.blueprint?.identity?.name || String(answers.agent_name || "Generated Agent");
      setRegistered(await registerAgent(name, buildRegistryConfig(bundle, answers)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el agente.");
    }
  }

  const canContinue = question?.type === "boolean" || (Array.isArray(value) ? value.length > 0 : String(value).trim().length > 0);

  return (
    <main className="min-h-screen bg-zinc-950 p-8 text-zinc-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-300">Creator integrado</p>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-50">Nuevo agente</h1>
            <p className="text-zinc-400">Flujo mínimo guiado por el backend: preguntas, bundle y registro.</p>
          </div>
          <Link href="/" className="text-sm text-zinc-400 transition-colors hover:text-emerald-300">Volver al dashboard</Link>
        </header>

        <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl shadow-emerald-950/20">
          <div className="h-1 bg-zinc-800"><div className="h-full bg-emerald-400 transition-all" style={{ width: `${progress}%` }} /></div>
          <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="flex min-h-96 flex-col gap-6 p-6 sm:p-8">
              {loading && <p className="text-zinc-400">Cargando workflow...</p>}
              {error && <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}

              {question && (
                <>
                  <div>
                    <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">{question.section}</span>
                    <h2 className="mt-4 text-2xl font-semibold text-zinc-100">{question.prompt}</h2>
                    {question.description && <p className="mt-2 text-zinc-400">{question.description}</p>}
                  </div>

                  <QuestionInput question={question} options={options} value={value} onChange={next => setAnswers(current => ({ ...current, [question.id]: next }))} />

                  <button onClick={submitAnswer} disabled={!canContinue} className="mt-auto rounded-md bg-emerald-600 px-5 py-3 font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-zinc-700">
                    Continuar
                  </button>
                </>
              )}

              {bundle && (
                <div className="flex flex-col gap-5">
                  <div>
                    <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">Bundle generado</span>
                    <h2 className="mt-4 text-2xl font-semibold">{bundle.blueprint?.identity?.name || answers.agent_name}</h2>
                    <p className="mt-2 text-zinc-400">{bundle.artifacts.length} artefactos listos. Regístralo para usarlo desde el dashboard.</p>
                  </div>
                  {registered ? (
                    <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-100">Agente registrado: {registered.name}</div>
                  ) : (
                    <button onClick={registerGeneratedAgent} className="rounded-md bg-emerald-600 px-5 py-3 font-medium text-white transition-colors hover:bg-emerald-500">Registrar agente</button>
                  )}
                </div>
              )}
            </div>

            <aside className="border-t border-zinc-800 bg-zinc-950/70 p-6 lg:border-l lg:border-t-0">
              <h3 className="font-semibold text-zinc-200">Resumen</h3>
              <dl className="mt-4 space-y-3 text-sm">
                {Object.entries(answers).map(([key, item]) => <div key={key}><dt className="text-zinc-500">{key}</dt><dd className="break-words text-zinc-300">{Array.isArray(item) ? item.join(", ") : String(item)}</dd></div>)}
              </dl>
              {bundle && <pre className="mt-6 max-h-64 overflow-auto rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-300">{bundle.artifacts.map(item => item.path).join("\n")}</pre>}
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

function QuestionInput({ question, options, value, onChange }: { question: CreatorQuestion; options: { id: string; label: string; description?: string }[]; value: string | boolean | string[]; onChange: (value: string | boolean | string[]) => void }) {
  const base = "w-full rounded-md border border-zinc-700 bg-zinc-950 p-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500";
  if (question.type === "textarea") return <textarea className={`${base} h-40 resize-none`} placeholder={question.placeholder} value={String(value)} onChange={event => onChange(event.target.value)} />;
  if (question.type === "text") return <input className={base} placeholder={question.placeholder} value={String(value)} onChange={event => onChange(event.target.value)} />;
  if (question.type === "boolean") return <label className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-zinc-200"><input type="checkbox" checked={Boolean(value)} onChange={event => onChange(event.target.checked)} /> Sí</label>;
  if (question.type === "select" || question.type === "catalog-select") return <select className={base} value={String(value)} onChange={event => onChange(event.target.value)}><option value="">Selecciona una opción</option>{options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select>;
  const selected = Array.isArray(value) ? value : [];
  return <div className="grid gap-2 sm:grid-cols-2">{options.map(option => <label key={option.id} className="flex gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200"><input type="checkbox" checked={selected.includes(option.id)} onChange={event => onChange(event.target.checked ? [...selected, option.id] : selected.filter(id => id !== option.id))} /><span><span className="block font-medium">{option.label}</span>{option.description && <span className="text-zinc-500">{option.description}</span>}</span></label>)}</div>;
}
