from __future__ import annotations

import json
from pathlib import Path

import pytest

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def _albums(name: str) -> dict[int, dict]:
    return {a["id"]: a for a in json.loads((_DATA_DIR / name).read_text(encoding="utf-8"))}


@pytest.mark.parametrize("name", ["1001_albums.json", "rough_trade_albums.json"])
def test_no_garbled_text_in_album_or_artist_names(name):
    # "Â" and "Ã" appear when UTF-8 text was misread as another encoding
    for album in _albums(name).values():
        for field in ("artist_name", "album_name"):
            assert "Â" not in album[field] and "Ã" not in album[field], (name, album["id"], album[field])


@pytest.mark.parametrize(
    "album_id, artist, title",
    [
        (189, "Nick Drake", "Bryter Layter"),
        (277, "Gram Parsons", "Grievous Angel"),
        (356, "Joni Mitchell", "Hejira"),
        (532, "Cyndi Lauper", "She's So Unusual"),
        (743, "Pet Shop Boys", "Very"),
        (844, "Finley Quaye", "Maverick A Strike"),
        (413, "Rubén Blades & Willie Colón", "Siembra"),
        (417, "The Adverts", "Crossing the Red Sea with The Adverts"),
        (590, "Emmylou Harris, Linda Ronstadt, Dolly Parton", "Trio"),
        # artist and title had been entered the wrong way round
        (753, "Aimee Mann", "Whatever"),
        (608, "Astor Piazzolla", "The New Tango"),
        (285, "Stephen Stills", "Manassas"),
        (895, "Suba", "São Paulo Confessions"),
    ],
)
def test_1001_albums_corrected_names(album_id, artist, title):
    album = _albums("1001_albums.json")[album_id]
    assert (album["artist_name"], album["album_name"]) == (artist, title)


@pytest.mark.parametrize(
    "album_id, artist, title",
    [
        (21, "Yves Tumor", "Heaven To A Tortured Mind"),
        (157, "Flock of Dimes", "Head of Roses"),
        (650, "A$AP Rocky", "Don’t Be Dumb"),
        (673, "Angel Du$t", "Cold 2 The Touch"),
        (629, "Slayyyter", "WOR$T GIRL IN AMERICA"),
    ],
)
def test_rough_trade_albums_corrected_names(album_id, artist, title):
    album = _albums("rough_trade_albums.json")[album_id]
    assert (album["artist_name"], album["album_name"]) == (artist, title)


def test_known_misspellings_are_gone():
    wrong = {
        "Bothers",
        "Bryter Later",
        "Grevious",
        "Hejeira",
        "Cindy Lauper",
        "Pet Shops Boys",
        "Finlay Quaye",
        "Rondstadt",
        "Liqour",
        "Aftterfuture",
        "Masquarade",
        "Aqulies",
        "Yves Tumour",
        "Rock of Dimes",
    }
    for name in ("1001_albums.json", "rough_trade_albums.json"):
        text = " ".join(f"{a['artist_name']} {a['album_name']}" for a in _albums(name).values())
        for bad in wrong:
            assert bad not in text, (name, bad)
