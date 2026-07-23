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
});
