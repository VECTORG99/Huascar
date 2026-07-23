import type { Migration } from '../Migrations.js';

export const createRagDocuments: Migration = {
  id: '002_create_rag_documents',
  description: 'Create rag_documents table',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS rag_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        chunk_text TEXT NOT NULL,
        embedding TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_rag_documents_source ON rag_documents(source)');
  },
};
