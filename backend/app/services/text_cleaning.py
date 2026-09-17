from __future__ import annotations

import re


def clean_title(title: str) -> str:
    """Strips extra metadata like (Remastered) or [Live] for better API matching."""
    if not isinstance(title, str) or not title.strip():
        return ""
    cleaned = re.sub(
        r"[\(\[\{].*?(remaster|live|version|edit|deluxe|feat|ft\.).*?[\)\]\}]",
        "",
        title,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(
        r"-\s*(remastered|live|radio edit|single version).*$",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    res = cleaned.strip()
    return res if res else title.strip()
