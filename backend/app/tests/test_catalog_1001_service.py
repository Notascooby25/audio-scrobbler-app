from backend.app.services.catalog_1001_service import (
    get_1001_album_by_id,
    get_canonical_1001_albums,
)


def test_catalog_loads_canonical_albums():
    albums = get_canonical_1001_albums()
    assert len(albums) >= 1000
    first = albums[0]
    assert "id" in first
    assert "album_name" in first
    assert "artist_name" in first
    assert "release_year" in first
    assert "decade" in first
    assert "genres" in first
    assert "track_count" in first
    assert first["track_count"] > 0
    assert "artwork_url" in first


def test_get_1001_album_by_id_found_and_missing():
    album = get_1001_album_by_id(1)
    assert album is not None
    assert album["id"] == 1
    missing = get_1001_album_by_id(999999)
    assert missing is None
