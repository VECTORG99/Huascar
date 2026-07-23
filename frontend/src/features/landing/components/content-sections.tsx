"use client";

import Link from "next/link";

interface Section {
  id: string;
  title: string;
  description: string;
  detail: string;
  hue: number;
}

const sections: Section[] = [
  {
    id: "decision-tree",
    title: "Árbol de Decisiones",
    description: "26 preguntas que se adaptan a tu contexto",
    detail:
      "El árbol ajusta su camino según tus respuestas. Desarrollo o producción, monolito o microservicios, cada rama desbloquea preguntas relevantes y oculta las que no aplican.",
    hue: 200,
  },
  {
    id: "recommendations",
    title: "Recomendaciones Explicables",
    description: "Cada sugerencia incluye evidencia y alternativas",
    detail:
      "No decisiones probabilísticas. Reglas deterministas con motivo, beneficios, trade-offs y alternativas. Sabes exactamente por qué se recomienda algo y qué sacrificas.",
    hue: 280,
  },
  {
    id: "bundle",
    title: "Bundle Reproducible",
    description: "Configuración lista con hashes SHA-256",
    detail:
      "Blueprint, manifest, guía de instalación y documentación explicativa. El mismo input siempre genera el mismo output. Verificable, auditable, versionable.",
    hue: 160,
  },
  {
    id: "targets",
    title: "Multi-Target",
    description: "Huascar · Kiro · Portable",
    detail:
      "Genera artefactos para el runtime que prefieras. AGENTS.md, steering, hooks, skills, RAG, PR review — adaptados al formato de cada plataforma.",
    hue: 40,
  },
];

function PlanetIcon({ hue }: { hue: number }) {
  return (
    <div className="relative h-10 w-10 shrink-0">
      <div
        className="absolute inset-0 rounded-full border"
        style={{ borderColor: `hsla(${hue}, 80%, 60%, 0.2)` }}
      />
      <div
        className="absolute inset-2 rounded-full"
        style={{
          background: `radial-gradient(circle at 35% 35%, hsla(${hue}, 70%, 60%, 0.6), hsla(${hue}, 60%, 30%, 0.8))`,
          boxShadow: `0 0 12px hsla(${hue}, 100%, 60%, 0.3), inset 0 0 8px rgba(0,0,0,0.4)`,
        }}
      />
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="flex h-screen snap-start flex-col items-center justify-center px-6">
      <div className="relative z-10 max-w-3xl text-center">
        <h1 className="text-6xl font-bold tracking-tight text-white sm:text-7xl lg:text-8xl">
          <span className="bg-gradient-to-r from-white via-zinc-300 to-zinc-500 bg-clip-text text-transparent">
            Huascar
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-zinc-400">
          Diseña agentes de desarrollo y operación mediante un árbol de
          decisiones determinista. Genera su configuración. Entiende por qué fue
          construida así.
        </p>

        <Link
          href="/agents/new"
          className="group relative mt-10 inline-flex items-center gap-3 overflow-hidden rounded-full border border-white/10 bg-white/[0.03] px-8 py-4 text-lg font-medium text-white backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/[0.06]"
        >
          <span className="absolute inset-0 -z-10 bg-gradient-to-r from-purple-600/10 via-blue-600/10 to-cyan-600/10 opacity-0 transition-opacity group-hover:opacity-100" />
          <span>Empezar misión</span>
          <svg
            className="h-4 w-4 transition-transform group-hover:translate-x-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 7l5 5m0 0l-5 5m5-5H6"
            />
          </svg>
        </Link>
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="h-8 w-[1px] bg-gradient-to-b from-white/20 to-transparent" />
      </div>
    </section>
  );
}

export function ContentSections() {
  return (
    <>
      {sections.map((section) => (
        <section
          key={section.id}
          id={section.id}
          className="flex h-screen snap-start items-center justify-center px-6"
        >
          <div
            className="relative z-10 w-full max-w-2xl rounded-2xl border border-white/[0.06] bg-black/50 p-8 backdrop-blur-md transition-all hover:border-white/[0.1] hover:bg-black/60 sm:p-10"
            style={{
              boxShadow: `0 0 40px hsla(${section.hue}, 60%, 50%, 0.04), inset 0 1px 0 rgba(255,255,255,0.04)`,
            }}
          >
            <div className="flex items-start gap-5">
              <PlanetIcon hue={section.hue} />
              <div>
                <h2
                  className="text-2xl font-bold"
                  style={{ color: `hsla(${section.hue}, 60%, 75%, 1)` }}
                >
                  {section.title}
                </h2>
                <p className="mt-1 text-sm font-medium text-zinc-500">
                  {section.description}
                </p>
              </div>
            </div>
            <p className="mt-5 leading-relaxed text-zinc-300">
              {section.detail}
            </p>
          </div>
        </section>
      ))}

      {/* Final CTA */}
      <section className="flex h-screen snap-start items-center justify-center px-6">
        <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-white/[0.06] bg-black/50 p-10 text-center backdrop-blur-md">
          <h2 className="text-3xl font-bold text-white">
            ¿Listo para construir tu agente?
          </h2>
          <p className="mt-3 max-w-md mx-auto text-zinc-400">
            El Creator te guía paso a paso. Sin sorpresas, sin caja negra.
          </p>
          <Link
            href="/agents/new"
            className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-7 py-3 font-medium text-white backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/[0.08]"
          >
            Iniciar Creator →
          </Link>
        </div>
      </section>
    </>
  );
}
