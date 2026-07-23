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

  it('close is idempotent', () => {
    const dbPath = '/tmp/huascar_test_close_unit.db';
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    const localStore = new Store(dbPath);
    assert.strictEqual(localStore.isOpen(), true);
    localStore.close();
    localStore.close();
    assert.strictEqual(localStore.isOpen(), false);
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });


  it('runs schema migrations', () => {
    const dbPath = '/tmp/huascar_test_migrations_unit.db';
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    const migrated = new Store(dbPath);
    migrated.saveExecution('role', 'task', 'response');
    assert.strictEqual(migrated.getHistory(1).length, 1);
    migrated.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it('lists and deletes RAG sources', () => {
    store.saveChunk({ source: 'a', chunkIndex: 0, chunkText: 'one', contentHash: 'content-a', chunkHash: 'hash-1' });
    store.saveChunk({ source: 'a', chunkIndex: 1, chunkText: 'two', contentHash: 'content-a', chunkHash: 'hash-2' });
    store.saveChunk({ source: 'b', chunkIndex: 0, chunkText: 'three', contentHash: 'content-b', chunkHash: 'hash-3' });

    const sourceA = store.getRagSources().find(source => source.source === 'a');
    assert.strictEqual(sourceA.chunk_count, 2);
    assert.deepStrictEqual(sourceA.chunk_hashes, ['hash-1', 'hash-2']);

    store.deleteChunksBySource('a');
    assert.ok(!store.getRagSources().some(source => source.source === 'a'));
    assert.ok(store.getRagSources().some(source => source.source === 'b'));
  });

});
