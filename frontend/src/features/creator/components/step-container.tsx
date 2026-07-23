"use client";

/**
 * Layout del wizard: header con progreso, sidebar de navegación, footer con acciones.
 */
export function StepContainer({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-zinc-950">{children}</div>;
}
