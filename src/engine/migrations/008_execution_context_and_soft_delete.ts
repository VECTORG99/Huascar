import type { Migration } from '../Migrations.js';

export const executionContextAndSoftDelete: Migration = {
  id: '008_execution_context_and_soft_delete',
  description: 'Persist ExecutionContext failures to DB; add soft-delete for RAG sources',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS execution_failures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL,
        tool TEXT NOT NULL,
        args TEXT NOT NULL,
        error_type TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_execution_failures_role ON execution_failures(role);

      CREATE TABLE IF NOT EXISTS commit_approvals (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'pending',
        diff_context TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        resolved_at TEXT
      );
    `);

    // ALTER TABLE cannot use IF NOT EXISTS; check column existence first
    const cols = db.pragma('table_info(rag_documents)') as { name: string }[];
    if (!cols.some((c) => c.name === 'deleted_at')) {
      db.exec(`ALTER TABLE rag_documents ADD COLUMN deleted_at TEXT DEFAULT NULL`);
    }

    db.exec(`CREATE INDEX IF NOT EXISTS idx_rag_documents_deleted ON rag_documents(deleted_at);`);
  },
  down(db) {
    db.exec(`
      DROP TABLE IF EXISTS execution_failures;
      DROP TABLE IF EXISTS commit_approvals;
      -- SQLite does not support DROP COLUMN directly in older versions;
      -- recreate the table without deleted_at would be needed for a full rollback.
      -- For safety we leave the column in place during rollback.
    `);
  },
};
