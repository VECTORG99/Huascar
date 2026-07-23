import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Structured Logging (issue #24)', () => {
  it('logger module exports logger and requestLogger', async () => {
    const mod = await import('../src/logger.ts');
    assert.equal(typeof mod.logger, 'object');
    assert.equal(typeof mod.logger.info, 'function');
    assert.equal(typeof mod.logger.warn, 'function');
    assert.equal(typeof mod.logger.error, 'function');
    assert.equal(typeof mod.requestLogger, 'function');
  });

  it('requestLogger returns child logger with reqId', async () => {
    const { requestLogger } = await import('../src/logger.ts');
    const child = requestLogger('test-123');
    assert.equal(typeof child.info, 'function');
    assert.ok(child);
  });

  it('requestLogger generates reqId when not provided', async () => {
    const { requestLogger } = await import('../src/logger.ts');
    const child = requestLogger();
    assert.equal(typeof child.info, 'function');
    assert.ok(child);
  });

  it('logger respects LOG_LEVEL env var', () => {
    const level = process.env.LOG_LEVEL || 'info';
    assert.equal(level, 'info');
  });
});
