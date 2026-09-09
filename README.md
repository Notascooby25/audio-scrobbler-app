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

To stop the stack:

```bash
docker compose down
```
