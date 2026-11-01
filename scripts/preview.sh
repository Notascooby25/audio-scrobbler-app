#!/usr/bin/env bash
# Run a private copy of this branch on the owner's PC, with a copy of live data.
#
#   scripts/preview.sh up            build, copy live data if needed, print the link
#   scripts/preview.sh up --phone    the same, and open it to your home Wi-Fi as well
#   scripts/preview.sh down          stop it and delete its data copy
#   scripts/preview.sh status        show what's running
#   scripts/preview.sh refresh-data  start again from a fresh copy of live data
#
# Server details live in ~/.config/safe-change/preview.env, never in this repo:
#   PREVIEW_PROD_HOST, PREVIEW_PROD_USER, PREVIEW_LAN_ADDRESS (optional)
# The live server is only ever asked for a read-only pg_dump.
set -euo pipefail

PROJECT=audio-scrobbler-preview
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
PREVIEWS_ROOT="$HOME/.local/share/safe-change/previews"
DATA_DIR=${PREVIEW_DATA_DIR:-$PREVIEWS_ROOT/audio-scrobbler}
SETTINGS="$HOME/.config/safe-change/preview.env"
SECRETS="$DATA_DIR/preview.secrets.env"
DUMP="$DATA_DIR/dump.sql"
PROD_DB_CONTAINER=${PREVIEW_PROD_DB_CONTAINER:-audio-scrobbler-app-db-1}
PORT=15173
TOKEN_SECONDS=28800

die() { echo "Preview stopped: $*" >&2; exit 1; }

check_safe_to_run() {
    case "${DOCKER_HOST:-}" in
        "" | unix://*) ;;
        *) die "DOCKER_HOST points at another machine. Previews only run on this PC." ;;
    esac
    case "$DATA_DIR" in
        *..*) die "the data folder path can't contain '..'." ;;
        "$PREVIEWS_ROOT"/*) ;;
        *) die "the data folder must be inside $PREVIEWS_ROOT." ;;
    esac
}

compose() {
    local env_args=()
    if [ -f "$SECRETS" ]; then
        env_args=(--env-file "$SECRETS")
    fi
    docker compose -p "$PROJECT" -f "$ROOT/docker-compose.preview.yml" "${env_args[@]}" "$@"
}

copy_live_data() {
    [ -f "$DUMP" ] && return 0
    # shellcheck disable=SC2016  # $POSTGRES_* expand inside the container
    local remote='pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges'
    echo "Copying live data (read-only)..."
    if ! ssh -o BatchMode=yes -o ConnectTimeout=10 "$PREVIEW_PROD_USER@$PREVIEW_PROD_HOST" \
        "docker exec $PROD_DB_CONTAINER sh -c '$remote'" > "$DUMP.partial" 2>/dev/null \
        || ! tail -n 5 "$DUMP.partial" | grep -q 'database dump complete'; then
        rm -f "$DUMP.partial"
        die "couldn't copy live data, so nothing was started. Check the server is reachable."
    fi
    mv "$DUMP.partial" "$DUMP"
}

write_secrets() {
    [ -f "$SECRETS" ] && return 0
    local origins="http://localhost:$PORT"
    if [ -n "${PREVIEW_LAN_ADDRESS:-}" ]; then
        origins="$origins,http://$PREVIEW_LAN_ADDRESS:$PORT"
    fi
    (
        umask 077
        python3 - "$DATA_DIR" "$origins" > "$SECRETS" <<'PY'
import secrets, sys
for name in ("POSTGRES_PASSWORD", "JWT_SECRET", "REFRESH_TOKEN_KEY", "WORKER_INGESTION_TOKEN"):
    print(f"{name}={secrets.token_hex(32)}")
print(f"PREVIEW_DATA_DIR={sys.argv[1]}")
print(f"CORS_ORIGINS={sys.argv[2]}")
PY
    )
}

load_data_once() {
    [ -f "$DATA_DIR/restored" ] && return 0
    compose up -d --wait db
    if ! compose exec -T db psql -q -v ON_ERROR_STOP=1 --single-transaction \
        -U preview -d preview < "$DUMP" > /dev/null; then
        compose down -v --remove-orphans > /dev/null 2>&1 || true
        die "couldn't load the live data copy, so the preview was removed."
    fi
    touch "$DATA_DIR/restored"
}

write_sign_in_page() {
    local user_and_token user_id token
    # The token is signed with this preview's own key, so it only works here.
    user_and_token=$(compose exec -T backend python -c "
import os
from sqlalchemy import create_engine, text
from app.services.auth_service import create_access_token
with create_engine(os.environ['DATABASE_URL']).connect() as c:
    user = os.environ.get('PREVIEW_USER_ID') or c.execute(text('select min(id) from users where is_active')).scalar()
print(user, create_access_token(int(user), $TOKEN_SECONDS))
" 2>/dev/null) || die "couldn't create a sign-in for the preview."
    read -r user_id token <<< "$user_and_token"
    [ -n "${token:-}" ] || die "couldn't create a sign-in for the preview."
    cat > "$DATA_DIR/preview-login.html" <<HTML
<!doctype html><meta charset="utf-8"><title>Preview sign-in</title>
<script>
localStorage.setItem("audio-scrobbler-session", JSON.stringify({
  userId: $user_id, accessToken: "$token", expiresAt: Date.now() + $TOKEN_SECONDS * 1000
}));
location.replace("/");
</script>
HTML
    chmod 644 "$DATA_DIR/preview-login.html"
}

cmd_up() {
    # Private to this PC unless asked: the sign-in page gives access to real data.
    export PREVIEW_BIND=127.0.0.1
    if [ "${1:-}" = "--phone" ]; then
        export PREVIEW_BIND=0.0.0.0
    fi
    [ -f "$SETTINGS" ] || die "add the server details to $SETTINGS first (see the top of this script)."
    # shellcheck disable=SC1090
    . "$SETTINGS"
    if [ -z "${PREVIEW_PROD_HOST:-}" ] || [ -z "${PREVIEW_PROD_USER:-}" ]; then
        die "$SETTINGS needs PREVIEW_PROD_HOST and PREVIEW_PROD_USER."
    fi
    mkdir -p "$DATA_DIR"
    chmod 700 "$DATA_DIR"
    copy_live_data
    write_secrets
    : > "$DATA_DIR/preview-login.html"
    load_data_once
    compose up -d --build --wait backend
    write_sign_in_page
    compose up -d --build --wait frontend

    echo
    echo "Preview is running (commit $(git -C "$ROOT" rev-parse --short HEAD), branch $(git -C "$ROOT" branch --show-current))."
    echo "  On this PC: http://localhost:$PORT/preview-login.html"
    if [ "$PREVIEW_BIND" = 0.0.0.0 ] && [ -n "${PREVIEW_LAN_ADDRESS:-}" ]; then
        echo "  On your phone (home Wi-Fi): http://$PREVIEW_LAN_ADDRESS:$PORT/preview-login.html"
        echo "  Anyone on your Wi-Fi could open that link, so stop the preview when you are done."
    else
        echo "  Private to this PC. For your phone, run: scripts/preview.sh up --phone"
    fi
    echo "  Cut off from Spotify and other outside services, and background jobs are off."
    echo "  When finished: scripts/preview.sh down"
}

cmd_down() {
    compose down -v --remove-orphans
    rm -rf -- "$DATA_DIR"
    echo "Preview stopped and its data copy deleted."
}

cmd_status() {
    compose ps
    if [ -f "$DUMP" ]; then
        echo "Data copy taken: $(date -r "$DUMP" '+%Y-%m-%d %H:%M')"
    else
        echo "No data copy on this PC."
    fi
}

check_safe_to_run
case "${1:-}" in
    up) cmd_up "${2:-}" ;;
    down) cmd_down ;;
    status) cmd_status ;;
    refresh-data)
        cmd_down
        cmd_up
        ;;
    *) die "use: scripts/preview.sh up|down|status|refresh-data" ;;
esac
