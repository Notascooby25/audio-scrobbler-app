from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models import BlockedItem, ListeningEvent

ENTITY_TYPES = ("artist", "album", "track")

_ENTITY_COLUMNS = {
    "artist": ListeningEvent.artist_name,
    "album": ListeningEvent.album_name,
    "track": ListeningEvent.track_name,
}


def list_blocks(db: Session, user_id: int) -> list[BlockedItem]:
    return db.query(BlockedItem).filter(BlockedItem.user_id == user_id).order_by(BlockedItem.created_at.desc()).all()


def _matching_events_count(db: Session, user_id: int, entity_type: str, name: str) -> int:
    column = _ENTITY_COLUMNS[entity_type]
    return db.query(ListeningEvent).filter(
        ListeningEvent.user_id == user_id,
        func.lower(column) == name.lower(),
    ).count()


def create_block(db: Session, user_id: int, entity_type: str, name: str) -> tuple[BlockedItem, int]:
    if entity_type not in ENTITY_TYPES:
        raise ValueError("Unsupported block entity type")
    cleaned = name.strip()
    if not cleaned:
        raise ValueError("Block name cannot be empty")

    existing = db.query(BlockedItem).filter(
        BlockedItem.user_id == user_id,
        BlockedItem.entity_type == entity_type,
        func.lower(BlockedItem.name) == cleaned.lower(),
    ).first()
    if existing is not None:
        return existing, _matching_events_count(db, user_id, entity_type, cleaned)

    block = BlockedItem(user_id=user_id, entity_type=entity_type, name=cleaned)
    db.add(block)
    db.commit()
    db.refresh(block)
    return block, _matching_events_count(db, user_id, entity_type, cleaned)


def remove_block(db: Session, user_id: int, block_id: int) -> bool:
    block = db.query(BlockedItem).filter(
        BlockedItem.id == block_id,
        BlockedItem.user_id == user_id,
    ).first()
    if block is None:
        return False
    db.delete(block)
    db.commit()
    return True


def delete_entries(
    db: Session,
    user_id: int,
    entity_type: str,
    name: str,
    secondary: str | None = None,
) -> int:
    if entity_type not in ENTITY_TYPES:
        raise ValueError("Unsupported delete entity type")
    cleaned = name.strip()
    if not cleaned:
        raise ValueError("Delete name cannot be empty")

    column = _ENTITY_COLUMNS[entity_type]
    query = db.query(ListeningEvent).filter(
        ListeningEvent.user_id == user_id,
        func.lower(column) == cleaned.lower(),
    )
    if entity_type == "track" and secondary:
        query = query.filter(func.lower(ListeningEvent.artist_name) == secondary.strip().lower())
    deleted = query.delete(synchronize_session=False)
    db.commit()
    return int(deleted)
