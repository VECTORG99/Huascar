/**
 * Huascar SDK — TypeScript client library for programmatic API consumption.
 *
 * Features:
 * - Type-safe request/response for all endpoints
 * - Automatic retry with exponential backoff
 * - Streaming support (SSE)
 * - Structured error handling
 * - Request/response interceptors
 */

export interface HuascarClientOptions {
  baseUrl: string;
  apiKey?: string;
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export interface ExecuteRequest {
  task: string;
  role: string;
  system_prompt?: string;
  config?: Record<string, unknown>;
  session_id?: string;
  mock_scenario?: string;
}

export interface ExecuteResponse {
  status: 'success' | 'blocked';
  agent_role: string;
  response?: string;
  error?: string;
  session_id?: string;
}

export interface StreamEvent {
  type: 'start' | 'thinking' | 'tool_call' | 'tool_result' | 'complete' | 'error';
  data: unknown;
}

export interface HealthResponse {
  status: string;
  uptime?: number;
  version?: string;
}

export interface HistoryEntry {
  id: number;
  role: string;
  task: string;
  response: string;
  created_at: string;
}

export interface ToolInfo {
  name: string;
  description: string;
  serverName: string;
  inputSchema?: unknown;
}

export interface HuascarError {
  code: string;
  message: string;
  statusCode: number;
  details?: unknown;
}

export class HuascarApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HuascarApiError';
  }
}

export class HuascarClient {
  private readonly baseUrl: string;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly timeoutMs: number;
  private readonly defaultHeaders: Record<string, string>;

  constructor(options: HuascarClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.maxRetries = options.maxRetries ?? 2;
    this.retryDelayMs = options.retryDelayMs ?? 1000;
    this.timeoutMs = options.timeoutMs ?? 120000;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}),
      ...(options.headers ?? {}),
    };
  }

  /** Execute a task with the agent engine. */
  async execute(request: ExecuteRequest): Promise<ExecuteResponse> {
    return this.post<ExecuteResponse>('/api/agent/execute', request);
  }

  /** Execute with Server-Sent Events streaming. */
  async *executeStream(request: ExecuteRequest): AsyncGenerator<StreamEvent> {
    const response = await this.fetchWithRetry(`${this.baseUrl}/api/agent/execute/stream`, {
      method: 'POST',
      headers: { ...this.defaultHeaders, Accept: 'text/event-stream' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ code: 'UNKNOWN', message: response.statusText }));
      throw new HuascarApiError(err.code || 'HTTP_ERROR', err.message || response.statusText, response.status);
    }

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7);
          } else if (line.startsWith('data: ') && currentEvent) {
            try {
              const data = JSON.parse(line.slice(6));
              yield { type: currentEvent as StreamEvent['type'], data };
            } catch {
              // Skip malformed data
            }
            currentEvent = '';
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /** Check backend health. */
  async health(): Promise<HealthResponse> {
    return this.get<HealthResponse>('/api/health');
  }

  /** Get execution history. */
  async history(options?: { limit?: number; offset?: number }): Promise<HistoryEntry[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.offset) params.set('offset', String(options.offset));
    const query = params.toString();
    return this.get<HistoryEntry[]>(`/api/history${query ? `?${query}` : ''}`);
  }

  /** List available tools. */
  async tools(): Promise<ToolInfo[]> {
    return this.get<ToolInfo[]>('/api/tools');
  }

  // --- HTTP helpers ---

  private async get<T>(path: string): Promise<T> {
    const response = await this.fetchWithRetry(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: this.defaultHeaders,
    });
    return this.handleResponse<T>(response);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const response = await this.fetchWithRetry(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.defaultHeaders,
      body: JSON.stringify(body),
    });
    return this.handleResponse<T>(response);
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const err = await response.json().catch(() => ({ code: 'UNKNOWN', message: response.statusText }));
      throw new HuascarApiError(
        err.code || 'HTTP_ERROR',
        err.message || err.error || response.statusText,
        response.status,
        err.details,
      );
    }
    return response.json() as Promise<T>;
  }

  private async fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        // Generate and propagate X-Request-ID for log correlation
        const requestId =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID().slice(0, 8)
            : Math.random().toString(36).slice(2, 10);
        const headers = {
          ...(options.headers as Record<string, string>),
          'X-Request-ID': requestId,
        };
        const response = await fetch(url, { ...options, headers, signal: controller.signal });
        clearTimeout(timer);

        // Don't retry on 4xx (client errors)
        if (response.status >= 400 && response.status < 500) return response;
        // Retry on 5xx
        if (response.status >= 500 && attempt < this.maxRetries) {
          await this.sleep(this.retryDelayMs * Math.pow(2, attempt));
          continue;
        }
        return response;
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < this.maxRetries) {
          await this.sleep(this.retryDelayMs * Math.pow(2, attempt));
        }
      }
    }
    throw lastError || new Error('Request failed after retries');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
