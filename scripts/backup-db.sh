#!/bin/bash
# SQLite backup script — creates timestamped copy of the database
# Usage: ./scripts/backup-db.sh [db_path] [backup_dir]
# Defaults: ./data/huascar.db → ./backups/

set -euo pipefail

DB_PATH="${1:-${HUASCAR_DB_PATH:-./data/huascar.db}}"
BACKUP_DIR="${2:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/huascar_${TIMESTAMP}.db"

if [ ! -f "$DB_PATH" ]; then
  echo "[backup] Database not found at $DB_PATH — skipping"
  exit 0
fi

mkdir -p "$BACKUP_DIR"

# Use SQLite's .backup command for consistency (handles WAL mode)
sqlite3 "$DB_PATH" ".backup '${BACKUP_FILE}'"

# Keep only last 7 backups (rotate)
ls -t "${BACKUP_DIR}"/huascar_*.db 2>/dev/null | tail -n +8 | xargs -r rm -f

echo "[backup] Created: ${BACKUP_FILE} ($(du -h "$BACKUP_FILE" | cut -f1))"
