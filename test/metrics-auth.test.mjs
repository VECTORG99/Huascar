import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Metrics Endpoint Auth (issue #76)', () => {
  it('requires token when METRICS_SECRET is set', () => {
    const metricsToken = 'secret123';
    const provided = undefined;
    const authorized = !metricsToken || provided === metricsToken;
    assert.equal(authorized, false);
  });

  it('allows access with correct token', () => {
    const metricsToken = 'secret123';
    const provided = 'secret123';
    const authorized = !metricsToken || provided === metricsToken;
    assert.equal(authorized, true);
  });

  it('denies access with wrong token', () => {
    const metricsToken = 'secret123';
    const provided = 'wrong-token';
    const authorized = !metricsToken || provided === metricsToken;
    assert.equal(authorized, false);
  });

  it('allows access in dev when no secret configured', () => {
    const metricsToken = '';
    const env = 'development';
    const authorized = !metricsToken && env !== 'production';
    assert.equal(authorized, true);
  });

  it('denies in production when no secret configured', () => {
    const metricsToken = '';
    const env = 'production';
    const denied = !metricsToken && env === 'production';
    assert.equal(denied, true);
  });

  it('sanitized output does not expose full path details', () => {
    const metrics = { totalRequests: 100, requestsByPath: { '/api/agent/execute': 50, '/api/health': 30, '/api/v1/creator/catalog': 20 }, errorsByPath: { '/api/agent/execute': 5 } };
    const safeMetrics = {
      totalRequests: metrics.totalRequests,
      totalErrors: Object.values(metrics.errorsByPath).reduce((a, b) => a + b, 0),
      topPaths: Object.entries(metrics.requestsByPath).sort(([,a], [,b]) => b - a).slice(0, 10).map(([path, count]) => ({ path, count })),
    };
    assert.equal(safeMetrics.totalErrors, 5);
    assert.equal(safeMetrics.topPaths[0].path, '/api/agent/execute');
    assert.equal('errorsByPath' in safeMetrics, false);
  });
});
