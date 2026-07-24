/**
 * Debug tooling routes — only available in development mode.
 * Provides request inspector, timing breakdown, and request replay.
 */
import { Router, type RequestHandler } from 'express';
import type { Store } from '../engine/Store.js';

export interface DebugRequest {
  id: string;
  method: string;
  path: string;
  body: unknown;
  timestamp: number;
  durationMs: number;
  statusCode: number;
  phases?: Record<string, number>;
}

const MAX_DEBUG_REQUESTS = 100;
const MAX_DEBUG_BODY_SIZE = 2048;
const SENSITIVE_KEYS = new Set(['password', 'secret', 'token', 'api_key', 'apiKey', 'authorization', 'credentials']);

function redactBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'string' && value.length > MAX_DEBUG_BODY_SIZE) {
      redacted[key] = value.slice(0, MAX_DEBUG_BODY_SIZE) + '...[truncated]';
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

export function createDebugState() {
  return {
    requests: [] as DebugRequest[],
    enabled: process.env.NODE_ENV !== 'production',
  };
}

export type DebugState = ReturnType<typeof createDebugState>;

/**
 * Middleware that records request timing for debug inspection.
 */
export function debugMiddleware(state: DebugState): RequestHandler {
  return (req, res, next) => {
    if (!state.enabled) return next();

    const id = `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const startTime = Date.now();

    res.on('finish', () => {
      const entry: DebugRequest = {
        id,
        method: req.method,
        path: req.path,
        body: req.method !== 'GET' ? redactBody(req.body) : undefined,
        timestamp: startTime,
        durationMs: Date.now() - startTime,
        statusCode: res.statusCode,
      };

      state.requests.unshift(entry);
      if (state.requests.length > MAX_DEBUG_REQUESTS) {
        state.requests.length = MAX_DEBUG_REQUESTS;
      }
    });

    // Attach timing helper to response for downstream use
    (res as unknown as Record<string, unknown>).__debug_id = id;
    (res as unknown as Record<string, unknown>).__debug_start = startTime;

    next();
  };
}

/**
 * Debug routes — disabled in production.
 */
export function debugRouter(state: DebugState, store?: Store): Router {
  const router = Router();

  // Guard: disable all debug routes in production
  router.use((_req, res, next) => {
    if (!state.enabled) {
      return res.status(404).json({ error: 'Debug routes disabled in production' });
    }
    next();
  });

  /**
   * GET /api/debug/requests - Last N requests with timing breakdown
   */
  router.get('/debug/requests', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, MAX_DEBUG_REQUESTS);
    res.json({
      requests: state.requests.slice(0, limit),
      total: state.requests.length,
    });
  });

  /**
   * GET /api/debug/requests/:id - Single request detail
   */
  router.get('/debug/requests/:id', (req, res) => {
    const entry = state.requests.find((r) => r.id === req.params.id);
    if (!entry) return res.status(404).json({ error: 'Request not found' });
    res.json(entry);
  });

  /**
   * POST /api/debug/replay/:executionId - Replay a past execution
   */
  router.post('/debug/replay/:executionId', async (req, res) => {
    if (!store) return res.status(501).json({ error: 'Store not available for replay' });

    try {
      const history = store.getHistory(100);
      const execution = history.find((h) => String(h.id) === req.params.executionId);
      if (!execution) return res.status(404).json({ error: 'Execution not found' });

      res.json({
        replay: {
          originalId: execution.id,
          role: execution.role,
          task: execution.task,
          originalResponse: execution.response.slice(0, 500),
          replayedAt: new Date().toISOString(),
          note: 'Replay requires calling /api/agent/execute with the original task/role',
        },
      });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Replay failed' });
    }
  });

  /**
   * GET /api/debug/stats - System statistics
   */
  router.get('/debug/stats', (_req, res) => {
    res.json({
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version,
      env: process.env.NODE_ENV || 'development',
      debugRequestsCaptured: state.requests.length,
    });
  });

  return router;
}
