import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { config } from './config.js';
import { HuascarEngine } from './engine/HuascarEngine.js';
import { Store } from './engine/Store.js';
import { resolveApproval, getApprovalStatus } from './kiro/hooks.js';
import { creatorRouter } from './creator/router.js';
import { requireAuth } from './middleware/auth.js';
import { logger, requestLogger } from './logger.js';
import { ApiError, ErrorCodes } from './errors.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';

const app = express();
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:5173').split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, health checks)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
}));
app.use(express.json({ limit: '128kb' }));
app.use('/api/v1/creator', creatorRouter);

// ponytail: global request timeout. Per-endpoint overrides if needed later.
app.use((req, res, next) => {
  const timer = setTimeout(() => {
    if (!res.headersSent) res.status(503).json({ error: 'Request timeout' });
  }, config.server.requestTimeoutMs);
  const done = () => clearTimeout(timer);
  res.on('finish', done);
  res.on('close', done);
  next();
});

// --- Monitoring ---
const startTime = Date.now();
const metrics = { totalRequests: 0, requestsByPath: {} as Record<string, number>, errorsByPath: {} as Record<string, number> };

app.use((req, res, next) => {
  const reqId = crypto.randomUUID().slice(0, 8);
  const t0 = Date.now();
  metrics.totalRequests++;
  metrics.requestsByPath[req.path] = (metrics.requestsByPath[req.path] || 0) + 1;

  res.on('finish', () => {
    const duration = Date.now() - t0;
    requestLogger(reqId).info({ method: req.method, path: req.path, status: res.statusCode, duration, len: res.get('content-length') || 0 }, 'request completed');
    if (res.statusCode >= 400) metrics.errorsByPath[req.path] = (metrics.errorsByPath[req.path] || 0) + 1;
  });
  next();
});

app.get('/api/metrics', (req, res) => {
  const metricsToken = process.env.METRICS_SECRET;
  if (process.env.NODE_ENV === 'production' && metricsToken) {
    const provided = req.headers['x-metrics-token'];
    if (provided !== metricsToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  res.json({ uptime, totalRequests: metrics.totalRequests, requestsByPath: metrics.requestsByPath, errorsByPath: metrics.errorsByPath });
});
// ---

const store = new Store();

// --- Public routes (no auth required) ---
app.get('/api/health', (req, res) => {
    res.json({ status: "Huascar Backend Online" });
});

// --- Auth middleware for all subsequent /api routes ---
app.use('/api', (req, res, next) => {
  // Health and metrics are already handled above
  if (req.path === '/health' || req.path === '/metrics') return next();
  requireAuth(req, res, next);
});

// In-memory store for HITL approvals (replace with DB in production)
const commitApprovals = new Map<string, { status: 'pending' | 'approved' | 'rejected'; diffContext: string; createdAt: string }>();

app.get('/api/history', (req, res, next) => {
    try {
        const parsed = parseInt(req.query.limit as string, 10);
        const limit = !isNaN(parsed) ? parsed : config.store.historyLimit;
        const records = store.getHistory(limit);
        res.json({ history: records });
    } catch (error: unknown) {
        next(error);
    }
});

app.post('/api/agent/execute', async (req, res, next) => {
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

app.post('/api/hooks/commit-approval', (req, res, next) => {
    try {
        const { diffContext } = req.body;
        if (typeof diffContext !== 'undefined' && typeof diffContext !== 'string') {
            return next(new ApiError(ErrorCodes.API_VALIDATION_ERROR, 'diffContext debe ser un texto', 400));
        }
        const id = crypto.randomUUID();
        commitApprovals.set(id, { status: 'pending', diffContext: diffContext || '', createdAt: new Date().toISOString() });
        setTimeout(() => commitApprovals.delete(id), 60000);
        res.json({ id, status: 'pending' });
    } catch (error: unknown) {
        next(error);
    }
});

app.post('/api/hooks/commit-approval/:id', (req, res, next) => {
    try {
        const { id } = req.params;
        const { approved } = req.body;
        if (typeof approved !== 'boolean') {
            return next(new ApiError(ErrorCodes.API_VALIDATION_ERROR, 'approved debe ser booleano', 400));
        }
        const record = commitApprovals.get(id);
        if (!record) return next(new ApiError(ErrorCodes.API_VALIDATION_ERROR, 'Approval request not found', 404));
        record.status = approved ? 'approved' : 'rejected';
        resolveApproval(id, approved);
        res.json({ id, status: record.status });
    } catch (error: unknown) {
        next(error);
    }
});

app.get('/api/hooks/commit-approval/:id', (req, res, next) => {
    try {
        const { id } = req.params;
        const record = commitApprovals.get(id);
        if (!record) return next(new ApiError(ErrorCodes.API_VALIDATION_ERROR, 'Approval request not found', 404));
        res.json({ id, ...record });
    } catch (error: unknown) {
        next(error);
    }
});

app.use(notFound);
app.use(errorHandler);

const server = app.listen(config.server.port, config.server.host, () => {
    logger.info({ host: config.server.host, port: config.server.port }, 'Huascar Backend running');
});

process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'uncaught exception');
    store.close();
    server.close(() => process.exit(1));
});
process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'unhandled rejection');
    store.close();
    server.close(() => process.exit(1));
});
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, closing connections');
    store.close();
    server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
    logger.info('SIGINT received, closing connections');
    store.close();
    server.close(() => process.exit(0));
});
