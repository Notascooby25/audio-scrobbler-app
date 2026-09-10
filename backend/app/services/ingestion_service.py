from __future__ import annotations

import json

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..models import ListeningEvent
from ..schemas.ingestion import ListeningEventCreate, ListeningEventResponse
from .runtime_metrics import record_ingestion


def ingest_listening_event(
    db: Session,
    user_id: int,
    event: ListeningEventCreate,
) -> ListeningEventResponse:
    canonical_play_id = event.play_id or event.track_id
    listening_event = ListeningEvent(
        user_id=user_id,
        track_id=event.track_id,
        track_name=event.track_name,
        artist_name=event.artist_name,
        album_name=event.album_name,
        artwork_url=event.artwork_url,
        played_at=event.played_at,
        duration_ms=event.duration_ms,
        source=event.source,
        play_id=canonical_play_id,
        payload=json.dumps(event.payload) if event.payload is not None else None,
        raw_metadata=event.raw_metadata,
    )
    db.add(listening_event)
    try:
        db.commit()
        db.refresh(listening_event)
        record_ingestion(False)
        return ListeningEventResponse(event_id=listening_event.id, duplicate=False)
    except IntegrityError:
        db.rollback()
        existing = (
            db.query(ListeningEvent)
            .filter(
                ListeningEvent.user_id == user_id,
                ListeningEvent.track_id == event.track_id,
                ListeningEvent.played_at == event.played_at,
            )
            .first()
        )
        if existing is None:
            raise
        record_ingestion(True)
        return ListeningEventResponse(event_id=existing.id, duplicate=True)