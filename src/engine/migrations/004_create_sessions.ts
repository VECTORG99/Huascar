import type { Migration } from '../Migrations.js';

export const createSessions: Migration = {
  id: '004_create_sessions',
  description: 'Create agent sessions and message history',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        role TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        last_active_at INTEGER NOT NULL,
        metadata TEXT
      );

      CREATE TABLE IF NOT EXISTS session_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_session_messages_session_created_at
        ON session_messages(session_id, created_at);
    `);
  },
};
