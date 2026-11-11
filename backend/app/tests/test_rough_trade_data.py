from __future__ import annotations

import json
from pathlib import Path


def test_rough_trade_dataset_validity():
    data_path = Path(__file__).resolve().parent.parent / "data" / "rough_trade_albums.json"
    assert data_path.exists(), "rough_trade_albums.json must exist"

    with open(data_path, "r", encoding="utf-8") as f:
        albums = json.load(f)

    assert len(albums) == 700, f"Expected 700 albums, got {len(albums)}"

    ids = set()
    years_count: dict[int, int] = {}
    for idx, album in enumerate(albums, 1):
        aid = album.get("id")
        year = album.get("year")
        rank = album.get("rank")
        artist = album.get("artist_name")
        title = album.get("album_name")

        assert aid == idx, f"Expected 1-based sequential ID {idx}, got {aid}"
        assert aid not in ids, f"Duplicate album ID {aid}"
        ids.add(aid)

        assert 2020 <= year <= 2026, f"Year out of bounds: {year}"
        assert 1 <= rank <= 100, f"Rank out of bounds: {rank}"
        assert artist and artist.strip(), f"Missing artist for album {aid}"
        assert title and title.strip(), f"Missing title for album {aid}"
        assert album.get("track_count", 0) > 0, f"Track count must be > 0 for {aid}"

        years_count[year] = years_count.get(year, 0) + 1

    for yr in range(2020, 2027):
        assert years_count.get(yr) == 100, f"Expected 100 albums for year {yr}, got {years_count.get(yr)}"
