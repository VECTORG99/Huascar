import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { config } from './config.js';
import { HuascarEngine } from './engine/HuascarEngine.js';
import { Store } from './engine/Store.js';
import { resolveApproval, getApprovalStatus } from './kiro/hooks.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10kb' }));

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
    const line = { t: new Date().toISOString(), reqId, method: req.method, path: req.path, status: res.statusCode, duration, len: res.get('content-length') || 0 };
    console.log(JSON.stringify(line));
    if (res.statusCode >= 400) metrics.errorsByPath[req.path] = (metrics.errorsByPath[req.path] || 0) + 1;
  });
  next();
});

app.get('/api/metrics', (req, res) => {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  res.json({ uptime, totalRequests: metrics.totalRequests, requestsByPath: metrics.requestsByPath, errorsByPath: metrics.errorsByPath });
});
// ---

const store = new Store();

// In-memory store for HITL approvals (replace with DB in production)
const commitApprovals = new Map<string, { status: 'pending' | 'approved' | 'rejected'; diffContext: string; createdAt: string }>();

app.get('/api/history', (req, res) => {
    try {
        const limit = parseInt(req.query.limit as string) || config.store.historyLimit;
        const records = store.getHistory(limit);
        res.json({ history: records });
    } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ status: "Huascar Backend Online" });
});

app.post('/api/agent/execute', async (req, res) => {
    const { task, role, system_prompt, config: agentConfig } = req.body;

    if (!task || !role) {
        return res.status(400).json({ error: "Faltan parámetros 'task' o 'role'" });
    }

    try {
        const engine = new HuascarEngine(role, store);
        const result = await engine.executeTask(task, system_prompt, agentConfig);
        res.json(result);
    } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
});

app.post('/api/hooks/commit-approval', (req, res) => {
    const { diffContext } = req.body;
    const id = crypto.randomUUID();
    commitApprovals.set(id, { status: 'pending', diffContext: diffContext || '', createdAt: new Date().toISOString() });
    res.json({ id, status: 'pending' });
});

app.post('/api/hooks/commit-approval/:id', (req, res) => {
    const { id } = req.params;
    const { approved } = req.body;
    const record = commitApprovals.get(id);
    if (!record) return res.status(404).json({ error: 'Approval request not found' });
    record.status = approved ? 'approved' : 'rejected';
    resolveApproval(id, approved);
    res.json({ id, status: record.status });
});

app.get('/api/hooks/commit-approval/:id', (req, res) => {
    const { id } = req.params;
    const record = commitApprovals.get(id);
    if (!record) return res.status(404).json({ error: 'Approval request not found' });
    res.json({ id, ...record });
});

const server = app.listen(config.server.port, config.server.host, () => {
    console.log(`Huascar Backend corriendo en http://${config.server.host}:${config.server.port}`);
});

process.on('SIGTERM', () => {
    console.log('SIGTERM recibido, cerrando conexiones...');
    store.close();
    server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
    console.log('SIGINT recibido, cerrando conexiones...');
    store.close();
    server.close(() => process.exit(0));
});
