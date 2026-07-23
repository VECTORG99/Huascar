import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { MigrationRunner } from '../src/engine/Migrations.ts';

describe('SQLite Migrations (issue #25)', () => {
  it('creates _migrations table on init', () => {
    const db = new Database(':memory:');
    new MigrationRunner(db);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    assert.ok(tables.some(t => t.name === '_migrations'));
    db.close();
  });

  it('registers and runs migrations', () => {
    const db = new Database(':memory:');
    const runner = new MigrationRunner(db);
    runner.register({
      id: 'test_001',
      description: 'create test table',
      up: (db) => db.exec('CREATE TABLE test_table (id INTEGER PRIMARY KEY)'),
      down: (db) => db.exec('DROP TABLE test_table'),
    });
    const { applied } = runner.runAll();
    assert.deepEqual(applied, ['test_001']);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='test_table'").all();
    assert.equal(tables.length, 1);
    db.close();
  });

  it('skips already-applied migrations', () => {
    const db = new Database(':memory:');
    const runner = new MigrationRunner(db);
    runner.register({ id: 'test_001', description: 'first', up: (db) => db.exec('CREATE TABLE t1 (id INT)'), down: () => {} });
    runner.runAll();
    const { applied, skipped } = runner.runAll();
    assert.deepEqual(applied, []);
    assert.deepEqual(skipped, ['test_001']);
    db.close();
  });

  it('rollback removes migration and undoes changes', () => {
    const db = new Database(':memory:');
    const runner = new MigrationRunner(db);
    runner.register({ id: 'test_001', description: 'table', up: (db) => db.exec('CREATE TABLE t1 (id INT)'), down: (db) => db.exec('DROP TABLE t1') });
    runner.runAll();
    runner.rollback('test_001');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='t1'").all();
    assert.equal(tables.length, 0);
    assert.equal(runner.getApplied().length, 0);
    db.close();
  });

  it('getPending returns only unapplied migrations', () => {
    const db = new Database(':memory:');
    const runner = new MigrationRunner(db);
    runner.register({ id: 'm1', description: 'first', up: () => {}, down: () => {} });
    runner.register({ id: 'm2', description: 'second', up: () => {}, down: () => {} });
    runner.runAll();
    runner.register({ id: 'm3', description: 'third', up: () => {}, down: () => {} });
    const pending = runner.getPending();
    assert.equal(pending.length, 1);
    assert.equal(pending[0].id, 'm3');
    db.close();
  });
});
