#!/usr/bin/env bash
set -euo pipefail

# Pre-migration snapshot safety script.
# Takes a timestamped dump of the PostgreSQL database before Alembic runs migrations.
# Fails open (logs warning and continues) if pg_dump is not installed, if database is non-Postgres,
# or if pg_dump fails, ensuring container startup is not blocked.

if [[ "${PRE_MIGRATION_BACKUP_ENABLED:-true}" == "false" || "${PRE_MIGRATION_BACKUP_ENABLED:-true}" == "0" ]]; then
    echo "Pre-migration backup is disabled via PRE_MIGRATION_BACKUP_ENABLED."
    exit 0
fi

db_url="${DATABASE_URL:-}"
if [[ -z "$db_url" ]]; then
    echo "DATABASE_URL is not set; skipping pre-migration backup."
    exit 0
fi

if [[ "$db_url" != postgresql* ]]; then
    echo "DATABASE_URL does not use PostgreSQL (${db_url%%:*}); skipping pre-migration backup."
    exit 0
fi

if ! command -v pg_dump >/dev/null 2>&1; then
    echo "WARNING: pg_dump utility not found. Proceeding with migration without pre-migration snapshot."
    exit 0
fi

# Convert SQLAlchemy dialect URLs (postgresql+psycopg:// or postgresql+asyncpg://) to standard libpq connection URI
pg_conn_url="${db_url/postgresql+psycopg:\/\//postgresql:\/\/}"
pg_conn_url="${pg_conn_url/postgresql+asyncpg:\/\//postgresql:\/\/}"

backup_dir="${PRE_MIGRATION_BACKUP_DIR:-/tmp/pre_migration_backups}"
mkdir -p "$backup_dir"

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
snapshot_file="$backup_dir/pre_migration_${timestamp}.dump"

echo "Attempting pre-migration database snapshot to $snapshot_file..."
if pg_dump "$pg_conn_url" -Fc -f "$snapshot_file"; then
    size_bytes=$(wc -c < "$snapshot_file" | tr -d ' ')
    echo "Pre-migration snapshot successfully created at $snapshot_file ($size_bytes bytes)."

    # Retain the 5 most recent snapshots to prevent unbounded disk usage
    mapfile -t old_dumps < <(find "$backup_dir" -maxdepth 1 -type f -name 'pre_migration_*.dump' | sort -r | tail -n +6)
    for old in "${old_dumps[@]}"; do
        if [[ -f "$old" ]]; then
            rm -f "$old"
        fi
    done
else
    echo "WARNING: Pre-migration pg_dump command failed (exit code $?). Proceeding with migration."
fi

exit 0
