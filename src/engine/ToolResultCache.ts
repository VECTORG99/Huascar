/**
 * LRU cache for tool call results within a single execution.
 * Avoids re-executing the same tool with the same arguments.
 */
import crypto from 'crypto';
import { logger } from '../logger.js';

interface CacheEntry {
  result: string;
  cachedAt: number;
}

export class ToolResultCache {
  private cache = new Map<string, CacheEntry>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;

  constructor(maxEntries = 50, ttlMs = 60_000) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
  }

  private key(toolName: string, args: unknown): string {
    const serialized = JSON.stringify({ tool: toolName, args });
    return crypto.createHash('sha256').update(serialized).digest('hex').slice(0, 16);
  }

  get(toolName: string, args: unknown): string | null {
    const k = this.key(toolName, args);
    const entry = this.cache.get(k);
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > this.ttlMs) {
      this.cache.delete(k);
      return null;
    }
    logger.debug({ tool: toolName }, '[ToolResultCache] Cache hit');
    return entry.result;
  }

  set(toolName: string, args: unknown, result: string): void {
    const k = this.key(toolName, args);
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxEntries) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(k, { result, cachedAt: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  get stats() {
    return {
      entries: this.cache.size,
      maxEntries: this.maxEntries,
      ttlMs: this.ttlMs,
    };
  }
}
