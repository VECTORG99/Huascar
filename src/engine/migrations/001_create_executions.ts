import type { Migration } from '../Migrations.js';
import type Database from 'better-sqlite3';

const migration: Migration = {
  id: '001_create_executions',
  description: 'Create executions table for agent task history',
  up: (db: Database.Database) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS executions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL,
        task TEXT NOT NULL,
        result TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_executions_role ON executions(role)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_executions_created ON executions(created_at)');
  },
  down: (db: Database.Database) => {
    db.exec('DROP TABLE IF EXISTS executions');
  },
};

export default migration;
