import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DbWorkerPool } from '../src/engine/DbWorkerPool.ts';

describe('DbWorkerPool (#72)', () => {
  it('exports DbWorkerPool class', () => {
    assert.equal(typeof DbWorkerPool, 'function');
  });

  it('initializes with options', () => {
    const pool = new DbWorkerPool({ dbPath: ':memory:', poolSize: 2, queryTimeoutMs: 5000 });
    assert.ok(pool);
    assert.deepEqual(pool.stats, { poolSize: 0, busy: 0, queueLength: 0, pendingQueries: 0 });
  });

  it('throws on query after close', async () => {
    const pool = new DbWorkerPool({ dbPath: ':memory:' });
    await pool.close();
    await assert.rejects(
      () => pool.query('SELECT 1'),
      /closed/,
    );
  });

  it('close is idempotent', async () => {
    const pool = new DbWorkerPool({ dbPath: ':memory:' });
    await pool.close();
    await pool.close(); // should not throw
  });
});
