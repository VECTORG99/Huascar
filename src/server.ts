import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { HuascarEngine } from './engine/HuascarEngine.js';
import { Store } from './engine/Store.js';

const app = express();
app.use(cors());
app.use(express.json());

const store = new Store();

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
    const { task, role } = req.body;

    if (!task || !role) {
        return res.status(400).json({ error: "Faltan parámetros 'task' o 'role'" });
    }

    try {
        const engine = new HuascarEngine(role, store);
        const result = await engine.executeTask(task);
        res.json(result);
    } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
});

const server = app.listen(config.server.port, config.server.host, () => {
    console.log(`Huascar Backend corriendo en http://localhost:${config.server.port}`);
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
