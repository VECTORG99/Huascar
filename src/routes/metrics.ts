import crypto from 'crypto';
import { Router, type RequestHandler } from 'express';
import { logger, requestLogger } from '../logger.js';

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
    if (process.env.NODE_ENV === 'production' && metricsToken) {
      const provided = req.headers['x-metrics-token'];
      if (provided !== metricsToken) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }
    const uptime = Math.floor((Date.now() - state.startTime) / 1000);
    res.json({ uptime, totalRequests: state.metrics.totalRequests, requestsByPath: state.metrics.requestsByPath, errorsByPath: state.metrics.errorsByPath });
  });
  return router;
}
