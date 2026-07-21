import { StepProvider, useStep } from "./context/StepContext";
import StepContainer from "./components/StepContainer";
import WelcomeStep from "./steps/WelcomeStep";
import RoleStep from "./steps/RoleStep";
import TaskStep from "./steps/TaskStep";
import KnowledgeStep from "./steps/KnowledgeStep";
import ToolsStep from "./steps/ToolsStep";
import SecurityStep from "./steps/SecurityStep";
import ReviewStep from "./steps/ReviewStep";
import CompletionScreen from "./steps/CompletionScreen";

const STEP_COMPONENTS = [
  WelcomeStep,
  RoleStep,
  TaskStep,
  KnowledgeStep,
  ToolsStep,
  SecurityStep,
  ReviewStep,
];

function StepRenderer() {
  const { currentStep, completed } = useStep();

  if (completed) return <CompletionScreen />;

  const Component = STEP_COMPONENTS[currentStep];
  return (
    <StepContainer>
      <Component />
    </StepContainer>
  );
}

export default function App() {
  return (
    <StepProvider>
      <StepRenderer />
    </StepProvider>
  );
}
