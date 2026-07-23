import Database from 'better-sqlite3';

export interface Migration {
  id: string;
  description: string;
  up: (db: Database.Database) => void;
  down: (db: Database.Database) => void;
}

export class MigrationRunner {
  private db: Database.Database;
  private migrations: Migration[] = [];

  constructor(db: Database.Database) {
    this.db = db;
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }

  register(migration: Migration): void {
    this.migrations.push(migration);
  }

  getApplied(): string[] {
    return this.db.prepare('SELECT id FROM _migrations ORDER BY applied_at').all().map((r: any) => r.id);
  }

  getPending(): Migration[] {
    const applied = new Set(this.getApplied());
    return this.migrations.filter(m => !applied.has(m.id));
  }

  runAll(): { applied: string[]; skipped: string[] } {
    const applied: string[] = [];
    const skipped: string[] = [];
    const appliedSet = new Set(this.getApplied());

    for (const migration of this.migrations) {
      if (appliedSet.has(migration.id)) {
        skipped.push(migration.id);
        continue;
      }
      const tx = this.db.transaction(() => {
        migration.up(this.db);
        this.db.prepare('INSERT INTO _migrations (id, description) VALUES (?, ?)').run(migration.id, migration.description);
      });
      tx();
      applied.push(migration.id);
      console.log(`[Migration] Applied: ${migration.id} — ${migration.description}`);
    }

    return { applied, skipped };
  }

  rollback(migrationId: string): void {
    const migration = this.migrations.find(m => m.id === migrationId);
    if (!migration) throw new Error(`Migration ${migrationId} not found`);
    const tx = this.db.transaction(() => {
      migration.down(this.db);
      this.db.prepare('DELETE FROM _migrations WHERE id = ?').run(migrationId);
    });
    tx();
    console.log(`[Migration] Rolled back: ${migrationId}`);
  }
}
