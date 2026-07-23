import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '../config.js';
import { ErrorCodes, StoreError } from '../errors.js';
import { MigrationRunner } from './Migrations.js';
import { initialMigrations } from './migrations/index.js';

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
  content_hash: string | null;
  chunk_hash: string | null;
  created_at: string;
}

export interface RagSourceSummary {
  source: string;
  chunk_count: number;
  content_hash: string | null;
  chunk_hashes: string[];
}

export class Store {
  private db: Database.Database;
  private dbPath: string;
  private closed = false;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || config.paths.db;
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    try {
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');
      new MigrationRunner(this.db, initialMigrations).run();
    } catch (err) {
      throw new StoreError(ErrorCodes.STORE_QUERY_FAILED, 'Failed to initialize SQLite store', 500, { cause: err });
    }
  }

  // --- Execution history ---

  saveExecution(role: string, task: string, response: string): void {
    const stmt = this.db.prepare(
      'INSERT INTO executions (role, task, response) VALUES (?, ?, ?)'
    );
    stmt.run(role, task, response);
  }

  getHistory(limit: number = config.store.historyLimit): ExecutionRecord[] {
    const stmt = this.db.prepare(
      'SELECT * FROM executions ORDER BY created_at DESC LIMIT ?'
    );
    return stmt.all(limit) as ExecutionRecord[];
  }

  // --- Vector RAG ---

  saveChunk(chunk: { source: string; chunkIndex: number; chunkText: string; embedding?: number[]; contentHash?: string; chunkHash?: string }): void {
    const embeddingJson = chunk.embedding ? JSON.stringify(chunk.embedding) : null;
    const stmt = this.db.prepare(
      'INSERT INTO rag_documents (source, chunk_index, chunk_text, embedding, content_hash, chunk_hash) VALUES (?, ?, ?, ?, ?, ?)'
    );
    stmt.run(chunk.source, chunk.chunkIndex, chunk.chunkText, embeddingJson, chunk.contentHash ?? null, chunk.chunkHash ?? null);
  }

  getContentHashBySource(source: string): string | null {
    const row = this.db.prepare('SELECT content_hash FROM rag_documents WHERE source = ? AND content_hash IS NOT NULL LIMIT 1').get(source) as { content_hash: string } | undefined;
    return row?.content_hash ?? null;
  }

  deleteChunksBySource(source: string): void {
    const stmt = this.db.prepare('DELETE FROM rag_documents WHERE source = ?');
    stmt.run(source);
  }

  getRagSources(): RagSourceSummary[] {
    const rows = this.db.prepare(`
      SELECT source, COUNT(*) as chunk_count, MAX(content_hash) as content_hash, GROUP_CONCAT(chunk_hash) as chunk_hashes
      FROM rag_documents
      GROUP BY source
      ORDER BY source
    `).all() as { source: string; chunk_count: number; content_hash: string | null; chunk_hashes: string | null }[];
    return rows.map(r => ({
      ...r,
      chunk_hashes: r.chunk_hashes ? r.chunk_hashes.split(',').filter(Boolean) : [],
    }));
  }

  getAllChunks(): DocumentChunk[] {
    const rows = this.db.prepare('SELECT * FROM rag_documents ORDER BY source, chunk_index').all() as any[];
    return rows.map(r => ({
      ...r,
      embedding: r.embedding ? JSON.parse(r.embedding) as number[] : null,
    }));
  }

  getChunksCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM rag_documents').get() as { count: number };
    return row.count;
  }

  isOpen(): boolean {
    return !this.closed;
  }

  close(): void {
    if (this.closed) return;
    this.db.pragma('wal_checkpoint(TRUNCATE)');
    this.db.close();
    this.closed = true;
  }
}
