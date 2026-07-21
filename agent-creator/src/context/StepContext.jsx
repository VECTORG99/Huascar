import { createContext, useContext, useState, useCallback } from "react";

const StepContext = createContext();

const STEPS = [
  { id: "welcome",   label: "Bienvenida" },
  { id: "role",      label: "Rol del Agente" },
  { id: "task",      label: "Tarea Principal" },
  { id: "knowledge", label: "Fuentes de Conocimiento" },
  { id: "tools",     label: "Herramientas (MCPs)" },
  { id: "security",  label: "Seguridad y Reglas" },
  { id: "review",    label: "Revisión y Generar" },
];

const INITIAL_ANSWERS = {
  role: "PR_REVIEWER",
  roleCustom: "",
  task: "",
  knowledge: {
    localRepo: false,
    webDocs: { enabled: false, url: "" },
    conventions: { enabled: false, text: "" },
  },
  tools: { github: false, terminal: false, filesystem: false },
  security: { requireApproval: true, blockDestructive: true },
};

export function StepProvider({ children }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState(INITIAL_ANSWERS);
  const [validations, setValidations] = useState({});
  const [completed, setCompleted] = useState(false);

  const updateAnswer = (key, value) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const registerValidation = useCallback((stepId, fn) => {
    setValidations((prev) => ({ ...prev, [stepId]: fn }));
  }, []);

  const canProceed = validations[STEPS[currentStep]?.id]?.() ?? true;

  const nextStep = () => {
    if (currentStep === STEPS.length - 1) {
      setCompleted(true);
    } else {
      setCurrentStep((p) => Math.min(p + 1, STEPS.length - 1));
    }
  };

  const prevStep = () => setCurrentStep((p) => Math.max(p - 1, 0));

  const reset = () => {
    setCurrentStep(0);
    setAnswers(INITIAL_ANSWERS);
    setCompleted(false);
    setValidations({});
  };

  return (
    <StepContext.Provider
      value={{
        currentStep, STEPS, answers, updateAnswer,
        registerValidation, canProceed, completed, reset,
        nextStep, prevStep,
        isFirst: currentStep === 0,
        isLast: currentStep === STEPS.length - 1,
      }}
    >
      {children}
    </StepContext.Provider>
  );
}

export const useStep = () => useContext(StepContext);
