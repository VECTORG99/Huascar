import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ExecutionContext } from '../src/engine/ExecutionContext.ts';

describe('ExecutionContext (#63)', () => {
  it('stores and retrieves memory', () => {
    const ctx = new ExecutionContext(null);
    ctx.setMemory('DEVELOPER', 'preference', 'use TypeScript');
    assert.equal(ctx.getMemoryValue('DEVELOPER', 'preference'), 'use TypeScript');
  });

  it('updates existing memory key', () => {
    const ctx = new ExecutionContext(null);
    ctx.setMemory('DEVELOPER', 'note', 'first');
    ctx.setMemory('DEVELOPER', 'note', 'second');
    assert.equal(ctx.getMemoryValue('DEVELOPER', 'note'), 'second');
  });

  it('isolates memory between roles', () => {
    const ctx = new ExecutionContext(null);
    ctx.setMemory('DEVELOPER', 'key', 'dev-value');
    ctx.setMemory('REVIEWER', 'key', 'rev-value');
    assert.equal(ctx.getMemoryValue('DEVELOPER', 'key'), 'dev-value');
    assert.equal(ctx.getMemoryValue('REVIEWER', 'key'), 'rev-value');
  });

  it('deletes memory', () => {
    const ctx = new ExecutionContext(null);
    ctx.setMemory('DEVELOPER', 'key', 'value');
    const deleted = ctx.deleteMemory('DEVELOPER', 'key');
    assert.equal(deleted, true);
    assert.equal(ctx.getMemoryValue('DEVELOPER', 'key'), undefined);
  });

  it('returns false for deleting nonexistent key', () => {
    const ctx = new ExecutionContext(null);
    assert.equal(ctx.deleteMemory('DEVELOPER', 'nonexistent'), false);
  });

  it('clears all memory for a role', () => {
    const ctx = new ExecutionContext(null);
    ctx.setMemory('DEVELOPER', 'a', '1');
    ctx.setMemory('DEVELOPER', 'b', '2');
    ctx.clearMemory('DEVELOPER');
    assert.equal(ctx.getMemory('DEVELOPER').length, 0);
  });

  it('records and retrieves failures', () => {
    const ctx = new ExecutionContext(null);
    ctx.recordFailure('DEVELOPER', 'bash', '{ cmd: "rm -rf" }', 'blocked_destructive');
    const failures = ctx.getFailures('DEVELOPER');
    assert.equal(failures.length, 1);
    assert.equal(failures[0].tool, 'bash');
    assert.equal(failures[0].error_type, 'blocked_destructive');
  });

  it('limits failure records to 20', () => {
    const ctx = new ExecutionContext(null);
    for (let i = 0; i < 25; i++) {
      ctx.recordFailure('DEV', 'tool', `args_${i}`, 'error');
    }
    assert.equal(ctx.getFailures('DEV').length, 20);
  });

  it('builds context injection string', () => {
    const ctx = new ExecutionContext(null);
    ctx.setMemory('DEV', 'preference', 'TypeScript');
    ctx.recordFailure('DEV', 'bash', '{ cmd: "bad" }', 'timeout');
    const injection = ctx.buildContextInjection('DEV');
    assert.ok(injection.includes('KNOWN FAILURES'));
    assert.ok(injection.includes('AGENT NOTES'));
    assert.ok(injection.includes('TypeScript'));
  });

  it('returns empty injection when no data', () => {
    const ctx = new ExecutionContext(null);
    const injection = ctx.buildContextInjection('UNKNOWN_ROLE');
    assert.equal(injection, '');
  });
});
