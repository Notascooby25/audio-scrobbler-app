#!/usr/bin/env bash
# Hermetic tests for backend/scripts/pre_migration_backup.sh
set -uo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
SCRIPT=$(cd "$HERE/.." && pwd)/pre_migration_backup.sh

PASS=0; FAIL=0
check() {
    local desc=$1; shift
    if "$@" >/dev/null 2>&1; then PASS=$((PASS+1)); echo "  ok    $desc"
    else FAIL=$((FAIL+1)); echo "  FAIL  $desc"; fi
}
summary() { echo "passed=$PASS failed=$FAIL"; [[ $FAIL -eq 0 ]]; }

T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT

mkdir -p "$T/bin" "$T/backups"
LOG="$T/out.log"
DUMP_LOG="$T/pg_dump.log"

# Stub pg_dump
cat > "$T/bin/pg_dump" <<EOF
#!/usr/bin/env bash
echo "pg_dump \$*" >> "$DUMP_LOG"
if [[ "\${FAKE_PG_DUMP_FAIL:-}" == "1" ]]; then
    exit 1
fi
# Find -f argument and write dummy dump content
while [[ \$# -gt 0 ]]; do
    if [[ "\$1" == "-f" ]]; then
        shift
        echo "DUMMY_DUMP_DATA" > "\$1"
        break
    fi
    shift
done
exit 0
EOF
chmod +x "$T/bin/pg_dump"

ORIG_PATH="$PATH"

echo "Case 1: Disabled via PRE_MIGRATION_BACKUP_ENABLED=false"
PRE_MIGRATION_BACKUP_ENABLED=false DATABASE_URL="postgresql://user:pass@host/db" bash "$SCRIPT" > "$LOG" 2>&1
rc=$?
check "exits 0 when disabled" test "$rc" -eq 0
check "logs disabled status" grep -q "disabled" "$LOG"

echo "Case 2: Empty DATABASE_URL"
PRE_MIGRATION_BACKUP_ENABLED=true DATABASE_URL="" bash "$SCRIPT" > "$LOG" 2>&1
rc=$?
check "exits 0 when DATABASE_URL is unset" test "$rc" -eq 0
check "logs empty DATABASE_URL" grep -q "DATABASE_URL is not set" "$LOG"

echo "Case 3: Non-PostgreSQL database (sqlite)"
PRE_MIGRATION_BACKUP_ENABLED=true DATABASE_URL="sqlite:///test.db" bash "$SCRIPT" > "$LOG" 2>&1
rc=$?
check "exits 0 for sqlite" test "$rc" -eq 0
check "logs non-PostgreSQL" grep -q "does not use PostgreSQL" "$LOG"

echo "Case 4: pg_dump not found in PATH"
mkdir -p "$T/no_pgdump_bin"
for tool in bash sh date mkdir tr wc find sort tail rm ls cat test [; do
    tool_path=$(command -v "$tool" || true)
    if [[ -n "$tool_path" && -x "$tool_path" ]]; then
        ln -sf "$tool_path" "$T/no_pgdump_bin/$tool"
    fi
done
PATH="$T/no_pgdump_bin" PRE_MIGRATION_BACKUP_ENABLED=true DATABASE_URL="postgresql://user:pass@host/db" "$T/no_pgdump_bin/bash" "$SCRIPT" > "$LOG" 2>&1
rc=$?
check "exits 0 when pg_dump is missing" test "$rc" -eq 0
check "logs warning when pg_dump is missing" grep -q "WARNING: pg_dump utility not found" "$LOG"

echo "Case 5: Successful backup with URL normalization"
PATH="$T/bin:$ORIG_PATH"
PRE_MIGRATION_BACKUP_ENABLED=true \
PRE_MIGRATION_BACKUP_DIR="$T/backups" \
DATABASE_URL="postgresql+psycopg://user:secret@db:5432/scrobbler" \
bash "$SCRIPT" > "$LOG" 2>&1
rc=$?
check "exits 0 on successful backup" test "$rc" -eq 0
check "pg_dump was invoked with normalized postgresql:// url" grep -q "postgresql://user:secret@db:5432/scrobbler" "$DUMP_LOG"
check "dump file was created" test -f "$T/backups"/pre_migration_*.dump
check "logs success message" grep -q "Pre-migration snapshot successfully created" "$LOG"

echo "Case 6: pg_dump failure fails open with warning"
rm -f "$DUMP_LOG"
PATH="$T/bin:$ORIG_PATH"
FAKE_PG_DUMP_FAIL=1 \
PRE_MIGRATION_BACKUP_ENABLED=true \
PRE_MIGRATION_BACKUP_DIR="$T/backups" \
DATABASE_URL="postgresql://user:secret@db:5432/scrobbler" \
bash "$SCRIPT" > "$LOG" 2>&1
rc=$?
check "exits 0 even when pg_dump fails" test "$rc" -eq 0
check "logs warning when pg_dump fails" grep -q "WARNING: Pre-migration pg_dump command failed" "$LOG"

echo "Case 7: Retention prunes older snapshots beyond 5"
rm -f "$T/backups"/*
# Create 7 dummy snapshot files with sorted timestamps
for i in 1 2 3 4 5 6 7; do
    touch "$T/backups/pre_migration_20261106T12000${i}Z.dump"
done
count_before=$(find "$T/backups" -maxdepth 1 -name 'pre_migration_*.dump' | wc -l)
check "7 files created initially" test "$count_before" -eq 7

PATH="$T/bin:$ORIG_PATH"
FAKE_PG_DUMP_FAIL=0 \
PRE_MIGRATION_BACKUP_ENABLED=true \
PRE_MIGRATION_BACKUP_DIR="$T/backups" \
DATABASE_URL="postgresql://user:secret@db:5432/scrobbler" \
bash "$SCRIPT" > "$LOG" 2>&1
rc=$?
check "exits 0 after retention cleanup" test "$rc" -eq 0
# 7 old + 1 new = 8, trimmed to 5 newest
count_after=$(find "$T/backups" -maxdepth 1 -name 'pre_migration_*.dump' | wc -l)
check "retains at most 5 dumps" test "$count_after" -eq 5
check "oldest file was removed" test ! -f "$T/backups/pre_migration_20261106T120001Z.dump"

summary
