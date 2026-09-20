#!/usr/bin/env bash
set -euo pipefail

# Values the caller supplied in the environment (systemd EnvironmentFile, or
# an inline VAR=... prefix), captured before the env file is sourced. The
# `set -a; . "$env_file"` below overwrites exported variables outright, so a
# host-specific override would otherwise silently lose to the shared env file
# — see BACKUP_DIR in scripts/systemd/audio-scrobbler-backup.env.example,
# which is documented as exactly that kind of per-host override.
env_backup_dir=${BACKUP_DIR:-}
env_metrics_dir=${BACKUP_METRICS_DIR:-}
env_retention_days=${BACKUP_RETENTION_DAYS:-}
env_gdrive_retention_days=${GDRIVE_RETENTION_DAYS:-}
env_gdrive_remote=${GDRIVE_REMOTE_NAME:-}

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

# Resolved only now, after the env file has been sourced. Reading these before
# that point made every backup setting in .env.production a no-op: dumps went
# to the plaintext `gdrive` remote while GDRIVE_REMOTE_NAME=gdrive-crypt sat
# there being ignored, and offsite pruning used 14 days rather than the
# configured 30. Precedence is caller environment > env file > default.
backup_dir=${env_backup_dir:-${BACKUP_DIR:-backups}}
metrics_dir=${env_metrics_dir:-${BACKUP_METRICS_DIR:-monitoring}}
retention_days=${env_retention_days:-${BACKUP_RETENTION_DAYS:-3}}
gdrive_retention_days=${env_gdrive_retention_days:-${GDRIVE_RETENTION_DAYS:-14}}
gdrive_remote=${env_gdrive_remote:-${GDRIVE_REMOTE_NAME:-gdrive}}

mkdir -p "$backup_dir"
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_file="$backup_dir/scrobbler-$timestamp.dump"

docker compose "${compose_args[@]}" exec -T db \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -Z 5 > "$backup_file"

find "$backup_dir" -type f -name 'scrobbler-*.dump' -mtime "+$retention_days" -delete

if command -v rclone &> /dev/null; then
  echo "Uploading backup to Google Drive..." >&2
  if rclone copy "$backup_file" "${gdrive_remote}:AudioScrobblerBackups/"; then
    mkdir -p "$metrics_dir"
    printf '# HELP audio_scrobbler_backup_last_offsite_timestamp_seconds Last successful offsite (Google Drive) backup upload time.\n# TYPE audio_scrobbler_backup_last_offsite_timestamp_seconds gauge\naudio_scrobbler_backup_last_offsite_timestamp_seconds %s\n' "$(date +%s)" > "$metrics_dir/backup_offsite.prom"
  else
    echo "Warning: offsite upload to Google Drive failed; local backup was still created." >&2
  fi

  echo "Cleaning up backups older than $gdrive_retention_days days on Google Drive..." >&2
  rclone delete "${gdrive_remote}:AudioScrobblerBackups/" --min-age "${gdrive_retention_days}d" || true
else
  echo "Note: 'rclone' is not installed or in PATH." >&2
  echo "To enable Google Drive backups, install rclone and configure a remote named '${gdrive_remote}'." >&2
fi

printf '%s\n' "$backup_file"