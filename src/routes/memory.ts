/**
 * Per-role memory store API routes.
 * Allows agents to persist key-value notes between executions.
 *
 * Security: validates that the requested role exists in steering config
 * before allowing any memory operations. Logs all write/delete operations.
 */
import fs from 'fs';
import { Router } from 'express';
import { ExecutionContext } from '../engine/ExecutionContext.js';
import { ApiError, ErrorCodes } from '../errors.js';
import { config } from '../config.js';
import { logger } from '../logger.js';

/** Load valid role IDs from steering.json */
function getValidRoles(): Set<string> {
  try {
    const steering = JSON.parse(fs.readFileSync(config.paths.steering, 'utf8'));
    const roles = steering.roles ?? {};
    return new Set(Object.keys(roles));
  } catch {
    return new Set();
  }
}

/** Middleware: validate that the role exists in steering config */
function validateRole(role: string): void {
  const validRoles = getValidRoles();
  if (!validRoles.has(role)) {
    throw new ApiError(ErrorCodes.API_VALIDATION_ERROR, `Role "${role}" does not exist in steering configuration`, 404);
  }
}

export function memoryRouter(executionContext: ExecutionContext): Router {
  const router = Router();

  /** GET /api/memory/:role — get all memory entries for a role */
  router.get('/memory/:role', (req, res) => {
    validateRole(req.params.role);
    const entries = executionContext.getMemory(req.params.role);
    res.json(entries);
  });

  /** POST /api/memory/:role — save a memory entry */
  router.post('/memory/:role', (req, res) => {
    validateRole(req.params.role);
    const { key, value } = req.body;
    if (!key || typeof key !== 'string' || key.length > 200) {
      throw new ApiError(ErrorCodes.API_VALIDATION_ERROR, 'key is required (max 200 chars)', 400);
    }
    if (!value || typeof value !== 'string' || value.length > 10000) {
      throw new ApiError(ErrorCodes.API_VALIDATION_ERROR, 'value is required (max 10000 chars)', 400);
    }
    executionContext.setMemory(req.params.role, key, value);
    logger.info({ role: req.params.role, key }, '[Memory] Entry written');
    res.status(201).json({ key, value, role: req.params.role });
  });

  /** DELETE /api/memory/:role/:key — delete a specific memory entry */
  router.delete('/memory/:role/:key', (req, res) => {
    validateRole(req.params.role);
    const deleted = executionContext.deleteMemory(req.params.role, req.params.key);
    if (!deleted) return res.status(404).json({ error: 'Key not found' });
    logger.info({ role: req.params.role, key: req.params.key }, '[Memory] Entry deleted');
    res.json({ deleted: true });
  });

  /** DELETE /api/memory/:role — clear all memory for a role */
  router.delete('/memory/:role', (req, res) => {
    validateRole(req.params.role);
    executionContext.clearMemory(req.params.role);
    logger.warn({ role: req.params.role }, '[Memory] All entries cleared');
    res.json({ cleared: true });
  });

  return router;
}
