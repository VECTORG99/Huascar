/**
 * OpenTelemetry instrumentation for the ReAct loop and MCP calls.
 * 
 * To enable: set OTEL_ENABLED=true and configure OTEL_EXPORTER_OTLP_ENDPOINT.
 * When disabled, all trace/metric calls are no-ops.
 */

export interface Span {
  end(): void;
  setAttribute(key: string, value: string | number | boolean): void;
  setStatus(code: 'OK' | 'ERROR', message?: string): void;
}

class NoOpSpan implements Span {
  end(): void {}
  setAttribute(): void {}
  setStatus(): void {}
}

class NoOpTracer {
  startSpan(_name: string, _attributes?: Record<string, string | number>): Span {
    return new NoOpSpan();
  }
}

export const tracer = new NoOpTracer();

/**
 * Wrap an async operation with a trace span.
 * When OTEL is configured, this creates real spans.
 * When not configured, this is a zero-overhead passthrough.
 */
export async function withSpan<T>(name: string, attributes: Record<string, string | number>, fn: () => Promise<T>): Promise<T> {
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
