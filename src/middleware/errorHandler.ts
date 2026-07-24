import type { ErrorRequestHandler } from 'express';
import { formatError } from '../errors.js';
import { logger } from '../logger.js';

const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production';

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const formatted = formatError(err);
  // Always log full error with stack (server-side only)
  logger.error({ err, method: req.method, path: req.path, code: formatted.code }, formatted.message);
  if (!res.headersSent) {
    // Never include stack traces in response — only operational details
    const safeDetails = isProduction ? undefined : formatted.details;
    res.status(formatted.statusCode).json({
      error: { code: formatted.code, message: formatted.message, ...(safeDetails === undefined ? {} : { details: safeDetails }) },
    });
  }
};
