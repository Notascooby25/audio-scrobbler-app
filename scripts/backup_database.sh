#!/usr/bin/env bash
set -euo pipefail

compose_file=${COMPOSE_FILE:-docker-compose.prod.yml}
env_file=${ENV_FILE:-.env.production}
backup_dir=${BACKUP_DIR:-backups}
retention_days=${BACKUP_RETENTION_DAYS:-14}

set -a
# shellcheck disable=SC1090
. "$env_file"
set +a

mkdir -p "$backup_dir"
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_file="$backup_dir/scrobbler-$timestamp.dump"

docker compose -f "$compose_file" --env-file "$env_file" exec -T db \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$backup_file"

find "$backup_dir" -type f -name 'scrobbler-*.dump' -mtime "+$retention_days" -delete
printf '%s\n' "$backup_file"