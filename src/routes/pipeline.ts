/**
 * Pipeline orchestration API routes.
 * Security: enforces server-side limits on steps, task size, delegation depth,
 * and validates roles against steering configuration.
 */
import { Router } from 'express';
import { PipelineEngine, type PipelineDefinition } from '../engine/PipelineEngine.js';
import { ApiError, ErrorCodes } from '../errors.js';
import type { Store } from '../engine/Store.js';
import { HuascarEngine } from '../engine/HuascarEngine.js';
import { logger } from '../logger.js';

/** Server-enforced pipeline limits (not client-controllable) */
const MAX_PIPELINE_STEPS = 20;
const MAX_STEP_TASK_LENGTH = 10000;
const MAX_DELEGATION_DEPTH = 3;
const MAX_RETRIES_PER_STEP = 2;

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

      // Server-side security enforcement
      if (pipeline.steps.length > MAX_PIPELINE_STEPS) {
        throw new ApiError(
          ErrorCodes.API_VALIDATION_ERROR,
          `Pipeline exceeds maximum step count (${MAX_PIPELINE_STEPS})`,
          400,
        );
      }

      for (let i = 0; i < pipeline.steps.length; i++) {
        const step = pipeline.steps[i]!;
        if (step.task.length > MAX_STEP_TASK_LENGTH) {
          throw new ApiError(
            ErrorCodes.API_VALIDATION_ERROR,
            `Step ${i} task exceeds maximum length (${MAX_STEP_TASK_LENGTH} chars)`,
            400,
          );
        }
        // Clamp retries to server max
        if (step.retries !== undefined && step.retries > MAX_RETRIES_PER_STEP) {
          logger.warn({ step: i, requested: step.retries }, '[Pipeline] Clamping retries to server max');
          step.retries = MAX_RETRIES_PER_STEP;
        }
      }

      const executeStep = async (role: string, task: string, _context: string) => {
        const engine = new HuascarEngine(role, store);
        return engine.executeTask(task);
      };

      // IGNORE client-provided maxDelegationDepth — use server-enforced value
      const pipelineEngine = new PipelineEngine(executeStep, MAX_DELEGATION_DEPTH);
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
