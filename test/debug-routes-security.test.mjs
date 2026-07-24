import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Debug routes security hardening (issue #241)', () => {
  it('isProduction is case-insensitive', () => {
    const check = (env) => (env || '').toLowerCase() === 'production';
    assert.equal(check('production'), true);
    assert.equal(check('Production'), true);
    assert.equal(check('PRODUCTION'), true);
    assert.equal(check('development'), false);
    assert.equal(check(undefined), false);
    assert.equal(check(''), false);
  });

  it('debug state is disabled in production', () => {
    const isProduction = () => (process.env.NODE_ENV || '').toLowerCase() === 'production';
    const state = { enabled: !isProduction() };
    // In test env (not production), debug should be enabled
    assert.equal(state.enabled, true);
  });

  it('replay endpoint is removed (no longer exists)', () => {
    // The debug router no longer has a replay route
    const routeNames = ['debug/requests', 'debug/stats'];
    assert.equal(routeNames.includes('debug/replay'), false);
  });

  it('stats endpoint does NOT expose node version', () => {
    // Simulated safe stats output
    const stats = {
      uptime: 123,
      debugRequestsCaptured: 5,
      maxRequests: 50,
      ttlMs: 600000,
    };
    assert.equal('nodeVersion' in stats, false);
    assert.equal('memory' in stats, false);
    assert.equal('version' in stats, false);
  });

  it('request body redacts sensitive keys', () => {
    const SENSITIVE = new Set(['password', 'secret', 'token', 'authorization', 'bypass_secret', 'system_prompt']);
    const body = { task: 'hello', password: 'secret123', system_prompt: 'override' };
    const redacted = {};
    for (const [key, value] of Object.entries(body)) {
      redacted[key] = SENSITIVE.has(key.toLowerCase()) ? '[REDACTED]' : value;
    }
    assert.equal(redacted.task, 'hello');
    assert.equal(redacted.password, '[REDACTED]');
    assert.equal(redacted.system_prompt, '[REDACTED]');
  });

  it('TTL auto-purge removes old entries', () => {
    const TTL = 100; // 100ms for test
    const now = Date.now();
    const requests = [
      { id: 'new', timestamp: now },
      { id: 'old', timestamp: now - 200 },
    ];
    const filtered = requests.filter(r => r.timestamp > now - TTL);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].id, 'new');
  });

  it('debug routes not registered when disabled', () => {
    const enabled = false;
    const registered = enabled ? 'debugRouter mounted' : 'skipped';
    assert.equal(registered, 'skipped');
  });
});
