#!/usr/bin/env bash
set -euo pipefail

backup_dir=${BACKUP_DIR:-backups}
retention_days=${BACKUP_RETENTION_DAYS:-3}
gdrive_retention_days=${GDRIVE_RETENTION_DAYS:-14}
gdrive_remote=${GDRIVE_REMOTE_NAME:-gdrive}

if [[ -n "${ENV_FILE:-}" ]]; then
  env_file="$ENV_FILE"
elif [[ -f .env.production ]]; then
  env_file=".env.production"
elif [[ -f .env ]]; then
  env_file=".env"
else
  env_file=""
fi

if [[ -n "${COMPOSE_FILE:-}" ]]; then
  compose_file="$COMPOSE_FILE"
elif [[ "$env_file" == ".env.production" && -f docker-compose.prod.yml ]]; then
  compose_file="docker-compose.prod.yml"
else
  compose_file="docker-compose.yml"
fi

compose_args=(-f "$compose_file")
if [[ -n "$env_file" && -f "$env_file" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "$env_file"
  set +a
  compose_args+=(--env-file "$env_file")
fi

POSTGRES_USER=${POSTGRES_USER:-scrobbler}
POSTGRES_DB=${POSTGRES_DB:-scrobbler}

mkdir -p "$backup_dir"
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_file="$backup_dir/scrobbler-$timestamp.dump"

docker compose "${compose_args[@]}" exec -T db \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -Z 5 > "$backup_file"

find "$backup_dir" -type f -name 'scrobbler-*.dump' -mtime "+$retention_days" -delete

if command -v rclone &> /dev/null; then
  echo "Uploading backup to Google Drive..."
  rclone copy "$backup_file" "${gdrive_remote}:AudioScrobblerBackups/"
  
  echo "Cleaning up backups older than $gdrive_retention_days days on Google Drive..."
  rclone delete "${gdrive_remote}:AudioScrobblerBackups/" --min-age "${gdrive_retention_days}d" || true
else
  echo "Note: 'rclone' is not installed or in PATH."
  echo "To enable Google Drive backups, install rclone and configure a remote named '${gdrive_remote}'."
fi

printf '%s\n' "$backup_file"