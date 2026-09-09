#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  printf 'Usage: %s BACKUP_FILE\n' "$0" >&2
  exit 2
fi

compose_file=${COMPOSE_FILE:-docker-compose.prod.yml}
env_file=${ENV_FILE:-.env.production}
backup_file=$1
verify_db="scrobbler_restore_verify_$(date -u +%Y%m%d%H%M%S)"

set -a
# shellcheck disable=SC1090
. "$env_file"
set +a

cleanup() {
  docker compose -f "$compose_file" --env-file "$env_file" exec -T db \
    dropdb -U "$POSTGRES_USER" --if-exists "$verify_db" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker compose -f "$compose_file" --env-file "$env_file" exec -T db \
  createdb -U "$POSTGRES_USER" "$verify_db"
cat "$backup_file" | docker compose -f "$compose_file" --env-file "$env_file" exec -T db \
  pg_restore -U "$POSTGRES_USER" -d "$verify_db" --exit-on-error --no-owner --no-privileges
docker compose -f "$compose_file" --env-file "$env_file" exec -T db \
  psql -U "$POSTGRES_USER" -d "$verify_db" -c 'select 1 from users limit 1;' >/dev/null
printf 'verified: %s\n' "$backup_file"