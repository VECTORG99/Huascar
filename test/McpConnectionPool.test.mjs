import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { config } from '../src/config.js';
import { McpConnectionPool } from '../src/engine/McpConnectionPool.js';

describe('McpConnectionPool', () => {
  it('reuses cached connections', async () => {
    const previousPath = config.paths.mcps;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'huascar-mcp-pool-'));
    config.paths.mcps = path.join(dir, 'mcps.json');
    fs.writeFileSync(config.paths.mcps, JSON.stringify({ mcpServers: { fake: { command: 'fake' } } }));

    let connects = 0;
    const connection = { name: 'fake', client: { close: async () => {} }, transport: { close: async () => {} }, tools: [{ name: 'tool' }] };
    const pool = new McpConnectionPool(async () => {
      connects++;
      return connection;
    });

    try {
      const first = await pool.getConnections();
      const second = await pool.getConnections();
      assert.strictEqual(connects, 1);
      assert.strictEqual(first[0], second[0]);
    } finally {
      config.paths.mcps = previousPath;
      await pool.closeAll();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('retries on transient failure and succeeds', async () => {
    const previousPath = config.paths.mcps;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'huascar-mcp-retry-'));
    config.paths.mcps = path.join(dir, 'mcps.json');
    fs.writeFileSync(config.paths.mcps, JSON.stringify({ mcpServers: { flaky: { command: 'flaky' } } }));

    let attempts = 0;
    const connection = { name: 'flaky', client: { close: async () => {} }, transport: { close: async () => {} }, tools: [{ name: 'tool1' }] };
    const pool = new McpConnectionPool(async () => {
      attempts++;
      if (attempts < 3) throw new Error('transient error');
      return connection;
    });

    try {
      const result = await pool.getConnections();
      assert.strictEqual(result.length, 1);
      assert.strictEqual(attempts, 3, 'Should succeed on 3rd attempt');
    } finally {
      config.paths.mcps = previousPath;
      await pool.closeAll();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reports error status after all retries fail', async () => {
    const previousPath = config.paths.mcps;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'huascar-mcp-fail-'));
    config.paths.mcps = path.join(dir, 'mcps.json');
    fs.writeFileSync(config.paths.mcps, JSON.stringify({ mcpServers: { broken: { command: 'broken' } } }));

    const pool = new McpConnectionPool(async () => {
      throw new Error('permanent failure');
    });

    try {
      const result = await pool.getConnections();
      assert.strictEqual(result.length, 0);

      const status = pool.getStatus();
      assert.strictEqual(status.length, 1);
      assert.strictEqual(status[0].name, 'broken');
      assert.strictEqual(status[0].status, 'error');
      assert.strictEqual(status[0].lastError, 'permanent failure');
    } finally {
      config.paths.mcps = previousPath;
      await pool.closeAll();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('getStatus reports connected servers correctly', async () => {
    const previousPath = config.paths.mcps;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'huascar-mcp-status-'));
    config.paths.mcps = path.join(dir, 'mcps.json');
    fs.writeFileSync(config.paths.mcps, JSON.stringify({ mcpServers: { good: { command: 'good' } } }));

    const connection = { name: 'good', client: { close: async () => {} }, transport: { close: async () => {} }, tools: [{ name: 'a' }, { name: 'b' }] };
    const pool = new McpConnectionPool(async () => connection);

    try {
      await pool.getConnections();
      const status = pool.getStatus();
      assert.strictEqual(status.length, 1);
      assert.strictEqual(status[0].status, 'connected');
      assert.strictEqual(status[0].toolCount, 2);
    } finally {
      config.paths.mcps = previousPath;
      await pool.closeAll();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
