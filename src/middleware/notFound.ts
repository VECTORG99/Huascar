import type { RequestHandler } from 'express';
import { ApiError, ErrorCodes } from '../errors.js';

export const notFound: RequestHandler = (req, _res, next) => {
  next(new ApiError(ErrorCodes.API_VALIDATION_ERROR, `Route not found: ${req.method} ${req.path}`, 404));
};
