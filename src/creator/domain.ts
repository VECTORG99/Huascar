export type CreatorAnswerValue = string | boolean | string[];
export type CreatorAnswers = Record<string, CreatorAnswerValue>;

export type EnvironmentScope = 'development' | 'production' | 'both';
export type QuestionType = 'text' | 'textarea' | 'select' | 'multiselect' | 'boolean' | 'catalog-multiselect' | 'catalog-select';

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

export interface DecisionEvaluation {
  workflowVersion: string;
  answers: CreatorAnswers;
  visibleQuestions: DecisionQuestion[];
  answeredQuestionIds: string[];
  nextQuestion: DecisionQuestion | null;
  progress: {
    answered: number;
    total: number;
    percent: number;
    complete: boolean;
  };
  recommendations: CreatorRecommendation[];
  warnings: string[];
  issues: AnswerIssue[];
}

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

export interface GeneratedArtifact {
  path: string;
  kind: 'configuration' | 'documentation' | 'instruction' | 'manifest';
  mediaType: 'application/json' | 'text/markdown';
  description: string;
  content: string;
  sha256: string;
}

export interface GeneratedAgentBundle {
  generatorVersion: string;
  blueprint: AgentBlueprint;
  artifacts: GeneratedArtifact[];
  manifest: {
    agent: string;
    artifactCount: number;
    targets: string[];
    files: Array<{ path: string; sha256: string; kind: GeneratedArtifact['kind'] }>;
  };
  applicationGuide: {
    summary: string;
    steps: string[];
    productionChecklist: string[];
  };
  warnings: string[];
}

export class CreatorInputError extends Error {
  readonly statusCode: number;
  readonly issues: AnswerIssue[];

  constructor(message: string, issues: AnswerIssue[], statusCode = 400) {
    super(message);
    this.name = 'CreatorInputError';
    this.issues = issues;
    this.statusCode = statusCode;
  }
}
