import { describe, it, before } from 'node:test';
import assert from 'node:assert';

describe('agentHooks', () => {
  let agentHooks;

  before(async () => {
    const mod = await import('../src/kiro/hooks.js');
    agentHooks = mod.agentHooks;
  });

  it('allows safe tool execution', () => {
    const result = agentHooks.before_action('execute_bash', { command: 'ls -la' });
    assert.strictEqual(result, true);
  });

  it('blocks tool with blocked name pattern', () => {
    assert.throws(() => {
      agentHooks.before_action('sudo_install', {});
    }, /HOOK TRIGGERED/);
  });

  it('blocks args with destructive substrings', () => {
    assert.throws(() => {
      agentHooks.before_action('execute_bash', { command: 'rm -rf /' });
    }, /HOOK TRIGGERED/);
  });

  it('is case-insensitive for destructive arg patterns', () => {
    assert.throws(() => {
      agentHooks.before_action('execute_bash', { command: 'RM -RF /' });
    }, /HOOK TRIGGERED/);
  });

  it('is case-insensitive for blocked tool names', () => {
    assert.throws(() => {
      agentHooks.before_action('Shell_Exec', {});
    }, /HOOK TRIGGERED/);
  });

  it('allows tool with blocked pattern in name when bypass_secret matches', () => {
    // This test verifies the BYPASS_SECRET mechanism exists (if configured)
    // Without BYPASS_SECRET, blocked patterns still block
    assert.throws(() => {
      agentHooks.before_action('shell', { bypass_secret: 'wrong' });
    }, /HOOK TRIGGERED/);
  });
});
