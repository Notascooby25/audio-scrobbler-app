from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from ..api.deps import get_current_user
from ..db import get_db
from ..models import User
from ..schemas.ingestion import ListeningEventCreate, ListeningEventResponse
from ..services.ingestion_service import ingest_listening_event

router = APIRouter(prefix="/ingestion", tags=["ingestion"])


@router.post("/events", response_model=ListeningEventResponse, status_code=status.HTTP_201_CREATED)
def create_listening_event(
    event: ListeningEventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ListeningEventResponse:
    return ingest_listening_event(db, current_user.id, event)