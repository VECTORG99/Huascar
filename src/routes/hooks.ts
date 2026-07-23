import crypto from 'crypto';
import { Router } from 'express';
import { resolveApproval } from '../kiro/hooks.js';
import { ApiError, ErrorCodes } from '../errors.js';
import type { CommitApproval } from '../services/approvals.js';

export function hooksRouter(commitApprovals: Map<string, CommitApproval>): Router {
  const router = Router();
  router.post('/hooks/commit-approval', (req, res, next) => {
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

  router.post('/hooks/commit-approval/:id', (req, res, next) => {
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

  router.get('/hooks/commit-approval/:id', (req, res, next) => {
    try {
      const { id } = req.params;
      const record = commitApprovals.get(id);
      if (!record) return next(new ApiError(ErrorCodes.API_VALIDATION_ERROR, 'Approval request not found', 404));
      res.json({ id, ...record });
    } catch (error: unknown) {
      next(error);
    }
  });
  return router;
}
