import type { Migration } from '../Migrations.js';
import type Database from 'better-sqlite3';

const migration: Migration = {
  id: '002_create_rag_documents',
  description: 'Create RAG chunks table for vector embeddings',
  up: (db: Database.Database) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS rag_chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        chunk_text TEXT NOT NULL,
        embedding BLOB,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_chunks_source ON rag_chunks(source)');
  },
  down: (db: Database.Database) => {
    db.exec('DROP TABLE IF EXISTS rag_chunks');
  },
};

export default migration;
