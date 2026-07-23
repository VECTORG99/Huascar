/**
 * Config versioning and rollback store.
 * Each config save creates a new version; only one version is active per name.
 */
import type Database from 'better-sqlite3';
import { logger } from '../logger.js';

export interface ConfigVersion {
  id: number;
  name: string;
  version: number;
  config_json: string;
  active: number;
  created_at: string;
}

export interface ConfigDiff {
  added: string[];
  removed: string[];
  changed: string[];
}

export class ConfigStore {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Save a new config version. Automatically increments version number.
   */
  save(name: string, configJson: unknown): ConfigVersion {
    const json = typeof configJson === 'string' ? configJson : JSON.stringify(configJson);
    const maxVersion = this.db
      .prepare('SELECT COALESCE(MAX(version), 0) as v FROM agent_configs WHERE name = ?')
      .get(name) as { v: number };
    const nextVersion = maxVersion.v + 1;
    const isFirst = nextVersion === 1;

    this.db
      .prepare('INSERT INTO agent_configs (name, version, config_json, active) VALUES (?, ?, ?, ?)')
      .run(name, nextVersion, json, isFirst ? 1 : 0);

    // If first, auto-activate
    if (isFirst) {
      logger.info({ name, version: nextVersion }, '[ConfigStore] First version auto-activated');
    }

    return this.getVersion(name, nextVersion)!;
  }

  /**
   * List all config names with their active versions.
   */
  list(): { name: string; activeVersion: number; totalVersions: number }[] {
    const rows = this.db
      .prepare(
        `
      SELECT name,
             MAX(CASE WHEN active = 1 THEN version ELSE 0 END) as activeVersion,
             COUNT(*) as totalVersions
      FROM agent_configs
      GROUP BY name
      ORDER BY name
    `,
      )
      .all() as { name: string; activeVersion: number; totalVersions: number }[];
    return rows;
  }

  /**
   * Get all versions of a config.
   */
  getVersions(name: string): ConfigVersion[] {
    return this.db
      .prepare('SELECT * FROM agent_configs WHERE name = ? ORDER BY version DESC')
      .all(name) as ConfigVersion[];
  }

  /**
   * Get a specific version.
   */
  getVersion(name: string, version: number): ConfigVersion | null {
    return (
      (this.db.prepare('SELECT * FROM agent_configs WHERE name = ? AND version = ?').get(name, version) as
        ConfigVersion | undefined) ?? null
    );
  }

  /**
   * Get the currently active version.
   */
  getActive(name: string): ConfigVersion | null {
    return (
      (this.db.prepare('SELECT * FROM agent_configs WHERE name = ? AND active = 1').get(name) as
        ConfigVersion | undefined) ?? null
    );
  }

  /**
   * Activate a specific version (rollback or forward).
   */
  activate(name: string, version: number): ConfigVersion | null {
    const target = this.getVersion(name, version);
    if (!target) return null;

    this.db.transaction(() => {
      this.db.prepare('UPDATE agent_configs SET active = 0 WHERE name = ?').run(name);
      this.db.prepare('UPDATE agent_configs SET active = 1 WHERE name = ? AND version = ?').run(name, version);
    })();

    logger.info({ name, version }, '[ConfigStore] Version activated');
    return this.getVersion(name, version);
  }

  /**
   * Compute diff between two versions.
   */
  diff(name: string, v1: number, v2: number): ConfigDiff | null {
    const ver1 = this.getVersion(name, v1);
    const ver2 = this.getVersion(name, v2);
    if (!ver1 || !ver2) return null;

    try {
      const obj1 = JSON.parse(ver1.config_json) as Record<string, unknown>;
      const obj2 = JSON.parse(ver2.config_json) as Record<string, unknown>;
      const keys1 = new Set(Object.keys(obj1));
      const keys2 = new Set(Object.keys(obj2));

      const added = [...keys2].filter((k) => !keys1.has(k));
      const removed = [...keys1].filter((k) => !keys2.has(k));
      const changed = [...keys1]
        .filter((k) => keys2.has(k))
        .filter((k) => JSON.stringify(obj1[k]) !== JSON.stringify(obj2[k]));

      return { added, removed, changed };
    } catch {
      return { added: [], removed: [], changed: ['<parse_error>'] };
    }
  }
}
