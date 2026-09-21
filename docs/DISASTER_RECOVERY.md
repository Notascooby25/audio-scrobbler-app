# Disaster Recovery

[RUNBOOK.md](RUNBOOK.md) answers *"something is wrong with the running system."*
This file answers *"the system is gone, or a rebuild is on the table."*

Written to be followed under stress, on a machine that may not be the NUC.

---

## Before you need any of this

Four things must exist **off the NUC**, or the procedures below cannot be
completed. Check them now, not during an incident.

| Thing | Where it should live | Why |
|---|---|---|
| `rclone.conf` (the `[gdrive]` **and** `[gdrive-crypt]` blocks) | Password manager | Offsite dumps are encrypted. Without the crypt `password` **and** `password2`, they are noise. It lives in `~/.config/rclone/`, outside `/srv`, so the NAS mirror does **not** carry it. |
| `.env.production` | Password manager | Holds `REFRESH_TOKEN_KEY`, without which every stored Spotify token is undecryptable (see [Scenario 7](#scenario-7-secret-rotation)). The NAS mirror holds a convenience copy; do not rely on it. |
| NAS login details (host, user, SSH port, share path) | Password manager | The NAS holds the only *unencrypted* off-host copy, and the fastest restore. They are in `~/.config/nas-sync.env` on the NUC (also in the daily host-config snapshot), but the SSH key that reaches the NAS dies with the NUC — a rebuilt host needs a new key authorised in DSM by an admin. |
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

### Prove every copy actually restores

The 6-hourly timer restore-verifies the dump it has just made. That says nothing
about the *other* copies, so drill each one (quarterly, and after any rclone,
NAS or credential change):

```bash
cd /srv/audio-scrobbler-app
scripts/restore_drill.sh local      # newest dump in backups/
scripts/restore_drill.sh nas        # newest dump the NAS mirror holds
scripts/restore_drill.sh gdrive     # newest dump in the encrypted Drive folder
```

Each pulls the newest dump into a temp directory, restores it into a throwaway
database (never the live one) and prints `DRILL PASSED`. It fails if the copy is
older than 8 hours — a restorable but stale copy means that copy is not being kept
up to date — and the `gdrive` drill refuses to run against a non-crypt remote. A
drill never updates `monitoring/backup.prom`, so it cannot mask a broken timer.

---

## Where the copies are

| Copy | Location | Holds | Encrypted |
|---|---|---|---|
| NUC local | `/srv/audio-scrobbler-app/backups/` | Last 3 days of dumps (6-hourly) | No |
| Synology NAS | `<NAS_TARGET>/audio-scrobbler-app/` — the **whole app folder** (dumps, `docker-compose.prod.yml`, `.env.production`, `scripts/`, `monitoring/`) | Mirror every 6h. Dumps deleted from the NUC are kept for 30 days under `<NAS_TARGET>/_versions/<UTC time>/audio-scrobbler-app/backups/` | No (owner-only folder) |
| Google Drive | `gdrive-crypt:AudioScrobblerBackups/` | Last 30 days of dumps | Yes |

The NAS mirror is **not owned by this repo.** It is `scripts/push_srv_to_synology.sh`
in the *sleepwell* repo (cron `30 */6 * * *`, config in `~/.config/nas-sync.env`),
and it mirrors all of `/srv` for every app. Two consequences:

- Do not edit that job from here; change it in the sleepwell repo.
- A broken or wiped `/srv/sleepwell` checkout silently stops this app's NAS copy
  too. The NAS job has its own dead-man's-switch ping (`NAS_HEALTHCHECK_URL`) for
  exactly that reason — see [RUNBOOK.md](RUNBOOK.md#check-backup-health).

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

**Fastest route if the NAS is reachable:** the NAS holds this whole folder, so
one command brings back the compose file, `scripts/`, `monitoring/`,
`.env.production` *and* recent dumps (it needs an SSH key authorised on the NAS —
see [Before you need any of this](#before-you-need-any-of-this)):

```bash
rsync -a -e "ssh -i ~/.ssh/<nas-key> -p <nas-port>" \
  <nas-user>@<nas-host>:<NAS_TARGET>/audio-scrobbler-app/ /srv/audio-scrobbler-app/
```

Then skip to [step 5](#5-start-the-database-only) — but still confirm
`.env.production` is right, and still do [step 8](#8-reinstall-the-backup-timer).

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
2026-09-20 encryption fix — look in `gdrive:AudioScrobblerBackups/` instead
(as of 2026-09-21 no plaintext `AudioScrobblerBackups` folder remains on Drive,
so offsite history effectively starts 2026-09-20).

If `gdrive:` needs re-authorising, `rclone config reconnect gdrive:` opens a
browser flow. The crypt remote wraps it, so `gdrive:` must work first.

**Or pull a dump from the NAS** (no rclone credentials needed, only the NAS
key). The newest few days are in `audio-scrobbler-app/backups/`; older dumps
that were removed from the NUC are under `_versions/`:

```bash
mkdir -p backups
rsync -t -e "ssh -i ~/.ssh/<nas-key> -p <nas-port>" \
  <nas-user>@<nas-host>:<NAS_TARGET>/audio-scrobbler-app/backups/scrobbler-<newest>.dump backups/

# an older dump that has since rotated off the NUC:
ssh -i ~/.ssh/<nas-key> -p <nas-port> <nas-user>@<nas-host> \
  "find <NAS_TARGET>/_versions -path '*audio-scrobbler-app/backups*' -name 'scrobbler-*.dump'"
```

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

The **NAS mirror** is not part of this repo and does not come back on its own.
Until it is reinstalled from the sleepwell repo (`scripts/setup_offsite_backup_cron.sh`,
plus a recreated `~/.config/nas-sync.env` and a new SSH key authorised on the NAS)
this app has no NAS copy. Then run `scripts/restore_drill.sh nas` to prove it.

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
dump from `backups/` if one survives — no need to pull from offsite. If none does,
take the newest from the NAS or Google Drive as in
[Scenario 1 step 4](#4-restore-rclone-and-pull-a-dump).

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
- **The NAS copies — these are not encrypted, so losing the crypt credentials does
  not touch them:** the last ~3 days in `audio-scrobbler-app/backups/` plus 30
  days of rotated-out dumps under `_versions/`. This is the real safety net here.
- The live database, if it is intact

Act immediately:

1. Copy the current `rclone.conf` somewhere safe **now**, if the NUC is alive.
2. If it is not, treat the Google copies as lost, recover from the NAS or local
   dumps, and set up a new crypt remote with credentials stored off-host from the
   start.

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

The app is reached from outside the LAN via **Tailscale Funnel**. The NUC serves
two apps through it, on different ports — this app must not disturb the other:

| Public URL | Proxies to | App |
|---|---|---|
| `https://nuc-server.<tailnet>.ts.net` (port 443) | `http://127.0.0.1:8510` | sleepwell — **leave alone** |
| `https://nuc-server.<tailnet>.ts.net:8443` | `http://127.0.0.1:5173` | this app (the frontend nginx, which proxies `/auth`, `/api` to the backend) |

Re-create this app's mapping (port 443 is already taken by sleepwell, hence 8443):

```bash
sudo tailscale funnel --bg --https=8443 5173
tailscale funnel status          # confirm BOTH mappings are present
```

The live config is also captured daily by `scripts/backup_host_config.sh` in the
sleepwell repo (`tailscale/funnel-status.txt` inside the newest
`host_config_*.tar.gz`, in `/srv/shared/backups/host-config/` and on the NAS).

`FRONTEND_AUTH_CALLBACK_URL`, `CORS_ORIGINS` and `SPOTIFY_REDIRECT_URI` all encode
the public hostname — all three need updating if it changes, and
`SPOTIFY_REDIRECT_URI` must also be re-registered with Spotify.

To confirm the app is healthy while access is broken, test from the host:

```bash
curl -s http://localhost:8010/readyz
curl -s http://localhost:5173/ -o /dev/null -w '%{http_code}\n'
```

Both healthy means the problem is the tunnel, not the app.

---

## What this document does not yet cover

- **A rehearsed full host rebuild.** The database restore is exercised every 6
  hours by `verify_database_backup.sh`, and each copy can be drilled with
  `scripts/restore_drill.sh`. The *full host rebuild* in Scenario 1 has never been
  performed end to end — it needs a spare machine (on the dev machine it risks the
  dev `postgres_data` volume). Until it has, treat its step ordering as reasoned
  rather than proven.
- **Restoring the other apps.** This file covers Audio Scrobbler only. Sleepwell
  and the expense tracker are in the sleepwell repo's `docs/nuc-backup-overview.md`.
