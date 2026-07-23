import { Router, type Response } from 'express';
import { HuascarEngine, type AgentConfig } from '../engine/HuascarEngine.js';
import type { Store } from '../engine/Store.js';
import { SessionManager } from '../engine/SessionManager.js';
import { ApiError, ErrorCodes, formatError } from '../errors.js';

type EngineClass = new (role: string, store: Store) => Pick<HuascarEngine, 'executeTask'>;

function validateExecuteBody(body: Record<string, unknown>) {
  const { task, role, system_prompt, config: agentConfig, session_id } = body;

  if (!task || !role) {
    throw new ApiError(ErrorCodes.API_VALIDATION_ERROR, "Faltan parámetros 'task' o 'role'", 400);
  }
  if (typeof task !== 'string' || task.length > 10000) {
    throw new ApiError(ErrorCodes.API_VALIDATION_ERROR, 'task debe ser un texto de maximo 10000 caracteres', 400);
  }
  if (typeof role !== 'string' || role.length > 200) {
    throw new ApiError(ErrorCodes.API_VALIDATION_ERROR, 'role debe ser un texto de maximo 200 caracteres', 400);
  }
  if (session_id !== undefined && (typeof session_id !== 'string' || session_id.length > 200)) {
    throw new ApiError(ErrorCodes.API_VALIDATION_ERROR, 'session_id debe ser un texto de maximo 200 caracteres', 400);
  }

  return { task, role, system_prompt: typeof system_prompt === 'string' ? system_prompt : undefined, agentConfig: agentConfig as AgentConfig | undefined, session_id };
}

async function executeAgent(store: Store, Engine: EngineClass, body: Record<string, unknown>, onSession?: (sessionId: string) => void) {
  const { task, role, system_prompt, agentConfig, session_id } = validateExecuteBody(body);
  const sessions = new SessionManager(store);
  const session = sessions.getOrCreate(session_id, role);
  onSession?.(session.id);
  const sessionContext = sessions.recentContext(session.id);
  store.addSessionMessage(session.id, 'user', task);
  const engine = new Engine(role, store);
  const result = await engine.executeTask(task, system_prompt, agentConfig, sessionContext);
  store.addSessionMessage(session.id, 'assistant', result.response ?? result.error ?? result.status);
  return { ...result, session_id: session.id };
}

function writeSse(res: Response, event: string, data: unknown, closed: () => boolean) {
  if (closed() || res.destroyed || res.writableEnded) return false;
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  return true;
}

export function agentRouter(store: Store, Engine: EngineClass = HuascarEngine): Router {
  const router = Router();
  router.post('/agent/execute', async (req, res, next) => {
    let activeSessionId: string | undefined;

    try {
      const result = await executeAgent(store, Engine, req.body, sessionId => { activeSessionId = sessionId; });
      res.json(result);
    } catch (error: unknown) {
      if (activeSessionId) {
        store.addSessionMessage(activeSessionId, 'assistant', error instanceof Error ? error.message : String(error));
      }
      next(error);
    }
  });

  router.post('/agent/execute/stream', async (req, res) => {
    let closed = false;
    req.on('close', () => { if (req.aborted) closed = true; });
    res.on('close', () => { if (!res.writableEnded) closed = true; });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const end = () => { if (!closed && !res.writableEnded && !res.destroyed) res.end(); };

    try {
      const result = await executeAgent(store, Engine, req.body, sessionId => {
        writeSse(res, 'start', { session_id: sessionId }, () => closed);
      });
      writeSse(res, 'complete', result, () => closed);
      end();
    } catch (error: unknown) {
      writeSse(res, 'error', { error: formatError(error) }, () => closed);
      end();
    }
  });
  return router;
}
