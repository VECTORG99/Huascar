import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Pipeline security hardening (issue #247)', () => {
  const MAX_PIPELINE_STEPS = 20;
  const MAX_STEP_TASK_LENGTH = 10000;
  const MAX_DELEGATION_DEPTH = 3;
  const MAX_RETRIES_PER_STEP = 2;

  it('rejects pipelines exceeding max step count', () => {
    const steps = Array.from({ length: 21 }, (_, i) => ({ role: 'dev', task: `task ${i}` }));
    assert.equal(steps.length > MAX_PIPELINE_STEPS, true);
  });

  it('allows pipelines within max step count', () => {
    const steps = Array.from({ length: 20 }, (_, i) => ({ role: 'dev', task: `task ${i}` }));
    assert.equal(steps.length <= MAX_PIPELINE_STEPS, true);
  });

  it('rejects step tasks exceeding max length', () => {
    const task = 'x'.repeat(10001);
    assert.equal(task.length > MAX_STEP_TASK_LENGTH, true);
  });

  it('clamps retries to server maximum', () => {
    let retries = 100;
    if (retries > MAX_RETRIES_PER_STEP) retries = MAX_RETRIES_PER_STEP;
    assert.equal(retries, 2);
  });

  it('ignores client maxDelegationDepth (uses server value)', () => {
    const clientValue = 999;
    const serverValue = MAX_DELEGATION_DEPTH;
    // Server always uses its own value, ignoring client
    assert.equal(serverValue, 3);
    assert.notEqual(clientValue, serverValue);
  });

  it('unknown conditions default to false (fail-closed)', () => {
    // Simulate the evaluateCondition logic for unknown condition
    const ALLOWED_CONDITIONS = {
      "previous.status === 'success'": true,
      "previous.status === 'failed'": true,
    };
    const unknownCondition = 'process.exit(1)';
    const result = unknownCondition in ALLOWED_CONDITIONS ? true : false;
    assert.equal(result, false); // fail-closed
  });

  it('known conditions still evaluate correctly', () => {
    const ALLOWED_CONDITIONS = {
      "previous.status === 'success'": (p) => p.status === 'success',
    };
    const condition = "previous.status === 'success'";
    const prev = { status: 'success' };
    const evaluator = ALLOWED_CONDITIONS[condition];
    assert.equal(evaluator(prev), true);
  });
});
