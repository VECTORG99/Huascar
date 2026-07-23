/**
 * Pipeline orchestration API routes.
 */
import { Router } from 'express';
import { PipelineEngine, type PipelineDefinition } from '../engine/PipelineEngine.js';
import { ApiError, ErrorCodes } from '../errors.js';
import type { Store } from '../engine/Store.js';
import { HuascarEngine } from '../engine/HuascarEngine.js';

export function pipelineRouter(store: Store): Router {
  const router = Router();

  /** POST /api/pipeline/execute — execute a pipeline */
  router.post('/pipeline/execute', async (req, res, next) => {
    try {
      const pipeline = req.body as PipelineDefinition;
      const validation = PipelineEngine.validate(pipeline);
      if (!validation.valid) {
        throw new ApiError(ErrorCodes.API_VALIDATION_ERROR, validation.errors.join('; '), 400);
      }

      const executeStep = async (role: string, task: string, _context: string) => {
        const engine = new HuascarEngine(role, store);
        return engine.executeTask(task);
      };

      const pipelineEngine = new PipelineEngine(executeStep, pipeline.maxDelegationDepth);
      const result = await pipelineEngine.execute(pipeline);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  /** POST /api/pipeline/validate — validate a pipeline definition */
  router.post('/pipeline/validate', (req, res) => {
    const result = PipelineEngine.validate(req.body);
    res.json(result);
  });

  return router;
}
