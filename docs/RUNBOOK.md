# Operations Runbook

The authoritative operational reference for this app.

> **Supersedes the PDFs.** `docs/Deployment_Runbook_—_Family_Music_Scrobbler_PWA.pdf`
> and `guides/Operations_&_Monitoring_Guide_—_Family_Music_Scrobbler_PWA.pdf`
> describe a system that does not exist: a `scripts/verify_backup.sh` that was
> never written, rsync-to-Synology as the offsite path (it is rclone to Google
> Drive), and a restore using `psql`, which **cannot read the dumps this app
> actually produces**. Follow this file instead.

---

## Where things are

| | |
|---|---|
| Deployment host | The NUC, `/srv/audio-scrobbler-app` — a file-drop directory, **not** a git checkout |
| Compose file | `docker-compose.prod.yml` |
| Secrets | `.env.production`, host-only, never in git |
| Local dumps | `backups/scrobbler-<UTC timestamp>.dump` under the deploy directory |
| Offsite dumps | `rclone` remote from `GDRIVE_REMOTE_NAME`, under `AudioScrobblerBackups/` |
| Backup schedule | systemd **user** timer, every 6h — `systemctl --user list-timers` |

All `docker compose` commands below assume:

```bash
cd /srv/audio-scrobbler-app
```

and are written out in full rather than abbreviated, so they can be pasted
during an incident without reconstructing context.

---

## Restore the database from a backup

**This is the procedure the PDFs get wrong.** Dumps are PostgreSQL *custom
format* (`pg_dump -Fc`). They are not SQL text: `psql < dump` will fail. Use
`pg_restore`.

### 1. Pick the dump

```bash
ls -lt /srv/audio-scrobbler-app/backups/scrobbler-*.dump | head
```

If the host itself is gone, pull one from offsite instead:

```bash
rclone ls gdrive-crypt:AudioScrobblerBackups/
rclone copy gdrive-crypt:AudioScrobblerBackups/scrobbler-<timestamp>.dump /srv/audio-scrobbler-app/backups/
```

(Substitute whatever `GDRIVE_REMOTE_NAME` is set to in `.env.production`.)

> **Dumps from before 2026-09-20 are on the plaintext `gdrive` remote, not
> `gdrive-crypt`.** `backup_database.sh` read its settings before sourcing the
> env file, so `GDRIVE_REMOTE_NAME=gdrive-crypt` was ignored and every upload
> went to the script's built-in default. If `gdrive-crypt:AudioScrobblerBackups/`
> is empty or missing, that is why — look in `gdrive:AudioScrobblerBackups/`
> instead. Those older dumps are unencrypted at rest in Google Drive.

### 2. Verify it before you rely on it

This restores into a throwaway database and checks row counts against live —
it does not touch the live database:

```bash
cd /srv/audio-scrobbler-app
ENV_FILE=.env.production COMPOSE_FILE=docker-compose.prod.yml \
  scripts/verify_database_backup.sh backups/scrobbler-<timestamp>.dump
```

### 3. Stop anything that writes

```bash
cd /srv/audio-scrobbler-app
docker compose -f docker-compose.prod.yml --env-file .env.production stop backend worker
```

Leave `db` running — you are restoring *into* it.

### 4. Restore

`--clean --if-exists` drops and recreates objects as it goes, so this works
against a database that still has the damaged data in it.

```bash
cd /srv/audio-scrobbler-app
POSTGRES_USER="$(grep '^POSTGRES_USER=' .env.production | cut -d= -f2)"
POSTGRES_DB="$(grep '^POSTGRES_DB=' .env.production | cut -d= -f2)"

cat backups/scrobbler-<timestamp>.dump | \
  docker compose -f docker-compose.prod.yml --env-file .env.production exec -T db \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    --clean --if-exists --no-owner --no-privileges --exit-on-error
```

If it aborts partway, the database is in a half-restored state — re-run the
same command rather than starting the app.

### 5. Confirm, then start back up

```bash
cd /srv/audio-scrobbler-app
docker compose -f docker-compose.prod.yml --env-file .env.production exec -T db \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c 'select count(*) as users from users; select count(*) as events from listening_events;'

docker compose -f docker-compose.prod.yml --env-file .env.production start backend worker
```

Then check readiness (`BACKEND_HOST_PORT` is 8010 on the NUC):

```bash
curl -s http://localhost:8010/readyz
```

---

## Liked tracks — live, not dormant

> This section previously said liked-tracks was removed on 2026-09-16 and that
> its table and columns were unused and safe to drop. **That is no longer
> true.** The feature was revived alongside real-time scrobbling (commit
> `3cbfc0a`, "add scrobble settings, revive liked-songs sync"). Do not drop
> any of it.

The chain, end to end:

| Step | Where |
|---|---|
| "Sync Liked Songs" button — pressed once per user | `frontend/src/pages/SettingsPage.jsx` |
| `POST /spotify/sync-liked` | `backend/app/api/spotify_library.py` |
| Sets `liked_tracks_sync_enabled`, `liked_tracks_backfill_offset = 0` | `backend/app/services/scrobble_settings_service.py` |
| Worker job, every `WORKER_LIKED_TRACKS_INTERVAL_MINUTES` (30) | `worker/app.py` |
| Walks the library one 40-track page per tick, then daily | `worker/spotify_ingestion.py` |
| Hearts rendered from `is_liked` | `frontend/src/components/LikedHeart.jsx` |

Actively written and read: the `liked_tracks` table, and the
`liked_tracks_*` columns on `user_scrobble_settings`.

Genuinely unused: `user_preferences.liked_tracks_view` (migration
`0009_add_user_preferences.py`) — a view-mode preference for the removed
Liked Tracks library tab, which was not revived.

### Reading sync state

```bash
docker exec audio-scrobbler-app-db-1 psql -U scrobbler -d scrobbler -P pager=off \
  -c 'select user_id, liked_tracks_sync_enabled, liked_tracks_backfill_offset,
             liked_tracks_watermark, liked_tracks_last_synced_at
      from user_scrobble_settings order by user_id;'
```

- `backfill_offset` non-null → the initial walk is still running; it should advance by 40 each tick.
- `backfill_offset` NULL + a recent `last_synced_at` → healthy steady state.

**Do not read health from the worker metrics alone.** In steady state
`sync_liked_tracks_for_user` returns early if `last_synced_at` is under 24h
old, so `audio_scrobbler_worker_liked_tracks_sync_events` is 0 on nearly every
tick. `users: 1, events: 0, failures: 0` is what *success* looks like here,
not a stall. The worker also never calls `logging.basicConfig()`, so its
`logger.info` lines never reach the logs — absence of liked-tracks log lines
means nothing either way.

---

## Check backup health

```bash
# When did the last verified backup and offsite upload happen?
cat /srv/audio-scrobbler-app/monitoring/backup.prom
cat /srv/audio-scrobbler-app/monitoring/backup_offsite.prom

# Timer state and last result
systemctl --user list-timers audio-scrobbler-backup.timer
systemctl --user status audio-scrobbler-backup.service

# Run one now
systemctl --user start audio-scrobbler-backup.service
```

Those `.prom` files are read by node-exporter's textfile collector and drive
the `AudioScrobblerBackupStale` / `AudioScrobblerBackupNeverRan` alerts. They
are runtime state, deliberately **not** in git — a committed copy would pin a
fake "verified" timestamp and defeat the `absent()` alert.

**Lingering matters.** The timer is a *user* unit, so it stops running when the
account has no session unless lingering is enabled:

```bash
loginctl show-user "$USER" --property=Linger   # expect Linger=yes
```

---

## Check monitoring

Prometheus and Alertmanager publish no host ports — reach them from inside
their containers. (On this NUC, host `:9090` is Cockpit, so curling
`localhost:9090` checks the wrong service entirely.)

```bash
cd /srv/audio-scrobbler-app

# Are all scrape targets up?
docker compose -f docker-compose.prod.yml --env-file .env.production exec -T prometheus \
  wget -qO- http://localhost:9090/api/v1/targets | jq -r '.data.activeTargets[] | "\(.labels.job) \(.health)"'

# Anything currently firing?
docker compose -f docker-compose.prod.yml --env-file .env.production exec -T alertmanager \
  wget -qO- http://localhost:9093/api/v2/alerts | jq -r '.[] | .labels.alertname'
```

If alerts fire but nothing reaches you, check that
`ALERTMANAGER_CRITICAL_WEBHOOK_URL` in `.env.production` is not still the
`127.0.0.1:65535/disabled` placeholder.

---

## Deploy, and roll back

Merging to `main` deploys: CI publishes `:latest` to GHCR and Watchtower picks
it up within `WATCHTOWER_POLL_INTERVAL` (300s). See README for the full model.

```bash
# What is actually running right now?
curl -s http://localhost:8010/readyz
docker ps --format '{{.Names}}\t{{.Image}}' | grep audio-scrobbler

# Is Watchtower doing anything?
docker logs --tail 20 audio-scrobbler-app-watchtower-1
```

To pin a known-good build (rollback):

```bash
cd /srv/audio-scrobbler-app
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=sha-<short>/' .env.production
docker compose -f docker-compose.prod.yml --env-file .env.production pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

Set `IMAGE_TAG` back to `latest` afterwards, or Watchtower stays inert and
future merges will silently stop deploying.

---

## Adding someone to the app

Account creation is gated by `ALLOWED_SPOTIFY_USER_IDS` in `.env.production` —
completing Spotify OAuth is not enough, because the frontend is reachable from
the public internet via Tailscale Funnel.

```bash
cd /srv/audio-scrobbler-app
# append their Spotify user ID to the comma-separated list, then:
docker compose -f docker-compose.prod.yml --env-file .env.production up -d backend
```

To find the ID of someone who was just rejected, check the backend logs around
their attempt, or ask them for their Spotify username.
