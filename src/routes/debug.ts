/**
 * Debug tooling routes — ONLY available in non-production environments.
 * Provides request inspector and timing breakdown for development.
 *
 * Security: case-insensitive production check, auto-purge after TTL,
 * replay endpoint removed (use /api/agent/execute directly).
 */
import { Router, type RequestHandler } from 'express';

export interface DebugRequest {
  id: string;
  method: string;
  path: string;
  body: unknown;
  timestamp: number;
  durationMs: number;
  statusCode: number;
}

const MAX_DEBUG_REQUESTS = 50;
const MAX_DEBUG_BODY_SIZE = 1024;
const DEBUG_TTL_MS = 10 * 60 * 1000; // 10 minutes auto-purge
const SENSITIVE_KEYS = new Set(['password', 'secret', 'token', 'api_key', 'apikey', 'authorization', 'credentials', 'bypass_secret', 'system_prompt']);

/** Case-insensitive production check */
function isProduction(): boolean {
  return (process.env.NODE_ENV || '').toLowerCase() === 'production';
}

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
    enabled: !isProduction(),
  };
}

export type DebugState = ReturnType<typeof createDebugState>;

/**
 * Middleware that records request timing for debug inspection.
 * Returns a no-op if debug is disabled (production).
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

      // TTL auto-purge: remove entries older than DEBUG_TTL_MS
      const cutoff = Date.now() - DEBUG_TTL_MS;
      state.requests = state.requests.filter(r => r.timestamp > cutoff);
    });

    next();
  };
}

/**
 * Debug routes — completely disabled in production.
 * Does NOT include replay functionality (security risk).
 */
export function debugRouter(state: DebugState): Router {
  const router = Router();

  // Guard: reject all debug requests in production (case-insensitive)
  router.use((_req, res, next) => {
    if (!state.enabled || isProduction()) {
      return res.status(404).json({ error: 'Not found' });
    }
    next();
  });

  /** GET /api/debug/requests - Last N requests with timing */
  router.get('/debug/requests', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, MAX_DEBUG_REQUESTS);
    res.json({
      requests: state.requests.slice(0, limit),
      total: state.requests.length,
    });
  });

  /** GET /api/debug/requests/:id - Single request detail */
  router.get('/debug/requests/:id', (req, res) => {
    const entry = state.requests.find((r) => r.id === req.params.id);
    if (!entry) return res.status(404).json({ error: 'Request not found' });
    res.json(entry);
  });

  /** GET /api/debug/stats - Limited system statistics (no version fingerprinting) */
  router.get('/debug/stats', (_req, res) => {
    res.json({
      uptime: Math.floor(process.uptime()),
      debugRequestsCaptured: state.requests.length,
      maxRequests: MAX_DEBUG_REQUESTS,
      ttlMs: DEBUG_TTL_MS,
    });
  });

  return router;
}
