from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

_REPO_ROOT = Path(__file__).resolve().parents[3]
_SPEC = importlib.util.spec_from_file_location("fill_album_artwork", _REPO_ROOT / "scripts" / "fill_album_artwork.py")
assert _SPEC and _SPEC.loader
script = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(script)

_DATA_DIR = _REPO_ROOT / "backend" / "app" / "data"


@pytest.mark.parametrize(
    "wanted, returned",
    [
        ("In The Wee Small Hours", "In the Wee Small Hours"),
        ("Déjà Vu", "Deja Vu"),
        ("Rumours", "Rumours (Deluxe Edition)"),
        ("Pet Sounds", "Pet Sounds [Mono & Stereo]"),
        ("Led Zeppelin IV", "Led Zeppelin IV - Remastered"),
        ("Untitled (Black Is)", "Untitled (Black Is)"),
        ("The Köln Concert", "Koln Concert"),
        ("Some EP", "Some EP - EP"),
    ],
)
def test_titles_match_ignores_case_accents_and_edition_tags(wanted, returned):
    assert script.titles_match(wanted, returned)


@pytest.mark.parametrize(
    "wanted, returned",
    [
        ("Blue", "Blue Train"),
        ("Rumours", "Rumours Live"),
        ("Abbey Road", "Abbey Road Sessions"),
        ("Wet Leg", "Wet Dream"),
        ("", "Anything"),
    ],
)
def test_titles_match_rejects_different_albums(wanted, returned):
    assert not script.titles_match(wanted, returned)


def test_artists_match_allows_the_wanted_artist_among_several():
    assert script.artists_match("The Beatles", "Beatles")
    assert script.artists_match("Sault", "SAULT")
    assert script.artists_match("Nick Cave", "Nick Cave & The Bad Seeds")
    assert script.artists_match("Beyoncé", "Beyonce")


def test_artists_match_rejects_other_artists():
    assert not script.artists_match("Wet Leg", "Wet Dream")
    assert not script.artists_match("Nick", "Nick Cave & The Bad Seeds Band")
    assert not script.artists_match("", "Someone")


def test_find_cover_prefers_deezer_then_falls_back_to_itunes(monkeypatch):
    monkeypatch.setattr(script.time, "sleep", lambda _s: None)
    monkeypatch.setattr(script, "deezer_cover", lambda a, b: ("https://deezer/c.jpg", ""))
    monkeypatch.setattr(script, "itunes_cover", lambda a, b: pytest.fail("iTunes should not be asked"))
    assert script.find_cover("A", "B", 0) == {"url": "https://deezer/c.jpg", "source": "deezer"}

    monkeypatch.setattr(script, "deezer_cover", lambda a, b: (None, "x - y"))
    monkeypatch.setattr(script, "itunes_cover", lambda a, b: ("https://itunes/c.jpg", ""))
    assert script.find_cover("A", "B", 0) == {"url": "https://itunes/c.jpg", "source": "itunes"}


def test_find_cover_reports_a_miss_without_a_url(monkeypatch):
    monkeypatch.setattr(script.time, "sleep", lambda _s: None)
    monkeypatch.setattr(script, "deezer_cover", lambda a, b: (None, "Other - Album"))
    monkeypatch.setattr(script, "itunes_cover", lambda a, b: (None, ""))
    result = script.find_cover("A", "B", 0)
    assert result["url"] == ""
    assert "Other - Album" in result["near"]


def test_deezer_cover_skips_a_wrong_album_and_the_no_cover_placeholder(monkeypatch):
    items = [
        {"title": "Wet Dream", "artist": {"name": "Wet Leg"}, "cover_medium": "https://d/1/250x250.jpg"},
        {"title": "Wet Leg", "artist": {"name": "Wet Leg"}, "cover_medium": "https://d/images/cover//250x250.jpg"},
        {"title": "Wet Leg", "artist": {"name": "Wet Leg"}, "cover_medium": "https://d/images/cover/abc/250x250.jpg"},
    ]
    monkeypatch.setattr(script, "deezer_candidates", lambda a, b: items)
    url, _ = script.deezer_cover("Wet Leg", "Wet Leg")
    assert url == "https://d/images/cover/abc/250x250.jpg"


def test_write_artwork_lines_changes_only_the_artwork_lines(tmp_path):
    path = tmp_path / "albums.json"
    original = (
        '[\n  {\n    "id": 1,\n    "artist_name": "Willie Col\\u00c2\\u00a2n",\n    "artwork_url": ""\n  },\n'
        '  {\n    "id": 2,\n    "artist_name": "B",\n    "artwork_url": "https://old/x.jpg"\n  }\n]'
    )
    path.write_text(original, encoding="utf-8")

    changed = script.write_artwork_lines(path, ["https://new/a.jpg", "https://old/x.jpg"])

    assert changed == 1
    updated = path.read_text(encoding="utf-8")
    assert updated == original.replace('"artwork_url": ""', '"artwork_url": "https://new/a.jpg"')
    assert json.loads(updated)[0]["artwork_url"] == "https://new/a.jpg"


def test_write_artwork_lines_refuses_a_mismatched_count(tmp_path):
    path = tmp_path / "albums.json"
    path.write_text('[\n  {\n    "id": 1,\n    "artwork_url": ""\n  }\n]', encoding="utf-8")
    with pytest.raises(SystemExit):
        script.write_artwork_lines(path, ["a", "b"])
    assert path.read_text(encoding="utf-8").count("artwork_url") == 1


@pytest.mark.parametrize("name", ["1001_albums.json", "rough_trade_albums.json"])
def test_every_album_cover_link_is_empty_or_https(name):
    albums = json.loads((_DATA_DIR / name).read_text(encoding="utf-8"))
    for album in albums:
        url = album.get("artwork_url", "")
        assert url == "" or url.startswith("https://"), f"{name} #{album['id']} has a bad cover link: {url!r}"
