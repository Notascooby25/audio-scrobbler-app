from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.analytics import router as analytics_router
from .config import settings
from .db import Base, engine

app = FastAPI(title=settings.app_name, version=settings.app_version)

app.include_router(analytics_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "app": settings.app_name, "version": settings.app_version}


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)


@app.get("/api/v1/me")
def get_profile() -> dict[str, str]:
    return {"name": "Audio Scrobbler App", "status": "scaffolded"}
