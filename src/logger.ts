import pino from 'pino';
import crypto from 'crypto';

const production = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: production ? undefined : {
    target: 'pino-pretty',
    options: { colorize: true, singleLine: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
  },
});

/**
 * Create a child logger with a correlation ID.
 * If no reqId is provided, generates one automatically.
 */
export function requestLogger(reqId?: string) {
  return logger.child({ reqId: reqId || crypto.randomUUID().slice(0, 8) });
}
