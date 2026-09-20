# Audio Scrobbler App

A self-hosted, full-stack application for tracking, analyzing, and sharing your music listening history. It seamlessly imports your "scrobbles" from sources like Spotify and YouTube, offering deep insights into your listening habits while providing social features to follow friends and compare tastes.

For a detailed breakdown of features, architecture, and benefits, please see [OVERVIEW.md](./OVERVIEW.md).

## Local Stack

From the repository root, start the PostgreSQL database, FastAPI backend, ingestion worker, and React frontend in the background with:

```bash
docker compose up -d --build
```

Check that all services are running:

```bash
docker compose ps
```

Open the app at [http://localhost:5173](http://localhost:5173). To follow service logs while developing:

```bash
docker compose logs -f frontend backend worker
```

The services are available at:

- Frontend: http://localhost:5173
- Backend health: http://localhost:8000/health
- Worker: http://localhost:8001

`/health` is a lightweight liveness check. `/readyz` verifies service dependencies and migration readiness; deployment and Compose health checks use readiness.

Compose waits for PostgreSQL and the backend health checks before starting dependent services.

The backend runs `alembic upgrade head` before serving requests. To apply migrations manually:

```bash
cd backend
alembic upgrade head
```

In development, the backend creates an idempotent user with ID `1`, then you can request a bearer token with `POST /auth/dev-token` and `{"user_id": 1}`.
Protected analytics and ingestion requests require that signed token.

Spotify OAuth endpoints are available at `/auth/spotify/authorize` and `/auth/spotify/callback` once Spotify credentials are configured in `.env`.
Real Spotify polling is opt-in with `WORKER_SPOTIFY_ENABLED=true`; it remains disabled in the default Compose development stack.
The worker health endpoint reports the last Spotify sync timestamp, user count, failures, and submitted event count.
Backend responses include an `X-Request-ID` correlation header, and `/health` reports safe ingestion event and duplicate counters.
Backend and worker `/metrics` endpoints expose bounded Prometheus-compatible operational metrics without user IDs or credentials.

## CI

GitHub Actions runs backend and worker tests, clean PostgreSQL migrations, frontend tests and builds, Docker Compose validation, and a full container smoke test on pushes to `main` and pull requests.
Successful pushes to `main` publish backend, worker, and frontend images to GHCR with commit-SHA tags and a `latest` tag.

> For the full merge-to-deploy pipeline, the exact job dependency graph, and a real incident where a broken Alembic migration chain silently blocked publishing with no error visible outside CI, see [docs/CI_CD_PIPELINE.md](docs/CI_CD_PIPELINE.md).

## Production Images

> Operational procedures — restore-from-backup, rollback, backup health, monitoring — live in [docs/RUNBOOK.md](docs/RUNBOOK.md). Rebuilding after total host loss, plus secret rotation, Spotify quota blocks, disk exhaustion and migration failures, are in [docs/DISASTER_RECOVERY.md](docs/DISASTER_RECOVERY.md). The PDF runbooks under `docs/` and `guides/` are outdated and superseded by both.

Copy `.env.example` to a deployment-only environment file and replace every placeholder secret. Keep `.env.production` only on the deployment host.

### How code reaches production

Watchtower, running on the deployment host, polls GHCR every `WATCHTOWER_POLL_INTERVAL` seconds and restarts backend/worker/frontend when a new `:latest` image appears. A successful push to `main` publishes those images, so **merging to `main` is what deploys**. No GitHub-initiated deploy step is involved, and none is needed — the host reaches out, which is what makes this work from behind NAT.

This requires `IMAGE_TAG=latest`. Pinning it to an immutable `sha-<short>` tag makes Watchtower a permanent no-op: it only re-resolves the tag a container was originally started with, and a `sha-` tag's digest never moves.

Watchtower needs the host already logged in via `docker login ghcr.io`, with `DOCKER_CONFIG_DIR` pointing at the docker config directory holding those credentials.

### Manual deploy and rollback

To pin a specific build — a deliberate rollback, or rolling forward past a bad `:latest`:

```bash
# set IMAGE_TAG=sha-<short> in .env.production first
docker compose -f docker-compose.prod.yml --env-file .env.production pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

Note the `sha-` prefix: CI publishes `sha-45c4e2e`, not `45c4e2e`. A bare short SHA fails with `manifest unknown`. Set `IMAGE_TAG` back to `latest` once you're done, or Watchtower stays inert.

Database migrations run during backend startup; rolling an image back does **not** roll back migrations.

The `Deploy production` GitHub Actions workflow is **break-glass only and has never completed a run** — the `production` environment has no secrets set, and GitHub-hosted runners cannot reach a LAN deployment host without an additional Tailscale (or equivalent) step that does not exist here. Treat the commands above as the real procedure.

### Backups

Backups run on the deployment host itself, on a systemd timer, every 6 hours — see `scripts/systemd/` and its `install.sh`. Each run dumps the database, restore-verifies the dump into a scratch database, uploads it offsite via rclone, and pings a heartbeat/dead-man's-switch URL if one is configured.

Local dumps are kept for `BACKUP_RETENTION_DAYS` (3 by default); the offsite copies are pruned separately after `GDRIVE_RETENTION_DAYS` (14 by default).

Manual backup and verification from the production host:

```bash
ENV_FILE=.env.production COMPOSE_FILE=docker-compose.prod.yml scripts/backup_database.sh
ENV_FILE=.env.production COMPOSE_FILE=docker-compose.prod.yml scripts/verify_database_backup.sh backups/scrobbler-<timestamp>.dump
```

Or run the whole cycle exactly as the timer does:

```bash
systemctl --user start audio-scrobbler-backup.service
```

The `Verify production backup` workflow is retained for a future Tailscale-enabled setup, but its schedule is disabled and it has never completed a run, for the same reachability reason as the deploy workflow.

### Monitoring

Production Compose includes an internal Prometheus scraping backend and worker metrics with 14-day retention by default. It is not published to the host; reach it through `docker compose exec` or an authenticated operator tunnel.

Prometheus tracks the last verified backup and the last successful offsite upload through host-local textfile metrics, alerting when either goes stale (12h) or has never been written at all. Alertmanager routes by severity; the defaults in `.env.example` intentionally disable delivery, so set `ALERTMANAGER_CRITICAL_WEBHOOK_URL` to something real or critical alerts go nowhere.

CI validates Prometheus and Alertmanager configuration semantics with the pinned monitoring images, and stands up the full production Compose stack with inert placeholder secrets to verify targets and readiness before any image is published.

## Listening Ingestion

Authenticated clients can submit listening events to `POST /ingestion/events`.
The backend validates event fields and deduplicates repeated events per user, track, and playback timestamp.
The unified import endpoint is `POST /import/scrobbles` and accepts a `source` of `spotify` or `youtube` together with an array of raw history entries. The API normalizes each item through the canonical importer layer and preserves source-aware dedupe by `(user_id, source, play_id)`.
The frontend supports importing a local JSON export by choosing a Spotify or YouTube history file from the dashboard.
The worker can also import history files unattended: enable `WORKER_FILE_IMPORT_ENABLED=true`, mount a host directory at `WORKER_IMPORT_DIR` (default `/data/imports`), and drop files named `user-<id>-<source>.json` (for example `user-1-spotify.json`). The worker submits each file's entries through a worker-token-authenticated `POST /import/internal/scrobbles` endpoint on its configured interval (`WORKER_FILE_IMPORT_INTERVAL_MINUTES`, default 10) and moves processed files into a `processed/` subfolder or failed files into a `failed/` subfolder. This is disabled by default.
The worker's development fixture is disabled by default and can be enabled explicitly with `WORKER_FIXTURE_ENABLED=true`.

## Social Profiles & Charts

Every user gets a public `username` (generated automatically from their Spotify ID or display name, deduplicated on collision).
`GET /users/search?q=`, `POST /users/{id}/follow`, and `DELETE /users/{id}/follow` let signed-in users find and follow each other.
`GET /users/{id}/profile` returns username, display name, follower/following counts, and `is_following`/`is_self` for anyone signed in; the target user's last scrobbled track is only included when the viewer is the owner or an approved follower (`can_view_details`).
`GET /analytics/charts/{id}?entity=artists|tracks|albums&range=7day|1month|12month|overall` returns last.fm-style top charts, gated by the same owner-or-follower rule.
The frontend's `/profile` and `/profile/:userId` routes render follow controls, the gated last-scrobble, and the Spotify connect action; the dashboard (`/`) renders personal charts alongside the monthly summary.

## Progressive Web App

The frontend ships a web app manifest (`frontend/public/manifest.json`) and placeholder icons so it is installable ("Add to Home Screen") while running live against the deployed server.
A minimal service worker (`frontend/public/service-worker.js`) caches the app shell (HTML/CSS/JS/manifest/icons) cache-first and never intercepts API requests (`/analytics`, `/auth`, `/import`, `/users`, `/ingestion`).
Full offline data sync — IndexedDB-backed offline queues, Background Sync API replay, and push notifications — is documented in `docs/PWA_Offline_Behaviour_Specification...pdf` as future work and is not implemented yet.

To stop the stack:

```bash
docker compose down
```

To stop the stack and remove the local PostgreSQL volume as well:

```bash
docker compose down -v
```
