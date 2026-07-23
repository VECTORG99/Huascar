import { describe, it } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import http from 'node:http';
import { creatorProtectedRouter } from '../src/creator/router.js';

function mockRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

describe('requireAuth', () => {
  it('fails closed when auth is required without configured keys', async () => {
    process.env.AUTH_REQUIRED = 'true';
    delete process.env.HUASCAR_API_KEYS;
    const mod = await import(`../src/middleware/auth.js?case=${Date.now()}`);
    const res = mockRes();
    let nextCalled = false;
    mod.requireAuth({ headers: {} }, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 500);
    assert.strictEqual(res.body.code, 'AUTH_MISCONFIGURED');
    delete process.env.AUTH_REQUIRED;
  });

  it('protects creator generate when auth is required', async () => {
    process.env.AUTH_REQUIRED = 'true';
    process.env.HUASCAR_API_KEYS = 'secret';
    const { requireAuth } = await import(`../src/middleware/auth.js?case=${Date.now()}`);
    const app = express().use(express.json()).use('/api/v1/creator', requireAuth, creatorProtectedRouter);
    const server = http.createServer(app);
    try {
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      const { port } = server.address();
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/creator/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answers: {} }),
      });
      assert.strictEqual(res.status, 401);
    } finally {
      await new Promise(resolve => server.close(resolve));
      delete process.env.AUTH_REQUIRED;
      delete process.env.HUASCAR_API_KEYS;
    }
  });
});
