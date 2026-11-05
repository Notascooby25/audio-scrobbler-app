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


def test_zero_mojibake_in_catalog():
    albums = get_canonical_1001_albums()
    for a in albums:
        assert "Ã" not in a.get("artist_name", ""), f"Mojibake in artist: {a.get('artist_name')}"
        assert "Ã" not in a.get("album_name", ""), f"Mojibake in album: {a.get('album_name')}"
        assert "%C3%83" not in a.get("spotify_url", ""), f"Mojibake in spotify_url: {a.get('spotify_url')}"

    debut = get_1001_album_by_id(730)
    assert debut is not None
    assert debut["artist_name"] == "Björk"
    assert "Debut" in debut["album_name"]
    assert "Bj%C3%B6rk" in debut["spotify_url"]
