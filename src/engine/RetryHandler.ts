/**
 * Retry logic with exponential backoff for transient tool call failures.
 * Distinguishes transient errors (timeout, 5xx, network) from permanent ones (auth, not found).
 */
import { logger } from '../logger.js';

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  retryableErrors?: Set<string>;
}

const DEFAULT_RETRYABLE_PATTERNS = [
  'timeout',
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'ENOTFOUND',
  '5', // 5xx status codes start with '5'
  'socket hang up',
  'network',
  'temporarily',
  'rate limit',
  'throttl',
];

function isTransientError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return DEFAULT_RETRYABLE_PATTERNS.some((p) => msg.includes(p));
}

export async function withRetry<T>(fn: () => Promise<T>, label: string, options: RetryOptions = {}): Promise<T> {
  const maxRetries = options.maxRetries ?? 2;
  const initialDelayMs = options.initialDelayMs ?? 500;
  const maxDelayMs = options.maxDelayMs ?? 10000;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;

      if (attempt >= maxRetries || !isTransientError(err)) {
        throw err;
      }

      const delay = Math.min(initialDelayMs * Math.pow(2, attempt), maxDelayMs);
      logger.warn(
        { attempt: attempt + 1, maxRetries, delay, label, error: err instanceof Error ? err.message : String(err) },
        '[RetryHandler] Retrying after transient error',
      );
      await sleep(delay);
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
