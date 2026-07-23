import { Router } from 'express';
import { HuascarEngine } from '../engine/HuascarEngine.js';
import type { Store } from '../engine/Store.js';
import { ApiError, ErrorCodes } from '../errors.js';

export function agentRouter(store: Store): Router {
  const router = Router();
  router.post('/agent/execute', async (req, res, next) => {
    const { task, role, system_prompt, config: agentConfig } = req.body;

    if (!task || !role) {
      return next(new ApiError(ErrorCodes.API_VALIDATION_ERROR, "Faltan parámetros 'task' o 'role'", 400));
    }
    if (typeof task !== 'string' || task.length > 10000) {
      return next(new ApiError(ErrorCodes.API_VALIDATION_ERROR, 'task debe ser un texto de maximo 10000 caracteres', 400));
    }
    if (typeof role !== 'string' || role.length > 200) {
      return next(new ApiError(ErrorCodes.API_VALIDATION_ERROR, 'role debe ser un texto de maximo 200 caracteres', 400));
    }

    try {
      const engine = new HuascarEngine(role, store);
      const result = await engine.executeTask(task, system_prompt, agentConfig);
      res.json(result);
    } catch (error: unknown) {
      next(error);
    }
  });
  return router;
}
