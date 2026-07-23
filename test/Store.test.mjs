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

  it('persists registered agents and records executions', () => {
    const dbPath = '/tmp/huascar_test_agents_unit.db';
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    const localStore = new Store(dbPath);
    const config = { steering: { roles: [{ id: 'dev', prompt: 'You code.' }] }, tools: ['shell'] };

    const created = localStore.createAgent('Coder', config, 1000);
    assert.strictEqual(created.name, 'Coder');
    assert.deepStrictEqual(JSON.parse(created.config), config);
    assert.strictEqual(localStore.listAgents().length, 1);

    const updated = localStore.updateAgent(created.id, 'Coder 2', { tools: [] }, 2000);
    assert.strictEqual(updated.name, 'Coder 2');
    assert.strictEqual(updated.updated_at, 2000);

    const executed = localStore.recordAgentExecution(created.id, 3000);
    assert.strictEqual(executed.execution_count, 1);
    assert.strictEqual(executed.last_executed_at, 3000);

    localStore.close();
    const reopened = new Store(dbPath);
    assert.strictEqual(reopened.getAgent(created.id).execution_count, 1);
    assert.strictEqual(reopened.deleteAgent(created.id), true);
    assert.strictEqual(reopened.getAgent(created.id), null);
    reopened.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it('creates sessions and orders messages oldest first', () => {
    const session = store.createSession('s1', 'role', 1000, '{"a":1}');
    assert.deepStrictEqual(session, { id: 's1', role: 'role', created_at: 1000, last_active_at: 1000, metadata: '{"a":1}' });
    store.addSessionMessage('s1', 'user', 'one', 1001);
    store.addSessionMessage('s1', 'assistant', 'two', 1002);

    assert.strictEqual(store.getSession('s1').role, 'role');
    assert.deepStrictEqual(store.listSessionMessages('s1').map(m => [m.role, m.content]), [['user', 'one'], ['assistant', 'two']]);
  });

  it('touches and deletes expired sessions', () => {
    store.createSession('old-session', 'role', 1);
    store.touchSession('old-session', 2);
    store.addSessionMessage('old-session', 'user', 'orphan', 3);
    assert.strictEqual(store.getSession('old-session').last_active_at, 2);
    assert.strictEqual(store.deleteExpiredSessions(10, 13), 1);
    assert.strictEqual(store.getSession('old-session'), null);
    assert.deepStrictEqual(store.listSessionMessages('old-session'), []);
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


  it('does not report hash-current when embeddings are missing', () => {
    const dbPath = '/tmp/huascar_test_missing_embedding_hash.db';
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    const localStore = new Store(dbPath);
    localStore.saveChunk({ source: 's', chunkIndex: 0, chunkText: 't', contentHash: 'h', chunkHash: 'c' });
    assert.strictEqual(localStore.getContentHashBySource('s'), null);
    localStore.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it('retention deletes old executions and reports rows', () => {
    const dbPath = '/tmp/huascar_test_retention_age.db';
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    const localStore = new Store(dbPath);
    localStore.saveExecution('role', 'old', 'response', '2024-01-01 00:00:00');
    localStore.saveExecution('role', 'new', 'response', '2024-04-01 00:00:00');

    const report = localStore.cleanupRetention({ executionMaxAgeDays: 30, executionMaxCount: 100, ragChunksMaxPerSource: 100, cleanupOnStart: false }, Date.parse('2024-04-15T00:00:00Z'));

    assert.deepStrictEqual(report, { executionsDeleted: 1, chunksDeleted: 0 });
    assert.deepStrictEqual(localStore.getHistory(10).map(row => row.task), ['new']);
    localStore.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it('retention count limit keeps newest executions', () => {
    const dbPath = '/tmp/huascar_test_retention_execution_count.db';
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    const localStore = new Store(dbPath);
    localStore.saveExecution('role', 'oldest', 'response', '2024-01-01 00:00:00');
    localStore.saveExecution('role', 'middle', 'response', '2024-01-02 00:00:00');
    localStore.saveExecution('role', 'newest', 'response', '2024-01-03 00:00:00');

    const report = localStore.cleanupRetention({ executionMaxAgeDays: 365, executionMaxCount: 2, ragChunksMaxPerSource: 100, cleanupOnStart: false }, Date.parse('2024-01-04T00:00:00Z'));

    assert.deepStrictEqual(report, { executionsDeleted: 1, chunksDeleted: 0 });
    assert.deepStrictEqual(localStore.getHistory(10).map(row => row.task), ['newest', 'middle']);
    localStore.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it('retention keeps newest chunks per source', () => {
    const dbPath = '/tmp/huascar_test_retention_chunks.db';
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    const localStore = new Store(dbPath);
    for (let i = 0; i < 3; i++) {
      localStore.saveChunk({ source: 'a', chunkIndex: i, chunkText: `a-${i}`, createdAt: `2024-01-0${i + 1} 00:00:00` });
      localStore.saveChunk({ source: 'b', chunkIndex: i, chunkText: `b-${i}`, createdAt: `2024-01-0${i + 1} 00:00:00` });
    }

    const report = localStore.cleanupRetention({ executionMaxAgeDays: 365, executionMaxCount: 100, ragChunksMaxPerSource: 2, cleanupOnStart: false }, Date.parse('2024-01-04T00:00:00Z'));

    assert.deepStrictEqual(report, { executionsDeleted: 0, chunksDeleted: 2 });
    assert.deepStrictEqual(localStore.getAllChunks().map(row => row.chunk_text), ['a-1', 'a-2', 'b-1', 'b-2']);
    localStore.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

});
