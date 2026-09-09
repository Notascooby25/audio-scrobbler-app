from __future__ import annotations

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI

app = FastAPI(title="Audio Scrobbler Worker")

scheduler = BackgroundScheduler()


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "worker"}


@app.on_event("startup")
def start_scheduler() -> None:
    scheduler.start()


@app.on_event("shutdown")
def stop_scheduler() -> None:
    scheduler.shutdown(wait=False)
