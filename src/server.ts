import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { HuascarEngine } from './engine/HuascarEngine.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
    res.json({ status: "Huascar Backend Online" });
});

app.post('/api/agent/execute', async (req, res) => {
    const { task, role } = req.body;

    if (!task || !role) {
        return res.status(400).json({ error: "Faltan parámetros 'task' o 'role'" });
    }

    try {
        const engine = new HuascarEngine(role);
        const result = await engine.executeTask(task);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Huascar Backend corriendo en http://localhost:${PORT}`);
});
