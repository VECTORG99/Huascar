export type CreatorAnswerValue = string | boolean | string[];

export type CreatorAnswers = Record<string, CreatorAnswerValue>;

export interface CreatorOption {
  id: string;
  label: string;
  description?: string;
}

export interface CreatorQuestion {
  id: string;
  section: string;
  prompt: string;
  description?: string;
  type: "text" | "textarea" | "select" | "multiselect" | "boolean" | "catalog-select" | "catalog-multiselect";
  required: boolean;
  placeholder?: string;
  options?: CreatorOption[];
  catalogCategories?: string[];
  maxSelections?: number;
}

export interface CreatorCatalogItem extends CreatorOption {
  category: string;
}

export interface CreatorCatalog {
  version: string;
  items: CreatorCatalogItem[];
}

export interface CreatorWorkflow {
  version: string;
  catalogVersion: string;
  questions: CreatorQuestion[];
}

export interface CreatorEvaluation {
  workflowVersion: string;
  answers: CreatorAnswers;
  nextQuestion: CreatorQuestion | null;
  progress: { answered: number; total: number; percent: number; complete: boolean };
  recommendations: { id: string; severity: string; title: string; reason: string }[];
  warnings: string[];
  issues: { path: string; message: string }[];
}

export interface GeneratedArtifact {
  path: string;
  kind: string;
  mediaType: string;
  description: string;
  content: string;
}

export interface GeneratedAgentBundle {
  blueprint?: { identity?: { name?: string; slug?: string; description?: string } };
  artifacts: GeneratedArtifact[];
  warnings?: string[];
}

export interface RegisteredAgent {
  id: string;
  name: string;
  config?: unknown;
}
