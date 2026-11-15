# Settings History Import & Prep-Script Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the History File Import UI into **Settings → Data** and fix frontend/backend parsing so both raw exports and prep-script (`*_processed.json`) files for Spotify and YouTube Music import cleanly.

**Architecture:** Extract the existing file-import logic (`submitUnifiedImport`, `ImportProgressBar`, `ImportSummaryPanel`, and source detection) from `HomePage.jsx` into a reusable `HistoryImportPanel` component mounted in `SettingsPage.jsx` under the `data` tab, while `/connect` links to `/settings?tab=data`. On the backend, update `processed_import_service.py` so Spotify normalization accepts both raw Extended Streaming History and prep-script records, and raw YouTube Takeout filtering matches the prep script's `YouTube Music` + `- Topic` rules.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic v2, Pytest, React 18, Vite, Vitest, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-15-settings-history-import-design.md`

## Global Constraints
- Follow `DESIGN.md` ("Flat-By-Default": zero gradients, zero `box-shadow`, approved color tokens only).
- Reuse `POST /import/unified?stream=true` and `ArtworkCache` deduplication; no schema/migration changes.
- Never call rate-limited third-party APIs outside the existing optional `enable_deezer_artwork_lookup` import flow.
- Imports in Python must be at module level (Ruff `PLC0415`).
- In Vitest tests, always call `afterEach(() => cleanup())`.

## Review Focus
1. **Prepped Spotify JSON (`{"source": "Spotify", "song": ..., "artist": ..., "time": ...}`):** Frontend must detect `"spotify"` (not `"youtube"` because `"song"` is present), and backend `normalize_record(..., "spotify")` must import it with `artwork` preserved.
2. **Raw Spotify Extended Streaming History (`Streaming_History_Audio_*.json`):** Valid music plays import cleanly; podcast episodes (`episode_name` / `spotify_episode_uri`), audiobooks (`audiobook_uri` / `audiobook_title`), and rows with `null` `master_metadata_track_name` are skipped.
3. **Raw YouTube Takeout (`watch-history.json`):** Non-music YouTube videos (`header != "YouTube Music"` or channel not ending in `"- Topic"`) are skipped, matching the prep script.
4. **Re-selecting the same file & error recovery:** Clearing `event.target.value = ""` after upload so a user can retry the same file after fixing an error.
5. **Cross-skin & `/connect` navigation:** Settings → Data renders `HistoryImportPanel` in Flat, Timeline, and Sleeve skins, and `/connect` links cleanly to `/settings?tab=data`.

---

### Task 1: Backend — Support Prep-Script Spotify Records & Tighten Raw YouTube Filtering

**Files:**
- Modify: `backend/app/services/processed_import_service.py:148-281`
- Test: `backend/app/tests/test_unified_import.py`

**Interfaces:**
- Consumes: `entries: list[dict[str, Any]]`, `source_hint: str | None`
- Produces:
  - `detect_source(entries: list[dict[str, Any]], hint_source: str | None = None) -> str`
  - `normalize_record(entry: dict[str, Any], source: str) -> dict[str, Any] | None`

- [ ] **Step 1: Write failing tests for prepped Spotify records and raw YouTube non-Topic filtering**

Add tests to `backend/app/tests/test_unified_import.py`:
- `test_detect_source_prefers_explicit_spotify_over_song_key`: `[{"source": "Spotify", "artist": "Foals", "song": "Spanish Sahara", "release": "Total Life Forever", "artwork": "https://cdn.example/art.jpg", "time": "2012-11-24T15:31:53Z"}]` returns `"spotify"`.
- `test_normalize_spotify_accepts_prepped_script_format`: normalizes a prep-script Spotify dict (`source: "Spotify"`, `artist`, `song`, `release`, `artwork`, `time`) into `artist_name="Foals"`, `song_name="Spanish Sahara"`, `album_name="Total Life Forever"`, `artwork_url="https://cdn.example/art.jpg"`, `source="spotify"`.
- `test_normalize_spotify_extended_streaming_history_skips_podcasts_and_audiobooks`: verifies real Extended Streaming History sample row imports, while rows with `episode_name`, `audiobook_uri`, or `master_metadata_track_name: None` return `None`.
- `test_normalize_youtube_raw_takeout_requires_youtube_music_and_topic_channel`: verifies raw Takeout row with `header: "YouTube"` or `subtitles: [{"name": "Regular Channel"}]` returns `None`, while `header: "YouTube Music"` + `subtitles: [{"name": "Foals - Topic"}]` normalizes with `artist_name="Foals"`.

- [ ] **Step 2: Run pytest to verify the new tests fail**

Run: `PYTHONPATH=worker python -m pytest backend/app/tests/test_unified_import.py -q`
Expected: FAIL on `test_normalize_spotify_accepts_prepped_script_format` and `test_normalize_youtube_raw_takeout_requires_youtube_music_and_topic_channel`.

- [ ] **Step 3: Update `normalize_record` in `backend/app/services/processed_import_service.py`**

- In `source == "spotify"`:
  - Keep podcast (`episode_name`, `spotify_episode_uri`) and audiobook (`audiobook_uri`, `audiobook_title`) skip guards.
  - Fall back to prep-script keys when raw Spotify keys are absent:
    - `song_name = entry.get("master_metadata_track_name") or entry.get("trackName") or entry.get("song") or entry.get("title")`
    - `artist_name = entry.get("master_metadata_album_artist_name") or entry.get("artistName") or entry.get("artist")`
    - `album_name = entry.get("master_metadata_album_album_name") or entry.get("albumName") or entry.get("release") or entry.get("album")`
    - `time_str = entry.get("ts") or entry.get("endTime") or entry.get("time")`
    - `artwork_url = entry.get("artwork") or entry.get("artwork_url")` (cleaned against `"no artwork"`, `"none"`, `"null"`, returning `None` if empty).
  - Include `"artwork_url": cleaned_art` in the returned dict.
- In `source == "youtube"`:
  - Distinguish raw Takeout entries (`"header" in entry or "subtitles" in entry or "titleUrl" in entry`) from prepped entries (`song` / `artist` / `time`).
  - For raw Takeout entries, require `entry.get("header") == "YouTube Music"` and `subtitles[0].get("name", "").endswith("- Topic")`, stripping `" - Topic"` for `artist_name` and `"Watched "` for `song_name`.

- [ ] **Step 4: Run pytest and Ruff to verify all backend tests pass**

Run: `PYTHONPATH=worker python -m pytest backend/app/tests/test_unified_import.py -q && ruff check backend/app/services/processed_import_service.py backend/app/tests/test_unified_import.py`
Expected: PASS, 0 lint errors.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/processed_import_service.py backend/app/tests/test_unified_import.py
git commit -m "fix(import): support prep-script Spotify JSON and tighten raw YouTube filtering"
```

---

### Task 2: Frontend — Extract `HistoryImportPanel` & Fix Source Detection

**Files:**
- Create: `frontend/src/components/HistoryImportPanel.jsx`
- Create: `frontend/src/components/HistoryImportPanel.test.jsx`

**Interfaces:**
- Consumes: `ImportProgressBar`, `ImportSummaryPanel`, `submitUnifiedImport`, `submitImportScrobbles` from `../api`
- Produces: `HistoryImportPanel({ token, onImportComplete, submitImportFn })` (and `detectImportSource(entries, filename)` helper)

- [ ] **Step 1: Write failing tests in `frontend/src/components/HistoryImportPanel.test.jsx`**

Test cases:
- `detects explicit "Spotify" source from prep-script JSON even when "song" key is present`
- `detects "youtube" from explicit "YouTube Music" source or raw Takeout fields`
- `detects "spotify" from raw Extended Streaming History (ts + master_metadata_track_name)`
- `renders progress and ImportSummaryPanel on successful import and calls onImportComplete`
- `resets file input value after selection and shows error on empty/invalid JSON`

- [ ] **Step 2: Run Vitest to verify tests fail**

Run: `cd frontend && npx vitest run src/components/HistoryImportPanel.test.jsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `frontend/src/components/HistoryImportPanel.jsx`**

- Export `detectImportSource(entries, filename)`:
  1. Check `firstEntry.source` (`"apple"`/`"itunes"`, `"youtube"`, `"spotify"`) **first**.
  2. Then check raw YouTube fields (`"subtitles" in firstEntry`, `"titleUrl" in firstEntry`, `firstEntry.header === "YouTube Music"`).
  3. Then check raw Spotify fields (`"master_metadata_track_name" in firstEntry`, `"ts" in firstEntry`, `"trackName" in firstEntry`, `"endTime" in firstEntry`).
  4. Then check `"song" in firstEntry` (legacy prepped YouTube without `source`), then filename hints (`apple`, `youtube`, `watch-history`), defaulting to `"spotify"`.
- Render the `.import-panel` with `<label className="import-picker">`, `<input type="file" accept="application/json,.json" onChange={handleImport} />`, `ImportProgressBar`, and `ImportSummaryPanel`. Reset `event.target.value = ""` in `finally`.

- [ ] **Step 4: Run Vitest and ESLint**

Run: `cd frontend && npx vitest run src/components/HistoryImportPanel.test.jsx && npm run lint`
Expected: PASS, 0 lint errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/HistoryImportPanel.jsx frontend/src/components/HistoryImportPanel.test.jsx
git commit -m "feat(import): extract HistoryImportPanel with accurate prep-script source detection"
```

---

### Task 3: Frontend — Mount `HistoryImportPanel` in Settings → Data, Link from `/connect`, & Update Docs

**Files:**
- Modify: `frontend/src/pages/SettingsPage.jsx:829-968` (Data tab)
- Modify: `frontend/src/pages/HomePage.jsx:17-18,288-355,443-493` (`/connect` Card 2)
- Modify: `frontend/src/components/settings/UserGuideSection.jsx:124-128`
- Modify: `frontend/src/pages/SettingsPage.test.jsx`
- Modify: `frontend/src/App.test.jsx:220-286`
- Modify: `agents/page_specs.md`

**Interfaces:**
- Consumes: `HistoryImportPanel` from `../components/HistoryImportPanel`

- [ ] **Step 1: Update tests in `SettingsPage.test.jsx` and `App.test.jsx` for Settings → Data**

- In `SettingsPage.test.jsx`: add a test verifying the Data tab renders the **Import Listening History** heading and `"Import history JSON"` file input, and triggers `submitUnifiedImport` when a Spotify JSON file is selected.
- In `App.test.jsx`: update the two `"History File Import"` tests (lines 220–286) to render `/settings?tab=data` (or navigate to Settings → Data) instead of `/connect`, and add an assertion that `/connect`'s History File Import card links to `/settings?tab=data`.

- [ ] **Step 2: Run Vitest to verify the updated tests fail**

Run: `cd frontend && npx vitest run src/pages/SettingsPage.test.jsx src/App.test.jsx`
Expected: FAIL because `SettingsPage` does not yet render `HistoryImportPanel`.

- [ ] **Step 3: Wire `HistoryImportPanel` into `SettingsPage.jsx`, update `HomePage.jsx`, `UserGuideSection.jsx`, and `agents/page_specs.md`**

- In `SettingsPage.jsx` (`activeTab === "data"`): render a new **Import Listening History** section with `<HistoryImportPanel token={session.accessToken} />` above **Backfill Missing Artwork**, with description noting support for Spotify JSON exports, YouTube Music `watch-history.json`, and prep-script `*_processed.json` files.
- In `HomePage.jsx`: remove the duplicated `handleImport`, `importResult`/`importError`/`liveProgress` state, and inline file picker from Card 2; replace Card 2's action with a `<Link to="/settings?tab=data" className="btn-secondary">Open Import in Settings →</Link>`. Clean up unused imports (`submitUnifiedImport`, `submitImportScrobbles`, `ImportSummaryPanel`, `importInputRef`).
- Update `UserGuideSection.jsx` line 125–128 and `agents/page_specs.md` to reference **Settings → Data**.

- [ ] **Step 4: Run Vitest, ESLint, and Prettier**

Run: `cd frontend && npx prettier --write src/components/HistoryImportPanel.jsx src/components/HistoryImportPanel.test.jsx src/pages/SettingsPage.jsx src/pages/HomePage.jsx src/components/settings/UserGuideSection.jsx src/pages/SettingsPage.test.jsx src/App.test.jsx && npm run lint && npm test`
Expected: PASS, 0 lint errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/SettingsPage.jsx frontend/src/pages/HomePage.jsx frontend/src/components/settings/UserGuideSection.jsx frontend/src/pages/SettingsPage.test.jsx frontend/src/App.test.jsx agents/page_specs.md
git commit -m "feat(settings): move History File Import into Settings > Data"
```

---

### Task 4: Full Verification, Changelog, Security Review & Preview

**Files:**
- Modify: `frontend/package.json` (bump version)
- Modify: `frontend/src/changelogData.js` (add release entry at top)

- [ ] **Step 1: Run full backend & worker test suite and Python linters**
  - `ruff check backend/app worker scripts`
  - `ruff format --check backend/app worker scripts`
  - `PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q`
- [ ] **Step 2: Run full frontend lint, unit tests, production build, and Playwright E2E tests**
  - `cd frontend && npm run lint && npm test && npm run build`
  - `cd frontend && npm run test:e2e`
- [ ] **Step 3: Run `differential-review` and `pwa-failure-points` quick check on the whole branch**
- [ ] **Step 4: Bump version in `frontend/package.json` and add entry in `frontend/src/changelogData.js`, commit, and push branch**
