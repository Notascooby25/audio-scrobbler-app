from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")


@dataclass(frozen=True)
class Settings:
    app_name: str = "Audio Scrobbler App"
    app_version: str = "0.1.0"
    database_url: str = os.getenv("DATABASE_URL", "postgresql+psycopg://scrobbler:scrobbler@db:5432/scrobbler")
    jwt_secret: str = os.getenv("JWT_SECRET", "dev-secret-change-me")
    refresh_token_key: str = os.getenv("REFRESH_TOKEN_KEY", "0123456789abcdef0123456789abcdef")
    ingestion_worker_url: str = os.getenv("INGESTION_WORKER_URL", "http://worker:8001")


settings = Settings()
