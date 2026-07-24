/**
 * Pipeline engine for multi-agent orchestration with sequential/parallel steps,
 * conditional execution, delegation, and loop protection.
 */
import { logger } from '../logger.js';

export interface PipelineStep {
  role: string;
  task: string;
  condition?: string;
  retries?: number;
  parallel?: boolean;
}

export interface PipelineDefinition {
  id: string;
  name: string;
  steps: PipelineStep[];
  onFailure: 'abort' | 'continue' | 'rollback';
  maxDelegationDepth?: number;
}

export interface StepResult {
  role: string;
  status: 'success' | 'skipped' | 'failed';
  output: string;
  durationMs: number;
  error?: string;
}

export interface PipelineResult {
  pipelineId: string;
  status: 'completed' | 'failed' | 'partial';
  steps: StepResult[];
  totalDurationMs: number;
}

export type ExecuteStepFn = (
  role: string,
  task: string,
  previousContext: string,
) => Promise<{ status: string; response?: string; error?: string }>;

export class PipelineEngine {
  private readonly maxDelegationDepth: number;
  private currentDepth = 0;

  constructor(
    private readonly executeStep: ExecuteStepFn,
    maxDelegationDepth = 5,
  ) {
    this.maxDelegationDepth = maxDelegationDepth;
  }

  /**
   * Execute a pipeline definition sequentially.
   */
  async execute(pipeline: PipelineDefinition): Promise<PipelineResult> {
    const startTime = Date.now();
    const results: StepResult[] = [];
    let previousOutput = '';

    logger.info({ pipeline: pipeline.id, steps: pipeline.steps.length }, '[PipelineEngine] Starting pipeline');

    for (const step of pipeline.steps) {
      // Check condition
      if (step.condition && !this.evaluateCondition(step.condition, results)) {
        results.push({
          role: step.role,
          status: 'skipped',
          output: '',
          durationMs: 0,
        });
        continue;
      }

      const stepStart = Date.now();
      const maxRetries = step.retries ?? 0;
      let stepResult: StepResult | null = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          this.checkDelegationDepth();
          const taskWithContext = previousOutput
            ? `Context from previous step:\n${previousOutput}\n\nTask: ${step.task}`
            : step.task;

          const result = await this.executeStep(step.role, taskWithContext, previousOutput);

          stepResult = {
            role: step.role,
            status: result.status === 'success' ? 'success' : 'failed',
            output: result.response ?? result.error ?? '',
            durationMs: Date.now() - stepStart,
            error: result.error,
          };

          if (stepResult.status === 'success') break;
        } catch (err: unknown) {
          stepResult = {
            role: step.role,
            status: 'failed',
            output: '',
            durationMs: Date.now() - stepStart,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }

      results.push(stepResult!);

      if (stepResult!.status === 'success') {
        previousOutput = stepResult!.output;
      } else if (pipeline.onFailure === 'abort') {
        logger.warn({ pipeline: pipeline.id, step: step.role }, '[PipelineEngine] Step failed, aborting');
        break;
      }
    }

    const allSuccess = results.every((r) => r.status === 'success' || r.status === 'skipped');
    const anySuccess = results.some((r) => r.status === 'success');

    return {
      pipelineId: pipeline.id,
      status: allSuccess ? 'completed' : anySuccess ? 'partial' : 'failed',
      steps: results,
      totalDurationMs: Date.now() - startTime,
    };
  }

  /**
   * Delegate to another agent (used as a tool within the ReAct loop).
   */
  async delegate(role: string, task: string, context = ''): Promise<string> {
    this.currentDepth++;
    try {
      this.checkDelegationDepth();
      const result = await this.executeStep(role, task, context);
      return result.response ?? result.error ?? 'No response';
    } finally {
      this.currentDepth--;
    }
  }

  private checkDelegationDepth(): void {
    if (this.currentDepth > this.maxDelegationDepth) {
      throw new Error(
        `Maximum delegation depth (${this.maxDelegationDepth}) exceeded. Possible infinite delegation loop.`,
      );
    }
  }

  /**
   * Simple condition evaluator — ONLY supports known safe patterns.
   * Rejects arbitrary strings. Whitelist approach prevents injection.
   */
  private evaluateCondition(condition: string, results: StepResult[]): boolean {
    const previous = results[results.length - 1];
    if (!previous) return true;

    // Only allow exact known condition patterns
    const ALLOWED_CONDITIONS: Record<string, (prev: StepResult) => boolean> = {
      "previous.status === 'success'": (p) => p.status === 'success',
      'previous.status === "success"': (p) => p.status === 'success',
      "previous.status === 'failed'": (p) => p.status === 'failed',
      'previous.status === "failed"': (p) => p.status === 'failed',
      "previous.status === 'blocked'": (p) => p.status === 'failed',
      'previous.status === "blocked"': (p) => p.status === 'failed',
      "previous.status === 'skipped'": (p) => p.status === 'skipped',
      'previous.status === "skipped"': (p) => p.status === 'skipped',
    };

    const trimmed = condition.trim();
    const evaluator = ALLOWED_CONDITIONS[trimmed];
    if (evaluator) return evaluator(previous);

    // Unknown condition — fail-closed: do NOT execute the step
    logger.warn({ condition }, '[PipelineEngine] Unknown condition pattern, defaulting to SKIP (fail-closed)');
    return false;
  }

  /**
   * Validate a pipeline definition.
   */
  static validate(pipeline: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!pipeline || typeof pipeline !== 'object') {
      return { valid: false, errors: ['Pipeline must be an object'] };
    }
    const p = pipeline as Record<string, unknown>;
    if (!p.id || typeof p.id !== 'string') errors.push('Pipeline must have a string id');
    if (!p.name || typeof p.name !== 'string') errors.push('Pipeline must have a string name');
    if (!Array.isArray(p.steps) || p.steps.length === 0) errors.push('Pipeline must have non-empty steps array');
    if (p.onFailure && !['abort', 'continue', 'rollback'].includes(p.onFailure as string)) {
      errors.push('onFailure must be abort, continue, or rollback');
    }
    if (Array.isArray(p.steps)) {
      for (let i = 0; i < p.steps.length; i++) {
        const step = p.steps[i] as Record<string, unknown>;
        if (!step.role || typeof step.role !== 'string') errors.push(`Step ${i}: must have a string role`);
        if (!step.task || typeof step.task !== 'string') errors.push(`Step ${i}: must have a string task`);
      }
    }
    return { valid: errors.length === 0, errors };
  }
}
