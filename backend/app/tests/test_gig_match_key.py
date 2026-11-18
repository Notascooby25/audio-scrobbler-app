from __future__ import annotations

import pytest

from backend.app.services.gig_discovery_text import match_key


@pytest.mark.parametrize(
    "a, b",
    [
        ("DMA’s", "DMA's"),  # curly vs straight apostrophe, as seen on Setlist.fm vs Skiddle
        ("DMA's", "DMAs"),
        ("Fontaines D.C.", "Fontaines DC"),
        ("Beyoncé", "Beyonce"),
        ("Echo & The Bunnymen", "echo  AND the bunnymen"),
        ("The Snuts", "Snuts"),
        ("Mumford & Sons", "Mumford and Sons"),
        ("  Fat   Dog ", "fat dog"),
        ("Guns N’ Roses", "Guns N' Roses"),
    ],
)
def test_spellings_of_the_same_band_match(a: str, b: str):
    assert match_key(a) == match_key(b) != ""


@pytest.mark.parametrize(
    "a, b",
    [
        ("DMA's", "DMA"),
        ("Fat Dog", "Fat Cat"),
        ("Supergrass", "Super Grass Tribute"),
        ("The 1975", "The 1974"),
    ],
)
def test_different_bands_do_not_match(a: str, b: str):
    assert match_key(a) != match_key(b)


def test_a_bare_the_is_kept_and_empty_input_is_empty():
    assert match_key("The") == "the"
    assert match_key("The The") == "the the"
    assert match_key(None) == ""
    assert match_key("   ") == ""


def test_punctuation_only_names_do_not_collapse_into_each_other():
    assert match_key("!!!") == ""
