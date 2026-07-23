/**
 * Tool registry API route — exposes available tools for discovery.
 */
import { Router } from 'express';
import { toolRegistry } from '../engine/ToolRegistry.js';

export function toolsRouter(): Router {
  const router = Router();

  /** GET /api/tools — list all available tools with schemas */
  router.get('/tools', (_req, res) => {
    const tools = toolRegistry.getAllTools();
    res.json(tools);
  });

  /** GET /api/tools/health — health status of MCP servers */
  router.get('/tools/health', (_req, res) => {
    res.json(toolRegistry.getHealthStatus());
  });

  /** GET /api/tools/stats — registry statistics */
  router.get('/tools/stats', (_req, res) => {
    res.json(toolRegistry.stats);
  });

  return router;
}
