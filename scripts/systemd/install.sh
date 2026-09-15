#!/usr/bin/env bash
# Installs the audio-scrobbler-backup systemd user timer on the deployment
# host. Run this ON the host, as the same user the app is deployed under
# (the one with docker compose access) — not as root, and not via sudo.
#
# Usage: scripts/systemd/install.sh [deploy_path]
#   deploy_path defaults to the parent of this script's location.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
deploy_path="${1:-$(cd "$script_dir/../.." && pwd)}"

unit_dir="$HOME/.config/systemd/user"
mkdir -p "$unit_dir"

for unit in audio-scrobbler-backup.service audio-scrobbler-backup.timer; do
  sed "s#__DEPLOY_PATH__#$deploy_path#g" "$script_dir/$unit" > "$unit_dir/$unit"
done

if [[ ! -f "$script_dir/audio-scrobbler-backup.env" ]]; then
  echo "Note: $script_dir/audio-scrobbler-backup.env does not exist yet." >&2
  echo "Copy audio-scrobbler-backup.env.example to audio-scrobbler-backup.env and fill it in" >&2
  echo "before the first run, or backups will fall back to script defaults (BACKUP_DIR=backups)." >&2
fi

systemctl --user daemon-reload
systemctl --user enable --now audio-scrobbler-backup.timer

echo
echo "Installed. Verify with:"
echo "  systemctl --user list-timers audio-scrobbler-backup.timer"
echo "  systemctl --user status audio-scrobbler-backup.service"
echo
echo "IMPORTANT: on a headless host, user services stop when your SSH session"
echo "ends unless lingering is enabled for this account. Run once (needs sudo):"
echo "  sudo loginctl enable-linger \"\$USER\""
echo "Check current state with: loginctl show-user \"\$USER\" --property=Linger"
