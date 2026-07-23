import { describe, it } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import http from 'node:http';
import fs from 'fs';
import { agentRouter } from '../src/routes/agent.js';
import { Store } from '../src/engine/Store.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

async function post(server, body) {
  const { port } = server.address();
  const res = await fetch(`http://127.0.0.1:${port}/api/agent/execute`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function stream(server, body) {
  const { port } = server.address();
  const res = await fetch(`http://127.0.0.1:${port}/api/agent/execute/stream`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return [...text.matchAll(/event: (\w+)\ndata: (.+)/g)].map(([, event, data]) => ({ event, data: JSON.parse(data) }));
}

class FakeEngine {
  executeTask(task, _system, _config, context, mockScenario, _signal) {
    this._prompts = this._prompts || [];
    this._prompts.push({ task, context, mockScenario });
    return Promise.resolve({ status: 'success', agent_role: 'role', response: `reply:${task}` });
  }
  async cancelAll() {}
}

function createApp(store, Engine = FakeEngine) {
  const app = express().use(express.json()).use('/api', agentRouter(store, Engine)).use(errorHandler);
  return http.createServer(app);
}

function tempDb(name) {
  const db = `/tmp/huascar_agent_session_${name}_test.db`;
  if (fs.existsSync(db)) fs.unlinkSync(db);
  return db;
}

describe('agent sessions', () => {
  it('returns session_id and injects prior messages on next call', async () => {
    const db = tempDb('basic');
    const store = new Store(db);
    const prompts = [];
    class TrackingEngine {
      executeTask(task, _system, _config, context, mockScenario, _signal) {
        prompts.push({ task, context, mockScenario });
        return Promise.resolve({ status: 'success', agent_role: 'role', response: `reply:${task}` });
      }
      async cancelAll() {}
    }
    const server = createApp(store, TrackingEngine);
    try {
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      const first = await post(server, { task: 'first', role: 'role', mock_scenario: 'multi_step' });
      assert.strictEqual(first.status, 200);
      assert.ok(first.body.session_id);

      const second = await post(server, { task: 'second', role: 'role', session_id: first.body.session_id });
      assert.strictEqual(second.status, 200);
      assert.strictEqual(second.body.session_id, first.body.session_id);
      assert.match(prompts[1].context, /user: first/);
      assert.match(prompts[1].context, /assistant: reply:first/);
      assert.strictEqual(prompts[0].mockScenario, 'multi_step');
    } finally {
      await new Promise(resolve => server.close(resolve));
      store.close();
      if (fs.existsSync(db)) fs.unlinkSync(db);
    }
  });

  it('returns 404 for missing or expired session', async () => {
    const db = tempDb('missing');
    const store = new Store(db);
    const server = createApp(store);
    try {
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      assert.strictEqual((await post(server, { task: 'x', role: 'role', session_id: 'missing' })).status, 404);

      store.createSession('expired', 'role', 1);
      assert.strictEqual((await post(server, { task: 'x', role: 'role', session_id: 'expired' })).status, 404);
    } finally {
      await new Promise(resolve => server.close(resolve));
      store.close();
      if (fs.existsSync(db)) fs.unlinkSync(db);
    }
  });

  it('rejects reusing a session with another role', async () => {
    const db = tempDb('role_mismatch');
    const store = new Store(db);
    const prompts = [];
    class TrackingEngine {
      executeTask(task, _system, _config, context, _mockScenario, _signal) {
        prompts.push({ task, context });
        return Promise.resolve({ status: 'success', agent_role: 'role', response: `reply:${task}` });
      }
      async cancelAll() {}
    }
    const server = createApp(store, TrackingEngine);
    try {
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      const first = await post(server, { task: 'first', role: 'role-a' });
      assert.strictEqual(first.status, 200);

      const second = await post(server, { task: 'second', role: 'role-b', session_id: first.body.session_id });
      assert.strictEqual(second.status, 409);
      assert.strictEqual(prompts.length, 1);
    } finally {
      await new Promise(resolve => server.close(resolve));
      store.close();
      if (fs.existsSync(db)) fs.unlinkSync(db);
    }
  });

  it('streams start then complete with session_id', async () => {
    const db = tempDb('stream');
    const store = new Store(db);
    const server = createApp(store);
    try {
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      const events = await stream(server, { task: 'first', role: 'role' });
      assert.deepStrictEqual(events.map(e => e.event), ['start', 'complete']);
      assert.ok(events[0].data.session_id);
      assert.strictEqual(events[1].data.session_id, events[0].data.session_id);
      assert.strictEqual(events[1].data.response, 'reply:first');
    } finally {
      await new Promise(resolve => server.close(resolve));
      store.close();
      if (fs.existsSync(db)) fs.unlinkSync(db);
    }
  });

  it('streams validation errors', async () => {
    const db = tempDb('stream_error');
    const store = new Store(db);
    const server = createApp(store);
    try {
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      const events = await stream(server, { task: 'first' });
      assert.deepStrictEqual(events.map(e => e.event), ['error']);
      assert.strictEqual(events[0].data.error.code, 'API_VALIDATION_ERROR');
    } finally {
      await new Promise(resolve => server.close(resolve));
      store.close();
      if (fs.existsSync(db)) fs.unlinkSync(db);
    }
  });
});
