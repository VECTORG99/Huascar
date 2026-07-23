import fs from 'fs';
import { Router } from 'express';
import { config } from '../config.js';

interface SteeringConfig {
  roles?: Record<string, {
    name?: string;
    description?: string;
    recommended_tools?: string[];
    examples?: string[];
    temperature?: number;
  }>;
}

export function readRoles(readFile: typeof fs.readFileSync = fs.readFileSync) {
  const steering = JSON.parse(readFile(config.paths.steering, config.rag.encoding).toString()) as SteeringConfig;
  return Object.entries(steering.roles ?? {}).map(([id, role]) => ({
    id,
    name: role.name ?? id,
    description: role.description,
    recommended_tools: role.recommended_tools ?? [],
    examples: role.examples ?? [],
    temperature: role.temperature,
  }));
}

export function rolesRouter(getRoles = readRoles): Router {
  const router = Router();
  router.get('/roles', (_req, res, next) => {
    try {
      res.json({ roles: getRoles() });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
