import crypto from 'crypto';
import Database from 'better-sqlite3';

export interface Migration {
  id: string;
  description: string;
  up: (db: Database.Database) => void;
}

export class MigrationRunner {
  private db?: Database.Database;
  private migrations: Migration[] = [];

  constructor(db?: Database.Database) {
    if (db) {
      this.db = db;
      this.ensureMetadataTable();
    }
  }

  init(db: Database.Database): void {
    this.db = db;
    this.ensureMetadataTable();
  }

  register(migration: Migration): void {
    this.migrations.push(migration);
  }

  run(): void {
    if (!this.db) throw new Error('MigrationRunner: no database connection');
    this.migrations.sort((a, b) => a.id.localeCompare(b.id));
    const applied = this.getAppliedRecords();
    for (const m of this.migrations) {
      const existing = applied.find((a) => a.id === m.id);
      const chk = this.computeChecksum(m);
      if (existing) {
        if (existing.checksum !== chk) throw new Error('Migration "' + m.id + '" checksum mismatch');
        continue;
      }
      const tn = this.tableForMigration(m.id);
      if (tn && this.tableExists(tn)) {
        this.recordApplied(m, chk);
        continue;
      }
      this.applyMigration(m, chk);
    }
  }

  getStatus(): { id: string; description: string; appliedAt: string | null }[] {
    if (!this.db) return this.migrations.map((m) => ({ id: m.id, description: m.description, appliedAt: null }));
    const a = this.getAppliedRecords();
    return this.migrations.map((m) => {
      const x = a.find((r) => r.id === m.id);
      return { id: m.id, description: m.description, appliedAt: x ? x.applied_at : null };
    });
  }

  private ensureMetadataTable(): void {
    if (!this.db) return;
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, description TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT (datetime('now')), checksum TEXT NOT NULL)",
    );
  }

  private getAppliedRecords(): any[] {
    if (!this.db) return [];
    try {
      return this.db.prepare('SELECT * FROM _migrations ORDER BY id').all();
    } catch {
      return [];
    }
  }

  private tableExists(name: string): boolean {
    if (!this.db) return false;
    return !!this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(name);
  }

  private tableForMigration(id: string): string | null {
    const map: Record<string, string> = { '001': 'executions', '002': 'rag_documents' };
    return map[id] ?? null;
  }

  private applyMigration(m: Migration, chk: string): void {
    if (!this.db) return;
    this.db.exec('BEGIN');
    try {
      m.up(this.db);
      this.recordApplied(m, chk);
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  private recordApplied(m: Migration, chk: string): void {
    if (!this.db) return;
    this.db
      .prepare('INSERT INTO _migrations (id, description, checksum) VALUES (?, ?, ?)')
      .run(m.id, m.description, chk);
  }

  private computeChecksum(m: Migration): string {
    return crypto.createHash('sha256').update(m.up.toString()).digest('hex').slice(0, 16);
  }
}
