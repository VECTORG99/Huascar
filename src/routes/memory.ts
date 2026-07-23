/**
 * Per-role memory store API routes.
 * Allows agents to persist key-value notes between executions.
 */
import { Router } from 'express';
import { ExecutionContext } from '../engine/ExecutionContext.js';
import { ApiError, ErrorCodes } from '../errors.js';

export function memoryRouter(executionContext: ExecutionContext): Router {
  const router = Router();

  /** GET /api/memory/:role — get all memory entries for a role */
  router.get('/memory/:role', (req, res) => {
    const entries = executionContext.getMemory(req.params.role);
    res.json(entries);
  });

  /** POST /api/memory/:role — save a memory entry */
  router.post('/memory/:role', (req, res) => {
    const { key, value } = req.body;
    if (!key || typeof key !== 'string') {
      throw new ApiError(ErrorCodes.API_VALIDATION_ERROR, 'key is required', 400);
    }
    if (!value || typeof value !== 'string') {
      throw new ApiError(ErrorCodes.API_VALIDATION_ERROR, 'value is required', 400);
    }
    executionContext.setMemory(req.params.role, key, value);
    res.status(201).json({ key, value, role: req.params.role });
  });

  /** DELETE /api/memory/:role/:key — delete a specific memory entry */
  router.delete('/memory/:role/:key', (req, res) => {
    const deleted = executionContext.deleteMemory(req.params.role, req.params.key);
    if (!deleted) return res.status(404).json({ error: 'Key not found' });
    res.json({ deleted: true });
  });

  /** DELETE /api/memory/:role — clear all memory for a role */
  router.delete('/memory/:role', (req, res) => {
    executionContext.clearMemory(req.params.role);
    res.json({ cleared: true });
  });

  return router;
}
