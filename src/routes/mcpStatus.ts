import { Router } from 'express';
import { mcpConnectionPool } from '../engine/McpConnectionPool.js';

export const mcpStatusRouter = Router();

/** GET /api/mcp/status — reports health status of configured MCP servers. */
mcpStatusRouter.get('/mcp/status', (_req, res) => {
  const status = mcpConnectionPool.getStatus();
  const healthy = status.every((s) => s.status === 'connected');
  res.json({ healthy, servers: status });
});
