from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
import logging
import re
import time
from typing import Any, Iterator
import urllib.error
import urllib.parse
import urllib.request
import uuid

from sqlalchemy import tuple_
from sqlalchemy.orm import Session

from ..config import settings
from ..models import ArtworkCache, ListeningEvent
from ..schemas.imports import ImportScrobbleSummary, UnifiedImportProgressEvent
from .text_cleaning import clean_title

logger = logging.getLogger("audio-scrobbler-import")


# ─── Metadata Cleaning & Matching Helpers (from process_exports.py) ───────────


def is_artist_match(target_artist: str, returned_artist: str) -> bool:
    """Strictly checks if the returned artist name matches the target artist."""
    t_art = target_artist.lower().strip()
    r_art = returned_artist.lower().strip()

    if t_art == r_art:
        return True

    r_artists = re.split(r"[,&]| feat\. | ft\. ", r_art)
    r_artists = [a.strip() for a in r_artists]

    return t_art in r_artists


def fetch_and_validate(url: str, target_artist: str, timeout: float = 5.0) -> dict[str, Any] | None:
    """Fetches search results with retry logic and validates the artist."""
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "music-parser-app/1.0"})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))

            if "error" in data and data["error"].get("code") == 4:
                time.sleep(2)
                continue

            for item in data.get("data", []):
                ret_artist = item.get("artist", {}).get("name", "")
                if is_artist_match(target_artist, ret_artist):
                    return item
            return None
        except urllib.error.HTTPError as e:
            if e.code in (429, 403):
                time.sleep(2)
            else:
                break
        except Exception:
            time.sleep(1)
    return None


def deezer_search(artist: str, title: str, timeout: float = 5.0) -> dict[str, Any] | None:
    """Searches Deezer's API using precise and loose fallback queries."""
    clean_t = clean_title(title)
    safe_artist = artist.replace('"', "")
    safe_title = clean_t.replace('"', "")

    # 1. Precise Advanced Search
    query = urllib.parse.quote(f'artist:"{safe_artist}" track:"{safe_title}"')
    url = f"https://api.deezer.com/search?q={query}"
    track = fetch_and_validate(url, artist, timeout=timeout)
    if track:
        return track

    # 2. Fallback Loose Search
    loose_query = urllib.parse.quote(f"{safe_artist} {safe_title}")
    url = f"https://api.deezer.com/search?q={loose_query}"
    return fetch_and_validate(url, artist, timeout=timeout)


def deezer_artwork(track: dict[str, Any]) -> str:
    """Extracts high-res album cover, or falls back to artist picture."""
    album = track.get("album", {})
    cover = album.get("cover_big") or album.get("cover_xl") or album.get("cover_medium")
    if cover:
        return cover

    artist = track.get("artist", {})
    return artist.get("picture_big") or artist.get("picture_medium") or ""


def itunes_artwork(artist: str, title: str, timeout: float = 3.0) -> str | None:
    """Fallback search using the iTunes API for missing artwork."""
    query = urllib.parse.quote(f"{artist} {clean_title(title)}")
    url = f"https://itunes.apple.com/search?term={query}&entity=song&limit=3"

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "music-parser-app/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            for result in data.get("results", []):
                ret_artist = result.get("artistName", "")
                if is_artist_match(artist, ret_artist):
                    art = result.get("artworkUrl100")
                    if art:
                        # Upgrade 100x100 resolution to 600x600
                        return art.replace("100x100bb", "600x600bb")
    except Exception as exc:
        logger.debug("iTunes lookup exception for %s - %s: %s", artist, title, exc)
    return None


# ─── Schema Normalization Helpers ─────────────────────────────────────────────


def parse_iso_timestamp(raw_value: Any) -> datetime | None:
    if isinstance(raw_value, datetime):
        return raw_value if raw_value.tzinfo is None else raw_value.astimezone(timezone.utc).replace(tzinfo=None)
    if not isinstance(raw_value, str):
        return None
    value = raw_value.strip()
    if not value:
        return None
    try:
        if value.endswith("Z"):
            return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc).replace(tzinfo=None)
        dt = datetime.fromisoformat(value)
        return dt.astimezone(timezone.utc).replace(tzinfo=None) if dt.tzinfo else dt
    except ValueError:
        return None


def generate_track_id(source: str, artist: str, song: str, original_uri: str | None = None) -> str:
    """Generates a deterministic UUID string conforming to the Unified Import Schema."""
    if original_uri and original_uri.strip() and not original_uri.startswith("spotify:track:local-"):
        ident = original_uri.strip()
    else:
        ident = f"{source.strip().lower()}:{artist.strip().lower()}:{song.strip().lower()}"
    return str(uuid.uuid5(uuid.NAMESPACE_URL, ident))


def detect_source(entries: list[dict[str, Any]], hint_source: str | None = None) -> str:
    """Auto-detects whether an export dataset is from Spotify, YouTube, or Apple Music."""
    if hint_source and hint_source.lower() in ("spotify", "youtube", "apple"):
        return hint_source.lower()

    for entry in entries[:20]:
        if not isinstance(entry, dict):
            continue

        explicit_source = str(entry.get("source", "")).lower()
        if "apple" in explicit_source or "itunes" in explicit_source:
            return "apple"
        if "youtube" in explicit_source:
            return "youtube"
        if "spotify" in explicit_source:
            return "spotify"

        if entry.get("header") == "YouTube Music" or entry.get("subtitles") or "titleUrl" in entry:
            return "youtube"
        if "song" in entry and ("artist" in entry or "release" in entry):
            return "youtube"
        if (
            "master_metadata_track_name" in entry
            or "spotify_track_uri" in entry
            or "trackUri" in entry
            or "trackName" in entry
            or "endTime" in entry
        ):
            return "spotify"

    return "spotify"


def _clean_artwork_url(raw_url: Any) -> str | None:
    """Validates and normalizes an optional artwork URL from an import entry."""
    if not isinstance(raw_url, str):
        return None
    cleaned = raw_url.strip()
    if not cleaned or cleaned.lower() in ("no artwork", "none", "null"):
        return None
    if not cleaned.startswith(("https://", "http://")):
        return None
    return cleaned


def normalize_record(entry: dict[str, Any], source: str) -> dict[str, Any] | None:
    """Parses and normalizes a single raw export row into the Unified Import Record format."""
    if not isinstance(entry, dict):
        return None

    if source == "spotify":
        # Skip podcast episodes
        if entry.get("episode_name") or entry.get("spotify_episode_uri"):
            return None
        # Skip audiobooks
        if entry.get("audiobook_uri") or entry.get("audiobook_title"):
            return None

        song_name = (
            entry.get("master_metadata_track_name") or entry.get("trackName") or entry.get("song") or entry.get("title")
        )
        artist_name = entry.get("master_metadata_album_artist_name") or entry.get("artistName") or entry.get("artist")
        album_name = (
            entry.get("master_metadata_album_album_name")
            or entry.get("albumName")
            or entry.get("release")
            or entry.get("album")
        )
        time_str = entry.get("ts") or entry.get("endTime") or entry.get("time")
        track_uri = entry.get("spotify_track_uri") or entry.get("trackUri")
        ms_played = entry.get("ms_played") if isinstance(entry.get("ms_played"), int) else entry.get("msPlayed")
        artwork_url = entry.get("artwork") or entry.get("artwork_url")

        if not isinstance(song_name, str) or not isinstance(artist_name, str) or not isinstance(time_str, str):
            return None
        if not song_name.strip() or not artist_name.strip() or not time_str.strip():
            return None

        played_at = parse_iso_timestamp(time_str)
        if played_at is None:
            return None

        if not track_uri or not str(track_uri).strip():
            synth_id = hashlib.sha1(
                f"{artist_name.strip().lower()}:{song_name.strip().lower()}".encode("utf-8")
            ).hexdigest()[:16]
            track_uri = f"spotify:track:local-{synth_id}"

        track_id = generate_track_id("spotify", artist_name, song_name, track_uri)
        play_id = f"{track_uri}:{time_str}"

        cleaned_art = _clean_artwork_url(artwork_url)

        return {
            "artist_name": artist_name.strip(),
            "song_name": song_name.strip(),
            "album_name": album_name.strip() if isinstance(album_name, str) and album_name.strip() else None,
            "artwork_url": cleaned_art,
            "played_at": played_at,
            "played_at_iso": played_at.isoformat() + "Z",
            "track_id": track_id,
            "source": "spotify",
            "play_id": play_id,
            "duration_ms": ms_played if isinstance(ms_played, int) else None,
            "raw_entry": entry,
        }

    elif source == "youtube":
        artist_name = None
        song_name = None
        album_name = entry.get("release") or entry.get("album")
        time_str = entry.get("time")
        artwork_url = entry.get("artwork") or entry.get("artwork_url")

        is_raw_takeout = (
            "header" in entry
            or "subtitles" in entry
            or "titleUrl" in entry
            or (isinstance(entry.get("title"), str) and entry["title"].startswith("Watched "))
        )
        if is_raw_takeout:
            if entry.get("header") != "YouTube Music":
                return None
            subtitles = entry.get("subtitles", [])
            if not subtitles or not isinstance(subtitles, list) or not isinstance(subtitles[0], dict):
                return None
            channel = subtitles[0].get("name", "")
            if not isinstance(channel, str) or not channel.endswith("- Topic"):
                return None
            artist_name = channel.replace(" - Topic", "").strip()
            raw_title = entry.get("title", "")
            if raw_title.startswith("Watched "):
                song_name = raw_title.replace("Watched ", "", 1).strip()
            else:
                song_name = raw_title.strip()
        else:
            song_name = entry.get("song") or entry.get("title")
            artist_name = entry.get("artist")

        if not isinstance(song_name, str) or not isinstance(artist_name, str) or not isinstance(time_str, str):
            return None
        if not song_name.strip() or not artist_name.strip() or not time_str.strip():
            return None

        played_at = parse_iso_timestamp(time_str)
        if played_at is None:
            return None

        track_id = generate_track_id("youtube", artist_name, song_name)
        play_id = f"youtube-{song_name.lower().replace(' ', '-')}-{time_str}"

        cleaned_art = _clean_artwork_url(artwork_url)

        return {
            "artist_name": artist_name.strip(),
            "song_name": song_name.strip(),
            "album_name": album_name.strip() if isinstance(album_name, str) and album_name.strip() else None,
            "artwork_url": cleaned_art,
            "played_at": played_at,
            "played_at_iso": played_at.isoformat() + "Z",
            "track_id": track_id,
            "source": "youtube",
            "play_id": play_id,
            "duration_ms": entry.get("duration_ms") if isinstance(entry.get("duration_ms"), int) else None,
            "raw_entry": entry,
        }

    elif source == "apple":
        artist_name = entry.get("artist")
        song_name = entry.get("song") or entry.get("title")
        album_name = entry.get("release") or entry.get("album")
        time_str = entry.get("time")
        artwork_url = entry.get("artwork") or entry.get("artwork_url")

        if not isinstance(song_name, str) or not isinstance(artist_name, str) or not isinstance(time_str, str):
            return None
        if not song_name.strip() or not artist_name.strip() or not time_str.strip():
            return None

        played_at = parse_iso_timestamp(time_str)
        if played_at is None:
            return None

        track_id = generate_track_id("apple", artist_name, song_name)
        play_id = f"apple-{track_id}-{played_at.timestamp()}"

        cleaned_art = _clean_artwork_url(artwork_url)

        return {
            "artist_name": artist_name.strip(),
            "song_name": song_name.strip(),
            "album_name": album_name.strip() if isinstance(album_name, str) and album_name.strip() else None,
            "artwork_url": cleaned_art,
            "played_at": played_at,
            "played_at_iso": played_at.isoformat() + "Z",
            "track_id": track_id,
            "source": "apple",
            "play_id": play_id,
            "duration_ms": entry.get("duration_ms") if isinstance(entry.get("duration_ms"), int) else None,
            "raw_entry": entry,
        }

    return None


# ─── Unified Import Pipeline & Stream ─────────────────────────────────────────


IMPORT_DB_CHUNK_SIZE = 500


def _sanitize_db_str(value: str | None, max_len: int = 255) -> str | None:
    """Strips NUL bytes and truncates strings to fit PostgreSQL VARCHAR(255) columns."""
    if value is None:
        return None
    cleaned = value.replace("\x00", "")
    return cleaned[:max_len]


def _sanitize_normalized_record(rec: dict[str, Any]) -> dict[str, Any]:
    """Sanitizes string fields on a normalized record prior to DB lookup and insertion."""
    rec["artist_name"] = _sanitize_db_str(rec.get("artist_name")) or "Unknown Artist"
    rec["song_name"] = _sanitize_db_str(rec.get("song_name")) or "Unknown Track"
    rec["album_name"] = _sanitize_db_str(rec.get("album_name"))
    rec["track_id"] = _sanitize_db_str(rec.get("track_id")) or ""
    rec["play_id"] = _sanitize_db_str(rec.get("play_id")) or ""
    return rec


def process_unified_import_stream(
    db: Session,
    user_id: int,
    entries: list[dict[str, Any]],
    source_hint: str | None = None,
) -> Iterator[UnifiedImportProgressEvent]:
    """Processes imported records and yields real-time progress events across 5 stages."""
    total_raw = len(entries)
    errors: list[str] = []

    # 1. Stage: File Validation
    yield UnifiedImportProgressEvent(
        stage="file_validation",
        percent=5,
        message=f"Validating {total_raw} export entries...",
        current=0,
        total=total_raw,
    )

    detected_source = detect_source(entries, source_hint)

    yield UnifiedImportProgressEvent(
        stage="file_validation",
        percent=15,
        message=f"Validation complete. Source detected: {detected_source.upper()}.",
        current=total_raw,
        total=total_raw,
    )

    # 2. Stage: Record Normalization
    yield UnifiedImportProgressEvent(
        stage="record_normalization",
        percent=20,
        message="Normalizing metadata fields...",
        current=0,
        total=total_raw,
    )

    normalized_records: list[dict[str, Any]] = []
    skipped_count = 0

    for idx, raw in enumerate(entries):
        norm = normalize_record(raw, detected_source)
        if norm is None:
            skipped_count += 1
            if len(errors) < 10:
                raw_snippet = str(raw.get("trackName") or raw.get("title") or raw.get("song") or f"row #{idx + 1}")
                errors.append(f"Row {idx + 1} skipped (invalid or non-music entry): {raw_snippet}")
        else:
            normalized_records.append(_sanitize_normalized_record(norm))

        if (idx + 1) % max(1, total_raw // 5) == 0 or idx + 1 == total_raw:
            pct = 20 + int(((idx + 1) / max(1, total_raw)) * 25)
            yield UnifiedImportProgressEvent(
                stage="record_normalization",
                percent=min(45, pct),
                message=f"Normalized {len(normalized_records)} tracks ({skipped_count} skipped)...",
                current=idx + 1,
                total=total_raw,
                errors=list(errors),
            )

    # 3. Stage: Artwork Caching (local DB cache only — never block uploads on external HTTP calls)
    yield UnifiedImportProgressEvent(
        stage="artwork_caching",
        percent=45,
        message="Checking artwork cache...",
        current=0,
        total=len(normalized_records),
    )

    batch_art_cache: dict[str, str] = {}
    total_norm = len(normalized_records)

    all_track_ids = list({r["track_id"] for r in normalized_records if r["track_id"]})
    for offset in range(0, len(all_track_ids), 1000):
        chunk_ids = all_track_ids[offset : offset + 1000]
        for item in db.query(ArtworkCache).filter(ArtworkCache.track_id.in_(chunk_ids)).all():
            batch_art_cache[item.track_id] = item.artwork_url

    new_cached_entries: list[ArtworkCache] = []
    seen_new_cache_ids: set[str] = set()

    for rec in normalized_records:
        t_id = rec["track_id"]
        if t_id in batch_art_cache and batch_art_cache[t_id]:
            rec["artwork_url"] = batch_art_cache[t_id]
        elif rec.get("artwork_url") and t_id not in seen_new_cache_ids:
            batch_art_cache[t_id] = rec["artwork_url"]
            seen_new_cache_ids.add(t_id)
            new_cached_entries.append(ArtworkCache(track_id=t_id, artwork_url=rec["artwork_url"]))

    if new_cached_entries:
        try:
            for item in new_cached_entries:
                db.merge(item)
            db.commit()
        except Exception as e:
            db.rollback()
            logger.warning("Failed to commit artwork_cache items: %s", e)

    yield UnifiedImportProgressEvent(
        stage="artwork_caching",
        percent=75,
        message=f"Matched cached artwork for {total_norm} tracks.",
        current=total_norm,
        total=total_norm,
    )

    # 4. Stage: Database Insertion & Chunked Deduplication
    yield UnifiedImportProgressEvent(
        stage="database_insertion",
        percent=75,
        message="Inserting records and checking for duplicates...",
        current=0,
        total=total_norm,
    )

    inserted_count = 0
    duplicate_count = 0

    seen_track_times: set[tuple[str, datetime]] = set()
    seen_play_ids: set[str] = set()

    for chunk_start in range(0, total_norm, IMPORT_DB_CHUNK_SIZE):
        chunk = normalized_records[chunk_start : chunk_start + IMPORT_DB_CHUNK_SIZE]

        # Pre-filter intra-file duplicates first
        candidates: list[dict[str, Any]] = []
        for rec in chunk:
            track_time_key = (rec["track_id"], rec["played_at"])
            play_id = rec["play_id"]
            if track_time_key in seen_track_times or (play_id and play_id in seen_play_ids):
                duplicate_count += 1
            else:
                seen_track_times.add(track_time_key)
                if play_id:
                    seen_play_ids.add(play_id)
                candidates.append(rec)

        if candidates:
            track_time_keys = list({(r["track_id"], r["played_at"]) for r in candidates})
            play_id_keys = list({r["play_id"] for r in candidates if r["play_id"]})

            existing_track_times: set[tuple[str, datetime]] = set()
            if track_time_keys:
                existing_rows = (
                    db.query(ListeningEvent.track_id, ListeningEvent.played_at)
                    .filter(
                        ListeningEvent.user_id == user_id,
                        tuple_(ListeningEvent.track_id, ListeningEvent.played_at).in_(track_time_keys),
                    )
                    .all()
                )
                existing_track_times = {(row[0], row[1]) for row in existing_rows}

            existing_play_ids: set[str] = set()
            if play_id_keys:
                existing_play_rows = (
                    db.query(ListeningEvent.play_id)
                    .filter(
                        ListeningEvent.user_id == user_id,
                        ListeningEvent.source == detected_source,
                        ListeningEvent.play_id.in_(play_id_keys),
                    )
                    .all()
                )
                existing_play_ids = {row[0] for row in existing_play_rows}

            for rec in candidates:
                if (rec["track_id"], rec["played_at"]) in existing_track_times or (
                    rec["play_id"] and rec["play_id"] in existing_play_ids
                ):
                    duplicate_count += 1
                else:
                    new_event = ListeningEvent(
                        user_id=user_id,
                        track_id=rec["track_id"],
                        track_name=rec["song_name"],
                        artist_name=rec["artist_name"],
                        album_name=rec["album_name"],
                        artwork_url=rec["artwork_url"],
                        played_at=rec["played_at"],
                        duration_ms=rec["duration_ms"],
                        source=detected_source,
                        play_id=rec["play_id"],
                        payload="",
                        raw_metadata=rec["raw_entry"],
                    )
                    db.add(new_event)
                    inserted_count += 1

            db.commit()

        processed = min(chunk_start + len(chunk), total_norm)
        pct = 75 + int((processed / max(1, total_norm)) * 20)
        yield UnifiedImportProgressEvent(
            stage="database_insertion",
            percent=min(95, pct),
            message=f"Processed {processed}/{total_norm} records ({inserted_count} new, {duplicate_count} dupes)...",
            current=processed,
            total=total_norm,
        )

    # 5. Stage: Completion
    summary = ImportScrobbleSummary(
        inserted=inserted_count,
        skipped=skipped_count,
        duplicate=duplicate_count,
    )

    yield UnifiedImportProgressEvent(
        stage="completion",
        percent=100,
        message=f"Import complete! {inserted_count} scrobbles added, {duplicate_count} duplicates skipped.",
        current=total_raw,
        total=total_raw,
        summary=summary,
        errors=list(errors),
    )


def process_unified_import(
    db: Session,
    user_id: int,
    entries: list[dict[str, Any]],
    source_hint: str | None = None,
) -> dict[str, Any]:
    """Synchronous execution returning the final completion result."""
    last_event: UnifiedImportProgressEvent | None = None
    detected = detect_source(entries, source_hint)
    for event in process_unified_import_stream(db, user_id, entries, source_hint):
        last_event = event

    summary_data = (
        last_event.summary
        if last_event and last_event.summary
        else ImportScrobbleSummary(inserted=0, skipped=0, duplicate=0)
    )
    return {
        "status": "ok",
        "source": detected,
        "summary": summary_data.model_dump(),
        "errors": last_event.errors if last_event else [],
    }


def backfill_artwork_stream(
    db: Session,
    user_id: int,
) -> Iterator[UnifiedImportProgressEvent]:
    """Scans the user's library for missing artwork and attempts to backfill from Deezer."""

    yield UnifiedImportProgressEvent(
        stage="validation",
        percent=10,
        message="Scanning library for missing artwork...",
        current=0,
        total=1,
    )

    # Find unique track names without artwork
    missing_records = (
        db.query(
            ListeningEvent.track_id, ListeningEvent.artist_name, ListeningEvent.track_name, ListeningEvent.album_name
        )
        .filter(ListeningEvent.user_id == user_id)
        .filter((ListeningEvent.artwork_url == None) | (ListeningEvent.artwork_url == ""))
        .group_by(
            ListeningEvent.track_id, ListeningEvent.artist_name, ListeningEvent.track_name, ListeningEvent.album_name
        )
        .limit(100)
        .all()
    )

    if not missing_records:
        yield UnifiedImportProgressEvent(
            stage="completion",
            percent=100,
            message="No missing artwork found.",
            current=0,
            total=0,
            summary=ImportScrobbleSummary(inserted=0, skipped=0, duplicate=0),
        )
        return

    total_missing = len(missing_records)

    yield UnifiedImportProgressEvent(
        stage="artwork_caching",
        percent=20,
        message=f"Found {total_missing} missing tracks. Starting backfill...",
        current=0,
        total=total_missing,
    )

    processed_count = 0
    updated_count = 0
    updated_track_names: list[str] = []
    skipped_track_names: list[str] = []
    processed_track_ids = set()

    for idx, rec in enumerate(missing_records):
        if rec.track_id in processed_track_ids:
            continue
        processed_track_ids.add(rec.track_id)

        if settings.enable_deezer_artwork_lookup:
            time.sleep(0.5)  # Prevent overwhelming Deezer/iTunes rate limits
            try:
                dz_track = deezer_search(rec.artist_name, rec.track_name, timeout=3.0)
                resolved_art = deezer_artwork(dz_track) if dz_track else None

                if not resolved_art:
                    resolved_art = itunes_artwork(rec.artist_name, rec.track_name)

                if resolved_art:
                    # Update ArtworkCache
                    db.merge(ArtworkCache(track_id=rec.track_id, artwork_url=resolved_art))
                    # Update ListeningEvents
                    db.query(ListeningEvent).filter(
                        ListeningEvent.user_id == user_id, ListeningEvent.track_id == rec.track_id
                    ).update({"artwork_url": resolved_art}, synchronize_session=False)

                    updated_count += 1
                    updated_track_names.append(f"{rec.artist_name} - {rec.track_name}")
                else:
                    db.merge(ArtworkCache(track_id=rec.track_id, artwork_url=""))
                    skipped_track_names.append(f"{rec.artist_name} - {rec.track_name}")
            except Exception as exc:
                logger.debug("Deezer/iTunes backfill exception for %s - %s: %s", rec.artist_name, rec.track_name, exc)
                db.merge(ArtworkCache(track_id=rec.track_id, artwork_url=""))
                skipped_track_names.append(f"{rec.artist_name} - {rec.track_name}")

        processed_count += 1

        if processed_count % 5 == 0 or processed_count == total_missing:
            db.commit()
            pct = 20 + int((processed_count / total_missing) * 75)
            yield UnifiedImportProgressEvent(
                stage="artwork_caching",
                percent=pct,
                message=f"Checking artwork ({processed_count}/{total_missing})...",
                current=processed_count,
                total=total_missing,
                errors=list(skipped_track_names),
            )

    db.commit()

    yield UnifiedImportProgressEvent(
        stage="completion",
        percent=100,
        message=f"Backfill complete! Updated {updated_count} tracks.",
        current=processed_count,
        total=total_missing,
        summary=ImportScrobbleSummary(inserted=updated_count, skipped=total_missing - updated_count, duplicate=0),
        updated_tracks=updated_track_names,
        errors=skipped_track_names,
    )
