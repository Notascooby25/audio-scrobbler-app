from __future__ import annotations

import os
import logging
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
import requests

app = FastAPI(title="Audio Scrobbler Worker")
logger = logging.getLogger("audio-scrobbler-worker")

scheduler = BackgroundScheduler()
backend_url = os.getenv("WORKER_BACKEND_URL", "http://backend:8000")
worker_token = os.getenv("WORKER_INGESTION_TOKEN", "dev-worker-token")
fixture_enabled = os.getenv("WORKER_FIXTURE_ENABLED", "false").lower() == "true"
fixture_user_id = int(os.getenv("WORKER_USER_ID", "1"))
max_attempts = 3


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


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "worker", "scheduler_running": str(scheduler.running).lower(), "fixture_enabled": str(fixture_enabled).lower()}


@app.on_event("startup")
def start_scheduler() -> None:
    scheduler.start()
    if fixture_enabled:
        scheduler.add_job(run_fixture_ingestion, "interval", minutes=1, id="fixture-ingestion")


@app.on_event("shutdown")
def stop_scheduler() -> None:
    scheduler.shutdown(wait=False)
