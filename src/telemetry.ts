/**
 * Lightweight structured tracing for engine operations (#274).
 *
 * Uses the logger with structured fields (start/end/duration) rather than
 * a full tracing library. Provides real observability into engine operations.
 */
import { logger } from './logger.js';

export interface Span {
  end(): void;
  setAttribute(key: string, value: string | number | boolean): void;
  setStatus(code: 'OK' | 'ERROR', message?: string): void;
}

interface SpanData {
  name: string;
  attributes: Record<string, string | number | boolean>;
  startTime: number;
  status?: { code: 'OK' | 'ERROR'; message?: string };
}

class LoggerSpan implements Span {
  private data: SpanData;

  constructor(name: string, attributes: Record<string, string | number | boolean> = {}) {
    this.data = { name, attributes: { ...attributes }, startTime: Date.now() };
    logger.debug({ span: name, ...attributes }, `[Trace] ${name} started`);
  }

  setAttribute(key: string, value: string | number | boolean): void {
    this.data.attributes[key] = value;
  }

  setStatus(code: 'OK' | 'ERROR', message?: string): void {
    this.data.status = { code, message };
  }

  end(): void {
    const durationMs = Date.now() - this.data.startTime;
    const logData = {
      span: this.data.name,
      durationMs,
      status: this.data.status?.code ?? 'OK',
      ...this.data.attributes,
    };
    if (this.data.status?.code === 'ERROR') {
      logger.warn(
        { ...logData, error: this.data.status.message },
        `[Trace] ${this.data.name} failed (${durationMs}ms)`,
      );
    } else {
      logger.info(logData, `[Trace] ${this.data.name} completed (${durationMs}ms)`);
    }
  }
}

class StructuredTracer {
  startSpan(name: string, attributes?: Record<string, string | number | boolean>): Span {
    return new LoggerSpan(name, attributes);
  }
}

export const tracer = new StructuredTracer();

/**
 * Wrap an async operation with a trace span.
 * Creates a real structured log entry with start/end/duration (#274).
 */
export async function withSpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean>,
  fn: () => Promise<T>,
): Promise<T> {
  const span = tracer.startSpan(name, attributes);
  try {
    const result = await fn();
    span.setStatus('OK');
    return result;
  } catch (err) {
    span.setStatus('ERROR', err instanceof Error ? err.message : 'unknown');
    throw err;
  } finally {
    span.end();
  }
}
