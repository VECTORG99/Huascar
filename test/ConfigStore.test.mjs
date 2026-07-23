import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { ConfigStore } from '../src/engine/ConfigStore.ts';
import { createAgentConfigs } from '../src/engine/migrations/006_create_agent_configs.ts';

describe('ConfigStore (#49)', () => {
  let db;
  let configStore;

  beforeEach(() => {
    db = new Database(':memory:');
    createAgentConfigs.up(db);
    configStore = new ConfigStore(db);
  });

  afterEach(() => {
    db.close();
  });

  it('saves first config with auto-activate', () => {
    const saved = configStore.save('my-agent', { roles: ['DEVELOPER'] });
    assert.equal(saved.name, 'my-agent');
    assert.equal(saved.version, 1);
    assert.equal(saved.active, 1);
  });

  it('increments version on subsequent saves', () => {
    configStore.save('my-agent', { v: 1 });
    const v2 = configStore.save('my-agent', { v: 2 });
    assert.equal(v2.version, 2);
    assert.equal(v2.active, 0); // only first is auto-active
  });

  it('lists configs with active version info', () => {
    configStore.save('agent-a', { x: 1 });
    configStore.save('agent-b', { y: 2 });
    const list = configStore.list();
    assert.equal(list.length, 2);
    assert.ok(list.find((c) => c.name === 'agent-a'));
  });

  it('retrieves version history', () => {
    configStore.save('agent', { v: 1 });
    configStore.save('agent', { v: 2 });
    configStore.save('agent', { v: 3 });
    const versions = configStore.getVersions('agent');
    assert.equal(versions.length, 3);
    assert.equal(versions[0].version, 3); // DESC order
  });

  it('activates a specific version (rollback)', () => {
    configStore.save('agent', { v: 1 });
    configStore.save('agent', { v: 2 });
    configStore.save('agent', { v: 3 });
    configStore.activate('agent', 1);
    const active = configStore.getActive('agent');
    assert.equal(active.version, 1);
  });

  it('returns null for nonexistent version activation', () => {
    const result = configStore.activate('nonexistent', 99);
    assert.equal(result, null);
  });

  it('computes diff between versions', () => {
    configStore.save('agent', { a: 1, b: 2, c: 3 });
    configStore.save('agent', { a: 1, b: 99, d: 4 });
    const diff = configStore.diff('agent', 1, 2);
    assert.ok(diff);
    assert.deepEqual(diff.added, ['d']);
    assert.deepEqual(diff.removed, ['c']);
    assert.deepEqual(diff.changed, ['b']);
  });

  it('returns null for diff with missing version', () => {
    configStore.save('agent', { a: 1 });
    const diff = configStore.diff('agent', 1, 999);
    assert.equal(diff, null);
  });

  it('getActive returns null when no config exists', () => {
    assert.equal(configStore.getActive('nonexistent'), null);
  });
});
