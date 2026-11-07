from __future__ import annotations

from datetime import timedelta
import json

from sqlalchemy import and_, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..models import ArtworkCache, ListeningEvent
from ..schemas.ingestion import ListeningEventCreate, ListeningEventResponse
from . import scrobble_settings_service
from .color_service import fetch_and_extract_color
from .runtime_metrics import record_ingestion
from .text_cleaning import clean_title


def ingest_listening_event(
    db: Session,
    user_id: int,
    event: ListeningEventCreate,
) -> ListeningEventResponse:
    canonical_play_id = event.play_id or event.track_id
    track_name = event.track_name
    if scrobble_settings_service.get_strip_remaster_tags(db, user_id):
        track_name = clean_title(track_name)
        
    if event.source.startswith("spotify"):
        # Deduplicate historical or real-time Spotify scrobbles if the same track was already recorded within 15 minutes
        dup = (
            db.query(ListeningEvent)
            .filter(
                ListeningEvent.user_id == user_id,
                ListeningEvent.track_id == event.track_id,
                ListeningEvent.source.in_(["spotify", "spotify_realtime"]),
                ListeningEvent.played_at >= event.played_at - timedelta(minutes=15),
                ListeningEvent.played_at <= event.played_at + timedelta(minutes=15),
            )
            .first()
        )
        if dup:
            record_ingestion(True)
            return ListeningEventResponse(event_id=dup.id, duplicate=True)

    artwork_color = None
    if event.artwork_url:
        cached = db.query(ArtworkCache).filter(ArtworkCache.artwork_url == event.artwork_url).first()
        if cached and cached.dominant_color:
            artwork_color = cached.dominant_color
        else:
            artwork_color = fetch_and_extract_color(event.artwork_url)
            if artwork_color:
                if cached:
                    cached.dominant_color = artwork_color
                else:
                    db.merge(
                        ArtworkCache(
                            track_id=event.track_id or event.artwork_url,
                            artwork_url=event.artwork_url,
                            dominant_color=artwork_color,
                        )
                    )

    listening_event = ListeningEvent(
        user_id=user_id,
        track_id=event.track_id,
        track_name=track_name,
        artist_name=event.artist_name,
        album_name=event.album_name,
        artwork_url=event.artwork_url,
        artwork_color=artwork_color,
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
                or_(
                    and_(
                        ListeningEvent.track_id == event.track_id,
                        ListeningEvent.played_at == event.played_at,
                    ),
                    and_(
                        ListeningEvent.source == event.source,
                        ListeningEvent.play_id == canonical_play_id,
                    ),
                ),
            )
            .first()
        )
        if existing is None:
            raise
        record_ingestion(True)
        return ListeningEventResponse(event_id=existing.id, duplicate=True)