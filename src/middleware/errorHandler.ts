import type { ErrorRequestHandler } from 'express';
import { formatError } from '../errors.js';

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const formatted = formatError(err);
  const details = process.env.NODE_ENV === 'production'
    ? formatted.details
    : { ...(typeof formatted.details === 'object' && formatted.details ? formatted.details : {}), stack: err instanceof Error ? err.stack : undefined };

  process.stderr.write(JSON.stringify({ level: 'error', method: req.method, path: req.path, error: formatted }) + '\n');

  if (!res.headersSent) {
    res.status(formatted.statusCode).json({
      error: {
        code: formatted.code,
        message: formatted.message,
        ...(details === undefined ? {} : { details }),
      },
    });
  }
};
