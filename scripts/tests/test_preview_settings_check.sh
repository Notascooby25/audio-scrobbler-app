#!/usr/bin/env bash
# Fixture tests: scripts/preview_settings_check.sh
#
# Hermetic: ssh is a stub on PATH and HOME is a temp folder.
set -uo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
SCRIPT="$ROOT/scripts/preview_settings_check.sh"
# shellcheck source=/dev/null
. "$HERE/lib.sh"

T=$(mktemp -d)
export HOME="$T/home"
mkdir -p "$HOME/.config/safe-change" "$T/bin"
cat > "$HOME/.config/safe-change/preview.env" <<'EOF'
PREVIEW_PROD_HOST=fake-host
PREVIEW_PROD_USER=fake-user
EOF
cat > "$T/compose.yml" <<'EOF'
services:
  backend:
    environment:
      APP_ENV: production
      JWT_SECRET: ${JWT_SECRET}
      NEW_SETTING: ${NEW_SETTING}
      HAS_DEFAULT: ${HAS_DEFAULT:-30}
      SPOTIFY_SCOPES: ${SPOTIFY_SCOPES:-user-library-read user-library-modify}
  worker:
    environment:
      WORKER_ONLY: ${WORKER_ONLY}
  frontend:
    ports:
      - "5173:5173"
EOF
cat > "$T/bin/ssh" <<EOF
#!/usr/bin/env bash
echo "ssh \$*" >> "$T/ssh.log"
if [ -n "\${FAKE_SSH_FAIL:-}" ]; then exit 1; fi
case "\$*" in
  *sha256sum*) printf '%s' "\${FAKE_SCOPES:-user-library-read user-library-modify}" | sha256sum ;;
  *backend*) printf 'APP_ENV\nJWT_SECRET=leaked-secret-value\nSPOTIFY_SCOPES\n' ;;
  *worker*) printf 'WORKER_ONLY\n' ;;
esac
EOF
chmod +x "$T/bin/ssh"
export PATH="$T/bin:$PATH"
export PREVIEW_PROD_COMPOSE="$T/compose.yml"

run() { bash "$SCRIPT" > "$T/out.txt" 2>&1; }

echo "a setting this branch expects is missing on live"
run; rc=$?
check "exits non-zero" test "$rc" -ne 0
check "names the missing setting" grep -q "NEW_SETTING" "$T/out.txt"
check "doesn't flag settings live has" hasnt "$T/out.txt" "WORKER_ONLY"
check "never prints a value" hasnt "$T/out.txt" "leaked-secret-value"
check "reports scopes matching" grep -qi "SPOTIFY_SCOPES.*same" "$T/out.txt"

echo "a missing setting with a safe default is not a problem"
check "explains the default" grep -qi "uses the default: HAS_DEFAULT" "$T/out.txt"
check "not reported as missing" bash -c "! grep -q 'MISSING.*HAS_DEFAULT' '$T/out.txt'"
check "not counted as a problem" grep -q "^1 setting" "$T/out.txt"
sed -i '/NEW_SETTING/d' "$T/compose.yml"
run; rc=$?
check "defaults alone pass" test "$rc" -eq 0
check "says settings match" grep -q "Settings match" "$T/out.txt"
check "still mentions the default" grep -qi "uses the default: HAS_DEFAULT" "$T/out.txt"

echo "a live value differs from what this branch expects"
FAKE_SCOPES=old-scopes run
check "reports scopes differing" grep -qi "SPOTIFY_SCOPES.*different" "$T/out.txt"
check "never prints the live value" hasnt "$T/out.txt" "old-scopes"

echo "only reads from the server"
check "no compose or write commands sent" bash -c "! grep -Eq 'compose|rm |up -d' '$T/ssh.log'"
check "values cut off on the server" grep -q "cut -d= -f1" "$T/ssh.log"

echo "the server can't be reached"
FAKE_SSH_FAIL=1 run; rc=$?
check "exits non-zero" test "$rc" -ne 0
check "plain message" grep -qi "couldn't reach" "$T/out.txt"

summary
