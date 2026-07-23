import { Store } from './engine/Store.js';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  timestamp: string;
  checks: {
    database: { status: string; latency_ms?: number; error?: string };
    memory: { status: string; used_mb: number; limit_mb: number; percent: number };
    disk: { status: string };
  };
  version: string;
}

const MAX_MEMORY_PERCENT = 90;
const startTime = Date.now();

export function deepHealthCheck(store: Store | null): HealthStatus {
  const checks: HealthStatus['checks'] = {
    database: { status: 'unknown' },
    memory: { status: 'unknown', used_mb: 0, limit_mb: 0, percent: 0 },
    disk: { status: 'ok' },
  };

  // Database check
  if (store) {
    try {
      const t0 = Date.now();
      store.getExecutions(1); // lightweight query
      checks.database = { status: 'ok', latency_ms: Date.now() - t0 };
    } catch (err) {
      checks.database = { status: 'error', error: err instanceof Error ? err.message : 'unknown' };
    }
  } else {
    checks.database = { status: 'not_configured' };
  }

  // Memory check
  const mem = process.memoryUsage();
  const usedMb = Math.round(mem.heapUsed / 1024 / 1024);
  const limitMb = Math.round(mem.heapTotal / 1024 / 1024);
  const percent = Math.round((mem.heapUsed / mem.heapTotal) * 100);
  checks.memory = {
    status: percent > MAX_MEMORY_PERCENT ? 'warning' : 'ok',
    used_mb: usedMb,
    limit_mb: limitMb,
    percent,
  };

  // Determine overall status
  const hasError = checks.database.status === 'error';
  const hasWarning = checks.memory.status === 'warning';
  const status = hasError ? 'unhealthy' : hasWarning ? 'degraded' : 'healthy';

  return {
    status,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    checks,
    version: process.env.npm_package_version || '0.0.0',
  };
}
