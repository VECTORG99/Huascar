import pino from 'pino';

const production = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: production ? undefined : { target: 'pino-pretty', options: { colorize: true, singleLine: true } },
});

export function requestLogger(reqId: string) {
  return logger.child({ reqId });
}
