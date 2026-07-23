"use client";

import { createContext, useContext } from "react";

/**
 * Creator wizard state management.
 * Migrar lógica completa de agent-creator/src/context/StepContext.jsx aquí.
 */

interface CreatorState {
  // TODO: Completar con el estado del wizard
}

const CreatorContext = createContext<CreatorState | null>(null);

export function useCreator(): CreatorState {
  const ctx = useContext(CreatorContext);
  if (!ctx) throw new Error("useCreator must be used within CreatorProvider");
  return ctx;
}

export function CreatorProvider({ children }: { children: React.ReactNode }) {
  // TODO: Migrar lógica de StepProvider
  return (
    <CreatorContext.Provider value={{} as CreatorState}>
      {children}
    </CreatorContext.Provider>
  );
}
