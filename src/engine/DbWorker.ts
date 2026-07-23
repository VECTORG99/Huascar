/**
 * Worker thread for executing heavy SQLite queries off the main thread.
 * Receives SQL + params via parentPort messages, executes in a read-only DB, returns results.
 */
import { parentPort, workerData } from 'worker_threads';
import Database from 'better-sqlite3';

if (!parentPort) throw new Error('DbWorker must run as a worker thread');

const db = new Database(workerData.dbPath, { readonly: true });
db.pragma('journal_mode = WAL');

interface WorkerRequest {
  id: string;
  sql: string;
  params: unknown[];
  method: 'all' | 'get';
}

parentPort.on('message', (msg: WorkerRequest) => {
  try {
    const stmt = db.prepare(msg.sql);
    const result = msg.method === 'get' ? stmt.get(...msg.params) : stmt.all(...msg.params);
    parentPort!.postMessage({ id: msg.id, result, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    parentPort!.postMessage({ id: msg.id, result: null, error: message });
  }
});

parentPort.on('close', () => {
  db.close();
});
