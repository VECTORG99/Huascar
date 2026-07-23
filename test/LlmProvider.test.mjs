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
});
