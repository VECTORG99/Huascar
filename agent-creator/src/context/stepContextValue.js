import { createContext, useContext } from "react";

export const StepContext = createContext(null);

export function useStep() {
  const context = useContext(StepContext);
  if (!context) throw new Error("useStep debe utilizarse dentro de StepProvider.");
  return context;
}
