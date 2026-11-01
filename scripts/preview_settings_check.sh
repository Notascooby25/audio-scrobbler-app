#!/usr/bin/env bash
# Before a branch goes live, compare the settings it expects with the live
# server's, so a setting that was never added there is found before release.
#
# Values never leave the server: names are cut off there, and the few non-secret
# settings compared by value are compared as hashes. Only reads from the server.
# Exits non-zero when a setting is missing or different.
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
SETTINGS="$HOME/.config/safe-change/preview.env"
COMPOSE=${PREVIEW_PROD_COMPOSE:-$ROOT/docker-compose.prod.yml}
SERVICES=(backend worker)
HASH_COMPARED=(SPOTIFY_SCOPES)
problems=0

die() { echo "Settings check stopped: $*" >&2; exit 2; }

[ -f "$SETTINGS" ] || die "add the server details to $SETTINGS first."
# shellcheck disable=SC1090
. "$SETTINGS"

on_server() {
    ssh -o BatchMode=yes -o ConnectTimeout=10 "$PREVIEW_PROD_USER@$PREVIEW_PROD_HOST" "$1" 2>/dev/null \
        || die "couldn't reach the server, so nothing was checked."
}

expected_names() {
    awk -v service="  $1:" '
        $0 == service { in_service = 1; next }
        in_service && /^  [^ ]/ { in_service = 0 }
        in_service && /^    environment:/ { in_env = 1; next }
        in_service && in_env && /^    [^ ]/ { in_env = 0 }
        in_service && in_env && /^      [A-Z_0-9]+:/ { sub(/^ +/, ""); sub(/:.*/, ""); print }
    ' "$COMPOSE"
}

for service in "${SERVICES[@]}"; do
    container="audio-scrobbler-app-$service-1"
    live=$(on_server "docker exec $container env | cut -d= -f1 | sort" | cut -d= -f1)
    while read -r name; do
        [ -n "$name" ] || continue
        if ! grep -qx -- "$name" <<< "$live"; then
            echo "MISSING on live ($service): $name"
            problems=$((problems + 1))
        fi
    done < <(expected_names "$service")
done

for name in "${HASH_COMPARED[@]}"; do
    expected=$(sed -n "s/.*\${$name:-\(.*\)}.*/\1/p" "$COMPOSE" | head -n 1)
    [ -n "$expected" ] || continue
    # shellcheck disable=SC2016  # $name's value expands inside the container
    live_hash=$(on_server "docker exec audio-scrobbler-app-backend-1 sh -c 'printf %s \"\$$name\" | sha256sum'" | cut -d' ' -f1)
    expected_hash=$(printf %s "$expected" | sha256sum | cut -d' ' -f1)
    if [ "$live_hash" = "$expected_hash" ]; then
        echo "$name: same on live as this branch's default"
    else
        echo "$name: different on live from this branch's default"
        problems=$((problems + 1))
    fi
done

if [ "$problems" -gt 0 ]; then
    echo "$problems setting(s) to check before going live."
    exit 1
fi
echo "Settings match."
