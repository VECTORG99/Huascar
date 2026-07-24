/**
 * Execution Context provides persistent memory between agent executions.
 *
 * Features:
 * - Sessions group executions with shared context
 * - Context injection: summarizes previous executions into system prompt
 * - Failure learning: past errors injected as warnings (persisted to DB)
 * - Key-value memory store per role (persisted via agent_memory table)
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

  constructor(private readonly store: Store | null) {
    this.loadFromDb();
  }

  /**
   * Load persisted memory and failures from DB on startup (#245).
   */
  private loadFromDb(): void {
    if (!this.store) return;
    try {
      const db = this.store.getDatabase();
      // Load memory entries
      const memoryRows = db.prepare('SELECT role, key, value, created_at, updated_at FROM agent_memory').all() as {
        role: string;
        key: string;
        value: string;
        created_at: number;
        updated_at: number;
      }[];
      for (const row of memoryRows) {
        if (!this.memory.has(row.role)) this.memory.set(row.role, new Map());
        this.memory.get(row.role)!.set(row.key, {
          key: row.key,
          value: row.value,
          role: row.role,
          created_at: row.created_at,
          updated_at: row.updated_at,
        });
      }
      // Load failures
      const failureRows = db
        .prepare('SELECT role, tool, args, error_type, timestamp FROM execution_failures ORDER BY timestamp DESC')
        .all() as {
        role: string;
        tool: string;
        args: string;
        error_type: string;
        timestamp: number;
      }[];
      for (const row of failureRows) {
        if (!this.failures.has(row.role)) this.failures.set(row.role, []);
        const records = this.failures.get(row.role)!;
        if (records.length < ExecutionContext.MAX_FAILURES_PER_ROLE) {
          records.push({ tool: row.tool, args: row.args, error_type: row.error_type, timestamp: row.timestamp });
        }
      }
      logger.info(
        { memoryRoles: this.memory.size, failureRoles: this.failures.size },
        '[ExecutionContext] Loaded from DB',
      );
    } catch (err) {
      logger.warn({ err }, '[ExecutionContext] Failed to load from DB, starting fresh');
    }
  }

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
   * Persisted to DB (#245).
   */
  recordFailure(role: string, tool: string, args: string, errorType: string): void {
    if (!this.failures.has(role)) this.failures.set(role, []);
    const records = this.failures.get(role)!;
    const timestamp = Date.now();
    records.push({ tool, args, error_type: errorType, timestamp });
    // Keep last N failures per role
    if (records.length > ExecutionContext.MAX_FAILURES_PER_ROLE)
      records.splice(0, records.length - ExecutionContext.MAX_FAILURES_PER_ROLE);

    // Persist to DB
    if (this.store) {
      try {
        this.store.saveFailure(role, tool, args, errorType, timestamp);
      } catch (err) {
        logger.warn({ err }, '[ExecutionContext] Failed to persist failure');
      }
    }
    logger.debug({ role, tool, errorType }, '[ExecutionContext] Failure recorded');
  }

  getFailures(role: string): FailureRecord[] {
    return this.failures.get(role) ?? [];
  }

  /**
   * Store a key-value memory entry for a role.
   * Persisted to DB via agent_memory table (#245).
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

    // Persist to DB
    if (this.store) {
      try {
        const db = this.store.getDatabase();
        db.prepare(
          `INSERT OR REPLACE INTO agent_memory (role, key, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
        ).run(role, key, value, existing?.created_at ?? now, now);
      } catch (err) {
        logger.warn({ err }, '[ExecutionContext] Failed to persist memory');
      }
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
    const deleted = this.memory.get(role)?.delete(key) ?? false;
    if (deleted && this.store) {
      try {
        const db = this.store.getDatabase();
        db.prepare('DELETE FROM agent_memory WHERE role = ? AND key = ?').run(role, key);
      } catch (err) {
        logger.warn({ err }, '[ExecutionContext] Failed to delete memory from DB');
      }
    }
    return deleted;
  }

  clearMemory(role: string): void {
    this.memory.delete(role);
    if (this.store) {
      try {
        const db = this.store.getDatabase();
        db.prepare('DELETE FROM agent_memory WHERE role = ?').run(role);
      } catch (err) {
        logger.warn({ err }, '[ExecutionContext] Failed to clear memory in DB');
      }
    }
  }
}
