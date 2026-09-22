from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.db import Base
from backend.app.models import ListeningEvent, PlaylistCache, User
from backend.app.schemas.spotify_library import WorkerPlaylistCacheItem
from backend.app.services import analytics_service
from backend.app.services.spotify_library_service import find_pending_playlist_uris, upsert_playlist_cache

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(engine)


def _event(user_id: int, playlist_uri: str | None, *, played_at=None, track="t", active=True) -> ListeningEvent:
    return ListeningEvent(
        user_id=user_id,
        track_id=track,
        track_name="Track",
        artist_name="Artist",
        played_at=played_at or datetime.utcnow(),
        source="spotify",
        play_id=f"{user_id}-{track}-{playlist_uri}",
        raw_metadata={"context": {"type": "playlist", "uri": playlist_uri}} if playlist_uri else None,
    )


def _reset(db):
    db.query(PlaylistCache).delete()
    db.query(ListeningEvent).delete()
    db.query(User).delete()
    db.commit()


def test_find_pending_playlist_uris_returns_only_uncached_ones():
    db = TestingSession()
    _reset(db)
    db.add(User(id=1, spotify_user_id="s1", username="u1", display_name="U1", refresh_token_cipher="c", is_active=True))
    db.commit()
    db.add(_event(1, "spotify:playlist:cached", track="a"))
    db.add(_event(1, "spotify:playlist:pending", track="b"))
    db.add(PlaylistCache(playlist_uri="spotify:playlist:cached", name="Already Named", cached_at=datetime.utcnow()))
    db.commit()

    pending = find_pending_playlist_uris(db, limit=10)

    assert pending == [{"playlist_uri": "spotify:playlist:pending", "user_id": 1}]
    db.close()


def test_find_pending_playlist_uris_ignores_non_playlist_context():
    db = TestingSession()
    _reset(db)
    db.add(User(id=1, spotify_user_id="s1", username="u1", display_name="U1", refresh_token_cipher="c", is_active=True))
    db.commit()
    db.add(_event(1, None, track="no-context"))  # a bare scrobble, no playlist context at all
    db.commit()

    assert find_pending_playlist_uris(db, limit=10) == []
    db.close()


def test_find_pending_playlist_uris_skips_inactive_users():
    db = TestingSession()
    _reset(db)
    db.add(User(id=1, spotify_user_id="s1", username="u1", display_name="U1", refresh_token_cipher="c", is_active=False))
    db.commit()
    db.add(_event(1, "spotify:playlist:x"))
    db.commit()

    assert find_pending_playlist_uris(db, limit=10) == []
    db.close()


def test_find_pending_playlist_uris_respects_limit_and_is_deduplicated():
    db = TestingSession()
    _reset(db)
    db.add(User(id=1, spotify_user_id="s1", username="u1", display_name="U1", refresh_token_cipher="c", is_active=True))
    db.commit()
    # The same playlist played 5 times must appear once, not five times.
    for i in range(5):
        db.add(_event(1, "spotify:playlist:repeated", track=f"t{i}"))
    for uri in ("spotify:playlist:a", "spotify:playlist:b", "spotify:playlist:c"):
        db.add(_event(1, uri, track=uri))
    db.commit()

    pending = find_pending_playlist_uris(db, limit=2)

    assert len(pending) == 2
    uris = [p["playlist_uri"] for p in find_pending_playlist_uris(db, limit=100)]
    assert uris.count("spotify:playlist:repeated") == 1
    db.close()


def test_find_pending_playlist_uris_picks_an_active_user_who_played_it():
    db = TestingSession()
    _reset(db)
    db.add(User(id=1, spotify_user_id="s1", username="u1", display_name="U1", refresh_token_cipher="c", is_active=False))
    db.add(User(id=2, spotify_user_id="s2", username="u2", display_name="U2", refresh_token_cipher="c", is_active=True))
    db.commit()
    db.add(_event(1, "spotify:playlist:shared", track="from-inactive"))
    db.add(_event(2, "spotify:playlist:shared", track="from-active"))
    db.commit()

    pending = find_pending_playlist_uris(db, limit=10)

    assert pending == [{"playlist_uri": "spotify:playlist:shared", "user_id": 2}]
    db.close()


def test_upsert_playlist_cache_inserts_and_updates():
    db = TestingSession()
    _reset(db)

    inserted = upsert_playlist_cache(db, [WorkerPlaylistCacheItem(playlist_uri="spotify:playlist:x", name="First Name")])
    assert inserted == 1
    row = db.query(PlaylistCache).filter(PlaylistCache.playlist_uri == "spotify:playlist:x").one()
    assert row.name == "First Name"
    first_cached_at = row.cached_at

    updated = upsert_playlist_cache(db, [WorkerPlaylistCacheItem(playlist_uri="spotify:playlist:x", name="Renamed")])
    assert updated == 1
    db.refresh(row)
    assert row.name == "Renamed"
    assert row.cached_at >= first_cached_at
    assert db.query(PlaylistCache).count() == 1  # updated in place, not duplicated
    db.close()


def test_upsert_playlist_cache_empty_list_is_a_noop():
    db = TestingSession()
    _reset(db)
    assert upsert_playlist_cache(db, []) == 0
    assert db.query(PlaylistCache).count() == 0
    db.close()


def test_get_user_charts_playlists_reads_cache_and_never_calls_spotify(monkeypatch):
    """The regression this whole feature exists to prevent: the chart-building
    path must not import or call anything Spotify-related. If it ever does
    again, this blows up loudly instead of quietly hammering Spotify."""
    def _boom(*args, **kwargs):
        raise AssertionError("get_user_charts must never call Spotify directly")
    monkeypatch.setattr("backend.app.services.spotify_library_service._request", _boom)
    monkeypatch.setattr("requests.request", _boom)
    monkeypatch.setattr("requests.get", _boom)
    monkeypatch.setattr("requests.post", _boom)

    db = TestingSession()
    _reset(db)
    db.add(User(id=1, spotify_user_id="s1", username="u1", display_name="U1", refresh_token_cipher="c", is_active=True))
    db.commit()
    db.add(_event(1, "spotify:playlist:cached", track="a"))
    db.add(_event(1, "spotify:playlist:uncached", track="b"))
    db.add(PlaylistCache(playlist_uri="spotify:playlist:cached", name="Road Trip Mix", cached_at=datetime.utcnow()))
    db.commit()

    response = analytics_service.get_user_charts(db, user_id=1, entity="playlists", range_key="overall")

    labels = {entry.label for entry in response.entries}
    assert "Road Trip Mix" in labels
    # Not yet resolved by the worker: falls back to the raw URI, exactly as before.
    assert "spotify:playlist:uncached" in labels
    db.close()
