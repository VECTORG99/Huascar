import type { Migration } from '../Migrations.js';

export const createExecutions: Migration = {
  id: '001_create_executions',
  description: 'Create executions table',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS executions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL,
        task TEXT NOT NULL,
        response TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_executions_created_at ON executions(created_at DESC)');
  },
};
