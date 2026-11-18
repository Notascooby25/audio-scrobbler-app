"""Small text helpers shared by every gig discovery source (no database or network use)."""

from __future__ import annotations

import re
from urllib.parse import urlparse

_WHITESPACE = re.compile(r"\s+")
_AMPERSAND = re.compile(r"\s*&\s*")


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
