from __future__ import annotations

from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.models import Base, ListeningEvent, User, UserRoughTradeAlbumCompletion
from backend.app.services.catalog_rough_trade_service import (
    get_canonical_rough_trade_albums,
    get_rough_trade_album_by_id,
    get_user_rough_trade_catalog,
    toggle_user_rough_trade_album_completion,
)


def test_rough_trade_service_catalog_and_85pct_completion():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    user = User(
        spotify_user_id="test_scrobbler",
        username="scrobbler",
        display_name="Scrobbler",
        refresh_token_cipher="cipher",
    )
    db.add(user)
    db.commit()

    albums = get_canonical_rough_trade_albums()
    assert len(albums) == 700

    # Test get_rough_trade_album_by_id
    a1 = get_rough_trade_album_by_id(1)
    assert a1 is not None
    assert a1["id"] == 1
    assert a1["year"] == 2020

    # Album 1 is SAULT - Untitled (Black Is), track count defaults to 10
    # Simulate playing 9 unique tracks (9 / 10 = 90% >= 85%)
    for i in range(1, 10):
        db.add(
            ListeningEvent(
                user_id=user.id,
                track_id=f"track_sault_{i}",
                play_id=f"play_sault_{i}",
                artist_name="SAULT",
                album_name="Untitled (Black Is)",
                track_name=f"Track {i}",
                played_at=datetime.now(timezone.utc),
            )
        )
    db.commit()

    cat = get_user_rough_trade_catalog(db, user.id)
    assert cat["total_albums"] == 700
    assert cat["completed_count"] >= 1

    first = next(a for a in cat["albums"] if a["id"] == 1)
    assert first["is_completed"] is True
    assert first["completed_source"] == "scrobble_85pct"

    # Test toggle completed
    toggle_res = toggle_user_rough_trade_album_completion(db, user.id, 1, False, source="manual_unmark")
    assert toggle_res["is_completed"] is False

    rec = db.query(UserRoughTradeAlbumCompletion).filter_by(user_id=user.id, album_id=1).first()
    assert rec.is_completed is False

    db.close()
