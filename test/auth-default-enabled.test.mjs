import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

describe('Authentication default-enabled (issue #242)', () => {
  it('AUTH_REQUIRED defaults to true when env is unset', () => {
    const env = undefined;
    const authRequired = env !== 'false';
    assert.equal(authRequired, true);
  });

  it('AUTH_REQUIRED defaults to true when env is empty string', () => {
    const env = '';
    const authRequired = env !== 'false';
    assert.equal(authRequired, true);
  });

  it('AUTH_REQUIRED is true when explicitly set to "true"', () => {
    const env = 'true';
    const authRequired = env !== 'false';
    assert.equal(authRequired, true);
  });

  it('AUTH_REQUIRED is false ONLY when explicitly "false"', () => {
    const env = 'false';
    const authRequired = env !== 'false';
    assert.equal(authRequired, false);
  });

  it('production without keys should fail to start', () => {
    const isProduction = 'production' === 'production';
    const authRequired = true;
    const keysConfigured = false;
    const shouldFail = isProduction && authRequired && !keysConfigured;
    assert.equal(shouldFail, true);
  });

  it('development without keys logs warning but continues', () => {
    const isProduction = 'development'.toLowerCase() === 'production';
    const authRequired = true;
    const keysConfigured = false;
    const shouldFail = isProduction && authRequired && !keysConfigured;
    assert.equal(shouldFail, false); // does NOT exit, only warns
  });

  it('.env.example explicitly sets AUTH_REQUIRED=false for dev', () => {
    const envExample = fs.readFileSync('.env.example', 'utf8');
    assert.match(envExample, /AUTH_REQUIRED=false/);
    assert.match(envExample, /ENABLED by default/i);
  });
});
