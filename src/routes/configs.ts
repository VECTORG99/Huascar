/**
 * Config versioning and rollback API routes.
 */
import { Router } from 'express';
import { ConfigStore } from '../engine/ConfigStore.js';
import { ApiError, ErrorCodes } from '../errors.js';

/**
 * Creates configs router with a pre-built ConfigStore.
 */
export function createConfigsRouter(configStore: ConfigStore): Router {
  const router = Router();

  /** POST /api/configs — save a new config version */
  router.post('/configs', (req, res) => {
    const { name, config: configJson } = req.body;
    if (!name || typeof name !== 'string') {
      throw new ApiError(ErrorCodes.API_VALIDATION_ERROR, 'name is required', 400);
    }
    if (!configJson) {
      throw new ApiError(ErrorCodes.API_VALIDATION_ERROR, 'config is required', 400);
    }
    const saved = configStore.save(name, configJson);
    res.status(201).json(saved);
  });

  /** GET /api/configs — list all configs */
  router.get('/configs', (_req, res) => {
    res.json(configStore.list());
  });

  /** GET /api/configs/:name/versions — get version history */
  router.get('/configs/:name/versions', (req, res) => {
    const versions = configStore.getVersions(req.params.name);
    res.json(versions);
  });

  /** GET /api/configs/:name/active — get active config */
  router.get('/configs/:name/active', (req, res) => {
    const active = configStore.getActive(req.params.name);
    if (!active) return res.status(404).json({ error: 'No active config found' });
    res.json(active);
  });

  /** PUT /api/configs/:name/activate/:version — activate (rollback to) a version */
  router.put('/configs/:name/activate/:version', (req, res) => {
    const version = parseInt(req.params.version, 10);
    if (isNaN(version)) {
      throw new ApiError(ErrorCodes.API_VALIDATION_ERROR, 'version must be a number', 400);
    }
    const activated = configStore.activate(req.params.name, version);
    if (!activated) return res.status(404).json({ error: 'Version not found' });
    res.json(activated);
  });

  /** GET /api/configs/:name/diff — diff between two versions */
  router.get('/configs/:name/diff', (req, res) => {
    const v1 = parseInt(req.query.v1 as string, 10);
    const v2 = parseInt(req.query.v2 as string, 10);
    if (isNaN(v1) || isNaN(v2)) {
      throw new ApiError(ErrorCodes.API_VALIDATION_ERROR, 'v1 and v2 query params required', 400);
    }
    const diff = configStore.diff(req.params.name, v1, v2);
    if (!diff) return res.status(404).json({ error: 'One or both versions not found' });
    res.json(diff);
  });

  return router;
}
