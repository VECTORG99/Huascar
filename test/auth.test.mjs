import { describe, it } from 'node:test';
import assert from 'node:assert';

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
});
