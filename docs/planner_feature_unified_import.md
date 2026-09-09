# Unified Import System — Feature Specification

## 1. Purpose
Add a unified import pipeline that allows importing historical scrobbles from multiple sources (Spotify Extended Streaming History, YouTube Music watch-history.json) into a single canonical scrobble format.

## 2. Canonical Scrobble Format
Fields:
- user_id
- source ("spotify" | "youtube")
- play_id (unique per source)
- played_at (UTC timestamp)
- track_name
- artist_name
- album_name (nullable)
- duration_ms (nullable)
- context.platform
- context.country
- context.raw (JSONB)

## 3. Required Backend Changes
- Add new columns to scrobbles table:
  - source TEXT NOT NULL
  - play_id TEXT NOT NULL
  - raw_metadata JSONB
- Add UNIQUE(user_id, source, play_id)
- Add POST /import/scrobbles endpoint
- Add import service:
  - spotify_import_service.py
  - youtube_import_service.py
- Add canonical normalisation layer:
  - canonical_scrobble.py

## 4. Required Worker Changes
- Worker must be able to ingest canonical scrobbles
- Worker must not assume Spotify-only ingestion
- Worker must support file-based ingestion

## 5. Required Frontend Changes
- Add import UI
- Add import summary screen
- Add source badges in scrobble list

## 6. Required Tests
- Schema migration tests
- Import endpoint tests
- Normalisation tests
- Dedupe tests
