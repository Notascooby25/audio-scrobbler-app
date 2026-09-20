# Disaster Recovery

[RUNBOOK.md](RUNBOOK.md) answers *"something is wrong with the running system."*
This file answers *"the system is gone, or a rebuild is on the table."*

Written to be followed under stress, on a machine that may not be the NUC.

---

## Before you need any of this

Three things must exist **off the NUC**, or the procedures below cannot be
completed. Check them now, not during an incident.

| Thing | Where it should live | Why |
|---|---|---|
| `rclone.conf` (the `[gdrive-crypt]` block) | Password manager | Offsite dumps are encrypted. Without the crypt `password` **and** `password2`, they are noise. |
| `.env.production` | Password manager | Holds `REFRESH_TOKEN_KEY`, without which every stored Spotify token is undecryptable (see [Scenario 7](#scenario-7-secret-rotation)). |
| Spotify app credentials | developer.spotify.com | `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` and the registered redirect URI. |

A passphrase alone is **not** enough for rclone — recreating a crypt remote
needs `password`, `password2`, `remote`, `filename_encryption` and
`directory_name_encryption` to all match. Store the config block, not the
password.

**Verify the offsite copy is actually recoverable** (do this quarterly, and
after any rclone change):

```bash
rclone config create crypt-test crypt \
  remote=gdrive:encrypted-nuc-backups \
  password='<from password manager>' \
  password2='<from password manager>' \
  --obscure

rclone lsl crypt-test:AudioScrobblerBackups/ | tail -3
rclone cat --count 5 crypt-test:AudioScrobblerBackups/<newest>.dump   # expect: PGDMP
rclone config delete crypt-test
```

`PGDMP` means the dump decrypted and is a valid PostgreSQL custom-format
archive. Anything else means your stored credentials are wrong — fix that
while the NUC is still alive.

---

## Scenario index

| # | Situation | Severity |
|---|---|---|
| [1](#scenario-1-total-host-loss) | NUC is dead or unrecoverable | Rebuild from nothing |
| [2](#scenario-2-postgres-volume-lost-host-fine) | Database volume lost, host OK | Restore only |
| [3](#scenario-3-a-migration-broke-production) | A migration broke production | Rollback is not enough |
| [4](#scenario-4-spotify-quota-block) | Spotify returning 429 / sync stopped | Wait it out |
| [5](#scenario-5-disk-full) | Disk full on the NUC | Usually unallocated space |
| [6](#scenario-6-lost-rclone-crypt-credentials) | Lost the crypt credentials | Offsite copies unreadable |
| [7](#scenario-7-secret-rotation) | Rotating secrets | `REFRESH_TOKEN_KEY` is a trap |
| [8](#scenario-8-app-unreachable-from-outside) | App unreachable externally | Undocumented — see section |

---

## Scenario 1: Total host loss

The NUC is dead, stolen, or its disk is gone. You have offsite dumps in Google
Drive and the credentials listed above.

Expected data loss: **up to 6 hours** (the backup interval).

### 1. Provision the host

Any Linux box with Docker. The original was Fedora on an Intel NUC; nothing
here depends on that. Install `docker`, `docker compose`, `rclone`, `curl`.

Give `/` more than 16 GB. If installing Fedora with LVM defaults, see
[Scenario 5](#scenario-5-disk-full) — the installer leaves most of the disk
unallocated, which is a slow-motion outage.

### 2. Restore the app directory

`/srv/audio-scrobbler-app` is a **file-drop directory, not a git checkout**.
Recreate it from the repo:

```bash
sudo mkdir -p /srv/audio-scrobbler-app
sudo chown "$USER" /srv/audio-scrobbler-app
cd /srv/audio-scrobbler-app

git clone https://github.com/Notascooby25/audio-scrobbler-app /tmp/asa
cp -r /tmp/asa/docker-compose.prod.yml /tmp/asa/monitoring /tmp/asa/scripts .
```

Only those three are needed on the host — images come from GHCR.

### 3. Restore `.env.production`

From your password manager. If it is lost, rebuild it — these are **required**
or the stack will not start (derived from `docker-compose.prod.yml`):

```
POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD
JWT_SECRET, REFRESH_TOKEN_KEY, WORKER_INGESTION_TOKEN
SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REDIRECT_URI
FRONTEND_AUTH_CALLBACK_URL, CORS_ORIGINS
GHCR_OWNER, IMAGE_TAG, DOCKER_CONFIG_DIR
```

`DOCKER_CONFIG_DIR` has no safe default and fails loudly at `compose config`
time — set it to the directory holding your GHCR login, e.g. `/home/andy/.docker`.

Also set, though they have defaults:

```
BACKEND_HOST_PORT=8010          # 8000 collides on a shared host
WORKER_SPOTIFY_ENABLED=true     # otherwise nothing ingests
ALLOWED_SPOTIFY_USER_IDS=...    # the signup gate — see step 9
ALERTMANAGER_CRITICAL_WEBHOOK_URL=...
GDRIVE_REMOTE_NAME=gdrive-crypt # used by scripts/, not compose
GDRIVE_RETENTION_DAYS=30
BACKUP_RETENTION_DAYS=3
```

> **`REFRESH_TOKEN_KEY` must be the original value.** It is SHA-256'd into a
> Fernet key that decrypts `users.refresh_token_cipher` in the dump you are
> about to restore. A new value restores cleanly and then fails to decrypt a
> single Spotify token — every user must reconnect, and the failure is silent.

Generate replacements **only** for a from-scratch install with no dump to
restore:

```bash
python3 -c "import secrets; print('JWT_SECRET=' + secrets.token_hex(32)); print('REFRESH_TOKEN_KEY=' + secrets.token_hex(16)); print('WORKER_INGESTION_TOKEN=' + secrets.token_hex(32))"
```

### 4. Restore rclone and pull a dump

```bash
mkdir -p ~/.config/rclone
# paste the saved [gdrive] and [gdrive-crypt] blocks into:
nano ~/.config/rclone/rclone.conf

rclone lsl gdrive-crypt:AudioScrobblerBackups/ | tail -5
mkdir -p backups
rclone copy gdrive-crypt:AudioScrobblerBackups/scrobbler-<newest>.dump backups/
```

If `gdrive-crypt:AudioScrobblerBackups/` is empty, the dump may predate the
2026-09-20 encryption fix — look in `gdrive:AudioScrobblerBackups/` instead.

If `gdrive:` needs re-authorising, `rclone config reconnect gdrive:` opens a
browser flow. The crypt remote wraps it, so `gdrive:` must work first.

### 5. Start the database only

```bash
docker login ghcr.io          # needed before anything pulls
docker compose -f docker-compose.prod.yml --env-file .env.production up -d db
```

Wait for healthy: `docker ps | grep db`.

### 6. Restore the dump

```bash
POSTGRES_USER="$(grep '^POSTGRES_USER=' .env.production | cut -d= -f2)"
POSTGRES_DB="$(grep '^POSTGRES_DB=' .env.production | cut -d= -f2)"

docker compose -f docker-compose.prod.yml --env-file .env.production exec -T db \
  createdb -U "$POSTGRES_USER" "$POSTGRES_DB" 2>/dev/null || true

cat backups/scrobbler-<newest>.dump | \
  docker compose -f docker-compose.prod.yml --env-file .env.production exec -T db \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    --clean --if-exists --no-owner --no-privileges --exit-on-error
```

Dumps are `pg_dump -Fc` (custom format). **`psql < dump` will not work** — use
`pg_restore`. If it aborts partway, re-run the same command rather than
starting the app.

### 7. Bring up the rest

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
curl -s http://localhost:8010/readyz
```

The backend runs `alembic upgrade head` at startup, so a dump from an older
schema is migrated forward automatically.

### 8. Reinstall the backup timer

Easy to forget, and the system is unprotected until it is done:

```bash
cp scripts/systemd/audio-scrobbler-backup.env.example scripts/systemd/audio-scrobbler-backup.env
nano scripts/systemd/audio-scrobbler-backup.env     # set HEARTBEAT_URL
scripts/systemd/install.sh
sudo loginctl enable-linger "$USER"
loginctl show-user "$USER" --property=Linger        # expect Linger=yes
```

**Lingering is not optional.** The timer is a *user* unit — without it, backups
stop the moment your SSH session ends and nothing reports the silence.

Force one cycle and confirm it reaches offsite:

```bash
systemctl --user start audio-scrobbler-backup.service
rclone lsl gdrive-crypt:AudioScrobblerBackups/ | tail -2
```

### 9. Restore external access

- **Spotify redirect URI** — `SPOTIFY_REDIRECT_URI` must match a URI registered
  in the Spotify developer dashboard exactly. A new hostname means registering
  it there too, or OAuth fails with an opaque error.
- **Public access** — see [Scenario 8](#scenario-8-app-unreachable-from-outside).
- **Signup gate** — `ALLOWED_SPOTIFY_USER_IDS` is the only thing preventing
  strangers creating accounts once the app is publicly reachable. Completing
  Spotify OAuth is not a vetting step. Confirm it is populated before exposing
  the app.

### 10. Verify

```bash
curl -s http://localhost:8010/readyz
curl -s http://localhost:5173/worker-health
docker exec audio-scrobbler-app-db-1 psql -U scrobbler -d scrobbler -tAc \
  'select count(*) from users; select count(*) from listening_events;'
systemctl --user list-timers audio-scrobbler-backup.timer
```

Then sign in from a phone and confirm a new scrobble appears within ~5 minutes.

---

## Scenario 2: Postgres volume lost, host fine

Someone ran `docker compose down -v`, or the volume is corrupt.

```bash
cd /srv/audio-scrobbler-app
docker compose -f docker-compose.prod.yml --env-file .env.production stop backend worker
```

Then follow [Scenario 1 steps 5–7](#5-start-the-database-only), using a local
dump from `backups/` if one survives — no need to pull from offsite.

Verify the dump *before* relying on it:

```bash
ENV_FILE=.env.production COMPOSE_FILE=docker-compose.prod.yml \
  scripts/verify_database_backup.sh backups/scrobbler-<timestamp>.dump
```

This restores into a throwaway database and fails if the row count is below
`BACKUP_MIN_RESTORED_FRACTION` of live. It does not touch production.

---

## Scenario 3: A migration broke production

Rolling the image back does **not** roll back migrations. The old image then
meets a newer schema, which usually fails differently.

Options, in order of preference:

1. **Roll forward.** Write a corrective migration, merge, let Watchtower deploy.
   Safest when the schema change is additive.
2. **Restore the pre-migration dump.** Backups run 6-hourly, so a dump from
   before the deploy usually exists. Follow [Scenario 2](#scenario-2-postgres-volume-lost-host-fine),
   then pin `IMAGE_TAG=sha-<pre-migration>` so Watchtower does not immediately
   re-apply the bad migration.

   ```bash
   sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=sha-<short>/' .env.production
   docker compose -f docker-compose.prod.yml --env-file .env.production up -d
   ```

   **Set `IMAGE_TAG` back to `latest` afterwards** or Watchtower stays inert and
   future merges silently stop deploying.
3. **Hand-edit the schema.** Last resort. Record what you did — the next
   `alembic upgrade head` will not know about it.

Check what the database thinks it is on:

```bash
docker exec audio-scrobbler-app-db-1 psql -U scrobbler -d scrobbler -tAc \
  'select version_num from alembic_version;'
```

---

## Scenario 4: Spotify quota block

Symptoms: scrobbles stop; `audio_scrobbler_worker_spotify_rate_limited` is 1;
worker logs show `Skipping ... quota rate-limited until <time>`.

```bash
curl -s http://localhost:5173/worker-health   # spotify_rate_limited_until
docker logs --tail 50 audio-scrobbler-app-worker-1 | grep -i 'rate\|429'
```

**There is nothing to fix.** The worker backs off for the duration Spotify
returns and resumes on its own. Do not restart the worker to "clear" it — the
block is held in an in-process global, so a restart *forgets* it and resumes
hammering the API, which is how a short block becomes a long one.

Watchtower restarts on deploy have the same effect. If a block is active,
avoid merging to `main` until it clears.

Reduce the chance of recurrence by raising per-user `poll_interval_minutes` in
Settings rather than lowering `WORKER_SPOTIFY_INTERVAL_MINUTES`.

---

## Scenario 5: Disk full

Check whether it is genuinely full or merely unallocated:

```bash
df -hT /
sudo vgs                      # look at VFree
docker system df              # look at RECLAIMABLE
```

**If `VFree` is non-zero**, the disk is not full — the filesystem was never
grown into it. A default Fedora LVM install can leave most of the disk
unallocated (this happened here: a 16 GB root on a 120 GB SSD).

```bash
sudo lvextend -L +80G -r /dev/fedora/root    # or -l +100%FREE for all of it
df -hT /
```

`-r` grows the XFS filesystem in the same step. XFS grows online with no
downtime — but **cannot shrink**, so leaving some VG free space keeps options
open.

**If the VG is genuinely full**, reclaim from Docker:

```bash
docker system prune -a          # add --volumes only after checking what they hold
```

On a shared host, check `docker volume ls` first — other apps' volumes live in
the same daemon.

---

## Scenario 6: Lost rclone crypt credentials

If `rclone.conf` is gone and the passphrase is not stored anywhere, **the
offsite dumps are unrecoverable.** There is no recovery path; the encryption is
doing exactly what it was asked to.

What you still have:
- Local dumps in `/srv/audio-scrobbler-app/backups/` (3 days), if the host lives
- The live database, if it is intact

Act immediately:

1. Copy the current `rclone.conf` somewhere safe **now**, if the NUC is alive.
2. If it is not, treat the offsite copies as lost, recover from local dumps, and
   set up a new crypt remote with credentials stored off-host from the start.

Prevention is the whole story here — see
[Before you need any of this](#before-you-need-any-of-this).

---

## Scenario 7: Secret rotation

| Secret | Effect of rotating | Safe? |
|---|---|---|
| `POSTGRES_PASSWORD` | Must change in the DB and the env file together | Careful |
| `JWT_SECRET` | All sessions invalidated; users sign in again | Safe |
| `WORKER_INGESTION_TOKEN` | Change in the same file both services read | Safe |
| **`REFRESH_TOKEN_KEY`** | **Every stored Spotify token becomes undecryptable** | **Destructive** |

`REFRESH_TOKEN_KEY` is SHA-256'd into a Fernet key that encrypts
`users.refresh_token_cipher`. Change it and every user must reconnect Spotify —
and nothing announces this. All three sync paths in
`worker/spotify_ingestion.py` (recently-played, currently-playing and
liked-tracks) catch `InvalidToken` and return early without logging, so
ingestion stops per user in complete silence. The metrics show zero failures,
because from the worker's point of view nothing failed.

If you must rotate it, tell users first and expect every account to need
reconnecting. There is no re-encryption path in the codebase.

After rotating `JWT_SECRET` or `WORKER_INGESTION_TOKEN`:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d backend worker
```

---

## Scenario 8: App unreachable from outside

The app is reached from outside the LAN via **Tailscale Funnel**. That setup is
referenced in [RUNBOOK.md](RUNBOOK.md) and [README.md](../README.md) but the
configuration itself **is not recorded anywhere in this repository** — not the
Funnel config, the hostname, nor which port it fronts.

> **Known gap.** Someone rebuilding from this document cannot restore external
> access from the repo alone. Capture the working `tailscale funnel status`
> output and the serve config, then replace this section.

What is known:
- The frontend nginx container listens on **5173** and proxies API paths to
  `backend:8000` ([frontend/nginx.conf](../frontend/nginx.conf)).
- The backend is published on the host at `BACKEND_HOST_PORT` (8010 here).
- `FRONTEND_AUTH_CALLBACK_URL`, `CORS_ORIGINS` and `SPOTIFY_REDIRECT_URI` all
  encode the public hostname — all three need updating if it changes, and
  `SPOTIFY_REDIRECT_URI` must also be re-registered with Spotify.

To confirm the app is healthy while access is broken, test from the host:

```bash
curl -s http://localhost:8010/readyz
curl -s http://localhost:5173/ -o /dev/null -w '%{http_code}\n'
```

Both healthy means the problem is the tunnel, not the app.

---

## What this document does not yet cover

- **NAS backups.** A third backup destination is planned but not built. When it
  exists, this file needs a restore-from-NAS path in
  [Scenario 1 step 4](#4-restore-rclone-and-pull-a-dump) and
  [Scenario 2](#scenario-2-postgres-volume-lost-host-fine), and the
  "Before you need any of this" table needs whatever credentials it requires.
- **Tailscale Funnel** — see [Scenario 8](#scenario-8-app-unreachable-from-outside).
- **A rehearsed full restore.** The database restore in Scenario 2 is exercised
  every 6 hours by `verify_database_backup.sh`. The *full host rebuild* in
  Scenario 1 has never been performed end to end. Until it has, treat its step
  ordering as reasoned rather than proven.
