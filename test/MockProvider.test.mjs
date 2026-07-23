import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runMockScenario } from '../src/engine/MockProvider.js';

describe('MockProvider', () => {
  it('runs built-in happy_path deterministically', async () => {
    const text = await runMockScenario({ task: 'ship it', scenario: 'happy_path' });
    assert.equal(text, '[MOCK:happy_path] task=ship it\nstep: analyzed task\nfinal: completed');
  });

  it('records blocked tool_call hook errors', async () => {
    const text = await runMockScenario({
      task: 'danger',
      scenario: 'blocked',
      hooks: { before_action: () => { throw new Error('blocked by test'); } },
    });
    assert.match(text, /tool_call: execute_bash blocked: blocked by test/);
    assert.match(text, /final: blocked action recorded/);
  });

  it('loads custom scenarios from JSON path', async () => {
    const { config } = await import('../src/config.js');
    const previous = config.paths.mockScenarios;
    config.paths.mockScenarios = '/tmp/mock-scenarios.json';
    const readFile = () => JSON.stringify({ custom: { steps: [{ type: 'message', text: 'saw {{task}}' }, { type: 'final', text: '{{scenario}} done' }] } });

    try {
      const text = await runMockScenario({ task: 'custom task', scenario: 'custom', readFile });
      assert.equal(text, '[MOCK:custom] task=custom task\nstep: saw custom task\nfinal: custom done');
    } finally {
      config.paths.mockScenarios = previous;
    }
  });

  it('throws deterministic errors', async () => {
    await assert.rejects(() => runMockScenario({ task: 'x', scenario: 'error' }), /\[MOCK:error\] mock provider error/);
  });
});
