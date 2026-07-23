import { describe, it } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import http from 'node:http';
import fs from 'fs';
import { agentsRouter } from '../src/routes/agents.js';
import { Store } from '../src/engine/Store.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

async function request(server, method, path, body) {
  const { port } = server.address();
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

describe('registered agents route', () => {
  it('supports CRUD and executes with registered config', async () => {
    const db = '/tmp/huascar_agents_route_test.db';
    if (fs.existsSync(db)) fs.unlinkSync(db);
    const store = new Store(db);
    const calls = [];
    class FakeEngine {
      constructor(role) { this.role = role; }
      executeTask(task, system, config, context) {
        calls.push({ role: this.role, task, system, config, context });
        return Promise.resolve({ status: 'success', agent_role: this.role, response: `reply:${task}` });
      }
    }
    const app = express().use(express.json()).use('/api', agentsRouter(store, FakeEngine)).use(errorHandler);
    const server = http.createServer(app);

    try {
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      const config = { steering: { roles: [{ id: 'dev', prompt: 'You code.' }] }, tools: ['shell'], knowledge: [] };
      const created = await request(server, 'POST', '/api/agents', { name: 'Coder', config });
      assert.strictEqual(created.status, 201);
      assert.strictEqual(created.body.name, 'Coder');
      assert.deepStrictEqual(created.body.config, config);

      const list = await request(server, 'GET', '/api/agents');
      assert.strictEqual(list.body.length, 1);
      assert.strictEqual(list.body[0].config, undefined);

      const got = await request(server, 'GET', `/api/agents/${created.body.id}`);
      assert.deepStrictEqual(got.body.config, config);

      const updated = await request(server, 'PUT', `/api/agents/${created.body.id}`, { name: 'Coder 2', config });
      assert.strictEqual(updated.body.name, 'Coder 2');

      const executed = await request(server, 'POST', `/api/agents/${created.body.id}/execute`, { task: 'build it' });
      assert.strictEqual(executed.status, 200);
      assert.strictEqual(executed.body.agent_id, created.body.id);
      assert.ok(executed.body.session_id);
      assert.strictEqual(calls[0].role, 'dev');
      assert.strictEqual(calls[0].system, 'You code.');
      assert.deepStrictEqual(calls[0].config, config);
      assert.strictEqual(store.getAgent(created.body.id).execution_count, 1);

      const override = await request(server, 'POST', `/api/agents/${created.body.id}/execute`, { task: 'build it', system_prompt: 'ignore registry' });
      assert.strictEqual(override.status, 400);

      const unknownRole = await request(server, 'POST', `/api/agents/${created.body.id}/execute`, { task: 'build it', role: 'unknown' });
      assert.strictEqual(unknownRole.status, 400);

      const deleted = await request(server, 'DELETE', `/api/agents/${created.body.id}`);
      assert.deepStrictEqual(deleted.body, { deleted: true });
    } finally {
      await new Promise(resolve => server.close(resolve));
      store.close();
      if (fs.existsSync(db)) fs.unlinkSync(db);
    }
  });

  it('rejects malformed agent config', async () => {
    const db = '/tmp/huascar_agents_route_bad_test.db';
    if (fs.existsSync(db)) fs.unlinkSync(db);
    const store = new Store(db);
    const app = express().use(express.json()).use('/api', agentsRouter(store)).use(errorHandler);
    const server = http.createServer(app);
    try {
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      const res = await request(server, 'POST', '/api/agents', { name: 'Bad', config: { steering: { roles: [{ id: 'x' }] } } });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error.code, 'API_VALIDATION_ERROR');
    } finally {
      await new Promise(resolve => server.close(resolve));
      store.close();
      if (fs.existsSync(db)) fs.unlinkSync(db);
    }
  });

  it('does not reuse registered sessions across agents with the same role', async () => {
    const db = '/tmp/huascar_agents_route_session_agent_test.db';
    if (fs.existsSync(db)) fs.unlinkSync(db);
    const store = new Store(db);
    class FakeEngine {
      constructor(role) { this.role = role; }
      executeTask(task) {
        return Promise.resolve({ status: 'success', agent_role: this.role, response: `reply:${task}` });
      }
    }
    const app = express().use(express.json()).use('/api', agentsRouter(store, FakeEngine)).use(errorHandler);
    const server = http.createServer(app);
    try {
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      const config = { steering: { roles: [{ id: 'dev', prompt: 'You code.' }] } };
      const a = await request(server, 'POST', '/api/agents', { name: 'A', config });
      const b = await request(server, 'POST', '/api/agents', { name: 'B', config });
      const first = await request(server, 'POST', `/api/agents/${a.body.id}/execute`, { task: 'first' });
      assert.strictEqual(first.status, 200);

      const second = await request(server, 'POST', `/api/agents/${b.body.id}/execute`, { task: 'second', session_id: first.body.session_id });
      assert.strictEqual(second.status, 409);
    } finally {
      await new Promise(resolve => server.close(resolve));
      store.close();
      if (fs.existsSync(db)) fs.unlinkSync(db);
    }
  });
});
