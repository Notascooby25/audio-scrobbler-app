#!/usr/bin/env bash
# restore_drill.sh — prove a backup can really be restored, from a chosen copy.
#
# The 6-hourly timer already restore-verifies the dump it has just made on the NUC.
# That says nothing about the *other* copies. This pulls the newest dump from one of
# them and runs the same restore-into-a-scratch-database verification on it:
#
#   local   the newest dump in backups/ on this host
#   nas     the newest dump the NAS mirror holds (audio-scrobbler-app/backups/)
#   gdrive  the newest dump in the encrypted Google Drive folder (AudioScrobblerBackups/)
#
# Usage:  scripts/restore_drill.sh {local|nas|gdrive}
#
# Safe to run on the production host: it restores into a throwaway database (the same
# thing verify_database_backup.sh does every 6 hours) and never touches the live one.
# It also refuses a copy older than DRILL_MAX_AGE_HOURS, because "restorable but a
# week stale" means the copy is not being kept up to date.
#
# Environment (all optional):
#   ENV_FILE, COMPOSE_FILE   forwarded to verify_database_backup.sh
#                            (default .env.production / docker-compose.prod.yml if present)
#   BACKUP_DIR               local dumps directory (default backups)
#   DRILL_MAX_AGE_HOURS      default 8  (6h schedule + jitter + the NAS mirror's delay)
#   NAS_ENV_FILE             default ~/.config/nas-sync.env  (NAS_USER, NAS_HOST, NAS_PORT,
#                            NAS_TARGET, SSH_KEY — the file the NAS mirror job uses)
#   GDRIVE_REMOTE_NAME       rclone remote (default: value in ENV_FILE, else "gdrive")
#   DRILL_ALLOW_PLAINTEXT=1  allow a non-crypt rclone remote (normally refused)
set -euo pipefail

usage() { printf 'Usage: %s {local|nas|gdrive}\n' "$0" >&2; exit 2; }
die()   { printf 'DRILL FAILED: %s\n' "$*" >&2; exit 1; }
log()   { printf '[restore_drill] %s\n' "$*" >&2; }

[[ $# -eq 1 ]] || usage
source_kind=$1
case "$source_kind" in local|nas|gdrive) ;; *) usage ;; esac

cd "$(dirname "$0")/.."

# Captured before any env file is read: caller-supplied values must win.
env_gdrive_remote=${GDRIVE_REMOTE_NAME:-}

# Same defaults verify_database_backup.sh would pick itself; exported so it sees them.
if [[ -z "${ENV_FILE:-}" && -f .env.production ]]; then export ENV_FILE=.env.production; fi
if [[ -z "${COMPOSE_FILE:-}" && "${ENV_FILE:-}" == ".env.production" && -f docker-compose.prod.yml ]]; then
  export COMPOSE_FILE=docker-compose.prod.yml
fi

max_age_hours=${DRILL_MAX_AGE_HOURS:-8}
[[ "$max_age_hours" =~ ^[0-9]+$ ]] || die "DRILL_MAX_AGE_HOURS must be a non-negative integer (got: $max_age_hours)"
max_age_hours=$((10#$max_age_hours))

# Read one KEY from an env file without executing it.
env_value() {
  local key=$1 file=$2 line
  [[ -f "$file" ]] || return 0
  line=$(grep -E "^${key}=" "$file" | tail -n 1 || true)
  line=${line#*=}
  line=${line%%[[:space:]]#*}            # drop a trailing " # comment", as sourcing would
  line=${line%"${line##*[![:space:]]}"}  # rtrim
  line=${line%\"}; line=${line#\"}
  line=${line%\'}; line=${line#\'}
  printf '%s' "$line"
}

work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT

dump_name_re='^scrobbler-([0-9]{8})T([0-9]{6})Z\.dump$'

# The UTC creation time is embedded in the filename, so age never depends on a
# copy having preserved its mtime.
dump_epoch() {
  local name=$1 d t
  [[ "$name" =~ $dump_name_re ]] || return 1
  d=${BASH_REMATCH[1]}; t=${BASH_REMATCH[2]}
  date -u -d "${d:0:4}-${d:4:2}-${d:6:2} ${t:0:2}:${t:2:2}:${t:4:2}" +%s
}

newest_name() {  # reads names on stdin, prints the newest valid one (or nothing)
  { grep -E "$dump_name_re" || true; } | sort | tail -n 1
}

dump_file=""
case "$source_kind" in
  local)
    backup_dir=${BACKUP_DIR:-backups}
    [[ -d "$backup_dir" ]] || die "local backup directory not found: $backup_dir"
    name=$(find "$backup_dir" -maxdepth 1 -type f -name 'scrobbler-*.dump' -printf '%f\n' | newest_name)
    [[ -n "$name" ]] || die "no scrobbler-*.dump in $backup_dir"
    dump_file="$backup_dir/$name"
    ;;

  nas)
    nas_env=${NAS_ENV_FILE:-$HOME/.config/nas-sync.env}
    [[ -f "$nas_env" ]] || die "NAS config not found: $nas_env (written when the NAS mirror was set up)"
    set -a
    # shellcheck disable=SC1090
    . "$nas_env"
    set +a
    : "${NAS_USER:?NAS_USER is not set in $nas_env}"
    : "${NAS_HOST:?NAS_HOST is not set in $nas_env}"
    nas_port=${NAS_PORT:-8022}
    nas_target=${NAS_TARGET:-/volume1/Backups/nuc-server}
    ssh_key=${SSH_KEY:-$HOME/.ssh/id_ed25519_synology}
    [[ -f "$ssh_key" ]] || die "NAS SSH key not found: $ssh_key"
    # nas_target is interpolated into a remote shell command, so keep it a plain path.
    [[ "$nas_target" =~ ^/[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)+$ ]] \
      || die "NAS_TARGET must be a plain absolute path (got: $nas_target)"
    remote_dir="$nas_target/audio-scrobbler-app/backups"
    ssh_cmd=(ssh -i "$ssh_key" -p "$nas_port" -o BatchMode=yes -o ConnectTimeout=15)

    log "Listing $remote_dir on the NAS"
    names=$("${ssh_cmd[@]}" "${NAS_USER}@${NAS_HOST}" "ls -1 '$remote_dir'" 2>/dev/null) \
      || die "could not list $remote_dir on the NAS (unreachable, or the folder is missing)"
    name=$(printf '%s\n' "$names" | newest_name)
    [[ -n "$name" ]] || die "no scrobbler-*.dump on the NAS in $remote_dir"
    log "Fetching $name from the NAS"
    rsync -t -e "${ssh_cmd[*]}" "${NAS_USER}@${NAS_HOST}:${remote_dir}/${name}" "$work/" \
      || die "rsync from the NAS failed"
    dump_file="$work/$name"
    ;;

  gdrive)
    command -v rclone >/dev/null 2>&1 || die "rclone is not installed"
    remote=${env_gdrive_remote:-$(env_value GDRIVE_REMOTE_NAME "${ENV_FILE:-}")}
    remote=${remote:-gdrive}
    # A drill that quietly passes against the plaintext remote proves nothing about
    # the encrypted copy — the exact mistake that once went unnoticed here.
    remote_type=$(rclone listremotes --long | awk -v r="${remote}:" '$1 == r { print $2 }') \
      || die "rclone listremotes failed"
    [[ -n "$remote_type" ]] || die "rclone has no remote named '$remote'"
    if [[ "$remote_type" != "crypt" && "${DRILL_ALLOW_PLAINTEXT:-0}" != "1" ]]; then
      die "rclone remote '$remote' is type '$remote_type', not crypt. Set GDRIVE_REMOTE_NAME to the crypt remote (or DRILL_ALLOW_PLAINTEXT=1)."
    fi
    log "Listing ${remote}:AudioScrobblerBackups/"
    names=$(rclone lsf "${remote}:AudioScrobblerBackups/" --files-only) \
      || die "could not list ${remote}:AudioScrobblerBackups/"
    name=$(printf '%s\n' "$names" | newest_name)
    [[ -n "$name" ]] || die "no scrobbler-*.dump in ${remote}:AudioScrobblerBackups/"
    log "Fetching $name from ${remote}:"
    rclone copyto "${remote}:AudioScrobblerBackups/${name}" "$work/$name" \
      || die "rclone download failed"
    dump_file="$work/$name"
    ;;
esac

name=$(basename "$dump_file")
[[ -s "$dump_file" ]] || die "$name is empty"

created=$(dump_epoch "$name") || die "cannot read a timestamp from the file name: $name"
age_seconds=$(( $(date +%s) - created ))
age_hours=$(( age_seconds / 3600 ))
if (( age_seconds > max_age_hours * 3600 )); then
  die "newest $source_kind copy ($name) is ${age_hours}h old, limit ${max_age_hours}h — that copy is not being kept current"
fi

# The metrics dir goes to scratch: verify_database_backup.sh stamps "last verified now"
# into backup.prom on success, and a manual drill must never refresh the metric that
# the AudioScrobblerBackupStale alert watches.
log "Restore-verifying $name (${age_hours}h old, $(wc -c < "$dump_file") bytes) into a scratch database"
BACKUP_METRICS_DIR="$work/metrics" scripts/verify_database_backup.sh "$dump_file" >&2 \
  || die "$source_kind copy $name did NOT restore cleanly"

printf 'DRILL PASSED: source=%s file=%s age=%sh (limit %sh)\n' "$source_kind" "$name" "$age_hours" "$max_age_hours"
