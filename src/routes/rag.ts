import { Router } from 'express';
import type { Store } from '../engine/Store.js';

export function ragRouter(store: Store): Router {
  const router = Router();
  router.get('/rag/sources', (req, res, next) => {
    try {
      res.json({ sources: store.getRagSources() });
    } catch (error: unknown) {
      next(error);
    }
  });

  router.delete('/rag/sources/:source', (req, res, next) => {
    try {
      store.deleteChunksBySource(req.params.source);
      res.json({ deleted: true, source: req.params.source });
    } catch (error: unknown) {
      next(error);
    }
  });
  return router;
}
