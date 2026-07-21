import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import { Store } from '../src/engine/Store.js';

const TEST_DB = '/tmp/huascar_test_unit.db';

describe('Store', () => {
  let store;

  before(() => {
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    store = new Store(TEST_DB);
  });

  after(() => {
    store.close();
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  it('saves and retrieves an execution', () => {
    store.saveExecution('test-role', 'test task', 'test response');
    const history = store.getHistory(10);
    assert.ok(history.length >= 1);
    const last = history[0];
    assert.strictEqual(last.role, 'test-role');
    assert.strictEqual(last.task, 'test task');
    assert.strictEqual(last.response, 'test response');
  });

  it('respects history limit', () => {
    for (let i = 0; i < 5; i++) {
      store.saveExecution('role', `task-${i}`, 'response');
    }
    const limited = store.getHistory(3);
    assert.strictEqual(limited.length, 3);
  });

  it('returns empty array for limit 0', () => {
    const empty = store.getHistory(0);
    assert.deepStrictEqual(empty, []);
  });

  it('orders by created_at descending', () => {
    const history = store.getHistory(10);
    for (let i = 1; i < history.length; i++) {
      assert.ok(history[i - 1].created_at >= history[i].created_at);
    }
  });
});
