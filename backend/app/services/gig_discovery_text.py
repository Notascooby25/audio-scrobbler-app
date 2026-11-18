"""Small text helpers shared by every gig discovery source (no database or network use)."""

from __future__ import annotations

import re
import unicodedata
from urllib.parse import urlparse

_WHITESPACE = re.compile(r"\s+")
_AMPERSAND = re.compile(r"\s*&\s*")
_DROPPED_MARKS = re.compile(r"['\u2019\u2018`\u00b4\u02bc.]")  # apostrophes of every kind, and full stops
_NOT_ALPHANUMERIC = re.compile(r"[\W_]+")


def sanitize_external_url(url: str | None) -> str | None:
    """Allow only http/https external URLs; drop javascript:, data:, or malformed strings."""
    if not url or not isinstance(url, str):
        return None
    cleaned = url.strip()
    if not cleaned:
        return None
    parsed = urlparse(cleaned)
    if parsed.scheme.lower() not in ("http", "https") or not parsed.netloc:
        return None
    return cleaned[:512]


def normalize_artist_key(name: str | None) -> str:
    return (name or "").strip().lower()


def canonical_artist_key(name: str | None) -> str:
    """Lower-case, collapse spaces and treat '&' and 'and' alike, so spellings compare equal."""
    text = _AMPERSAND.sub(" and ", normalize_artist_key(name))
    return _WHITESPACE.sub(" ", text).strip()


def match_key(name: str | None) -> str:
    """Key for deciding two spellings are the same band or act.

    Ignores case, accents, apostrophes of every kind (DMA's, DMA\u2019s, DMAs), full stops
    (Fontaines D.C. = Fontaines DC), other punctuation and spacing, treats '&' and 'and' alike,
    and drops a leading 'The' (The Snuts = Snuts). Used only to compare names, never stored.
    """
    text = unicodedata.normalize("NFKD", name or "")
    text = "".join(ch for ch in text if not unicodedata.combining(ch)).lower()
    text = _AMPERSAND.sub(" and ", text)
    text = _DROPPED_MARKS.sub("", text)
    text = _NOT_ALPHANUMERIC.sub(" ", text).strip()
    if text.startswith("the "):
        remainder = text[4:]
        if remainder and remainder != "the":
            text = remainder
    return text
