import { describe, it } from 'node:test';
import assert from 'node:assert';

import { generateTextWithFallback, parseProviderChain } from '../src/engine/LlmProvider.js';

describe('LlmProvider', () => {
  it('tries the second model when the first throws', async () => {
    const calls = [];
    const models = [
      { provider: 'openai', modelId: 'first', model: { id: 'first' } },
      { provider: 'local', modelId: 'second', model: { id: 'second' } },
    ];

    const result = await generateTextWithFallback({ prompt: 'test' }, models, async options => {
      calls.push(options.model.id);
      if (calls.length === 1) throw new Error('boom');
      return { text: 'ok' };
    });

    assert.strictEqual(result.text, 'ok');
    assert.deepStrictEqual(calls, ['first', 'second']);
  });

  it('falls back to openai when the chain has no valid provider', () => {
    assert.deepStrictEqual(parseProviderChain('bogus'), ['openai']);
  });

  it('does not fallback after a tool executes', async () => {
    const calls = [];
    const models = [
      { provider: 'openai', modelId: 'first', model: { id: 'first' } },
      { provider: 'local', modelId: 'second', model: { id: 'second' } },
    ];

    await assert.rejects(
      () => generateTextWithFallback({ prompt: 'test' }, models, async options => {
        calls.push(options.model.id);
        throw new Error('after-tool-failure');
      }, () => false),
      /after-tool-failure/
    );
    assert.deepStrictEqual(calls, ['first']);
  });

  it('retries retryable errors before succeeding', async () => {
    let calls = 0;
    const models = [{ provider: 'openai', modelId: 'first', model: { id: 'first' } }];

    const result = await generateTextWithFallback({ prompt: 'test' }, models, async () => {
      calls++;
      if (calls < 3) throw Object.assign(new Error('busy'), { status: 503 });
      return { text: 'ok' };
    }, undefined, { sleep: async () => {}, random: () => 0 });

    assert.strictEqual(result.text, 'ok');
    assert.strictEqual(calls, 3);
  });

  it('does not retry non-retryable 401 errors', async () => {
    let calls = 0;
    const models = [{ provider: 'openai', modelId: 'first', model: { id: 'first' } }];

    await assert.rejects(
      () => generateTextWithFallback({ prompt: 'test' }, models, async () => {
        calls++;
        throw Object.assign(new Error('unauthorized'), { status: 401 });
      }, undefined, { sleep: async () => {} }),
      /unauthorized/
    );
    assert.strictEqual(calls, 1);
  });

  it('respects Retry-After on retryable errors', async () => {
    const delays = [];
    let calls = 0;
    const models = [{ provider: 'openai', modelId: 'first', model: { id: 'first' } }];

    await generateTextWithFallback({ prompt: 'test' }, models, async () => {
      calls++;
      if (calls === 1) throw Object.assign(new Error('rate limited'), { status: 429, headers: { 'retry-after': '2' } });
      return { text: 'ok' };
    }, undefined, { sleep: async ms => delays.push(ms), random: () => 0 });

    assert.deepStrictEqual(delays, [2000]);
  });

});
