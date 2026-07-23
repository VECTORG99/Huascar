import type Database from 'better-sqlite3';
import type { Migration } from '../Migrations.js';

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).some(row => row.name === column);
}

export const addRagHashes: Migration = {
  id: '003_add_rag_hashes',
  description: 'Add RAG content hashes',
  up(db) {
    if (!hasColumn(db, 'rag_documents', 'content_hash')) {
      db.exec('ALTER TABLE rag_documents ADD COLUMN content_hash TEXT');
    }
    if (!hasColumn(db, 'rag_documents', 'chunk_hash')) {
      db.exec('ALTER TABLE rag_documents ADD COLUMN chunk_hash TEXT');
    }
    db.exec('CREATE INDEX IF NOT EXISTS idx_rag_documents_source_content_hash ON rag_documents(source, content_hash)');
  },
};
