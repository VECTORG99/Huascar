import { Router } from 'express';
import type { Store } from '../engine/Store.js';
import { logger } from '../logger.js';

export function ragRouter(store: Store): Router {
  const router = Router();
  router.get('/rag/sources', (_req, res, next) => {
    try {
      res.json({ sources: store.getRagSources() });
    } catch (error: unknown) {
      next(error);
    }
  });

  /**
   * Soft-delete a RAG source (#258). Marks as deleted, keeps data for recovery.
   */
  router.delete('/rag/sources/:source', (req, res, next) => {
    try {
      const count = store.softDeleteChunksBySource(req.params.source);
      logger.info({ source: req.params.source, chunks: count }, '[RAG] Source soft-deleted');
      res.json({ deleted: true, source: req.params.source, chunksAffected: count });
    } catch (error: unknown) {
      next(error);
    }
  });

  /**
   * Restore a soft-deleted RAG source (#258).
   */
  router.post('/rag/sources/:source/restore', (req, res, next) => {
    try {
      const count = store.restoreChunksBySource(req.params.source);
      if (count === 0) {
        return res.status(404).json({ error: 'No deleted chunks found for this source' });
      }
      logger.info({ source: req.params.source, chunks: count }, '[RAG] Source restored');
      res.json({ restored: true, source: req.params.source, chunksRestored: count });
    } catch (error: unknown) {
      next(error);
    }
  });

  /**
   * Permanently delete a RAG source (hard delete, admin only).
   */
  router.delete('/rag/sources/:source/purge', (req, res, next) => {
    try {
      store.deleteChunksBySource(req.params.source);
      logger.warn({ source: req.params.source }, '[RAG] Source permanently deleted');
      res.json({ purged: true, source: req.params.source });
    } catch (error: unknown) {
      next(error);
    }
  });

  return router;
}
