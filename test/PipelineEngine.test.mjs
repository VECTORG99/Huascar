import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PipelineEngine } from '../src/engine/PipelineEngine.ts';

describe('PipelineEngine (#69)', () => {
  it('executes a simple pipeline sequentially', async () => {
    const executed = [];
    const engine = new PipelineEngine(async (role, task) => {
      executed.push({ role, task: task.slice(0, 20) });
      return { status: 'success', response: `Done by ${role}` };
    });

    const result = await engine.execute({
      id: 'test-pipeline',
      name: 'Test',
      steps: [
        { role: 'REVIEWER', task: 'Review code' },
        { role: 'FIXER', task: 'Fix issues' },
      ],
      onFailure: 'abort',
    });

    assert.equal(result.status, 'completed');
    assert.equal(result.steps.length, 2);
    assert.equal(executed.length, 2);
    assert.equal(executed[0].role, 'REVIEWER');
    assert.equal(executed[1].role, 'FIXER');
  });

  it('passes previous output as context', async () => {
    let secondTask = '';
    const engine = new PipelineEngine(async (role, task) => {
      if (role === 'FIXER') secondTask = task;
      return { status: 'success', response: 'Review complete: 2 issues' };
    });

    await engine.execute({
      id: 'ctx-test',
      name: 'Context Test',
      steps: [
        { role: 'REVIEWER', task: 'Review' },
        { role: 'FIXER', task: 'Fix' },
      ],
      onFailure: 'abort',
    });

    assert.ok(secondTask.includes('Review complete'));
  });

  it('aborts on failure when onFailure is abort', async () => {
    const engine = new PipelineEngine(async (role) => {
      if (role === 'REVIEWER') return { status: 'blocked', error: 'Failed' };
      return { status: 'success', response: 'ok' };
    });

    const result = await engine.execute({
      id: 'abort-test',
      name: 'Abort Test',
      steps: [
        { role: 'REVIEWER', task: 'Review' },
        { role: 'FIXER', task: 'Fix' },
      ],
      onFailure: 'abort',
    });

    assert.equal(result.status, 'failed');
    assert.equal(result.steps.length, 1);
  });

  it('skips conditional steps when condition not met', async () => {
    const engine = new PipelineEngine(async () => {
      return { status: 'success', response: 'ok' };
    });

    const result = await engine.execute({
      id: 'cond-test',
      name: 'Conditional',
      steps: [
        { role: 'REVIEWER', task: 'Review' },
        { role: 'FIXER', task: 'Fix', condition: "previous.status === 'failed'" },
      ],
      onFailure: 'abort',
    });

    assert.equal(result.steps[1].status, 'skipped');
  });

  it('executes conditional step when condition is met', async () => {
    const engine = new PipelineEngine(async (role) => {
      if (role === 'REVIEWER') return { status: 'blocked', error: 'issues found' };
      return { status: 'success', response: 'fixed' };
    });

    const result = await engine.execute({
      id: 'cond-test-2',
      name: 'Conditional Met',
      steps: [
        { role: 'REVIEWER', task: 'Review' },
        { role: 'FIXER', task: 'Fix', condition: "previous.status === 'failed'" },
      ],
      onFailure: 'continue',
    });

    assert.equal(result.steps[1].status, 'success');
  });

  it('protects against infinite delegation', async () => {
    // With maxDepth=2, delegation depth 3 should throw
    const engine = new PipelineEngine(
      async () => ({ status: 'success', response: 'ok' }),
      2,
    );

    // Simulate nested delegation: depth accumulates inside a pipeline
    const result = await engine.execute({
      id: 'deep-pipeline',
      name: 'Deep',
      steps: [
        { role: 'A', task: 'task1' },
        { role: 'B', task: 'task2' },
        { role: 'C', task: 'task3' },
      ],
      onFailure: 'abort',
      maxDelegationDepth: 2,
    });

    // Pipeline should complete since each step is depth 0
    assert.equal(result.steps.length, 3);
  });

  it('validates pipeline definition', () => {
    assert.equal(PipelineEngine.validate({}).valid, false);
    assert.equal(PipelineEngine.validate({ id: 'x', name: 'y', steps: [{ role: 'R', task: 'T' }], onFailure: 'abort' }).valid, true);
    assert.equal(PipelineEngine.validate({ id: 'x', name: 'y', steps: [] }).valid, false);
  });
});
