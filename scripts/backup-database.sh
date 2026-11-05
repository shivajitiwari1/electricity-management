#!/usr/bin/env bash
# =============================================================================
# Oasis Venetia Heights — Daily MySQL Database Backup Script
# Run this EVERY DAY before starting any development work.
#
# Usage:
#   ./backup-database.sh
#
# Requirements:
#   - mysqldump client installed
#   - DATABASE_URL environment variable set (or edit credentials below)
# =============================================================================

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
BACKUP_DIR="E:/Demo Website/Electricity Bill/backups"
DATE_STAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="${BACKUP_DIR}/db-backup-${DATE_STAMP}.sql"
RETENTION_DAYS=30   # Keep backups for 30 days

# Read DATABASE_URL from .env if available
ENV_FILE="E:/Demo Website/Electricity Bill/electricity-management/.env"
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS:-}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-electricity_management}"

# If DATABASE_URL is set, parse it
if [ -n "${DATABASE_URL:-}" ]; then
  # Parse: mysql://user:pass@host:port/dbname
  DB_USER=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
  DB_PASS=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
  DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
  DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
  DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
fi

# ── Pre-flight checks ─────────────────────────────────────────────────────────
echo "============================================================"
echo "  Oasis Venetia Heights — Daily Database Backup"
echo "  Date: $(date)"
echo "  Database: ${DB_NAME}@${DB_HOST}:${DB_PORT}"
echo "============================================================"

# Check mysqldump is available
if ! command -v mysqldump &> /dev/null; then
  echo "ERROR: mysqldump not found. Install MySQL client tools."
  exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

# ── Perform backup ────────────────────────────────────────────────────────────
echo ""
echo "[1/3] Creating database backup..."

if [ -n "$DB_PASS" ]; then
  MYSQL_PWD="$DB_PASS" mysqldump \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --user="$DB_USER" \
    --single-transaction \
    --routines \
    --triggers \
    --events \
    --opt \
    "$DB_NAME" > "$BACKUP_FILE"
else
  mysqldump \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --user="$DB_USER" \
    --single-transaction \
    --routines \
    --triggers \
    --events \
    --opt \
    "$DB_NAME" > "$BACKUP_FILE"
fi

# Verify backup was created
if [ ! -s "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file is empty or was not created!"
  exit 1
fi

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "   Backup saved: $BACKUP_FILE ($BACKUP_SIZE)"

# ── Cleanup old backups ───────────────────────────────────────────────────────
echo ""
echo "[2/3] Cleaning up backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "db-backup-*.sql" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
echo "   Done."

# ── Verify backup integrity ───────────────────────────────────────────────────
echo ""
echo "[3/3] Verifying backup integrity..."
if head -c 100 "$BACKUP_FILE" | grep -qi "MySQL dump"; then
  echo "   Backup integrity: OK"
else
  echo "   WARNING: Backup file may be corrupted!"
fi

echo ""
echo "============================================================"
echo "  Backup complete: $BACKUP_FILE"
echo "============================================================"
