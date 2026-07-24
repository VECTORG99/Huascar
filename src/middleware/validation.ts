/**
 * Middleware to validate URL path parameters.
 * Prevents oversized or malformed params from reaching handlers (#278).
 */
import type { RequestHandler } from 'express';

const MAX_PARAM_LENGTH = 100;
const SAFE_PARAM_PATTERN = /^[a-zA-Z0-9._\-:]+$/;

/**
 * Validates all path params: max length 100, alphanumeric + hyphens/dots/underscores/colons.
 */
export const validatePathParams: RequestHandler = (req, res, next) => {
  if (req.params) {
    for (const [key, value] of Object.entries(req.params)) {
      if (typeof value !== 'string') continue;
      if (value.length > MAX_PARAM_LENGTH) {
        return res.status(400).json({ error: `Path parameter "${key}" exceeds maximum length (${MAX_PARAM_LENGTH})` });
      }
      if (!SAFE_PARAM_PATTERN.test(value)) {
        return res.status(400).json({ error: `Path parameter "${key}" contains invalid characters` });
      }
    }
  }
  next();
};

/**
 * Content-Type enforcement that strips charset and other params before comparing (#249).
 * "application/json; charset=utf-8" passes correctly.
 */
export const enforceJsonContentType: RequestHandler = (req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.headers['content-type'];
    if (!contentType) {
      return res.status(415).json({ error: 'Content-Type must be application/json' });
    }
    // Strip parameters (charset, boundary, etc.) and compare media type only
    const mediaType = contentType.split(';')[0]?.trim().toLowerCase();
    if (mediaType !== 'application/json') {
      return res.status(415).json({ error: 'Content-Type must be application/json' });
    }
  }
  next();
};
