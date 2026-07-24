import fs from 'fs';
import { config } from '../config.js';
import { logger } from '../logger.js';

/**
 * Singleton cache for agent config files (steering.json, rag.json).
 * Reads once at first access and caches in memory. Avoids readFileSync per request.
 * Call invalidate() to force reload (e.g., after external config change).
 *
 * If stat() fails, returns the cached version instead of reloading (#280).
 */
export class ConfigCache {
  private static instance: ConfigCache | null = null;

  private steeringCache: unknown = null;
  private ragCache: unknown = null;
  private steeringMtime = 0;
  private ragMtime = 0;

  static getInstance(): ConfigCache {
    if (!ConfigCache.instance) {
      ConfigCache.instance = new ConfigCache();
    }
    return ConfigCache.instance;
  }

  /** Read and cache steering.json. Returns parsed JSON.
   * When a custom readFile is provided, the cache is bypassed to support DI in tests. */
  getSteering(readFile?: (path: string, encoding: BufferEncoding) => string): unknown {
    // If a custom readFile is injected, bypass cache (DI / test mode)
    if (readFile) {
      const raw = readFile(config.paths.steering, config.rag.encoding);
      return JSON.parse(raw);
    }
    if (this.steeringCache) {
      const mtime = this.getMtime(config.paths.steering);
      // If stat fails (mtime === 0), use cached version instead of reloading (#280)
      if (mtime === 0 || mtime === this.steeringMtime) return this.steeringCache;
    }
    const raw = fs.readFileSync(config.paths.steering, config.rag.encoding);
    this.steeringCache = JSON.parse(raw);
    this.steeringMtime = this.getMtime(config.paths.steering);
    logger.info('[ConfigCache] steering.json loaded');
    return this.steeringCache;
  }

  /** Read and cache rag.json. Returns parsed JSON or null if file missing.
   * When a custom readFile is provided, the cache is bypassed to support DI in tests. */
  getRag(
    readFile?: (path: string, encoding: BufferEncoding) => string,
    exists?: (path: string) => boolean,
  ): unknown | null {
    const fileExists = exists ?? fs.existsSync;
    if (!fileExists(config.paths.rag)) return null;

    // If a custom readFile is injected, bypass cache (DI / test mode)
    if (readFile) {
      const raw = readFile(config.paths.rag, config.rag.encoding);
      return JSON.parse(raw);
    }

    if (this.ragCache) {
      const mtime = this.getMtime(config.paths.rag);
      // If stat fails (mtime === 0), use cached version instead of reloading (#280)
      if (mtime === 0 || mtime === this.ragMtime) return this.ragCache;
    }
    const raw = fs.readFileSync(config.paths.rag, config.rag.encoding);
    this.ragCache = JSON.parse(raw);
    this.ragMtime = this.getMtime(config.paths.rag);
    logger.info('[ConfigCache] rag.json loaded');
    return this.ragCache;
  }

  /** Force reload on next access. */
  invalidate(): void {
    this.steeringCache = null;
    this.ragCache = null;
    this.steeringMtime = 0;
    this.ragMtime = 0;
  }

  /** Reset singleton (for tests). */
  static reset(): void {
    ConfigCache.instance = null;
  }

  private getMtime(filePath: string): number {
    try {
      return fs.statSync(filePath).mtimeMs;
    } catch {
      return 0;
    }
  }
}
