import { Router } from 'express';
import { config } from '../config.js';
import type { Store } from '../engine/Store.js';

export function historyRouter(store: Store): Router {
  const router = Router();
  router.get('/history', (req, res, next) => {
    try {
      const parsedLimit = parseInt(req.query.limit as string, 10);
      const limit = Math.min(!isNaN(parsedLimit) ? parsedLimit : config.store.historyLimit, 100);
      const parsedOffset = parseInt(req.query.offset as string, 10);
      const offset = Math.max(!isNaN(parsedOffset) ? parsedOffset : 0, 0);
      const records = store.getHistory(limit, offset);
      const total = store.getHistoryCount();
      res.json({
        history: records,
        pagination: { limit, offset, total, hasMore: offset + records.length < total },
      });
    } catch (error: unknown) {
      next(error);
    }
  });
  return router;
}
