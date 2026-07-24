/**
 * Worker thread pool for offloading heavy SQLite queries from the main event loop.
 *
 * Light queries (bounded reads, single inserts) remain on the main thread.
 * Heavy queries (full table scans, vector search, aggregations) go through this pool.
 */
import { Worker } from 'worker_threads';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import path from 'path';
import { logger } from '../logger.js';
import { ErrorCodes, StoreError } from '../errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKER_PATH = path.resolve(__dirname, 'DbWorker.ts');

interface PendingQuery {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  enqueuedAt: number;
}

interface WorkerEntry {
  worker: Worker;
  busy: boolean;
}

export interface DbWorkerPoolOptions {
  dbPath: string;
  poolSize?: number;
  queryTimeoutMs?: number;
}

export class DbWorkerPool {
  private workers: WorkerEntry[] = [];
  private pending = new Map<string, PendingQuery>();
  private queue: { id: string; sql: string; params: unknown[]; method: 'all' | 'get' }[] = [];
  private closed = false;
  private readonly poolSize: number;
  private readonly queryTimeoutMs: number;
  private readonly dbPath: string;

  constructor(options: DbWorkerPoolOptions) {
    this.dbPath = options.dbPath;
    this.poolSize = options.poolSize ?? 2;
    this.queryTimeoutMs = options.queryTimeoutMs ?? 30000;
  }

  private ensureWorkers(): void {
    if (this.workers.length > 0 || this.closed) return;
    for (let i = 0; i < this.poolSize; i++) {
      this.spawnWorker();
    }
  }

  private spawnWorker(): void {
    const worker = new Worker(WORKER_PATH, {
      workerData: { dbPath: this.dbPath },
      execArgv: ['--import', 'tsx/esm'],
    });

    const entry: WorkerEntry = { worker, busy: false };

    worker.on('message', (msg: { id: string; result: unknown; error: string | null }) => {
      const pending = this.pending.get(msg.id);
      if (!pending) return;
      this.pending.delete(msg.id);
      entry.busy = false;

      if (msg.error) {
        pending.reject(new StoreError(ErrorCodes.STORE_QUERY_FAILED, msg.error, 500));
      } else {
        pending.resolve(msg.result);
      }

      this.processQueue();
    });

    worker.on('error', (err) => {
      logger.error({ err: err.message }, '[DbWorkerPool] Worker error');
      // Reject all pending queries assigned to this worker
      entry.busy = false;
      for (const [id, p] of this.pending) {
        p.reject(new StoreError(ErrorCodes.STORE_QUERY_FAILED, `Worker error: ${err.message}`, 500));
        this.pending.delete(id);
      }
      this.processQueue();
    });

    worker.on('exit', (code) => {
      const idx = this.workers.indexOf(entry);
      if (idx >= 0) this.workers.splice(idx, 1);
      if (!this.closed && code !== 0) {
        logger.warn({ code }, '[DbWorkerPool] Worker exited unexpectedly, respawning');
        this.spawnWorker();
      }
    });

    this.workers.push(entry);
  }

  private processQueue(): void {
    if (this.queue.length === 0) return;
    const free = this.workers.find((w) => !w.busy);
    if (!free) return;

    const task = this.queue.shift()!;
    free.busy = true;
    free.worker.postMessage(task);
  }

  async query<T = unknown>(sql: string, params: unknown[] = [], method: 'all' | 'get' = 'all'): Promise<T> {
    if (this.closed) throw new StoreError(ErrorCodes.STORE_QUERY_FAILED, 'Worker pool is closed', 500);
    this.ensureWorkers();

    const id = randomUUID();
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new StoreError(ErrorCodes.STORE_QUERY_FAILED, `Worker query timed out after ${this.queryTimeoutMs}ms`, 504),
        );
      }, this.queryTimeoutMs);

      this.pending.set(id, {
        resolve: (val) => {
          clearTimeout(timer);
          resolve(val as T);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
        enqueuedAt: Date.now(),
      });

      const free = this.workers.find((w) => !w.busy);
      if (free) {
        free.busy = true;
        free.worker.postMessage({ id, sql, params, method });
      } else {
        this.queue.push({ id, sql, params, method });
      }
    });
  }

  async queryAll<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.query<T[]>(sql, params, 'all');
  }

  async queryGet<T = unknown>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    return this.query<T | undefined>(sql, params, 'get');
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    for (const { worker } of this.workers) {
      await worker.terminate();
    }
    this.workers = [];
    // Reject pending
    for (const [id, p] of this.pending) {
      p.reject(new StoreError(ErrorCodes.STORE_QUERY_FAILED, 'Pool closed', 500));
      this.pending.delete(id);
    }
  }

  get stats() {
    return {
      poolSize: this.workers.length,
      busy: this.workers.filter((w) => w.busy).length,
      queueLength: this.queue.length,
      pendingQueries: this.pending.size,
    };
  }
}
