import crypto from 'crypto';
import { Router, type RequestHandler } from 'express';
import { requestLogger } from '../logger.js';

export type MetricsState = {
  startTime: number;
  metrics: {
    totalRequests: number;
    requestsByPath: Record<string, number>;
    errorsByPath: Record<string, number>;
  };
};

export function createMetricsState(): MetricsState {
  return {
    startTime: Date.now(),
    metrics: { totalRequests: 0, requestsByPath: {}, errorsByPath: {} },
  };
}

export function metricsMiddleware(state: MetricsState): RequestHandler {
  return (req, res, next) => {
    const reqId = crypto.randomUUID().slice(0, 8);
    const t0 = Date.now();
    state.metrics.totalRequests++;
    state.metrics.requestsByPath[req.path] = (state.metrics.requestsByPath[req.path] || 0) + 1;

    res.on('finish', () => {
      const duration = Date.now() - t0;
      requestLogger(reqId).info({ method: req.method, path: req.path, status: res.statusCode, duration, len: res.get('content-length') || 0 }, 'request completed');
      if (res.statusCode >= 400) state.metrics.errorsByPath[req.path] = (state.metrics.errorsByPath[req.path] || 0) + 1;
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
      const provided = req.headers['x-metrics-token'] || req.query.token;
      if (provided !== metricsToken) {
        return res.status(401).json({ error: 'Unauthorized — provide X-Metrics-Token header or ?token= query param' });
      }
    } else if (process.env.NODE_ENV === 'production') {
      // In production without METRICS_SECRET, deny all access
      return res.status(403).json({ error: 'Metrics disabled — METRICS_SECRET not configured' });
    }
    const uptime = Math.floor((Date.now() - state.startTime) / 1000);
    // Sanitize: don't expose full path details, only aggregated counts
    const safeMetrics = {
      uptime,
      totalRequests: state.metrics.totalRequests,
      totalErrors: Object.values(state.metrics.errorsByPath).reduce((a, b) => a + b, 0),
      topPaths: Object.entries(state.metrics.requestsByPath)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([path, count]) => ({ path, count })),
    };
    res.json(safeMetrics);
  });
  return router;
}
