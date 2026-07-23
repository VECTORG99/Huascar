// ─── Primitives ───────────────────────────────────────────────────────────────

export type CreatorAnswerValue = string | boolean | string[];
export type CreatorAnswers = Record<string, CreatorAnswerValue>;
export type EnvironmentScope = 'development' | 'production' | 'both';
export type QuestionType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'multiselect'
  | 'boolean'
  | 'catalog-multiselect'
  | 'catalog-select';

// ─── Catalog ──────────────────────────────────────────────────────────────────

export interface CatalogCategory {
  id: string;
  label: string;
  description: string;
  multiple: boolean;
}

export interface CatalogItem {
  id: string;
  category: string;
  label: string;
  description: string;
  tags: string[];
  environments: EnvironmentScope[];
  recommendedFor: string[];
}

export interface Catalog {
  version: string;
  categories: CatalogCategory[];
  items: CatalogItem[];
}

// ─── Decision Tree ────────────────────────────────────────────────────────────

export interface QuestionOption {
  id: string;
  label: string;
  description: string;
}

export type QuestionCondition =
  | { operator: 'equals'; questionId: string; value: CreatorAnswerValue }
  | { operator: 'oneOf'; questionId: string; values: CreatorAnswerValue[] }
  | { operator: 'includes'; questionId: string; value: string }
  | { operator: 'all'; conditions: QuestionCondition[] }
  | { operator: 'any'; conditions: QuestionCondition[] };

export interface DecisionQuestion {
  id: string;
  section: string;
  prompt: string;
  description: string;
  type: QuestionType;
  required: boolean;
  placeholder?: string;
  options?: QuestionOption[];
  catalogCategories?: string[];
  visibleWhen?: QuestionCondition;
  maxSelections?: number;
}

export interface Workflow {
  version: string;
  questions: DecisionQuestion[];
}

// ─── Tutorial ─────────────────────────────────────────────────────────────────

export interface TutorialStage {
  id: string;
  title: string;
  narrative: string;
  learning: string;
}

export interface Tutorial {
  title: string;
  skippable: boolean;
  stages: TutorialStage[];
}

// ─── Evaluation ───────────────────────────────────────────────────────────────

export interface CreatorRecommendation {
  id: string;
  severity: 'info' | 'recommended' | 'warning';
  title: string;
  reason: string;
  evidence: string[];
  benefits: string[];
  tradeoffs: string[];
  alternatives: string[];
}

export interface AnswerIssue {
  path: string;
  message: string;
}

export interface EvaluationProgress {
  answered: number;
  total: number;
  percent: number;
  complete: boolean;
}

export interface DecisionEvaluation {
  workflowVersion: string;
  answers: CreatorAnswers;
  visibleQuestions: DecisionQuestion[];
  answeredQuestionIds: string[];
  nextQuestion: DecisionQuestion | null;
  progress: EvaluationProgress;
  recommendations: CreatorRecommendation[];
  warnings: string[];
  issues: AnswerIssue[];
}

// ─── Blueprint ────────────────────────────────────────────────────────────────

export interface AgentBlueprint {
  schemaVersion: string;
  identity: {
    name: string;
    slug: string;
    description: string;
  };
  purpose: {
    type: string;
    objective: string;
    successCriteria: string;
  };
  project: {
    stage: string;
    architecture: string;
    technologies: string[];
    repositoryProvider: string;
  };
  environments: {
    target: EnvironmentScope;
    developmentSetup: string | null;
    deploymentTarget: string | null;
    cloudProvider: string | null;
    containerPlatforms: string[];
  };
  devops: {
    ciCd: string;
    infrastructure: string[];
    observability: string[];
    compliance: string[];
  };
  agent: {
    autonomy: string;
    capabilities: string[];
    targets: string[];
    requireHumanApproval: boolean;
  };
  knowledge: {
    enabled: boolean;
    sources: string[];
  };
  prReview: {
    enabled: boolean;
    focus: string[];
  };
  features: {
    hooks: boolean;
    skills: boolean;
    steering: boolean;
    agentsMd: boolean;
    kiro: boolean;
  };
  recommendations: CreatorRecommendation[];
}

// ─── Generated Bundle ─────────────────────────────────────────────────────────

export type ArtifactKind = 'configuration' | 'documentation' | 'instruction' | 'manifest';
export type ArtifactMediaType = 'application/json' | 'text/markdown';

export interface GeneratedArtifact {
  path: string;
  kind: ArtifactKind;
  mediaType: ArtifactMediaType;
  description: string;
  content: string;
  sha256: string;
}

export interface BundleManifest {
  agent: string;
  artifactCount: number;
  targets: string[];
  files: Array<{ path: string; sha256: string; kind: ArtifactKind }>;
}

export interface ApplicationGuide {
  summary: string;
  steps: string[];
  productionChecklist: string[];
}

export interface GeneratedAgentBundle {
  generatorVersion: string;
  blueprint: AgentBlueprint;
  artifacts: GeneratedArtifact[];
  manifest: BundleManifest;
  applicationGuide: ApplicationGuide;
  warnings: string[];
}

// ─── API Request/Response ─────────────────────────────────────────────────────

export interface EvaluateRequest {
  workflowVersion: string;
  catalogVersion: string;
  answers: CreatorAnswers;
}

export interface PreviewRequest {
  workflowVersion: string;
  catalogVersion: string;
  answers: CreatorAnswers;
}

// ─── Runtime (legacy) ─────────────────────────────────────────────────────────

export interface ExecuteRequest {
  task: string;
  role: string;
  config?: Record<string, unknown>;
  system_prompt?: string;
}

export interface ExecuteResponse {
  status: 'success' | 'error' | 'blocked';
  agent_role: string;
  response: string;
  error?: string;
}

export interface HistoryRecord {
  id: number;
  role: string;
  task: string;
  response: string;
  created_at: string;
}

export interface HealthResponse {
  status: string;
  uptime: number;
  version?: string;
}

// ─── API Error ────────────────────────────────────────────────────────────────

export interface ApiProblem {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  issues?: AnswerIssue[];
}
