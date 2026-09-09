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

## CI

GitHub Actions runs backend and worker tests, clean PostgreSQL migrations, frontend tests and builds, and Docker Compose validation on pushes to `main` and pull requests.

## Listening Ingestion

Authenticated clients can submit listening events to `POST /ingestion/events`.
The backend validates event fields and deduplicates repeated events per user, track, and playback timestamp.
The worker's development fixture is disabled by default and can be enabled explicitly with `WORKER_FIXTURE_ENABLED=true`.

To stop the stack:

```bash
docker compose down
```
