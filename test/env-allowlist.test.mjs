import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Simulate the allowlist logic from McpConnectionPool
const ALLOWED_MCP_ENV_VARS = new Set([
  'GITHUB_TOKEN', 'GITHUB_PERSONAL_ACCESS_TOKEN', 'MCP_SERVER_PORT',
  'NODE_ENV', 'PATH', 'HOME', 'USER', 'LANG', 'TERM',
]);

function resolveEnvValue(value, allowedVars = ALLOWED_MCP_ENV_VARS) {
  return value.replace(/\$\{(\w+)\}/g, (_, name) => {
    if (!allowedVars.has(name)) return '';
    return process.env[name] || '';
  });
}

describe('MCP Env Var Allowlist (issue #50)', () => {
  it('allows interpolation of allowlisted vars', () => {
    process.env.GITHUB_TOKEN = 'ghp_test123';
    const result = resolveEnvValue('token=${GITHUB_TOKEN}');
    assert.equal(result, 'token=ghp_test123');
    delete process.env.GITHUB_TOKEN;
  });

  it('blocks interpolation of sensitive vars (OPENAI_API_KEY)', () => {
    process.env.OPENAI_API_KEY = 'sk-secret';
    const result = resolveEnvValue('key=${OPENAI_API_KEY}');
    assert.equal(result, 'key=');
    delete process.env.OPENAI_API_KEY;
  });

  it('blocks AWS credentials', () => {
    process.env.AWS_SECRET_ACCESS_KEY = 'aws-secret';
    const result = resolveEnvValue('${AWS_SECRET_ACCESS_KEY}');
    assert.equal(result, '');
    delete process.env.AWS_SECRET_ACCESS_KEY;
  });

  it('blocks JWT_SECRET', () => {
    process.env.JWT_SECRET = 'super-secret';
    assert.equal(resolveEnvValue('${JWT_SECRET}'), '');
    delete process.env.JWT_SECRET;
  });

  it('blocks DATABASE_URL', () => {
    process.env.DATABASE_URL = 'postgres://user:pass@host/db';
    assert.equal(resolveEnvValue('${DATABASE_URL}'), '');
    delete process.env.DATABASE_URL;
  });

  it('allows NODE_ENV (safe system var)', () => {
    process.env.NODE_ENV = 'production';
    assert.equal(resolveEnvValue('${NODE_ENV}'), 'production');
  });

  it('returns empty string for unset but allowed vars', () => {
    delete process.env.MCP_SERVER_PORT;
    assert.equal(resolveEnvValue('port=${MCP_SERVER_PORT}'), 'port=');
  });

  it('handles multiple interpolations in one value', () => {
    process.env.GITHUB_TOKEN = 'ghp_abc';
    process.env.OPENAI_API_KEY = 'sk-secret';
    const result = resolveEnvValue('gh=${GITHUB_TOKEN}&key=${OPENAI_API_KEY}');
    assert.equal(result, 'gh=ghp_abc&key=');
    delete process.env.GITHUB_TOKEN;
    delete process.env.OPENAI_API_KEY;
  });

  it('config-driven allowlist extends the set', () => {
    const extended = new Set([...ALLOWED_MCP_ENV_VARS, 'CUSTOM_VAR']);
    process.env.CUSTOM_VAR = 'custom_value';
    assert.equal(resolveEnvValue('${CUSTOM_VAR}', extended), 'custom_value');
    delete process.env.CUSTOM_VAR;
  });
});
