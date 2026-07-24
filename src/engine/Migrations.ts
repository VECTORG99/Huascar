import crypto from 'crypto';
import type Database from 'better-sqlite3';
import { ErrorCodes, StoreError } from '../errors.js';

export interface Migration {
  id: string;
  description: string;
  up: (db: Database.Database) => void;
  down?: (db: Database.Database) => void;
}

export class MigrationRunner {
  constructor(
    private readonly db: Database.Database,
    private readonly migrations: Migration[],
  ) {}

  run(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        checksum TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    for (const migration of this.migrations) {
      const checksum = this.checksum(migration);
      const applied = this.db.prepare('SELECT checksum FROM _migrations WHERE id = ?').get(migration.id) as
        { checksum: string } | undefined;
      if (applied) {
        if (applied.checksum !== checksum) {
          throw new StoreError(ErrorCodes.STORE_MIGRATION_FAILED, `Migration checksum mismatch: ${migration.id}`, 500);
        }
        continue;
      }
      const tx = this.db.transaction(() => {
        migration.up(this.db);
        this.db
          .prepare('INSERT INTO _migrations (id, description, checksum) VALUES (?, ?, ?)')
          .run(migration.id, migration.description, checksum);
      });
      tx();
    }
  }

  /**
   * Rollback the last N applied migrations (default 1).
   * Returns the list of rolled-back migration IDs.
   */
  rollback(count = 1): string[] {
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, description TEXT NOT NULL, checksum TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT (datetime('now')))`,
    );
    const applied = this.db
      .prepare('SELECT id FROM _migrations ORDER BY applied_at DESC, rowid DESC LIMIT ?')
      .all(count) as { id: string }[];
    const rolledBack: string[] = [];

    for (const row of applied) {
      const migration = this.migrations.find((m) => m.id === row.id);
      if (!migration) {
        throw new StoreError(ErrorCodes.STORE_MIGRATION_FAILED, `Cannot rollback unknown migration: ${row.id}`, 500);
      }
      if (!migration.down) {
        throw new StoreError(ErrorCodes.STORE_MIGRATION_FAILED, `Migration ${row.id} has no down() function`, 500);
      }
      const tx = this.db.transaction(() => {
        migration.down!(this.db);
        this.db.prepare('DELETE FROM _migrations WHERE id = ?').run(row.id);
      });
      tx();
      rolledBack.push(row.id);
    }

    return rolledBack;
  }

  getStatus(): { id: string; description: string; applied: boolean }[] {
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, description TEXT NOT NULL, checksum TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT (datetime('now')))`,
    );
    const applied = new Set(
      (this.db.prepare('SELECT id FROM _migrations').all() as { id: string }[]).map((row) => row.id),
    );
    return this.migrations.map((migration) => ({
      id: migration.id,
      description: migration.description,
      applied: applied.has(migration.id),
    }));
  }

  private checksum(migration: Migration): string {
    return crypto
      .createHash('sha256')
      .update(`${migration.id}:${migration.description}:${migration.up.toString()}`)
      .digest('hex');
  }
}
