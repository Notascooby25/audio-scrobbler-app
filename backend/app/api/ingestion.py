from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from ..api.deps import get_current_user
from ..db import get_db
from ..models import User
from ..schemas.ingestion import ListeningEventCreate, ListeningEventResponse
from ..schemas.worker import WorkerListeningEventCreate
from ..config import settings
from ..services.ingestion_service import ingest_listening_event

router = APIRouter(prefix="/ingestion", tags=["ingestion"])


def require_worker_token(x_worker_token: str | None = Header(default=None)) -> None:
    if x_worker_token != settings.worker_ingestion_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid worker credentials")


@router.post("/events", response_model=ListeningEventResponse, status_code=status.HTTP_201_CREATED)
def create_listening_event(
    event: ListeningEventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ListeningEventResponse:
    return ingest_listening_event(db, current_user.id, event)


@router.post("/internal/events", response_model=ListeningEventResponse, status_code=status.HTTP_201_CREATED)
def create_worker_listening_event(
    event: WorkerListeningEventCreate,
    db: Session = Depends(get_db),
    _: None = Depends(require_worker_token),
) -> ListeningEventResponse:
    return ingest_listening_event(db, event.user_id, event)