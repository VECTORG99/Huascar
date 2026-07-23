import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Simulate health check logic
function checkHealth(dbOk, memPercent) {
  const dbStatus = dbOk ? 'ok' : 'error';
  const memStatus = memPercent > 90 ? 'warning' : 'ok';
  const hasError = dbStatus === 'error';
  const hasWarning = memStatus === 'warning';
  return hasError ? 'unhealthy' : hasWarning ? 'degraded' : 'healthy';
}

describe('Health Monitoring (issue #73)', () => {
  it('returns healthy when all checks pass', () => {
    assert.equal(checkHealth(true, 50), 'healthy');
  });

  it('returns degraded on high memory', () => {
    assert.equal(checkHealth(true, 95), 'degraded');
  });

  it('returns unhealthy on DB error', () => {
    assert.equal(checkHealth(false, 50), 'unhealthy');
  });

  it('unhealthy takes priority over degraded', () => {
    assert.equal(checkHealth(false, 95), 'unhealthy');
  });

  it('healthy at exactly 90% memory', () => {
    assert.equal(checkHealth(true, 90), 'healthy');
  });
});
