#!/usr/bin/env python3
"""Fill in cover art links for the 1001 Albums and Rough Trade lists.

Run from the repo root on a developer machine, never on the server:

    python3 scripts/fill_album_artwork.py --work-dir /path/outside/repo            # dry run
    python3 scripts/fill_album_artwork.py --work-dir /path/outside/repo --apply    # write the files

Each album is looked up on Deezer, then iTunes, using only the public artist and album
names. A match is accepted only when the artist AND the album title both agree, so a
wrong cover is worse than none: anything unsure is left blank and listed in the report.

Lookups are saved in `<work-dir>/album-artwork-state.json`, so an interrupted run
resumes where it stopped. A report is written to `<work-dir>/album-artwork-report.txt`.
`--apply` rewrites only the `"artwork_url"` lines of the two data files.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "backend" / "app" / "data"
DATA_FILES = {"1001": DATA_DIR / "1001_albums.json", "rough_trade": DATA_DIR / "rough_trade_albums.json"}

USER_AGENT = "music-parser-app/1.0"
TIMEOUT_SECONDS = 8.0

# Words that mark a reissue rather than a different album
_EDITION_WORDS = (
    "remaster",
    "deluxe",
    "expanded",
    "anniversary",
    "edition",
    "version",
    "reissue",
    "bonus",
    "mono",
    "stereo",
    "special",
    "legacy",
    "collector",
)
_EDITION_BRACKETS = re.compile(r"[\(\[][^\)\]]*(" + "|".join(_EDITION_WORDS) + r")[^\)\]]*[\)\]]", re.IGNORECASE)
_EDITION_SUFFIX = re.compile(r"\s+-\s+(.*(" + "|".join(_EDITION_WORDS) + r").*|ep|single)$", re.IGNORECASE)


class LookupFailed(Exception):
    """A lookup that failed (network, rate limit), as opposed to a real "no match"."""


def _ascii_fold(text: str) -> str:
    return unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")


def normalise_title(title: str) -> str:
    """Album title reduced to lowercase letters and digits, ignoring edition tags."""
    text = _EDITION_BRACKETS.sub("", title or "")
    text = _EDITION_SUFFIX.sub("", text)
    text = _ascii_fold(text).lower().replace("&", "and")
    text = re.sub(r"^the\s+", "", text.strip())
    return re.sub(r"[^a-z0-9]", "", text)


def normalise_artist(name: str) -> str:
    text = _ascii_fold(name or "").lower().replace("&", "and")
    text = re.sub(r"^the\s+", "", text.strip())
    return re.sub(r"[^a-z0-9]", "", text)


def artists_match(wanted: str, returned: str) -> bool:
    """Same artist, or the wanted artist is one of several credited on the result."""
    target = normalise_artist(wanted)
    if not target:
        return False
    if target == normalise_artist(returned):
        return True
    parts = re.split(r"\s*(?:,|&|/| and | feat\.? | ft\.? | with )\s*", returned or "", flags=re.IGNORECASE)
    return target in {normalise_artist(part) for part in parts}


def titles_match(wanted: str, returned: str) -> bool:
    target = normalise_title(wanted)
    return bool(target) and target == normalise_title(returned)


def _get_json(url: str, attempts: int = 3) -> Any:
    last_error: Exception | None = None
    for attempt in range(attempts):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
                data = json.loads(response.read().decode("utf-8"))
            # Deezer reports "too many requests" as an error object with code 4
            if isinstance(data, dict) and isinstance(data.get("error"), dict) and data["error"].get("code") == 4:
                raise LookupFailed("rate limited")
            return data
        except Exception as exc:  # noqa: BLE001 - any failure is retried, then reported as an error
            last_error = exc
            time.sleep(2.0 * (attempt + 1))
    raise LookupFailed(str(last_error))


def _https(url: str | None) -> bool:
    return isinstance(url, str) and url.startswith("https://")


def deezer_candidates(artist: str, album: str) -> list[dict[str, Any]]:
    queries = [
        f'artist:"{artist.replace(chr(34), "")}" album:"{album.replace(chr(34), "")}"',
        f"{artist} {album}",
    ]
    for query in queries:
        data = _get_json(f"https://api.deezer.com/search/album?q={urllib.parse.quote(query)}&limit=10")
        results = data.get("data", []) if isinstance(data, dict) else []
        if results:
            return [r for r in results if isinstance(r, dict)]
    return []


def deezer_cover(artist: str, album: str) -> tuple[str | None, str]:
    """(cover url, note). The 250px cover, only when artist and title both match."""
    seen = []
    for item in deezer_candidates(artist, album):
        name = str((item.get("artist") or {}).get("name", ""))
        title = str(item.get("title", ""))
        seen.append(f"{name} - {title}")
        cover = item.get("cover_medium")
        # Deezer's picture for albums without a cover has no id in the path
        if artists_match(artist, name) and titles_match(album, title) and _https(cover) and "/cover//" not in cover:
            return cover, ""
    return None, "; ".join(seen[:3])


def itunes_cover(artist: str, album: str) -> tuple[str | None, str]:
    term = urllib.parse.quote(f"{artist} {album}")
    data = _get_json(f"https://itunes.apple.com/search?term={term}&entity=album&limit=10")
    results = data.get("results", []) if isinstance(data, dict) else []
    seen = []
    for item in results:
        name = str(item.get("artistName", ""))
        title = str(item.get("collectionName", ""))
        seen.append(f"{name} - {title}")
        art = item.get("artworkUrl100")
        if artists_match(artist, name) and titles_match(album, title) and _https(art):
            return art.replace("100x100bb", "300x300bb"), ""
    return None, "; ".join(seen[:3])


def find_cover(artist: str, album: str, pause: float) -> dict[str, Any]:
    """Look one album up. Raises LookupFailed when a service could not be reached."""
    url, note = deezer_cover(artist, album)
    if url:
        return {"url": url, "source": "deezer"}
    time.sleep(pause)
    url, note2 = itunes_cover(artist, album)
    if url:
        return {"url": url, "source": "itunes"}
    return {"url": "", "source": "", "near": "; ".join(n for n in (note, note2) if n)[:300]}


def load_albums(path: Path) -> list[dict[str, Any]]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_artwork_lines(path: Path, urls: list[str]) -> int:
    """Replace each album's `"artwork_url"` line in order, touching nothing else.

    Returns how many links changed. Refuses to write if the line count doesn't match."""
    lines = path.read_text(encoding="utf-8").split("\n")
    slots = [i for i, line in enumerate(lines) if line.lstrip().startswith('"artwork_url":')]
    if len(slots) != len(urls):
        raise SystemExit(f"{path.name}: found {len(slots)} artwork_url lines for {len(urls)} albums, not writing")
    changed = 0
    for index, new_url in zip(slots, urls):
        line = lines[index]
        indent = line[: len(line) - len(line.lstrip())]
        comma = "," if line.rstrip().endswith(",") else ""
        updated = f'{indent}"artwork_url": {json.dumps(new_url, ensure_ascii=False)}{comma}'
        if updated != line:
            lines[index] = updated
            changed += 1
    path.write_text("\n".join(lines), encoding="utf-8")
    return changed


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--work-dir", required=True, help="Folder OUTSIDE the repo for the resume file and report")
    parser.add_argument("--apply", action="store_true", help="Write the links into the data files")
    parser.add_argument("--pause", type=float, default=0.5, help="Seconds between outside requests")
    parser.add_argument("--limit", type=int, default=0, help="Only look up this many albums (testing)")
    args = parser.parse_args(argv)

    work_dir = Path(args.work_dir).resolve()
    if work_dir == REPO_ROOT or REPO_ROOT in work_dir.parents:
        print("The work folder must be outside the repo.", file=sys.stderr)
        return 2
    work_dir.mkdir(parents=True, exist_ok=True)
    state_path = work_dir / "album-artwork-state.json"
    state: dict[str, dict[str, Any]] = json.loads(state_path.read_text()) if state_path.exists() else {}

    errors = 0
    looked_up = 0
    for list_key, path in DATA_FILES.items():
        for album in load_albums(path):
            key = f"{list_key}:{album['id']}"
            if key in state:
                continue
            if args.limit and looked_up >= args.limit:
                break
            try:
                state[key] = find_cover(album["artist_name"], album["album_name"], args.pause)
            except LookupFailed as exc:
                errors += 1
                print(f"{key}: lookup failed ({exc}); it will be retried next run", file=sys.stderr)
                continue
            looked_up += 1
            state_path.write_text(json.dumps(state, indent=1, ensure_ascii=False))
            if looked_up % 50 == 0:
                print(f"{looked_up} looked up this run...", flush=True)
            time.sleep(args.pause)

    report: list[str] = []
    totals: dict[str, dict[str, int]] = {}
    for list_key, path in DATA_FILES.items():
        albums = load_albums(path)
        urls: list[str] = []
        stats = {"total": len(albums), "found": 0, "replaced": 0, "kept_old": 0, "blank": 0, "pending": 0}
        unmatched: list[str] = []
        for album in albums:
            old = album.get("artwork_url") or ""
            result = state.get(f"{list_key}:{album['id']}")
            if result is None:
                stats["pending"] += 1
                urls.append(old)
            elif result["url"]:
                stats["found"] += 1
                stats["replaced"] += int(bool(old) and old != result["url"])
                urls.append(result["url"])
            else:
                stats["kept_old" if old else "blank"] += 1
                urls.append(old)
                unmatched.append(
                    f"  #{album['id']} {album['artist_name']} - {album['album_name']}"
                    + (" [keeps its old cover]" if old else "")
                    + (f"\n      closest results: {result.get('near')}" if result.get("near") else "")
                )
        totals[list_key] = stats
        report.append(f"== {list_key}: {stats}")
        report.extend(unmatched)
        if args.apply:
            report.append(f"-- wrote {write_artwork_lines(path, urls)} changed links to {path.name}")

    (work_dir / "album-artwork-report.txt").write_text("\n".join(report) + "\n", encoding="utf-8")
    print(json.dumps(totals, indent=1))
    print(f"Report: {work_dir / 'album-artwork-report.txt'}")
    if errors:
        print(f"{errors} albums could not be looked up; run again to retry them.", file=sys.stderr)
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
