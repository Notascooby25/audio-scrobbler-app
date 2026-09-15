#!/usr/bin/env bash
# Orchestrates a full backup cycle: dump, restore-verify, then report success
# or failure to an external heartbeat/dead-man's-switch service (e.g.
# healthchecks.io). This is the script the systemd timer in
# scripts/systemd/ invokes; it exists so scheduling and alerting share one
# code path instead of being duplicated between cron/systemd and CI.
#
# Env vars:
#   ENV_FILE, COMPOSE_FILE       - forwarded to backup_database.sh / verify_database_backup.sh
#   HEARTBEAT_URL                - base ping URL (e.g. https://hc-ping.com/<uuid>).
#                                   On success: GET "$HEARTBEAT_URL"
#                                   On failure: GET "$HEARTBEAT_URL/fail"
#                                   If unset, heartbeat pings are skipped.
set -euo pipefail

cd "$(dirname "$0")/.."

ping_heartbeat() {
  local suffix="${1:-}"
  if [[ -n "${HEARTBEAT_URL:-}" ]]; then
    curl -fsS -m 10 --retry 3 --retry-delay 2 -o /dev/null "${HEARTBEAT_URL}${suffix}" || true
  fi
}

on_failure() {
  echo "Backup cycle failed." >&2
  ping_heartbeat "/fail"
}
trap on_failure ERR

backup_file="$(scripts/backup_database.sh)"
scripts/verify_database_backup.sh "$backup_file"

trap - ERR
ping_heartbeat
printf 'backup cycle complete: %s\n' "$backup_file"
