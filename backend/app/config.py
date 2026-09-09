from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")


@dataclass(frozen=True)
class Settings:
    app_name: str = "Audio Scrobbler App"
    app_version: str = os.getenv("APP_VERSION", "0.1.2")
    environment: str = os.getenv("APP_ENV", "development")
    database_url: str = os.getenv("DATABASE_URL", "postgresql+psycopg://scrobbler:scrobbler@db:5432/scrobbler")
    jwt_secret: str = os.getenv("JWT_SECRET", "dev-secret-change-me")
    refresh_token_key: str = os.getenv("REFRESH_TOKEN_KEY", "0123456789abcdef0123456789abcdef")
    ingestion_worker_url: str = os.getenv("INGESTION_WORKER_URL", "http://worker:8001")
    worker_ingestion_token: str = os.getenv("WORKER_INGESTION_TOKEN", "dev-worker-token")
    access_token_ttl_seconds: int = int(os.getenv("ACCESS_TOKEN_TTL_SECONDS", "3600"))
    dev_user_id: int = int(os.getenv("DEV_USER_ID", "1"))
    dev_user_spotify_id: str = os.getenv("DEV_USER_SPOTIFY_ID", "development-user")
    dev_user_display_name: str = os.getenv("DEV_USER_DISPLAY_NAME", "Development User")

    def validate(self) -> None:
        if self.environment.lower() == "production":
            if self.jwt_secret == "dev-secret-change-me":
                raise ValueError("JWT_SECRET must be changed in production")
            if self.refresh_token_key == "0123456789abcdef0123456789abcdef":
                raise ValueError("REFRESH_TOKEN_KEY must be changed in production")
            if self.worker_ingestion_token == "dev-worker-token":
                raise ValueError("WORKER_INGESTION_TOKEN must be changed in production")


settings = Settings()
