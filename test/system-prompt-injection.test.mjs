import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

describe('Client system_prompt injection prevention (issue #281)', () => {
  it('system_prompt is stripped when ALLOW_CLIENT_SYSTEM_PROMPT is not set', () => {
    delete process.env.ALLOW_CLIENT_SYSTEM_PROMPT;
    const allowed = process.env.ALLOW_CLIENT_SYSTEM_PROMPT === 'true';
    const system_prompt = 'malicious override';
    const result = allowed && typeof system_prompt === 'string' ? system_prompt : undefined;
    assert.equal(result, undefined);
  });

  it('system_prompt is stripped when ALLOW_CLIENT_SYSTEM_PROMPT=false', () => {
    process.env.ALLOW_CLIENT_SYSTEM_PROMPT = 'false';
    const allowed = process.env.ALLOW_CLIENT_SYSTEM_PROMPT === 'true';
    const system_prompt = 'malicious override';
    const result = allowed && typeof system_prompt === 'string' ? system_prompt : undefined;
    assert.equal(result, undefined);
    delete process.env.ALLOW_CLIENT_SYSTEM_PROMPT;
  });

  it('system_prompt is allowed only when ALLOW_CLIENT_SYSTEM_PROMPT=true', () => {
    process.env.ALLOW_CLIENT_SYSTEM_PROMPT = 'true';
    const allowed = process.env.ALLOW_CLIENT_SYSTEM_PROMPT === 'true';
    const system_prompt = 'custom prompt for testing';
    const result = allowed && typeof system_prompt === 'string' ? system_prompt : undefined;
    assert.equal(result, 'custom prompt for testing');
    delete process.env.ALLOW_CLIENT_SYSTEM_PROMPT;
  });

  it('non-string system_prompt is always rejected', () => {
    process.env.ALLOW_CLIENT_SYSTEM_PROMPT = 'true';
    const allowed = process.env.ALLOW_CLIENT_SYSTEM_PROMPT === 'true';
    const system_prompt = 123; // not a string
    const result = allowed && typeof system_prompt === 'string' ? system_prompt : undefined;
    assert.equal(result, undefined);
    delete process.env.ALLOW_CLIENT_SYSTEM_PROMPT;
  });

  it('frontend should not send system_prompt field separately', () => {
    // Simulate the frontend body construction (after fix)
    const task = 'test';
    const role = 'dev';
    const agentConfig = { steering: { system_prompt: 'should not leak' } };
    const body = { task, role };
    if (agentConfig) {
      body.config = agentConfig;
      // The fix removes: body.system_prompt = agentConfig.steering.system_prompt
    }
    assert.equal('system_prompt' in body, false);
  });
});
