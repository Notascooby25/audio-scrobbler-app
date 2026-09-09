from __future__ import annotations

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from .api.analytics import router as analytics_router
from .api.auth import router as auth_router
from .api.ingestion import router as ingestion_router
from .config import settings
from .db import SessionLocal
from .db import engine
from .services.bootstrap_service import bootstrap_development_user
from .services.readiness_service import check_backend_readiness

app = FastAPI(title=settings.app_name, version=settings.app_version)

settings.validate()

app.include_router(analytics_router)
app.include_router(auth_router)
app.include_router(ingestion_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "app": settings.app_name, "version": settings.app_version}


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
