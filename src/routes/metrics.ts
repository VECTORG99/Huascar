import crypto from 'crypto';
import { Router, type RequestHandler } from 'express';
import { requestLogger } from '../logger.js';

export type MetricsState = {
  startTime: number;
  metrics: {
    totalRequests: number;
    requestsByPath: Map<string, number>;
    errorsByPath: Map<string, number>;
  };
};

const MAX_TRACKED_PATHS = 200;

function incrementBounded(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) || 0) + 1);
  if (map.size > MAX_TRACKED_PATHS) {
    // Evict the least-used entry
    let minKey: string | undefined;
    let minVal = Infinity;
    for (const [k, v] of map) {
      if (v < minVal) {
        minVal = v;
        minKey = k;
      }
    }
    if (minKey) map.delete(minKey);
  }
}

export function createMetricsState(): MetricsState {
  return {
    startTime: Date.now(),
    metrics: { totalRequests: 0, requestsByPath: new Map(), errorsByPath: new Map() },
  };
}

export function metricsMiddleware(state: MetricsState): RequestHandler {
  return (req, res, next) => {
    const reqId = crypto.randomUUID().slice(0, 8);
    const t0 = Date.now();
    state.metrics.totalRequests++;
    incrementBounded(state.metrics.requestsByPath, req.path);

    res.on('finish', () => {
      const duration = Date.now() - t0;
      requestLogger(reqId).info(
        { method: req.method, path: req.path, status: res.statusCode, duration, len: res.get('content-length') || 0 },
        'request completed',
      );
      if (res.statusCode >= 400) incrementBounded(state.metrics.errorsByPath, req.path);
    });
    next();
  };
}

export function metricsRouter(state: MetricsState): Router {
  const router = Router();
  router.get('/metrics', (req, res) => {
    const metricsToken = process.env.METRICS_SECRET;
    // Always require auth when METRICS_SECRET is configured (any environment)
    if (metricsToken) {
      const provided = String(req.headers['x-metrics-token'] || req.query.token || '');
      // Timing-safe comparison to prevent token extraction via timing oracle
      const tokenMatch = provided.length === metricsToken.length
        && require('crypto').timingSafeEqual(Buffer.from(provided), Buffer.from(metricsToken));
      if (!tokenMatch) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    } else if ((process.env.NODE_ENV || '').toLowerCase() === 'production') {
      return res.status(403).json({ error: 'Metrics disabled — METRICS_SECRET not configured' });
    }
    const uptime = Math.floor((Date.now() - state.startTime) / 1000);
    // Sanitize: don't expose full path details, only aggregated counts
    const safeMetrics = {
      uptime,
      totalRequests: state.metrics.totalRequests,
      totalErrors: [...state.metrics.errorsByPath.values()].reduce((a, b) => a + b, 0),
      topPaths: [...state.metrics.requestsByPath.entries()]
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([path, count]) => ({ path, count })),
    };
    res.json(safeMetrics);
  });
  return router;
}
