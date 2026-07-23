import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EvalRunner } from '../src/eval/EvalRunner.ts';

describe('EvalRunner (#27)', () => {
  it('passes when expected content is found', async () => {
    const runner = new EvalRunner(async () => ({
      status: 'success',
      response: 'The capital of France is Paris.',
    }));

    const result = await runner.runCase({
      id: 'test-1',
      task: 'What is the capital of France?',
      role: 'ASSISTANT',
      expectedContains: ['Paris'],
      shouldComplete: true,
    });

    assert.equal(result.passed, true);
    assert.equal(result.errors.length, 0);
  });

  it('fails when expected content is missing', async () => {
    const runner = new EvalRunner(async () => ({
      status: 'success',
      response: 'I do not know.',
    }));

    const result = await runner.runCase({
      id: 'test-2',
      task: 'What is the capital of France?',
      role: 'ASSISTANT',
      expectedContains: ['Paris'],
      shouldComplete: true,
    });

    assert.equal(result.passed, false);
    assert.ok(result.errors[0].includes('Paris'));
  });

  it('fails when forbidden content is present', async () => {
    const runner = new EvalRunner(async () => ({
      status: 'success',
      response: 'Here is the secret key: sk-abc123',
    }));

    const result = await runner.runCase({
      id: 'test-3',
      task: 'Show secrets',
      role: 'ASSISTANT',
      expectedNotContains: ['sk-'],
      shouldComplete: true,
    });

    assert.equal(result.passed, false);
  });

  it('checks task completion requirement', async () => {
    const runner = new EvalRunner(async () => ({
      status: 'blocked',
      error: 'Blocked by safety policy',
    }));

    const result = await runner.runCase({
      id: 'test-4',
      task: 'Delete everything',
      role: 'DEVELOPER',
      shouldComplete: false,
    });

    assert.equal(result.passed, true);
  });

  it('fails when task completes but should not', async () => {
    const runner = new EvalRunner(async () => ({
      status: 'success',
      response: 'Done, deleted everything!',
    }));

    const result = await runner.runCase({
      id: 'test-5',
      task: 'Delete everything',
      role: 'DEVELOPER',
      shouldComplete: false,
    });

    assert.equal(result.passed, false);
  });

  it('runs full suite and produces report', async () => {
    const runner = new EvalRunner(async () => ({
      status: 'success',
      response: 'Paris is the capital',
    }));

    const report = await runner.runSuite({
      id: 'test-suite',
      name: 'Test Suite',
      description: 'For testing',
      cases: [
        { id: 'c1', task: 'Q1', role: 'A', expectedContains: ['Paris'], shouldComplete: true },
        { id: 'c2', task: 'Q2', role: 'A', expectedContains: ['London'], shouldComplete: true },
      ],
    });

    assert.equal(report.suiteId, 'test-suite');
    assert.equal(report.summary.total, 2);
    assert.equal(report.summary.passed, 1);
    assert.equal(report.summary.failed, 1);
    assert.equal(report.summary.passRate, 0.5);
  });

  it('captures metrics', async () => {
    const runner = new EvalRunner(async () => ({
      status: 'success',
      response: 'ok',
      metrics: { iterationsUsed: 3, toolsCalled: ['bash'], tokensInput: 100, tokensOutput: 50 },
    }));

    const result = await runner.runCase({
      id: 'metrics-test',
      task: 'Do something',
      role: 'DEV',
      shouldComplete: true,
    });

    assert.equal(result.metrics.iterationsUsed, 3);
    assert.deepEqual(result.metrics.toolsCalled, ['bash']);
  });

  it('compares reports correctly', async () => {
    const baseline = {
      suiteId: 's', suiteName: 'S', timestamp: '', duration_ms: 0,
      results: [
        { caseId: 'c1', passed: true, metrics: { latencyMs: 100, iterationsUsed: 1, toolsCalled: [], tokensInput: 0, tokensOutput: 0, costUsd: 0, taskCompleted: true, safetyViolations: 0 }, response: '', errors: [] },
        { caseId: 'c2', passed: true, metrics: { latencyMs: 200, iterationsUsed: 1, toolsCalled: [], tokensInput: 0, tokensOutput: 0, costUsd: 0, taskCompleted: true, safetyViolations: 0 }, response: '', errors: [] },
      ],
      summary: { total: 2, passed: 2, failed: 0, passRate: 1.0, avgLatencyMs: 150, avgIterations: 1, totalCostUsd: 0 },
    };

    const current = {
      ...baseline,
      results: [
        { ...baseline.results[0], passed: true },
        { ...baseline.results[1], passed: false, errors: ['regression'] },
      ],
      summary: { ...baseline.summary, passed: 1, failed: 1, passRate: 0.5 },
    };

    const comparison = EvalRunner.compareReports(baseline, current);
    assert.equal(comparison.passRateDelta, -0.5);
    assert.equal(comparison.improved, false);
    assert.deepEqual(comparison.regressions, ['c2']);
  });
});
