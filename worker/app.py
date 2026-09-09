from __future__ import annotations

import os
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
import requests

app = FastAPI(title="Audio Scrobbler Worker")

scheduler = BackgroundScheduler()
backend_url = os.getenv("WORKER_BACKEND_URL", "http://backend:8000")
worker_token = os.getenv("WORKER_INGESTION_TOKEN", "dev-worker-token")
fixture_enabled = os.getenv("WORKER_FIXTURE_ENABLED", "false").lower() == "true"
fixture_user_id = int(os.getenv("WORKER_USER_ID", "1"))


def build_fixture_event() -> dict[str, object]:
    played_at = datetime.now(timezone.utc).replace(second=0, microsecond=0).isoformat()
    return {
        "user_id": fixture_user_id,
        "track_id": "development-fixture-track",
        "track_name": "Development Fixture Track",
        "artist_name": "Audio Scrobbler",
        "played_at": played_at,
        "source": "development-fixture",
        "payload": {"fixture": True},
    }


def run_fixture_ingestion() -> None:
    if not fixture_enabled:
        return
    response = requests.post(
        f"{backend_url}/ingestion/internal/events",
        json=build_fixture_event(),
        headers={"X-Worker-Token": worker_token},
        timeout=10,
    )
    response.raise_for_status()


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "worker"}


@app.on_event("startup")
def start_scheduler() -> None:
    scheduler.start()
    if fixture_enabled:
        scheduler.add_job(run_fixture_ingestion, "interval", minutes=1, id="fixture-ingestion")


@app.on_event("shutdown")
def stop_scheduler() -> None:
    scheduler.shutdown(wait=False)
