import type { Migration } from '../Migrations.js';

export const createMemoryStore: Migration = {
  id: '007_create_memory_store',
  description: 'Create per-role memory store for execution context',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS agent_memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(role, key)
      );

      CREATE INDEX IF NOT EXISTS idx_agent_memory_role ON agent_memory(role);
    `);
  },
};
