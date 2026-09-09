# Audio Scrobbler App

## Local Stack

Start the PostgreSQL database, FastAPI backend, ingestion worker, and React frontend with:

```bash
docker compose up --build
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

## Production Images

Copy `.env.example` to a deployment-only environment file, replace every placeholder secret, and set `IMAGE_TAG` to an immutable commit-SHA tag. Pull and start the GHCR images with:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

To roll back, change `IMAGE_TAG` to a previously published SHA and run the same commands. Database migrations run during backend startup; application image rollback does not roll back database migrations.
The deployment workflow verifies backend, worker, and frontend health and attempts an application-image rollback if startup or readiness fails. It never removes the PostgreSQL volume.
Before deployment, the workflow creates and restore-verifies a compressed PostgreSQL backup under the host deployment directory. Backups are retained for `BACKUP_RETENTION_DAYS` (14 days by default).

Manual backup and verification from the production host:

```bash
ENV_FILE=.env.production COMPOSE_FILE=docker-compose.prod.yml scripts/backup_database.sh
ENV_FILE=.env.production COMPOSE_FILE=docker-compose.prod.yml scripts/verify_database_backup.sh backups/scrobbler-<timestamp>.dump
```

Production deployment is manually triggered through the GitHub Actions `Deploy production` workflow. Configure the protected `production` environment with `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PATH`, `DEPLOY_SSH_KEY`, `GHCR_USERNAME`, and `GHCR_TOKEN`. Keep `.env.production` only on the deployment host.

The `Verify production backup` workflow runs daily at `02:17 UTC` and can also be started manually. It creates and restore-verifies a backup on the deployment host without uploading database contents to GitHub.

Production Compose includes an internal Prometheus service scraping backend and worker metrics with 14-day retention by default. It is not published directly to the host; access it through an internal network or an authenticated operator tunnel.
Prometheus also tracks the last verified database backup through a host-local textfile metric and alerts when verification is stale for more than 48 hours.
Production Compose includes an internal Alertmanager with severity-based routing. Configure the critical and warning webhook URLs through the deployment environment; the documented defaults intentionally disable delivery.
CI validates Prometheus and Alertmanager configuration semantics with the pinned monitoring images before changes can merge.
CI builds local application images to start the production monitoring Compose stack with inert placeholder secrets, verifies Prometheus targets and Alertmanager readiness, and tears the stack down afterward.

## Listening Ingestion

Authenticated clients can submit listening events to `POST /ingestion/events`.
The backend validates event fields and deduplicates repeated events per user, track, and playback timestamp.
The unified import endpoint is `POST /import/scrobbles` and accepts a `source` of `spotify` or `youtube` together with an array of raw history entries. The API normalizes each item through the canonical importer layer and preserves source-aware dedupe by `(user_id, source, play_id)`.
The frontend supports importing a local JSON export by choosing a Spotify or YouTube history file from the dashboard.
The worker can also import history files unattended: enable `WORKER_FILE_IMPORT_ENABLED=true`, mount a host directory at `WORKER_IMPORT_DIR` (default `/data/imports`), and drop files named `user-<id>-<source>.json` (for example `user-1-spotify.json`). The worker submits each file's entries through a worker-token-authenticated `POST /import/internal/scrobbles` endpoint on its configured interval (`WORKER_FILE_IMPORT_INTERVAL_MINUTES`, default 10) and moves processed files into a `processed/` subfolder or failed files into a `failed/` subfolder. This is disabled by default.
The worker's development fixture is disabled by default and can be enabled explicitly with `WORKER_FIXTURE_ENABLED=true`.

To stop the stack:

```bash
docker compose down
```
