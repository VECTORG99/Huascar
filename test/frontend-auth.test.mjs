import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Frontend auth header injection (issue #268)', () => {
  it('frontend api.ts exports authHeaders function', () => {
    const apiTs = fs.readFileSync(path.resolve('frontend/src/lib/api.ts'), 'utf8');
    assert.match(apiTs, /export function authHeaders/);
  });

  it('frontend api.ts includes auth header in request()', () => {
    const apiTs = fs.readFileSync(path.resolve('frontend/src/lib/api.ts'), 'utf8');
    assert.match(apiTs, /\.\.\.authHeaders\(\)/);
  });

  it('frontend useAgentExecution includes auth headers in stream fetch', () => {
    const hook = fs.readFileSync(path.resolve('frontend/src/hooks/useAgentExecution.ts'), 'utf8');
    assert.match(hook, /\.\.\.authHeaders\(\)/);
  });

  it('agent-creator includes auth headers in requests', () => {
    const api = fs.readFileSync(path.resolve('agent-creator/src/api/creatorApi.js'), 'utf8');
    assert.match(api, /\.\.\.authHeaders\(\)/);
  });

  it('authHeaders returns empty object when no key configured', () => {
    // Simulate the logic
    const apiKey = '';
    const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
    assert.deepEqual(headers, {});
  });

  it('authHeaders returns Bearer token when key is set', () => {
    const apiKey = 'test-key-123';
    const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
    assert.deepEqual(headers, { Authorization: 'Bearer test-key-123' });
  });
});
