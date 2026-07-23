import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '../config.js';
import { MigrationRunner } from './Migrations.js';
import migration001 from './migrations/001_create_executions.js';
import migration002 from './migrations/002_create_rag_documents.js';

export interface ExecutionRecord {
  id: number;
  role: string;
  task: string;
  response: string;
  created_at: string;
}

export interface DocumentChunk {
  id: number;
  source: string;
  chunk_index: number;
  chunk_text: string;
  embedding: number[] | null;
  created_at: string;
}

export class Store {
  private db: Database.Database;
  private dbPath: string;
  private _closed = false;

  constructor(dbPath?: string, runner?: MigrationRunner) {
    this.dbPath = dbPath || config.paths.db;
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    if (runner) {
      runner.init(this.db);
      runner.run();
    } else {
      const d = new MigrationRunner(this.db);
      d.register(migration001);
      d.register(migration002);
      d.run();
    }
  }

  // --- Execution history ---

  saveExecution(role: string, task: string, response: string): void {
    const stmt = this.db.prepare('INSERT INTO executions (role, task, response) VALUES (?, ?, ?)');
    stmt.run(role, task, response);
  }

  getHistory(limit: number = config.store.historyLimit): ExecutionRecord[] {
    const stmt = this.db.prepare('SELECT * FROM executions ORDER BY created_at DESC LIMIT ?');
    return stmt.all(limit) as ExecutionRecord[];
  }

  // --- Vector RAG ---

  saveChunk(chunk: { source: string; chunkIndex: number; chunkText: string; embedding?: number[] }): void {
    const embeddingJson = chunk.embedding ? JSON.stringify(chunk.embedding) : null;
    const stmt = this.db.prepare(
      'INSERT INTO rag_documents (source, chunk_index, chunk_text, embedding) VALUES (?, ?, ?, ?)',
    );
    stmt.run(chunk.source, chunk.chunkIndex, chunk.chunkText, embeddingJson);
  }

  deleteChunksBySource(source: string): void {
    const stmt = this.db.prepare('DELETE FROM rag_documents WHERE source = ?');
    stmt.run(source);
  }

  getAllChunks(): DocumentChunk[] {
    const rows = this.db.prepare('SELECT * FROM rag_documents ORDER BY source, chunk_index').all() as any[];
    return rows.map((r) => ({
      ...r,
      embedding: r.embedding ? (JSON.parse(r.embedding) as number[]) : null,
    }));
  }

  getChunksCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM rag_documents').get() as { count: number };
    return row.count;
  }

  isOpen(): boolean {
    return !this._closed;
  }

  close(): void {
    if (this._closed) return;
    this._closed = true;
    // ponytail: WAL checkpoint before close to ensure data integrity
    try {
      this.db.pragma('wal_checkpoint(TRUNCATE)');
    } catch {
      // ignore if DB already closing
    }
    this.db.close();
  }
}
