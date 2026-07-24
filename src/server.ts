import { config } from './config.js';
import { mcpConnectionPool } from './engine/McpConnectionPool.js';
import { logger } from './logger.js';
import { app, store } from './app.js';
import { clearApprovalTimers } from './services/approvals.js';
import { waitForInFlight } from './shutdown.js';

if (config.retention.cleanupOnStart) {
  try {
    const report = store.cleanupRetention();
    logger.info({ retention: report }, 'retention cleanup completed');
  } catch (err) {
    logger.error({ err }, 'retention cleanup failed');
  }
}

// Production startup security warnings
if (process.env.NODE_ENV === 'production' && !process.env.BYPASS_SECRET) {
  logger.warn('[SECURITY] BYPASS_SECRET not configured in production — admin bypass disabled');
}
if (process.env.NODE_ENV === 'production' && !process.env.HUASCAR_API_KEYS) {
  logger.warn('[SECURITY] HUASCAR_API_KEYS not configured — API authentication disabled');
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
  }, 45_000); // Hard timeout extended to 45s to allow 30s drain
  timeout.unref();

  // Stop accepting new connections
  await new Promise<void>((resolve) => server.close(() => resolve()));

  // Wait for in-flight executions to complete (up to 30s hard timeout) (#285)
  await waitForInFlight(30_000);

  clearApprovalTimers();
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
