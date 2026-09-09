from __future__ import annotations

import os
import logging
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
from fastapi.responses import JSONResponse
import requests
from sqlalchemy import create_engine
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker

from spotify_ingestion import SpotifyClient, UserRecord, sync_user

app = FastAPI(title="Audio Scrobbler Worker")
logger = logging.getLogger("audio-scrobbler-worker")

scheduler = BackgroundScheduler()
backend_url = os.getenv("WORKER_BACKEND_URL", "http://backend:8000")
worker_token = os.getenv("WORKER_INGESTION_TOKEN", "dev-worker-token")
fixture_enabled = os.getenv("WORKER_FIXTURE_ENABLED", "false").lower() == "true"
fixture_user_id = int(os.getenv("WORKER_USER_ID", "1"))
spotify_enabled = os.getenv("WORKER_SPOTIFY_ENABLED", "false").lower() == "true"
database_url = os.getenv("DATABASE_URL", "postgresql+psycopg://scrobbler:scrobbler@db:5432/scrobbler")
spotify_client_id = os.getenv("SPOTIFY_CLIENT_ID", "")
spotify_client_secret = os.getenv("SPOTIFY_CLIENT_SECRET", "")
refresh_token_key = os.getenv("REFRESH_TOKEN_KEY", "0123456789abcdef0123456789abcdef")
spotify_interval_minutes = int(os.getenv("WORKER_SPOTIFY_INTERVAL_MINUTES", "5"))
max_attempts = 3
last_spotify_sync_at: str | None = None
last_spotify_sync_users = 0
last_spotify_sync_failures = 0
last_spotify_sync_events = 0


def build_fixture_event() -> dict[str, object]:
    return {
        "user_id": fixture_user_id,
        "track_id": "development-fixture-track",
        "track_name": "Development Fixture Track",
        "artist_name": "Audio Scrobbler",
        "played_at": datetime(2026, 1, 1, tzinfo=timezone.utc).isoformat(),
        "duration_ms": 180000,
        "source": "development-fixture",
        "payload": {"fixture": True},
    }


def run_fixture_ingestion() -> None:
    if not fixture_enabled:
        return
    for attempt in range(1, max_attempts + 1):
        try:
            response = requests.post(
                f"{backend_url}/ingestion/internal/events",
                json=build_fixture_event(),
                headers={"X-Worker-Token": worker_token},
                timeout=10,
            )
            if response.status_code >= 500 and attempt < max_attempts:
                logger.warning("Backend returned %s on fixture attempt %s", response.status_code, attempt)
                continue
            response.raise_for_status()
            logger.info("Fixture ingestion completed with response %s", response.status_code)
            return
        except requests.RequestException:
            logger.exception("Fixture ingestion attempt %s failed", attempt)
            if attempt == max_attempts:
                raise


def run_spotify_ingestion() -> None:
    global last_spotify_sync_at, last_spotify_sync_users, last_spotify_sync_failures, last_spotify_sync_events
    if not spotify_enabled or not spotify_client_id or not spotify_client_secret:
        return
    engine = create_engine(database_url, pool_pre_ping=True)
    session = sessionmaker(bind=engine)()
    client = SpotifyClient(spotify_client_id, spotify_client_secret, refresh_token_key)
    try:
        users = session.query(UserRecord).filter(UserRecord.is_active.is_(True)).all()
        failures = 0
        events = 0
        for user in users:
            try:
                count = sync_user(session, user, client, backend_url, worker_token)
                events += count
                logger.info("Spotify sync completed for user %s: %s events", user.id, count)
            except Exception:
                session.rollback()
                failures += 1
                logger.exception("Spotify sync failed for user %s", user.id)
        last_spotify_sync_at = datetime.now(timezone.utc).isoformat()
        last_spotify_sync_users = len(users)
        last_spotify_sync_failures = failures
        last_spotify_sync_events = events
    finally:
        session.close()
        engine.dispose()


@app.get("/health")
def health_check() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "worker",
        "scheduler_running": str(scheduler.running).lower(),
        "fixture_enabled": str(fixture_enabled).lower(),
        "spotify_enabled": str(spotify_enabled).lower(),
        "last_spotify_sync_at": last_spotify_sync_at or "never",
        "last_spotify_sync_users": str(last_spotify_sync_users),
        "last_spotify_sync_failures": str(last_spotify_sync_failures),
        "last_spotify_sync_events": str(last_spotify_sync_events),
    }


@app.get("/readyz", response_model=None)
def readiness_check() -> dict[str, str] | JSONResponse:
    if not scheduler.running:
        return JSONResponse(status_code=503, content={"status": "not_ready", "detail": "scheduler is not running"})
    if spotify_enabled:
        engine = create_engine(database_url, pool_pre_ping=True)
        try:
            with engine.connect() as connection:
                connection.execute(text("select 1"))
        except Exception:
            return JSONResponse(status_code=503, content={"status": "not_ready", "detail": "database is unavailable"})
        finally:
            engine.dispose()
    return {"status": "ready", "service": "worker"}


@app.on_event("startup")
def start_scheduler() -> None:
    scheduler.start()
    if fixture_enabled:
        scheduler.add_job(run_fixture_ingestion, "interval", minutes=1, id="fixture-ingestion")
    if spotify_enabled:
        scheduler.add_job(run_spotify_ingestion, "interval", minutes=spotify_interval_minutes, id="spotify-ingestion")


@app.on_event("shutdown")
def stop_scheduler() -> None:
    scheduler.shutdown(wait=False)
