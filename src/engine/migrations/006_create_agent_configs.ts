import type { Migration } from '../Migrations.js';

export const createAgentConfigs: Migration = {
  id: '006_create_agent_configs',
  description: 'Create agent config versioning table',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS agent_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        config_json TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(name, version)
      );

      CREATE INDEX IF NOT EXISTS idx_agent_configs_name ON agent_configs(name);
      CREATE INDEX IF NOT EXISTS idx_agent_configs_active ON agent_configs(name, active);
    `);
  },
};
