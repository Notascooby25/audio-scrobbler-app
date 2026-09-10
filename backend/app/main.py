from __future__ import annotations

import logging
from uuid import uuid4

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.responses import PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware

from .api.analytics import library_router, reports_router, router as analytics_router, stats_router
from .api.auth import router as auth_router
from .api.imports import router as import_router
from .api.ingestion import router as ingestion_router
from .api.spotify_library import router as spotify_library_router
from .api.users import router as users_router
from .api.preferences import router as preferences_router
from .api.blocks import router as blocks_router
from .config import settings
from .db import SessionLocal
from .db import engine
from .services.bootstrap_service import bootstrap_development_user
from .services.readiness_service import check_backend_readiness
from .services.runtime_metrics import snapshot
from .services.metrics_service import prometheus_metrics

app = FastAPI(title=settings.app_name, version=settings.app_version)
logger = logging.getLogger("audio-scrobbler-api")

settings.validate()

app.include_router(analytics_router)
app.include_router(stats_router)
app.include_router(library_router)
app.include_router(reports_router)
app.include_router(auth_router)
app.include_router(import_router)
app.include_router(ingestion_router)
app.include_router(spotify_library_router)
app.include_router(users_router)
app.include_router(preferences_router)
app.include_router(blocks_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_correlation_middleware(request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid4())
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    logger.info("request_completed request_id=%s method=%s path=%s status=%s", request_id, request.method, request.url.path, response.status_code)
    return response


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "app": settings.app_name, "version": settings.app_version, **{key: str(value) for key, value in snapshot().items()}}


@app.get("/metrics", response_class=PlainTextResponse)
def metrics() -> str:
    return prometheus_metrics()


@app.get("/readyz", response_model=None)
def readiness_check() -> dict[str, str] | JSONResponse:
    ready, detail = check_backend_readiness(engine)
    if not ready:
        return JSONResponse(status_code=503, content={"status": "not_ready", "detail": detail})
    return {"status": "ready", "app": settings.app_name, "version": settings.app_version}


@app.on_event("startup")
def bootstrap() -> None:
    db = SessionLocal()
    try:
        bootstrap_development_user(db)
    finally:
        db.close()


@app.get("/api/v1/me")
def get_profile() -> dict[str, str]:
    return {"name": "Audio Scrobbler App", "status": "scaffolded"}
