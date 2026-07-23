import Database from 'better-sqlite3';
import path from 'path';

export interface AuditEntry {
  timestamp: string;
  request_id: string;
  role: string;
  tool: string;
  args_hash: string;
  decision: 'allow' | 'deny';
  rule_id: string | null;
  reason: string | null;
}

export class AuditLog {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const resolvedPath = dbPath || process.env.HUASCAR_DB_PATH || './data/huascar.db';
    this.db = new Database(resolvedPath);
    this.db.pragma('journal_mode = WAL');
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS security_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        request_id TEXT NOT NULL,
        role TEXT NOT NULL,
        tool TEXT NOT NULL,
        args_hash TEXT NOT NULL,
        decision TEXT NOT NULL CHECK(decision IN ('allow', 'deny')),
        rule_id TEXT,
        reason TEXT
      )
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON security_audit(timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_role ON security_audit(role);
      CREATE INDEX IF NOT EXISTS idx_audit_decision ON security_audit(decision);
    `);
  }

  log(entry: Omit<AuditEntry, 'timestamp'>): void {
    const stmt = this.db.prepare(`
      INSERT INTO security_audit (request_id, role, tool, args_hash, decision, rule_id, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(entry.request_id, entry.role, entry.tool, entry.args_hash, entry.decision, entry.rule_id, entry.reason);
  }

  query(filters: { role?: string; decision?: string; since?: string; limit?: number }): AuditEntry[] {
    let sql = 'SELECT timestamp, request_id, role, tool, args_hash, decision, rule_id, reason FROM security_audit WHERE 1=1';
    const params: unknown[] = [];
    if (filters.role) { sql += ' AND role = ?'; params.push(filters.role); }
    if (filters.decision) { sql += ' AND decision = ?'; params.push(filters.decision); }
    if (filters.since) { sql += ' AND timestamp >= ?'; params.push(filters.since); }
    sql += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(filters.limit || 100);
    return this.db.prepare(sql).all(...params) as AuditEntry[];
  }

  close(): void {
    this.db.close();
  }
}
