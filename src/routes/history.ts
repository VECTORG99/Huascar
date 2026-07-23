import { Router } from 'express';
import { config } from '../config.js';
import type { Store } from '../engine/Store.js';

export function historyRouter(store: Store): Router {
  const router = Router();
  router.get('/history', (req, res, next) => {
    try {
      const parsed = parseInt(req.query.limit as string, 10);
      const limit = !isNaN(parsed) ? parsed : config.store.historyLimit;
      const records = store.getHistory(limit);
      res.json({ history: records });
    } catch (error: unknown) {
      next(error);
    }
  });
  return router;
}
