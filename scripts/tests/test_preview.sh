#!/usr/bin/env bash
# Fixture tests: scripts/preview.sh
#
# Hermetic: docker and ssh are stubs on PATH and HOME is a temp folder, so
# nothing here can reach a real container or the production server.
set -uo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
SCRIPT="$ROOT/scripts/preview.sh"
# shellcheck source=/dev/null
. "$HERE/lib.sh"

setup() {
    T=$(mktemp -d)
    export HOME="$T/home"
    DATA="$HOME/.local/share/safe-change/previews/audio-scrobbler"
    mkdir -p "$HOME/.config/safe-change" "$T/bin"
    cat > "$HOME/.config/safe-change/preview.env" <<'EOF'
PREVIEW_PROD_HOST=fake-host
PREVIEW_PROD_USER=fake-user
PREVIEW_LAN_ADDRESS=10.0.0.5
EOF
    cat > "$T/bin/docker" <<EOF
#!/usr/bin/env bash
echo "docker \$*" >> "$T/docker.log"
echo "PREVIEW_BIND=\${PREVIEW_BIND:-}" >> "$T/env.log"
case "\$*" in
  *"exec -T backend"*) [ -z "\${FAKE_NO_USER:-}" ] || exit 1; echo "1 fake-access-token" ;;
  *"exec -T db psql"*) cat > "$T/restored.sql"; exit "\${FAKE_RESTORE_RC:-0}" ;;
esac
exit 0
EOF
    cat > "$T/bin/ssh" <<EOF
#!/usr/bin/env bash
echo "ssh \$*" >> "$T/ssh.log"
if [ "\${FAKE_SSH_MODE:-ok}" = fail ]; then exit 1; fi
if [ "\${FAKE_SSH_MODE:-ok}" = partial ]; then echo "CREATE TABLE half"; exit 1; fi
if [ "\${FAKE_SSH_MODE:-ok}" = truncated ]; then echo "CREATE TABLE half"; exit 0; fi
echo "CREATE TABLE users;"
echo "-- PostgreSQL database dump complete"
EOF
    chmod +x "$T/bin/docker" "$T/bin/ssh"
    export PATH="$T/bin:$PATH"
    unset DOCKER_HOST PREVIEW_DATA_DIR FAKE_SSH_MODE FAKE_RESTORE_RC
}

run() { bash "$SCRIPT" "$@" > "$T/out.txt" 2>&1; }
every_compose_call_uses_preview_project() {
    ! grep 'compose' "$T/docker.log" | grep -qv -- '-p audio-scrobbler-preview'
}

echo "down only targets the preview project"
setup; mkdir -p "$DATA"; touch "$DATA/dump.sql"
run down
check "exits cleanly" test $? -eq 0
check "called compose" grep -q compose "$T/docker.log"
check "every call names the preview project" every_compose_call_uses_preview_project
check "data folder removed" test ! -e "$DATA"

echo "down refuses a data folder outside the previews area"
setup; mkdir -p "$T/precious"; touch "$T/precious/keep"
PREVIEW_DATA_DIR="$T/precious" run down; rc=$?
check "exits non-zero" test "$rc" -ne 0
check "file kept" test -e "$T/precious/keep"
check "docker not called" test ! -e "$T/docker.log"
PREVIEW_DATA_DIR="$DATA/../../../../../precious" run down; rc=$?
check "refuses .. in the path" test "$rc" -ne 0

echo "up stops plainly when the server can't be reached"
setup
FAKE_SSH_MODE=fail run up; rc=$?
check "exits non-zero" test "$rc" -ne 0
check "plain message" grep -qi "couldn't copy" "$T/out.txt"
check "nothing restored" test ! -e "$T/restored.sql"

echo "a partial or truncated copy is never used"
setup
FAKE_SSH_MODE=partial run up; rc=$?
check "partial: exits non-zero" test "$rc" -ne 0
check "partial: no dump left" test ! -e "$DATA/dump.sql"
check "partial: no temp file left" test ! -e "$DATA/dump.sql.partial"
setup
FAKE_SSH_MODE=truncated run up; rc=$?
check "truncated: exits non-zero" test "$rc" -ne 0
check "truncated: no dump left" test ! -e "$DATA/dump.sql"

echo "a failed restore doesn't leave a preview that looks fine"
setup
FAKE_RESTORE_RC=3 run up; rc=$?
check "exits non-zero" test "$rc" -ne 0
check "backend never started" bash -c "! grep -q 'up .*backend' '$T/docker.log'"
check "plain message" grep -qi "couldn't load" "$T/out.txt"

echo "a failed sign-in stops plainly"
setup
FAKE_NO_USER=1 run up; rc=$?
check "exits non-zero" test "$rc" -ne 0
check "plain message" grep -qi "couldn't create a sign-in" "$T/out.txt"
check "frontend never started" bash -c "! grep -q 'up .*frontend' '$T/docker.log'"

echo "refuses a remote docker"
setup
DOCKER_HOST=tcp://10.0.0.9:2375 run up; rc=$?
check "exits non-zero" test "$rc" -ne 0
check "docker not called" test ! -e "$T/docker.log"

echo "a missing server setting stops plainly"
setup; rm "$HOME/.config/safe-change/preview.env"
run up; rc=$?
check "exits non-zero" test "$rc" -ne 0
check "names the settings file" grep -q preview.env "$T/out.txt"

echo "a good run"
setup
run up; rc=$?
check "exits cleanly" test "$rc" -eq 0
check "every call names the preview project" every_compose_call_uses_preview_project
check "server only asked for a dump" bash -c "[ \$(grep -c . '$T/ssh.log') -eq 1 ] && grep -q pg_dump '$T/ssh.log'"
check "PC link printed" grep -q "http://localhost:15173" "$T/out.txt"
check "commit printed" grep -qi "commit" "$T/out.txt"
check "secrets file is private" test "$(stat -c %a "$DATA/preview.secrets.env")" = 600
check "data folder is private" test "$(stat -c %a "$DATA")" = 700
secret=$(sed -n 's/^JWT_SECRET=//p' "$DATA/preview.secrets.env")
check "secret was generated" test -n "$secret"
check "secret never printed" hasnt "$T/out.txt" "$secret"
check "token never printed" hasnt "$T/out.txt" "fake-access-token"
check "live key name not reused" hasnt "$DATA/preview.secrets.env" "fake-host"

echo "private to this PC unless the phone is asked for"
setup
PREVIEW_BIND=wrong run up
check "no phone link by default" hasnt "$T/out.txt" "http://10.0.0.5"
check "says how to get a phone link" grep -q -- "--phone" "$T/out.txt"
check "binds to this PC only" grep -q "PREVIEW_BIND=127.0.0.1" "$T/env.log"
setup
run up --phone
check "phone link when asked" grep -q "http://10.0.0.5:15173" "$T/out.txt"
check "warns about the Wi-Fi" grep -qi "anyone on your Wi-Fi" "$T/out.txt"
check "binds to the network" grep -q "PREVIEW_BIND=0.0.0.0" "$T/env.log"

echo "the preview stack is isolated"
C="$ROOT/docker-compose.preview.yml"
check "own project name" grep -q '^name: audio-scrobbler-preview' "$C"
check "no worker" hasnt "$C" "worker:"
check "no watchtower" hasnt "$C" "watchtower"
check "no shared volume" bash -c "! grep -Eq '(^|[^_])postgres_data' '$C'"
check "database publishes no port" bash -c "! sed -n '/^  db:/,/^  backend:/p' '$C' | grep -q ports"
check "backend publishes no port" bash -c "! sed -n '/^  backend:/,/^  frontend:/p' '$C' | grep -q ports"
check "backend has no internet route" grep -q 'internal: true' "$C"
check "port follows the chosen address" grep -q 'PREVIEW_BIND' "$C"

summary
