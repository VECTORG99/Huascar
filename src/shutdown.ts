/**
 * Graceful shutdown utilities.
 * Tracks in-flight executions and waits for them to complete (#285).
 */
import { randomUUID } from 'crypto';
import { logger } from './logger.js';

const inFlight = new Set<string>();

/** Track a new in-flight execution. Returns an ID to untrack later. */
export function trackExecution(): string {
  const id = randomUUID();
  inFlight.add(id);
  return id;
}

/** Untrack a completed execution. */
export function untrackExecution(id: string): void {
  inFlight.delete(id);
}

/** Number of in-flight executions. */
export function inFlightCount(): number {
  return inFlight.size;
}

/**
 * Wait for in-flight executions to complete, with a hard timeout (#285).
 * Checks every 200ms. Returns when all complete or timeout reached.
 */
export async function waitForInFlight(hardTimeoutMs = 30_000): Promise<void> {
  if (inFlight.size === 0) return;
  logger.info({ count: inFlight.size }, '[Shutdown] Waiting for in-flight executions');
  const deadline = Date.now() + hardTimeoutMs;
  while (inFlight.size > 0 && Date.now() < deadline) {
    await new Promise<void>((resolve) => setTimeout(resolve, 200).unref());
  }
  if (inFlight.size > 0) {
    logger.warn({ remaining: inFlight.size }, '[Shutdown] Hard timeout reached, forcing shutdown');
  }
}
