import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { Store } from './engine/Store.js';
import { creatorProtectedRouter, creatorPublicRouter } from './creator/router.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { agentRouter } from './routes/agent.js';
import { agentsRouter } from './routes/agents.js';
import { healthRouter } from './routes/health.js';
import { historyRouter } from './routes/history.js';
import { hooksRouter } from './routes/hooks.js';
import { createMetricsState, metricsMiddleware, metricsRouter } from './routes/metrics.js';
import { openApiRouter } from './routes/openapi.js';
import { ragRouter } from './routes/rag.js';
import { rolesRouter } from './routes/roles.js';
import { commitApprovals } from './services/approvals.js';

export const app = express();
export const store = new Store();
export const metricsState = createMetricsState();

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

// --- Rate Limiting ---
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_GLOBAL || '100', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
  keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown',
});

const executeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_EXECUTE || '5', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Execution rate limit exceeded. Max 5 requests per minute.' },
  keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown',
});

const creatorLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_CREATOR || '30', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Creator API rate limit exceeded' },
  keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown',
});

app.use(globalLimiter);
export { executeLimiter, creatorLimiter };

app.use('/api/v1/creator', creatorLimiter, creatorPublicRouter);

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

app.use(metricsMiddleware(metricsState));
app.use('/api', metricsRouter(metricsState));
app.use('/api', healthRouter);
app.use('/api', openApiRouter);

app.use('/api', (req, res, next) => {
  // Health and metrics are already handled above
  if (req.path === '/health' || req.path === '/metrics') return next();
  requireAuth(req, res, next);
});

app.use('/api', historyRouter(store));
app.use('/api/v1/creator', creatorProtectedRouter);
app.use('/api', ragRouter(store));
app.use('/api', rolesRouter());
app.use('/api', agentsRouter(store));
app.use('/api', agentRouter(store));

// Apply stricter rate limit to agent execution endpoint
app.use('/api/agent/execute', executeLimiter);
app.use('/api', hooksRouter(commitApprovals));

app.use(notFound);
app.use(errorHandler);
