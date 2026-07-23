import { Router } from 'express';
import { HuascarEngine } from '../engine/HuascarEngine.js';
import type { Store } from '../engine/Store.js';
import { SessionManager } from '../engine/SessionManager.js';
import { ApiError, ErrorCodes } from '../errors.js';

export function agentRouter(store: Store, Engine = HuascarEngine): Router {
  const router = Router();
  router.post('/agent/execute', async (req, res, next) => {
    const { task, role, system_prompt, config: agentConfig, session_id } = req.body;
    let activeSessionId: string | undefined;

    if (!task || !role) {
      return next(new ApiError(ErrorCodes.API_VALIDATION_ERROR, "Faltan parámetros 'task' o 'role'", 400));
    }
    if (typeof task !== 'string' || task.length > 10000) {
      return next(new ApiError(ErrorCodes.API_VALIDATION_ERROR, 'task debe ser un texto de maximo 10000 caracteres', 400));
    }
    if (typeof role !== 'string' || role.length > 200) {
      return next(new ApiError(ErrorCodes.API_VALIDATION_ERROR, 'role debe ser un texto de maximo 200 caracteres', 400));
    }
    if (session_id !== undefined && (typeof session_id !== 'string' || session_id.length > 200)) {
      return next(new ApiError(ErrorCodes.API_VALIDATION_ERROR, 'session_id debe ser un texto de maximo 200 caracteres', 400));
    }

    try {
      const sessions = new SessionManager(store);
      const session = sessions.getOrCreate(session_id, role);
      activeSessionId = session.id;
      const sessionContext = sessions.recentContext(session.id);
      store.addSessionMessage(session.id, 'user', task);
      const engine = new Engine(role, store);
      const result = await engine.executeTask(task, system_prompt, agentConfig, sessionContext);
      store.addSessionMessage(session.id, 'assistant', result.response ?? result.error ?? result.status);
      res.json({ ...result, session_id: session.id });
    } catch (error: unknown) {
      if (activeSessionId) {
        store.addSessionMessage(activeSessionId, 'assistant', error instanceof Error ? error.message : String(error));
      }
      next(error);
    }
  });
  return router;
}
