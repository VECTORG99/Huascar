import { config } from './config.js';
import { mcpConnectionPool } from './engine/McpConnectionPool.js';
import { logger } from './logger.js';
import { app, store } from './app.js';

if (config.retention.cleanupOnStart) {
  try {
    const report = store.cleanupRetention();
    logger.info({ retention: report }, 'retention cleanup completed');
  } catch (err) {
    logger.error({ err }, 'retention cleanup failed');
  }
}

const server = app.listen(config.server.port, config.server.host, () => {
  logger.info({ host: config.server.host, port: config.server.port }, 'Huascar Backend running');
});

let shuttingDown = false;

async function gracefulShutdown(signal: string, exitCode: number): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'graceful shutdown started');

  const timeout = setTimeout(() => {
    logger.error({ signal }, 'shutdown timeout, forcing exit');
    process.exit(1);
  }, 10000);
  timeout.unref();

  await new Promise<void>((resolve) => server.close(() => resolve()));
  await mcpConnectionPool.closeAll();
  if (store.isOpen()) store.close();
  clearTimeout(timeout);
  process.exit(exitCode);
}

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaught exception');
  void gracefulShutdown('uncaughtException', 1);
});
process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'unhandled rejection');
  void gracefulShutdown('unhandledRejection', 1);
});
process.on('SIGTERM', () => void gracefulShutdown('SIGTERM', 0));
process.on('SIGINT', () => void gracefulShutdown('SIGINT', 0));
