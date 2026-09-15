#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  printf 'Usage: %s BACKUP_FILE\n' "$0" >&2
  exit 2
fi

backup_dir=${BACKUP_DIR:-backups}
metrics_dir=${BACKUP_METRICS_DIR:-monitoring}

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

backup_file=$1
verify_db="scrobbler_restore_verify_$(date -u +%Y%m%d%H%M%S)"
POSTGRES_USER=${POSTGRES_USER:-scrobbler}

cleanup() {
  docker compose "${compose_args[@]}" exec -T db \
    dropdb -U "$POSTGRES_USER" --if-exists "$verify_db" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker compose "${compose_args[@]}" exec -T db \
  createdb -U "$POSTGRES_USER" "$verify_db"
cat "$backup_file" | docker compose "${compose_args[@]}" exec -T db \
  pg_restore -U "$POSTGRES_USER" -d "$verify_db" --exit-on-error --no-owner --no-privileges
docker compose "${compose_args[@]}" exec -T db \
  psql -U "$POSTGRES_USER" -d "$verify_db" -c 'select 1 from users limit 1;' >/dev/null
mkdir -p "$metrics_dir"
printf '# HELP audio_scrobbler_backup_last_verified_timestamp_seconds Last successful backup verification time.\n# TYPE audio_scrobbler_backup_last_verified_timestamp_seconds gauge\naudio_scrobbler_backup_last_verified_timestamp_seconds %s\n' "$(date +%s)" > "$metrics_dir/backup.prom"
printf 'verified: %s\n' "$backup_file"