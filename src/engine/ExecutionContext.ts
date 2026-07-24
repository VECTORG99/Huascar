/**
 * Execution Context provides persistent memory between agent executions.
 *
 * Features:
 * - Sessions group executions with shared context
 * - Context injection: summarizes previous executions into system prompt
 * - Failure learning: past errors injected as warnings
 * - Key-value memory store per role
 */
import { logger } from '../logger.js';
import type { Store } from './Store.js';

export interface MemoryEntry {
  key: string;
  value: string;
  role: string;
  created_at: number;
  updated_at: number;
}

export interface FailureRecord {
  tool: string;
  args: string;
  error_type: string;
  timestamp: number;
}

export interface ExecutionSummary {
  role: string;
  task: string;
  status: 'success' | 'blocked';
  timestamp: string;
  snippet: string;
}

export class ExecutionContext {
  private memory = new Map<string, Map<string, MemoryEntry>>();
  private failures = new Map<string, FailureRecord[]>();
  private static readonly MAX_ENTRIES_PER_ROLE = 100;
  private static readonly MAX_ROLES = 50;
  private static readonly MAX_FAILURES_PER_ROLE = 20;

  constructor(private readonly store: Store | null) {}

  /**
   * Get recent execution summaries for a session/role to inject as context.
   */
  getExecutionSummaries(role: string, limit = 5): ExecutionSummary[] {
    if (!this.store) return [];
    try {
      const history = this.store.getHistory(limit);
      return history
        .filter((h) => h.role === role)
        .slice(0, limit)
        .map((h) => ({
          role: h.role,
          task: h.task.slice(0, 200),
          status: h.response.startsWith('Error') ? ('blocked' as const) : ('success' as const),
          timestamp: h.created_at,
          snippet: h.response.slice(0, 300),
        }));
    } catch {
      return [];
    }
  }

  /**
   * Build context injection string from previous executions.
   */
  buildContextInjection(role: string, maxTokens = 2000): string {
    const summaries = this.getExecutionSummaries(role);
    const failures = this.getFailures(role);

    const parts: string[] = [];

    if (summaries.length > 0) {
      parts.push('PREVIOUS EXECUTIONS:');
      for (const s of summaries) {
        parts.push(`[${s.timestamp}] Task: ${s.task} → ${s.status}: ${s.snippet}`);
      }
    }

    if (failures.length > 0) {
      parts.push('\nKNOWN FAILURES (avoid repeating):');
      for (const f of failures.slice(-5)) {
        parts.push(`- ${f.tool}(${f.args.slice(0, 100)}) failed: ${f.error_type}`);
      }
    }

    const memory = this.getMemory(role);
    if (memory.length > 0) {
      parts.push('\nAGENT NOTES:');
      for (const m of memory.slice(-5)) {
        parts.push(`- ${m.key}: ${m.value}`);
      }
    }

    const text = parts.join('\n');
    // Rough token approximation: ~4 chars per token
    return text.slice(0, maxTokens * 4);
  }

  /**
   * Record a tool failure for future context injection.
   */
  recordFailure(role: string, tool: string, args: string, errorType: string): void {
    if (!this.failures.has(role)) this.failures.set(role, []);
    const records = this.failures.get(role)!;
    records.push({ tool, args, error_type: errorType, timestamp: Date.now() });
    // Keep last N failures per role
    if (records.length > ExecutionContext.MAX_FAILURES_PER_ROLE)
      records.splice(0, records.length - ExecutionContext.MAX_FAILURES_PER_ROLE);
    logger.debug({ role, tool, errorType }, '[ExecutionContext] Failure recorded');
  }

  getFailures(role: string): FailureRecord[] {
    return this.failures.get(role) ?? [];
  }

  /**
   * Store a key-value memory entry for a role.
   */
  setMemory(role: string, key: string, value: string): void {
    if (!this.memory.has(role)) {
      // Evict oldest role if at capacity
      if (this.memory.size >= ExecutionContext.MAX_ROLES) {
        let oldestRole: string | undefined;
        let oldestTime = Infinity;
        for (const [r, entries] of this.memory) {
          for (const entry of entries.values()) {
            if (entry.updated_at < oldestTime) {
              oldestTime = entry.updated_at;
              oldestRole = r;
            }
            break; // only check first entry per role for speed
          }
        }
        if (oldestRole) this.memory.delete(oldestRole);
      }
      this.memory.set(role, new Map());
    }
    const roleMemory = this.memory.get(role)!;
    const now = Date.now();
    const existing = roleMemory.get(key);
    roleMemory.set(key, {
      key,
      value,
      role,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    });
    // Evict oldest entries if over limit
    if (roleMemory.size > ExecutionContext.MAX_ENTRIES_PER_ROLE) {
      let oldestKey: string | undefined;
      let oldestTime = Infinity;
      for (const [k, entry] of roleMemory) {
        if (entry.updated_at < oldestTime) {
          oldestTime = entry.updated_at;
          oldestKey = k;
        }
      }
      if (oldestKey) roleMemory.delete(oldestKey);
    }
  }

  getMemoryValue(role: string, key: string): string | undefined {
    return this.memory.get(role)?.get(key)?.value;
  }

  getMemory(role: string): MemoryEntry[] {
    const roleMemory = this.memory.get(role);
    if (!roleMemory) return [];
    return [...roleMemory.values()];
  }

  deleteMemory(role: string, key: string): boolean {
    return this.memory.get(role)?.delete(key) ?? false;
  }

  clearMemory(role: string): void {
    this.memory.delete(role);
  }
}
