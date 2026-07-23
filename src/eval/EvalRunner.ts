/**
 * Evaluation framework for measuring agent quality with quantitative metrics.
 * Runs eval suites against the engine and produces reports.
 */
import { logger } from '../logger.js';

export interface EvalCase {
  id: string;
  task: string;
  role: string;
  expectedContains?: string[];
  expectedNotContains?: string[];
  shouldComplete: boolean;
  maxIterations?: number;
  tags?: string[];
}

export interface EvalSuite {
  id: string;
  name: string;
  description: string;
  cases: EvalCase[];
}

export interface EvalMetrics {
  latencyMs: number;
  iterationsUsed: number;
  toolsCalled: string[];
  tokensInput: number;
  tokensOutput: number;
  costUsd: number;
  taskCompleted: boolean;
  safetyViolations: number;
}

export interface EvalCaseResult {
  caseId: string;
  passed: boolean;
  metrics: EvalMetrics;
  response: string;
  errors: string[];
}

export interface EvalReport {
  suiteId: string;
  suiteName: string;
  timestamp: string;
  duration_ms: number;
  results: EvalCaseResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
    avgLatencyMs: number;
    avgIterations: number;
    totalCostUsd: number;
  };
}

export type ExecuteFn = (
  task: string,
  role: string,
) => Promise<{
  status: string;
  response?: string;
  error?: string;
  metrics?: Partial<EvalMetrics>;
}>;

export class EvalRunner {
  constructor(private readonly executeFn: ExecuteFn) {}

  /**
   * Run a single eval case and produce metrics.
   */
  async runCase(evalCase: EvalCase): Promise<EvalCaseResult> {
    const errors: string[] = [];
    const startTime = Date.now();

    try {
      const result = await this.executeFn(evalCase.task, evalCase.role);
      const latencyMs = Date.now() - startTime;
      const response = result.response ?? result.error ?? '';

      // Check expected content
      if (evalCase.expectedContains) {
        for (const expected of evalCase.expectedContains) {
          if (!response.toLowerCase().includes(expected.toLowerCase())) {
            errors.push(`Expected response to contain: "${expected}"`);
          }
        }
      }
      if (evalCase.expectedNotContains) {
        for (const notExpected of evalCase.expectedNotContains) {
          if (response.toLowerCase().includes(notExpected.toLowerCase())) {
            errors.push(`Expected response NOT to contain: "${notExpected}"`);
          }
        }
      }

      const taskCompleted = result.status === 'success';
      if (evalCase.shouldComplete && !taskCompleted) {
        errors.push('Expected task to complete successfully');
      }
      if (!evalCase.shouldComplete && taskCompleted) {
        errors.push('Expected task to be blocked but it completed');
      }

      const metrics: EvalMetrics = {
        latencyMs,
        iterationsUsed: result.metrics?.iterationsUsed ?? 1,
        toolsCalled: result.metrics?.toolsCalled ?? [],
        tokensInput: result.metrics?.tokensInput ?? 0,
        tokensOutput: result.metrics?.tokensOutput ?? 0,
        costUsd: result.metrics?.costUsd ?? 0,
        taskCompleted,
        safetyViolations: result.metrics?.safetyViolations ?? 0,
      };

      return {
        caseId: evalCase.id,
        passed: errors.length === 0,
        metrics,
        response: response.slice(0, 500),
        errors,
      };
    } catch (err: unknown) {
      return {
        caseId: evalCase.id,
        passed: false,
        metrics: {
          latencyMs: Date.now() - startTime,
          iterationsUsed: 0,
          toolsCalled: [],
          tokensInput: 0,
          tokensOutput: 0,
          costUsd: 0,
          taskCompleted: false,
          safetyViolations: 0,
        },
        response: '',
        errors: [err instanceof Error ? err.message : String(err)],
      };
    }
  }

  /**
   * Run an entire eval suite.
   */
  async runSuite(suite: EvalSuite): Promise<EvalReport> {
    const startTime = Date.now();
    logger.info({ suite: suite.id, cases: suite.cases.length }, '[EvalRunner] Starting suite');

    const results: EvalCaseResult[] = [];
    for (const evalCase of suite.cases) {
      const result = await this.runCase(evalCase);
      results.push(result);
      logger.info(
        { case: evalCase.id, passed: result.passed, latency: result.metrics.latencyMs },
        '[EvalRunner] Case complete',
      );
    }

    const passed = results.filter((r) => r.passed).length;
    const totalLatency = results.reduce((sum, r) => sum + r.metrics.latencyMs, 0);
    const totalIterations = results.reduce((sum, r) => sum + r.metrics.iterationsUsed, 0);
    const totalCost = results.reduce((sum, r) => sum + r.metrics.costUsd, 0);

    return {
      suiteId: suite.id,
      suiteName: suite.name,
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      results,
      summary: {
        total: results.length,
        passed,
        failed: results.length - passed,
        passRate: results.length > 0 ? passed / results.length : 0,
        avgLatencyMs: results.length > 0 ? totalLatency / results.length : 0,
        avgIterations: results.length > 0 ? totalIterations / results.length : 0,
        totalCostUsd: totalCost,
      },
    };
  }

  /**
   * Compare two eval reports and produce a diff.
   */
  static compareReports(baseline: EvalReport, current: EvalReport) {
    return {
      passRateDelta: current.summary.passRate - baseline.summary.passRate,
      latencyDelta: current.summary.avgLatencyMs - baseline.summary.avgLatencyMs,
      costDelta: current.summary.totalCostUsd - baseline.summary.totalCostUsd,
      improved: current.summary.passRate >= baseline.summary.passRate,
      regressions: current.results
        .filter((cr) => {
          const br = baseline.results.find((b) => b.caseId === cr.caseId);
          return br?.passed && !cr.passed;
        })
        .map((r) => r.caseId),
    };
  }
}
