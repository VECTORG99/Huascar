import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export interface ExecutionRecord {
  id: number;
  role: string;
  task: string;
  response: string;
  created_at: string;
}

export class Store {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || process.env.HUASCAR_DB_PATH || path.resolve('./data/huascar.db');
    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS executions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL,
        task TEXT NOT NULL,
        response TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_executions_created_at ON executions(created_at DESC)');
  }

  saveExecution(role: string, task: string, response: string): void {
    const stmt = this.db.prepare(
      'INSERT INTO executions (role, task, response) VALUES (?, ?, ?)'
    );
    stmt.run(role, task, response);
  }

  getHistory(limit: number = 20): ExecutionRecord[] {
    const stmt = this.db.prepare(
      'SELECT * FROM executions ORDER BY created_at DESC LIMIT ?'
    );
    return stmt.all(limit) as ExecutionRecord[];
  }

  close(): void {
    this.db.close();
  }
}
