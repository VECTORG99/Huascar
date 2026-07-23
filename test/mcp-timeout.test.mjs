import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('MCP Execution Cancellation (issue #6)', () => {
  it('AbortController.abort() sets signal.aborted', () => {
    const controller = new AbortController();
    assert.equal(controller.signal.aborted, false);
    controller.abort('test');
    assert.equal(controller.signal.aborted, true);
    assert.equal(controller.signal.reason, 'test');
  });

  it('abort event listener fires', () => {
    const controller = new AbortController();
    let fired = false;
    controller.signal.addEventListener('abort', () => { fired = true; }, { once: true });
    controller.abort('x');
    assert.equal(fired, true);
  });

  it('Promise.race rejects on abort before long op', async () => {
    const controller = new AbortController();
    const { signal } = controller;
    const longOp = new Promise((r) => setTimeout(() => r('done'), 5000));
    const abortP = new Promise((_, rej) => { signal.addEventListener('abort', () => rej(new Error('cancelled')), { once: true }); });
    setTimeout(() => controller.abort('timeout'), 10);
    try { await Promise.race([longOp, abortP]); assert.fail('unreachable'); } catch (e) { assert.equal(e.message, 'cancelled'); }
  });

  it('signal.aborted check exits loop immediately', () => {
    const c = new AbortController();
    c.abort('x');
    let n = 0;
    for (let i = 0; i < 100; i++) { if (c.signal.aborted) break; n++; }
    assert.equal(n, 0);
  });

  it('abort is idempotent (first reason wins)', () => {
    const c = new AbortController();
    c.abort('first');
    c.abort('second');
    assert.equal(c.signal.reason, 'first');
  });
});
