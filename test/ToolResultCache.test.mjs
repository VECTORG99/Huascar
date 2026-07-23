import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ToolResultCache } from '../src/engine/ToolResultCache.ts';
import { withRetry } from '../src/engine/RetryHandler.ts';

describe('ToolResultCache (#32)', () => {
  it('returns null for cache miss', () => {
    const cache = new ToolResultCache();
    assert.equal(cache.get('tool', { arg: 'value' }), null);
  });

  it('caches and retrieves results', () => {
    const cache = new ToolResultCache();
    cache.set('readFile', { path: '/tmp' }, 'file contents');
    assert.equal(cache.get('readFile', { path: '/tmp' }), 'file contents');
  });

  it('differentiates by tool name', () => {
    const cache = new ToolResultCache();
    cache.set('toolA', { x: 1 }, 'result A');
    cache.set('toolB', { x: 1 }, 'result B');
    assert.equal(cache.get('toolA', { x: 1 }), 'result A');
    assert.equal(cache.get('toolB', { x: 1 }), 'result B');
  });

  it('differentiates by args', () => {
    const cache = new ToolResultCache();
    cache.set('tool', { path: 'a' }, 'result A');
    cache.set('tool', { path: 'b' }, 'result B');
    assert.equal(cache.get('tool', { path: 'a' }), 'result A');
    assert.equal(cache.get('tool', { path: 'b' }), 'result B');
  });

  it('respects TTL', async () => {
    const cache = new ToolResultCache(50, 50); // 50ms TTL
    cache.set('tool', {}, 'result');
    assert.equal(cache.get('tool', {}), 'result');
    await new Promise((r) => setTimeout(r, 60));
    assert.equal(cache.get('tool', {}), null);
  });

  it('evicts oldest when at capacity', () => {
    const cache = new ToolResultCache(2);
    cache.set('tool', { a: 1 }, 'r1');
    cache.set('tool', { a: 2 }, 'r2');
    cache.set('tool', { a: 3 }, 'r3'); // should evict r1
    assert.equal(cache.get('tool', { a: 1 }), null);
    assert.equal(cache.get('tool', { a: 3 }), 'r3');
  });

  it('clears all entries', () => {
    const cache = new ToolResultCache();
    cache.set('tool', {}, 'result');
    cache.clear();
    assert.equal(cache.size, 0);
    assert.equal(cache.get('tool', {}), null);
  });
});

describe('RetryHandler (#32)', () => {
  it('succeeds without retry', async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls++;
      return 'ok';
    }, 'test');
    assert.equal(result, 'ok');
    assert.equal(calls, 1);
  });

  it('retries on transient error and succeeds', async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls++;
        if (calls < 2) throw new Error('timeout');
        return 'ok';
      },
      'test',
      { initialDelayMs: 10 },
    );
    assert.equal(result, 'ok');
    assert.equal(calls, 2);
  });

  it('does not retry permanent errors', async () => {
    let calls = 0;
    await assert.rejects(
      () =>
        withRetry(
          async () => {
            calls++;
            throw new Error('not found - 404');
          },
          'test',
          { maxRetries: 3, initialDelayMs: 10 },
        ),
      /not found/,
    );
    assert.equal(calls, 1);
  });

  it('throws after max retries exhausted', async () => {
    let calls = 0;
    await assert.rejects(
      () =>
        withRetry(
          async () => {
            calls++;
            throw new Error('timeout error');
          },
          'test',
          { maxRetries: 2, initialDelayMs: 10 },
        ),
      /timeout/,
    );
    assert.equal(calls, 3); // initial + 2 retries
  });
});
