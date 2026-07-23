import type { Migration } from '../Migrations.js';

export const createAgents: Migration = {
  id: '005_create_agents',
  description: 'Create persistent agent registry',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        config TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_executed_at INTEGER,
        execution_count INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_agents_name ON agents(name);
    `);
  },
};
