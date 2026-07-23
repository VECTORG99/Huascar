import type { ErrorRequestHandler } from 'express';
import { formatError } from '../errors.js';
import { logger } from '../logger.js';

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const formatted = formatError(err);
  const devDetails = process.env.NODE_ENV === 'production' ? formatted.details : { details: formatted.details, stack: err instanceof Error ? err.stack : undefined };
  logger.error({ err, method: req.method, path: req.path, code: formatted.code }, formatted.message);
  if (!res.headersSent) {
    res.status(formatted.statusCode).json({ error: { code: formatted.code, message: formatted.message, ...(devDetails === undefined ? {} : { details: devDetails }) } });
  }
};
