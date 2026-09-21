#!/usr/bin/env bash
# Fixture tests: scrobbler scripts/restore_drill.sh
#
# Hermetic: every external tool the script talks to (rclone, curl, ssh, rsync, crontab,
# verify script...) is replaced by a stub on PATH, and all state lives in a temp dir that
# is removed on exit. Nothing here touches a real remote, crontab or backup directory.
# Needs: bash, GNU coreutils/find/date (Linux), flock not required.
# Run:   scripts/tests/test_restore_drill.sh
set -uo pipefail
SP=$(cd "$(dirname "$0")" && pwd); . "$SP/lib.sh"
SRC="$(cd "$SP/.." && pwd)/restore_drill.sh"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
R=$T/repo; D=$T/stub; mkdir -p "$R/scripts" "$R/backups" "$R/monitoring" "$D/nasfiles" "$D/gdfiles" "$T/bin" "$T/home"
cp "$SRC" "$R/scripts/restore_drill.sh"; chmod +x "$R/scripts/restore_drill.sh"
echo "SENTINEL_PROM 1" > "$R/monitoring/backup.prom"

# ---- stubs ----
cat > "$R/scripts/verify_database_backup.sh" <<'EOF'
#!/usr/bin/env bash
echo "$1" > "$STUB_DIR/verify_arg"; echo "${BACKUP_METRICS_DIR:-UNSET}" > "$STUB_DIR/verify_metrics"
[[ -f "$1" ]] && echo present > "$STUB_DIR/verify_file_state"
[[ "${STUB_VERIFY_FAIL:-}" == 1 ]] && { echo "stub verify: restore error" >&2; exit 1; }
echo "verified: $1"
EOF
cat > "$T/bin/ssh" <<'EOF'
#!/usr/bin/env bash
echo "ssh $*" >> "$STUB_DIR/calls.log"
[[ "${STUB_SSH_FAIL:-}" == 1 ]] && exit 255
cat "$STUB_DIR/nas_listing"
EOF
cat > "$T/bin/rsync" <<'EOF'
#!/usr/bin/env bash
echo "rsync $*" >> "$STUB_DIR/calls.log"
[[ "${STUB_RSYNC_FAIL:-}" == 1 ]] && exit 23
src="${@: -2:1}"; dst="${@: -1}"; name=$(basename "${src#*:}")
cp "$STUB_DIR/nasfiles/$name" "$dst"
EOF
cat > "$T/bin/rclone" <<'EOF'
#!/usr/bin/env bash
echo "rclone $*" >> "$STUB_DIR/calls.log"
case "$1" in
  listremotes) printf 'gdrive: drive\ngdrive-crypt: crypt\n' ;;
  lsf) [[ "${STUB_RCLONE_LSF_FAIL:-}" == 1 ]] && exit 1; cat "$STUB_DIR/gd_listing" ;;
  copyto) [[ "${STUB_RCLONE_COPY_FAIL:-}" == 1 ]] && exit 1; cp "$STUB_DIR/gdfiles/$(basename "$2")" "$3" ;;
esac
EOF
chmod +x "$R/scripts/verify_database_backup.sh" "$T/bin"/*
export PATH="$T/bin:$PATH" STUB_DIR="$D" HOME="$T/home"

stamp() { date -u -d "$1 ago" +%Y%m%dT%H%M%SZ; }
name()  { echo "scrobbler-$(stamp "$1").dump"; }
reset() { rm -f "$D"/*.log "$D"/verify_* "$R"/backups/*; : > "$D/calls.log"; rm -f "$R/.env.production"; }
drill() { "$R/scripts/restore_drill.sh" "$@" > "$T/out.txt" 2> "$T/err.txt"; RC=$?; cat "$T/err.txt" >> "$T/out.txt"; }
calls() { cat "$D/calls.log" 2>/dev/null; }

echo "== argument handling"
reset; drill;               check "no argument -> exit 2"        test $RC -eq 2
drill bogus;                check "unknown source -> exit 2"     test $RC -eq 2
drill local extra;          check "extra argument -> exit 2"     test $RC -eq 2

echo "== local"
reset; n=$(name "2 hours"); head -c 2048 /dev/urandom > "$R/backups/$n"
drill local
check "fresh dump passes"                              test $RC -eq 0
check "prints DRILL PASSED with source and file"       has "$T/out.txt" "DRILL PASSED: source=local file=$n"
check "verify was given the local dump"                has "$D/verify_arg" "backups/$n"
check "verify metrics dir is scratch, NOT monitoring"  bash -c "! grep -qx 'monitoring' '$D/verify_metrics' && grep -q '/metrics\$' '$D/verify_metrics'"
check "scratch metrics dir is gone after the run"      bash -c "! test -e \"\$(cat '$D/verify_metrics')\""
check "backup.prom untouched"                          has "$R/monitoring/backup.prom" "SENTINEL_PROM 1"

reset; head -c 100 /dev/urandom > "$R/backups/$(name '20 hours')"; drill local
check "20h-old dump refused (limit 8h)"                test $RC -eq 1
check "-> says the copy is not kept current"           has "$T/out.txt" "not being kept current"
check "-> verify never ran on a stale dump"            bash -c "! test -e '$D/verify_arg'"
DRILL_MAX_AGE_HOURS=30 drill local; check "DRILL_MAX_AGE_HOURS=30 lets 20h pass" test $RC -eq 0
DRILL_MAX_AGE_HOURS=abc drill local; check "non-numeric max age rejected"  test $RC -eq 1

reset; for a in "20 hours" "2 hours" "50 hours" "10 hours"; do head -c 100 /dev/urandom > "$R/backups/$(name "$a")"; done
touch "$R/backups/manual-20260915-201039.sql.gz"; drill local
check "newest of several is chosen (by name)"          has "$D/verify_arg" "$(name '2 hours')"
reset; drill local;                                    check "no dumps at all -> fail"   test $RC -eq 1
reset; : > "$R/backups/$(name '1 hours')"; drill local; check "empty dump file -> fail"  test $RC -eq 1
reset; head -c 100 /dev/urandom > "$R/backups/$(name '1 hours')"; STUB_VERIFY_FAIL=1 drill local
check "verify failure -> DRILL FAILED, exit 1"         bash -c "[[ $RC -eq 1 ]] && grep -q 'did NOT restore' '$T/out.txt'"
reset; head -c 100 /dev/urandom > "$R/backups/$(name '1 hours')"; touch "$R/backups/scrobbler-notatimestamp.dump"; drill local
check "junk-named dump ignored, real one used"         test $RC -eq 0

echo "== nas"
NAS_ENV=$T/nas.env; KEY=$T/nas.key; : > "$KEY"
printf 'NAS_USER=alice\nNAS_HOST=nas.lan\nNAS_PORT=8022\nNAS_TARGET=/volume1/Backups/nuc-server\nSSH_KEY=%s\n' "$KEY" > "$NAS_ENV"
mknas() { reset; rm -f "$D"/nasfiles/*; n=$(name "$1"); head -c 4096 /dev/urandom > "$D/nasfiles/$n"; printf 'manual-1.sql.gz\n%s\n%s\n' "$(name '30 hours')" "$n" > "$D/nas_listing"; }
mknas "3 hours"; NAS_ENV_FILE=$NAS_ENV drill nas
check "fresh NAS dump passes"                          test $RC -eq 0
check "listed the right remote directory"              bash -c "grep -q \"ls -1 '/volume1/Backups/nuc-server/audio-scrobbler-app/backups'\" '$D/calls.log'"
check "used the configured SSH key and port"           bash -c "grep -q -- '-i $KEY -p 8022' '$D/calls.log'"
check "fetched the NEWEST dump by name"                bash -c "grep '^rsync' '$D/calls.log' | grep -q '$n'"
check "verify ran on a temp copy, not in the repo"     bash -c "! grep -q '$R' '$D/verify_arg'"
check "temp copy removed afterwards"                   bash -c "! test -e \"\$(cat '$D/verify_arg')\""
check "backup.prom untouched by the NAS drill"         has "$R/monitoring/backup.prom" "SENTINEL_PROM 1"

mknas "3 hours"; printf 'NAS_USER=a\nNAS_HOST=h\nNAS_TARGET=/a;rm -rf /\nSSH_KEY=%s\n' "$KEY" > "$T/bad.env"; NAS_ENV_FILE=$T/bad.env drill nas
check "unsafe NAS_TARGET rejected"                     test $RC -eq 1
check "-> ssh never invoked with it"                   bash -c "! grep -q '^ssh' '$D/calls.log'"
mknas "3 hours"; NAS_ENV_FILE=$T/nonexistent drill nas;            check "missing NAS env file -> fail"  test $RC -eq 1
mknas "3 hours"; printf 'NAS_USER=a\nNAS_HOST=h\nSSH_KEY=/no/such/key\n' > "$T/nokey.env"; NAS_ENV_FILE=$T/nokey.env drill nas
check "missing SSH key -> fail"                        test $RC -eq 1
mknas "3 hours"; printf 'NAS_HOST=h\nSSH_KEY=%s\n' "$KEY" > "$T/nouser.env"; NAS_ENV_FILE=$T/nouser.env drill nas
check "NAS_USER unset -> fail"                         test $RC -eq 1
mknas "3 hours"; STUB_SSH_FAIL=1 NAS_ENV_FILE=$NAS_ENV drill nas
check "unreachable NAS -> fail (could not list)"       bash -c "[[ $RC -eq 1 ]] && grep -q 'could not list' '$T/out.txt'"
mknas "3 hours"; printf 'manual-1.sql.gz\nnotes.txt\n' > "$D/nas_listing"; NAS_ENV_FILE=$NAS_ENV drill nas
check "NAS holds no scrobbler dump -> fail"            test $RC -eq 1
mknas "3 hours"; STUB_RSYNC_FAIL=1 NAS_ENV_FILE=$NAS_ENV drill nas; check "rsync failure -> fail"  test $RC -eq 1
mknas "20 hours"; NAS_ENV_FILE=$NAS_ENV drill nas
check "stale NAS copy (20h) refused"                   bash -c "[[ $RC -eq 1 ]] && grep -q 'nas copy' '$T/out.txt'"

echo "== gdrive"
mkgd() { reset; rm -f "$D"/gdfiles/*; n=$(name "$1"); head -c 4096 /dev/urandom > "$D/gdfiles/$n"; printf '%s\n%s\n' "$(name '30 hours')" "$n" > "$D/gd_listing"; }
mkgd "1 hours"; GDRIVE_REMOTE_NAME=gdrive-crypt drill gdrive
check "crypt remote passes"                            test $RC -eq 0
check "listed the crypt remote's AudioScrobblerBackups" bash -c "grep -q 'lsf gdrive-crypt:AudioScrobblerBackups/' '$D/calls.log'"
check "downloaded the newest dump"                     bash -c "grep '^rclone copyto' '$D/calls.log' | grep -q '$n'"
check "temp download removed afterwards"               bash -c "! test -e \"\$(cat '$D/verify_arg')\""
mkgd "1 hours"; GDRIVE_REMOTE_NAME=gdrive drill gdrive
check "PLAINTEXT remote refused"                       bash -c "[[ $RC -eq 1 ]] && grep -q 'not crypt' '$T/out.txt'"
check "-> nothing was downloaded from it"              bash -c "! grep -q copyto '$D/calls.log'"
mkgd "1 hours"; GDRIVE_REMOTE_NAME=gdrive DRILL_ALLOW_PLAINTEXT=1 drill gdrive
check "DRILL_ALLOW_PLAINTEXT=1 overrides the refusal"  test $RC -eq 0
mkgd "1 hours"; echo 'GDRIVE_REMOTE_NAME=gdrive-crypt' > "$R/.env.production"; drill gdrive
check "remote taken from .env.production when caller is silent" bash -c "[[ $RC -eq 0 ]] && grep -q 'lsf gdrive-crypt:' '$D/calls.log'"
mkgd "1 hours"; echo 'GDRIVE_REMOTE_NAME="gdrive-crypt"' > "$R/.env.production"; drill gdrive
check "quoted value in env file handled"               test $RC -eq 0
mkgd "1 hours"; echo 'GDRIVE_REMOTE_NAME=gdrive-crypt   # the encrypted one' > "$R/.env.production"; drill gdrive
check "trailing # comment in env file is not part of the remote name" test $RC -eq 0
mkgd "1 hours"; echo 'GDRIVE_REMOTE_NAME=gdrive-crypt' > "$R/.env.production"; GDRIVE_REMOTE_NAME=gdrive drill gdrive
check "caller beats the env file (plain -> refused)"   test $RC -eq 1
mkgd "1 hours"; drill gdrive
check "nothing configured -> falls back to plain 'gdrive' -> refused (the original bug is caught)" test $RC -eq 1
mkgd "1 hours"; GDRIVE_REMOTE_NAME=nosuch drill gdrive
check "unknown remote -> fail"                         bash -c "[[ $RC -eq 1 ]] && grep -q 'no remote named' '$T/out.txt'"
mkgd "1 hours"; GDRIVE_REMOTE_NAME=gdrive-crypt STUB_RCLONE_LSF_FAIL=1 drill gdrive; check "listing failure -> fail"  test $RC -eq 1
mkgd "1 hours"; GDRIVE_REMOTE_NAME=gdrive-crypt STUB_RCLONE_COPY_FAIL=1 drill gdrive; check "download failure -> fail" test $RC -eq 1
mkgd "20 hours"; GDRIVE_REMOTE_NAME=gdrive-crypt drill gdrive; check "stale Google copy refused" test $RC -eq 1
reset; : > "$D/gd_listing"; GDRIVE_REMOTE_NAME=gdrive-crypt drill gdrive; check "empty Drive folder -> fail" test $RC -eq 1

summary
