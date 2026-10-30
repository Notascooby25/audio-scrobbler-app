from datetime import datetime
from backend.app.models import SavedAlbum


def test_saved_album_instantiation():
    album = SavedAlbum(
        user_id=1,
        spotify_album_id="album123",
        album_name="Abbey Road",
        artist_name="The Beatles",
        release_date="1969-09-26",
        release_year=1969,
        genres=["Rock"],
        duration_ms=2843000,
        label="Apple Records",
        artwork_url="https://img.spotify.com/123",
        spotify_url="https://open.spotify.com/album/album123",
        added_at=datetime.utcnow(),
    )
    assert album.album_name == "Abbey Road"
    assert album.release_year == 1969
    assert album.genres == ["Rock"]
