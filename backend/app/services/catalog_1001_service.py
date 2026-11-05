from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

_DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "1001_albums.json"


@lru_cache(maxsize=1)
def get_canonical_1001_albums() -> list[dict]:
    """Loads and returns the in-memory cached canonical 1001 albums list."""
    if not _DATA_PATH.exists():
        return []
    with open(_DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def get_1001_album_by_id(album_id: int) -> dict | None:
    """Finds a 1001 album by its 1-based integer id."""
    albums = get_canonical_1001_albums()
    if 1 <= album_id <= len(albums):
        candidate = albums[album_id - 1]
        if candidate.get("id") == album_id:
            return candidate
    for a in albums:
        if a.get("id") == album_id:
            return a
    return None
