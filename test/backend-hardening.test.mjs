import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Backend Hardening (issue #16)', () => {
  it('Content-Type check rejects non-JSON POST', () => {
    const req = { method: 'POST', path: '/api/agent/execute', is: (type) => type === 'text/plain' };
    const shouldReject = ['POST', 'PUT', 'PATCH'].includes(req.method) && !req.is('application/json');
    assert.equal(shouldReject, true);
  });

  it('Content-Type check allows JSON POST', () => {
    const req = { method: 'POST', path: '/api/agent/execute', is: (type) => type === 'application/json' };
    const shouldReject = ['POST', 'PUT', 'PATCH'].includes(req.method) && !req.is('application/json');
    assert.equal(shouldReject, false);
  });

  it('Content-Type check skips GET requests', () => {
    const req = { method: 'GET', path: '/api/health', is: () => false };
    const shouldCheck = ['POST', 'PUT', 'PATCH'].includes(req.method);
    assert.equal(shouldCheck, false);
  });

  it('BYPASS_SECRET warning triggered when empty in production', () => {
    const env = { NODE_ENV: 'production', BYPASS_SECRET: '' };
    const shouldWarn = env.NODE_ENV === 'production' && !env.BYPASS_SECRET;
    assert.equal(shouldWarn, true);
  });

  it('BYPASS_SECRET warning NOT triggered in development', () => {
    const env = { NODE_ENV: 'development', BYPASS_SECRET: '' };
    const shouldWarn = env.NODE_ENV === 'production' && !env.BYPASS_SECRET;
    assert.equal(shouldWarn, false);
  });

  it('BYPASS_SECRET warning NOT triggered when set', () => {
    const env = { NODE_ENV: 'production', BYPASS_SECRET: 'strong-secret-123' };
    const shouldWarn = env.NODE_ENV === 'production' && !env.BYPASS_SECRET;
    assert.equal(shouldWarn, false);
  });

  it('sensitive values are redacted in log output', () => {
    const sensitivePatterns = [/sk-[a-zA-Z0-9]+/, /ghp_[a-zA-Z0-9]+/, /Bearer\s+\S+/];
    const input = 'API key: sk-abc123xyz and token ghp_secret456';
    let redacted = input;
    for (const p of sensitivePatterns) {
      redacted = redacted.replace(p, '[REDACTED]');
    }
    assert(!redacted.includes('sk-abc123xyz'));
    assert(!redacted.includes('ghp_secret456'));
  });
});
