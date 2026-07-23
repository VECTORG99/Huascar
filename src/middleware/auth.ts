import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger.js';

/**
 * Authentication middleware for the Huascar API.
 * 
 * Supports Bearer token auth via Authorization header or X-API-Key header.
 * API keys are configured via HUASCAR_API_KEYS env var (comma-separated).
 * 
 * When AUTH_REQUIRED=false (default for development), auth is optional.
 * When AUTH_REQUIRED=true (production), all protected routes require a valid key.
 */

const AUTH_REQUIRED = process.env.AUTH_REQUIRED === 'true';

// Load API keys from environment — comma-separated list
const API_KEYS = new Set(
  (process.env.HUASCAR_API_KEYS || '')
    .split(',')
    .map(k => k.trim())
    .filter(k => k.length > 0)
);

function extractToken(req: Request): string | null {
  // Check Authorization: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  // Check X-API-Key header
  const apiKeyHeader = req.headers['x-api-key'];
  if (typeof apiKeyHeader === 'string' && apiKeyHeader.length > 0) {
    return apiKeyHeader;
  }

  return null;
}

/**
 * Middleware that requires authentication on protected routes.
 * Public routes (health) should be mounted BEFORE this middleware.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // If auth is not required (development mode), pass through
  if (!AUTH_REQUIRED) {
    next();
    return;
  }

  // If no API keys are configured, warn and pass through (misconfiguration)
  if (API_KEYS.size === 0) {
    logger.warn('AUTH_REQUIRED=true but no HUASCAR_API_KEYS configured — allowing request');
    next();
    return;
  }

  const token = extractToken(req);

  if (!token) {
    res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_MISSING',
      hint: 'Provide an API key via Authorization: Bearer <key> or X-API-Key header',
    });
    return;
  }

  if (!API_KEYS.has(token)) {
    res.status(403).json({
      error: 'Invalid API key',
      code: 'AUTH_INVALID',
    });
    return;
  }

  next();
}
