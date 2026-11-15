# Design: Move History File Import to Settings → Data & Support Prep-Script + Raw Exports

**Date:** 2026-11-15  
**Size:** Small change  
**Status:** Draft (awaiting approval)

## Intent & Why
The History File Import UI currently lives on `/connect` (`HomePage.jsx`), which is hard to find in the current navigation/skins. Moving it into **Settings → Data** puts all data management (Sync Liked Songs, Import Listening History, Backfill Missing Artwork, Export Listening History, Delete/Batches) in one obvious place.

At the same time, files produced by the owner's Python prep script (`*_processed.json` with `source`, `artist`, `song`, `release`, `artwork`, `time`) currently fail for Spotify because:
1. Frontend source detection checks `"song" in firstEntry` and mislabels prepped Spotify files as `"youtube"`.
2. Backend `normalize_record(..., "spotify")` only reads raw Spotify fields (`master_metadata_track_name`, `ts`, etc.) and skips every prepped row.

## Goals
- Place **Import Listening History** in **Settings → Data**, working across all skins (Flat, Timeline, Sleeve).
- Support uploading **both**:
  - **Raw exports**: Spotify Extended Streaming History (`Streaming_History_Audio_*.json` / `endsong_*.json`) and raw YouTube Music `watch-history.json`.
  - **Prep-script outputs** (`*_processed.json` for Spotify, YouTube Music, and Apple Music).
- Keep `/connect` tidy by pointing its History File Import card to **Settings → Data**.

## Non-Goals
- Changing the database schema or adding new API endpoints (reuses `POST /import/unified?stream=true`).
- Supporting CSV upload in the browser (prep script already outputs `*_processed.json` alongside `.csv`).
- Modifying the Retro Jukebox or unrelated Settings tabs.

## Anti-Goals
- Importing non-music YouTube videos or Spotify podcasts/audiobooks as music scrobbles.
- Silently dropping valid prepped Spotify rows due to source misdetection.

## Constraints
- Follow `DESIGN.md` ("Flat-By-Default", zero gradients, zero `box-shadow`, approved tokens).
- Keep existing `/import/unified` SSE progress and `ArtworkCache` deduplication intact.
- Never call rate-limited third-party APIs outside existing throttled/optional `enable_deezer_artwork_lookup` import flow.

## Approaches Considered
1. **Unified "Import Listening History" card in Settings → Data (Picked)**  
   Extract the importer into a shared `HistoryImportPanel` component, mount it in **Settings → Data**, link `/connect` to `/settings?tab=data`, and fix both frontend and backend source detection/normalization for raw and prepped Spotify & YouTube files.  
   *Trade-off:* Clean single UI, reuses existing SSE pipeline, works in all skins.
2. **Separate Spotify and YouTube upload buttons in Settings → Data**  
   *Trade-off:* Avoids auto-detection ambiguity but clutters Settings with multiple uploaders (plus Apple Music) and still needs the same backend normalization fixes.

## Design
### Frontend
- Extract the file-picker, `ImportProgressBar`, `ImportSummaryPanel`, and `submitUnifiedImport` logic from `HomePage.jsx` into a reusable `HistoryImportPanel` component.
- Fix source detection in `HistoryImportPanel`: check explicit `firstEntry.source` (`"spotify"`, `"youtube"`, `"apple"`) **before** checking `"song" in firstEntry` or filename heuristics.
- Render `HistoryImportPanel` in **Settings → Data** (`SettingsPage.jsx`) as **Import Listening History**.
- On `/connect` (`HomePage.jsx`), replace the inline file picker in Card 2 with a link button to `/settings?tab=data` ("Open Import in Settings →").
- Update `UserGuideSection.jsx` (and `agents/page_specs.md`) to reference **Settings → Data**.

### Backend (`backend/app/services/processed_import_service.py`)
- `detect_source`: already checks `entry.get("source")` first; ensure `"spotify"` is matched before field-sniffing.
- `normalize_record(..., "spotify")`:
  - Skip podcasts (`episode_name`, `spotify_episode_uri`) and audiobooks (`audiobook_uri`, `audiobook_title`).
  - Support **raw Spotify** fields (`master_metadata_track_name` / `trackName`, `master_metadata_album_artist_name` / `artistName`, `master_metadata_album_album_name` / `albumName`, `ts` / `endTime`, `spotify_track_uri` / `trackUri`, `ms_played` / `msPlayed`).
  - Also support **prep-script** fields (`song` / `title`, `artist`, `release` / `album`, `artwork` / `artwork_url`, `time`), preserving prepped `artwork` in `ArtworkCache` so Deezer isn't re-queried unnecessarily.
- `normalize_record(..., "youtube")`:
  - Support **prep-script** fields (`song`, `artist`, `release`, `artwork`, `time`).
  - For **raw YouTube Takeout** entries (`header` / `subtitles` / `titleUrl`), require `entry.get("header") == "YouTube Music"` and `subtitles[0].name` ending with `"- Topic"` (matching the prep script) so non-music YouTube videos are skipped.

## Left to the Builder
- Update/add Vitest tests (`SettingsPage.test.jsx`, `HistoryImportPanel.test.jsx` or `monthlyLedger.test.jsx`) and Pytest tests (`test_unified_import.py`).
- Run full backend, frontend, lint, and E2E checks before preview.
