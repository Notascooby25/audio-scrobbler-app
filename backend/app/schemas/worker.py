from __future__ import annotations

from pydantic import Field

from .ingestion import ListeningEventCreate


class WorkerListeningEventCreate(ListeningEventCreate):
    user_id: int = Field(gt=0)