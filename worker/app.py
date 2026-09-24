from __future__ import annotations

import os
genre_cache_interval_minutes = int(os.environ.get("WORKER_GENRE_CACHE_INTERVAL_MINUTES", "5"))
genre_cache_batch_size = int(os.environ.get("WORKER_GENRE_CACHE_BATCH_SIZE", "50"))

import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
from fastapi.responses import JSONResponse, PlainTextResponse
import requests
from sqlalchemy import create_engine
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker

from file_import import process_import_directory
from spotify_ingestion import (
    CheckpointRecord,
    ScrobbleSettingsRecord,
    SpotifyClient,
    UserRecord,
    spotify_rate_limit_blocked_until,
    sync_liked_tracks_for_user,
    sync_user,
)

app = FastAPI(title="Audio Scrobbler Worker")

# Without this, nothing configures the root logger: uvicorn sets up its own
# "uvicorn.*" loggers and leaves the root at WARNING, so every logger.info()
# below was silently dropped. The access log kept appearing, which made the
# worker look far more talkative than it was — sync progress, per-user
# results and rate-limit skips all went nowhere, leaving the metrics endpoint
# as the only signal and a stalled sync indistinguishable from an idle one.
logging.basicConfig(
    level=os.getenv("WORKER_LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
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
lastfm_api_key = os.getenv("LASTFM_API_KEY", "")
# This now means "how often we check who's due," not "the sync cadence" itself —
# each user's actual cadence is their own `poll_interval_minutes` setting, checked
# against ingestion_checkpoints.last_polled_at on every tick.
spotify_interval_minutes = int(os.getenv("WORKER_SPOTIFY_INTERVAL_MINUTES", "1"))
liked_tracks_interval_minutes = int(os.getenv("WORKER_LIKED_TRACKS_INTERVAL_MINUTES", "30"))
# Playlist names are low-priority enrichment, not ingestion, so this defaults to a
# slow cadence and a small per-tick batch — a large backlog is spread across many
# ticks rather than bursting Spotify, the same reasoning as the liked-tracks walk.
file_import_enabled = os.getenv("WORKER_FILE_IMPORT_ENABLED", "false").lower() == "true"
file_import_dir = os.getenv("WORKER_IMPORT_DIR", "/data/imports")
file_import_interval_minutes = int(os.getenv("WORKER_FILE_IMPORT_INTERVAL_MINUTES", "10"))
max_attempts = 3
last_spotify_sync_at: str | None = None
last_spotify_sync_users = 0
last_spotify_sync_failures = 0
last_spotify_sync_events = 0
last_liked_tracks_sync_at: str | None = None
last_liked_tracks_sync_users = 0
last_liked_tracks_sync_failures = 0
last_liked_tracks_sync_events = 0
last_file_import_at: str | None = None
last_file_import_processed = 0
last_file_import_failed = 0

last_genre_cache_sync_at = "never"
last_genre_cache_sync_processed = 0
last_genre_cache_sync_resolved = 0
last_genre_cache_sync_failures = 0



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
    blocked_until = spotify_rate_limit_blocked_until()
    if blocked_until:
        logger.warning("Skipping Spotify sync: quota rate-limited until %s", blocked_until.isoformat())
        return
    engine = create_engine(database_url, pool_pre_ping=True)
    session = sessionmaker(bind=engine)()
    client = SpotifyClient(spotify_client_id, spotify_client_secret, refresh_token_key)
    try:
        users = session.query(UserRecord).filter(UserRecord.is_active.is_(True)).all()
        now = datetime.now(timezone.utc)
        failures = 0
        events = 0
        attempted = 0
        for user in users:
            checkpoint = session.get(CheckpointRecord, user.id)
            settings = session.query(ScrobbleSettingsRecord).filter(ScrobbleSettingsRecord.user_id == user.id).first()
            poll_interval_minutes = settings.poll_interval_minutes if settings else 5
            if checkpoint and checkpoint.last_polled_at:
                last_polled = checkpoint.last_polled_at.replace(tzinfo=timezone.utc)
                if now - last_polled < timedelta(minutes=poll_interval_minutes):
                    continue
            attempted += 1
            try:
                count = sync_user(session, user, client, backend_url, worker_token)
                events += count
                logger.info("Spotify sync completed for user %s: %s events", user.id, count)
            except Exception:
                session.rollback()
                failures += 1
                logger.exception("Spotify sync failed for user %s", user.id)
        last_spotify_sync_at = datetime.now(timezone.utc).isoformat()
        last_spotify_sync_users = attempted
        last_spotify_sync_failures = failures
        last_spotify_sync_events = events
    finally:
        session.close()
        engine.dispose()


def run_currently_playing_sync() -> None:
    if not spotify_enabled or not spotify_client_id or not spotify_client_secret:
        return
    blocked_until = spotify_rate_limit_blocked_until()
    if blocked_until:
        return
    engine = create_engine(database_url, pool_pre_ping=True)
    session = sessionmaker(bind=engine)()
    client = SpotifyClient(spotify_client_id, spotify_client_secret, refresh_token_key)
    try:
        from spotify_ingestion import sync_currently_playing
        enabled_settings = session.query(ScrobbleSettingsRecord).filter(ScrobbleSettingsRecord.realtime_sync_enabled.is_(True)).all()
        user_ids = [record.user_id for record in enabled_settings]
        users_by_id = {
            user.id: user
            for user in session.query(UserRecord).filter(UserRecord.id.in_(user_ids), UserRecord.is_active.is_(True)).all()
        } if user_ids else {}
        for settings in enabled_settings:
            user = users_by_id.get(settings.user_id)
            if user:
                try:
                    sync_currently_playing(session, user, settings, client, backend_url, worker_token)
                    session.commit()
                except Exception:
                    session.rollback()
                    logger.exception("Realtime sync failed for user %s", user.id)
    finally:
        session.close()
        engine.dispose()


def run_liked_tracks_ingestion() -> None:
    global last_liked_tracks_sync_at, last_liked_tracks_sync_users, last_liked_tracks_sync_failures, last_liked_tracks_sync_events
    if not spotify_enabled or not spotify_client_id or not spotify_client_secret:
        return
    blocked_until = spotify_rate_limit_blocked_until()
    if blocked_until:
        logger.warning("Skipping liked-tracks sync: quota rate-limited until %s", blocked_until.isoformat())
        return
    engine = create_engine(database_url, pool_pre_ping=True)
    session = sessionmaker(bind=engine)()
    client = SpotifyClient(spotify_client_id, spotify_client_secret, refresh_token_key)
    try:
        enabled_settings = (
            session.query(ScrobbleSettingsRecord)
            .filter(ScrobbleSettingsRecord.liked_tracks_sync_enabled.is_(True))
            .all()
        )
        user_ids = [record.user_id for record in enabled_settings]
        users_by_id = {
            user.id: user
            for user in session.query(UserRecord).filter(UserRecord.id.in_(user_ids), UserRecord.is_active.is_(True)).all()
        } if user_ids else {}
        failures = 0
        events = 0
        for settings in enabled_settings:
            user = users_by_id.get(settings.user_id)
            if user is None:
                continue
            try:
                count = sync_liked_tracks_for_user(session, user, settings, client, backend_url, worker_token)
                events += count
                logger.info("Liked-tracks sync completed for user %s: %s tracks", user.id, count)
            except Exception:
                session.rollback()
                failures += 1
                logger.exception("Liked-tracks sync failed for user %s", user.id)
        last_liked_tracks_sync_at = datetime.now(timezone.utc).isoformat()
        last_liked_tracks_sync_users = len(enabled_settings)
        last_liked_tracks_sync_failures = failures
        last_liked_tracks_sync_events = events
    finally:
        session.close()
        engine.dispose()





def run_genre_cache_backfill() -> None:
    global last_genre_cache_sync_at, last_genre_cache_sync_processed, last_genre_cache_sync_resolved, last_genre_cache_sync_failures
    if not spotify_enabled or not spotify_client_id or not spotify_client_secret:
        return
    blocked_until = spotify_rate_limit_blocked_until()
    if blocked_until:
        return
    client = SpotifyClient(spotify_client_id, spotify_client_secret, refresh_token_key)
    engine = create_engine(database_url, pool_pre_ping=True)
    session = sessionmaker(bind=engine)()
    try:
        from spotify_ingestion import backfill_artist_genres, UserRecord, decrypt_refresh_token, encrypt_refresh_token, InvalidToken
        import requests
        
        users = session.query(UserRecord).filter(UserRecord.is_active.is_(True)).all()
        access_token = None
        for user in users:
            try:
                refresh_token = decrypt_refresh_token(user.refresh_token_cipher, client.refresh_token_key)
                token, rotated = client.refresh_access_token(refresh_token)
                if rotated:
                    user.refresh_token_cipher = encrypt_refresh_token(rotated, client.refresh_token_key)
                    session.commit()
                access_token = token
                break
            except InvalidToken:
                continue
            except requests.HTTPError as e:
                if e.response is not None and e.response.status_code in (400, 401, 403):
                    logger.warning("Disabling user %s due to permanent auth error", user.id)
                    user.is_active = False
                    session.commit()
                continue
            except Exception:
                continue
                
        if not access_token:
            logger.warning("Genre cache backfill aborted: no active user token available")
            return
            
        result = backfill_artist_genres(client, backend_url, worker_token, access_token, lastfm_api_key, max_items=genre_cache_batch_size)
        last_genre_cache_sync_processed = result["processed"]
        last_genre_cache_sync_resolved = result["resolved"]
        last_genre_cache_sync_failures = result["failures"]
        last_genre_cache_sync_at = datetime.now(timezone.utc).isoformat()
        if result["processed"] > 0:
            logger.info("Genre cache backfill: %s processed, %s resolved, %s failures", result["processed"], result["resolved"], result["failures"])
    except Exception:
        logger.exception("Genre cache backfill failed")
    finally:
        session.close()

def run_file_import() -> None:
    global last_file_import_at, last_file_import_processed, last_file_import_failed
    if not file_import_enabled:
        return
    result = process_import_directory(file_import_dir, backend_url, worker_token)
    last_file_import_at = datetime.now(timezone.utc).isoformat()
    last_file_import_processed = result["processed"]
    last_file_import_failed = result["failed"]
    logger.info(
        "File import completed: %s processed, %s failed", last_file_import_processed, last_file_import_failed
    )


@app.get("/health")
def health_check() -> dict[str, str]:
    blocked_until = spotify_rate_limit_blocked_until()
    return {
        "status": "ok",
        "service": "worker",
        "scheduler_running": str(scheduler.running).lower(),
        "fixture_enabled": str(fixture_enabled).lower(),
        "spotify_enabled": str(spotify_enabled).lower(),
        "spotify_rate_limited_until": blocked_until.isoformat() if blocked_until else "not_limited",
        "last_spotify_sync_at": last_spotify_sync_at or "never",
        "last_spotify_sync_users": str(last_spotify_sync_users),
        "last_spotify_sync_failures": str(last_spotify_sync_failures),
        "last_spotify_sync_events": str(last_spotify_sync_events),
        "last_liked_tracks_sync_at": last_liked_tracks_sync_at or "never",
        "last_liked_tracks_sync_users": str(last_liked_tracks_sync_users),
        "last_liked_tracks_sync_failures": str(last_liked_tracks_sync_failures),
        "last_liked_tracks_sync_events": str(last_liked_tracks_sync_events),
        "file_import_enabled": str(file_import_enabled).lower(),
        "last_file_import_at": last_file_import_at or "never",
        "last_file_import_processed": str(last_file_import_processed),
        "last_file_import_failed": str(last_file_import_failed),

        "last_genre_cache_sync_at": last_genre_cache_sync_at,
        "last_genre_cache_sync_processed": str(last_genre_cache_sync_processed),
        "last_genre_cache_sync_resolved": str(last_genre_cache_sync_resolved),
        "last_genre_cache_sync_failures": str(last_genre_cache_sync_failures),

    }


@app.get("/metrics", response_class=PlainTextResponse)
def metrics() -> str:
    last_sync = 0 if last_spotify_sync_at == "never" or last_spotify_sync_at is None else 1
    rate_limited = 1 if spotify_rate_limit_blocked_until() else 0
    return "\n".join([
        "# HELP audio_scrobbler_worker_scheduler_running Scheduler state.",
        "# TYPE audio_scrobbler_worker_scheduler_running gauge",
        f"audio_scrobbler_worker_scheduler_running {int(scheduler.running)}",
        "# HELP audio_scrobbler_worker_spotify_rate_limited Whether the Spotify quota block is currently active.",
        "# TYPE audio_scrobbler_worker_spotify_rate_limited gauge",
        f"audio_scrobbler_worker_spotify_rate_limited {rate_limited}",
        "# HELP audio_scrobbler_worker_spotify_sync_success Last sync completed.",
        "# TYPE audio_scrobbler_worker_spotify_sync_success gauge",
        f"audio_scrobbler_worker_spotify_sync_success {last_sync}",
        "# HELP audio_scrobbler_worker_spotify_sync_users Users attempted in the last sync.",
        "# TYPE audio_scrobbler_worker_spotify_sync_users gauge",
        f"audio_scrobbler_worker_spotify_sync_users {last_spotify_sync_users}",
        "# HELP audio_scrobbler_worker_spotify_sync_failures Failures in the last sync.",
        "# TYPE audio_scrobbler_worker_spotify_sync_failures gauge",
        f"audio_scrobbler_worker_spotify_sync_failures {last_spotify_sync_failures}",
        "# HELP audio_scrobbler_worker_spotify_sync_events Events submitted in the last sync.",
        "# TYPE audio_scrobbler_worker_spotify_sync_events gauge",
        f"audio_scrobbler_worker_spotify_sync_events {last_spotify_sync_events}",
        "# HELP audio_scrobbler_worker_liked_tracks_sync_success Last liked-tracks sync completed.",
        "# TYPE audio_scrobbler_worker_liked_tracks_sync_success gauge",
        f"audio_scrobbler_worker_liked_tracks_sync_success {0 if last_liked_tracks_sync_at is None else 1}",
        "# HELP audio_scrobbler_worker_liked_tracks_sync_users Users attempted in the last liked-tracks sync.",
        "# TYPE audio_scrobbler_worker_liked_tracks_sync_users gauge",
        f"audio_scrobbler_worker_liked_tracks_sync_users {last_liked_tracks_sync_users}",
        "# HELP audio_scrobbler_worker_liked_tracks_sync_failures Failures in the last liked-tracks sync.",
        "# TYPE audio_scrobbler_worker_liked_tracks_sync_failures gauge",
        f"audio_scrobbler_worker_liked_tracks_sync_failures {last_liked_tracks_sync_failures}",
        "# HELP audio_scrobbler_worker_liked_tracks_sync_events Tracks submitted in the last liked-tracks sync.",
        "# TYPE audio_scrobbler_worker_liked_tracks_sync_events gauge",
        f"audio_scrobbler_worker_liked_tracks_sync_events {last_liked_tracks_sync_events}",
        "# HELP audio_scrobbler_worker_file_import_processed Files processed in the last file import run.",
        "# TYPE audio_scrobbler_worker_file_import_processed gauge",
        f"audio_scrobbler_worker_file_import_processed {last_file_import_processed}",
        "# HELP audio_scrobbler_worker_genre_cache_processed Total genre cache items processed.",
        "# TYPE audio_scrobbler_worker_genre_cache_processed gauge",
        f"audio_scrobbler_worker_genre_cache_processed {last_genre_cache_sync_processed}",
        "# HELP audio_scrobbler_worker_genre_cache_resolved Total genre cache items resolved.",
        "# TYPE audio_scrobbler_worker_genre_cache_resolved gauge",
        f"audio_scrobbler_worker_genre_cache_resolved {last_genre_cache_sync_resolved}",
        "# HELP audio_scrobbler_worker_file_import_failed Files failed in the last file import run.",
        "# TYPE audio_scrobbler_worker_file_import_failed gauge",
        f"audio_scrobbler_worker_file_import_failed {last_file_import_failed}",
        "",
    ])


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
    
    if spotify_enabled:
        scheduler.add_job(
            run_genre_cache_backfill,
            "interval",
            minutes=genre_cache_interval_minutes,
            id="genre_cache_backfill",
            replace_existing=True,
            next_run_time=datetime.now(timezone.utc),
        )

    scheduler.start()
    if fixture_enabled:
        scheduler.add_job(run_fixture_ingestion, "interval", minutes=1, id="fixture-ingestion")
    if spotify_enabled:
        scheduler.add_job(run_spotify_ingestion, "interval", minutes=spotify_interval_minutes, id="spotify-ingestion")
        scheduler.add_job(run_currently_playing_sync, "interval", seconds=10, id="currently-playing-sync")
        scheduler.add_job(run_liked_tracks_ingestion, "interval", minutes=liked_tracks_interval_minutes, id="liked-tracks-ingestion")
    if file_import_enabled:
        scheduler.add_job(run_file_import, "interval", minutes=file_import_interval_minutes, id="file-import")


@app.on_event("shutdown")
def stop_scheduler() -> None:
    scheduler.shutdown(wait=False)
