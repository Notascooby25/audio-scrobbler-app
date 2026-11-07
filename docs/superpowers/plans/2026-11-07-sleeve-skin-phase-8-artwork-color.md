# Implementation Plan: Sleeve Skin Phase 8 (Artwork Color & Dynamic Sleeve Tinting)

## 1. Overview & Goals
Implement **Phase 8: Sleeve colour from artwork** according to `docs/design/sleeve-skin.md`:
- **Backend Color Extraction & Caching:**
  - Add `Pillow` dependency to `backend/requirements.txt` and `worker/requirements.txt`.
  - Add Alembic migration `0033_add_artwork_color_and_match_sleeve.py`:
    - Add `dominant_color VARCHAR(7)` to `artwork_cache` table.
    - Add `artwork_color VARCHAR(7)` to `listening_events` table.
    - Add `match_album_sleeve BOOLEAN DEFAULT TRUE NOT NULL` to `user_preferences` table.
  - Implement a fast, cached color extraction helper `extract_dominant_color(image_bytes)` in `backend/app/services/color_service.py` that resizes image thumbnails and returns a normalized hex code (`#rrggbb`).
  - Update `setlist_artwork_service.py`, `ingestion_service.py`, and `social_service.py` / `users.py` (`/now-playing` and `/recent`) so that resolved artwork computes/stores `dominant_color` in `ArtworkCache` and serves `artwork_color` on scrobbles and now-playing responses.
- **Frontend Dynamic Sleeve Tinting:**
  - Add `match_album_sleeve` to `UserPreferencesResponse` and `UserPreferencesUpdate` schemas in frontend `api.js` and `SettingsPage.jsx`.
  - In `SettingsPage.jsx` Appearance section: Add the "Match the album sleeve" toggle switch (default: enabled).
  - In `SleeveTodayPage.jsx` (and global Sleeve skin runner): Dynamically update the `--sleeve` CSS custom property on `document.documentElement` when the hero track or currently playing record changes.
  - Dynamically calculate `--sl-on-sleeve` contrast: `#ffffff` for dark covers, `#1a1305` for bright covers (e.g. Yellow/Gold), ensuring $\ge 4.5:1$ contrast.
  - Smooth cross-fade transition: Maintain 300ms transition on `--sl-ground` unless `prefers-reduced-motion` is active.
- **Strict Invariants:**
  - Classic skin remains 100% pixel-identical in both light and dark themes.
  - Zero gradients, zero box-shadows (except `none`).
  - `RetroJukebox.jsx` and `RetroJukebox.module.css` remain untouched.
  - Network timeouts: Any artwork download failure or timeout falls back gracefully to `artwork_color = None` without delaying API responses.

---

## 2. Impact Analysis
- **Components & Files Modified**:
  - `backend/requirements.txt` & `worker/requirements.txt`: Add `pillow>=10.4.0`.
  - `backend/app/models.py`: Update `ArtworkCache`, `ListeningEvent`, and `UserPreference`.
  - `backend/migrations/versions/0033_add_artwork_color_and_match_sleeve.py`: New Alembic migration.
  - `backend/app/schemas/preferences.py`: Add `match_album_sleeve`.
  - `backend/app/schemas/events.py` & `backend/app/schemas/social.py`: Add `artwork_color` field to responses.
  - `backend/app/services/color_service.py`: Color extraction logic and unit tests.
  - `backend/app/api/users.py`: Return `artwork_color` in `NowPlayingResponse`.
  - `frontend/src/pages/SettingsPage.jsx`: "Match the album sleeve" switch in Appearance.
  - `frontend/src/skins/sleeve/slots/SleeveTodayPage.jsx` & `frontend/src/skins/sleeve/sleeveColor.js`: Dynamic `--sleeve` and `--sl-on-sleeve` calculation.
  - `frontend/src/skins/sleeve/sleeve.css`: Ensure 300ms transition for `--sl-ground`.
- **Tests Added/Updated**:
  - `backend/app/tests/test_color_service.py`: Verify RGB extraction on synthetic test images, corrupted images, and timeouts.
  - `backend/app/tests/test_artwork_color_migration.py`: Verify migration upgrades and downgrades cleanly.
  - `frontend/src/skins/sleeve/sleeveColor.test.js`: Verify luminance calculation and contrast ratios for dark, mid-tone, and bright colors.

---

## 3. Regression Checklist
- **Classic Invariant**: When `skin == 'classic'`, `--sleeve` and `match_album_sleeve` have zero effect on styles.
- **Offline / Miss Invariant**: When a track has no artwork or network fails, `--sleeve` cleanly falls back to `var(--color-primary)`.
- **Database Rollback Safety**: Migration has explicit, reversible `downgrade()` drop statements.
- **Performance**: Color calculation happens once per unique artwork and is cached in `ArtworkCache`.

---

## 4. Implementation Steps

### Step 1: Add Pillow Dependency & Color Extraction Service
- Add `pillow>=10.4.0` to `backend/requirements.txt` and `worker/requirements.txt`.
- Install in local environment: `.venv/bin/pip install pillow`.
- Create `backend/app/services/color_service.py`:
  - `extract_dominant_color(image_bytes: bytes) -> str | None`: Resize to thumbnail in-memory with Pillow, calculate dominant color, return `#rrggbb`.
  - Handle corrupt image bytes gracefully returning `None`.
- Write unit tests in `backend/app/tests/test_color_service.py`.
- **Files**: `backend/requirements.txt`, `worker/requirements.txt`, `backend/app/services/color_service.py`, `backend/app/tests/test_color_service.py`.
- **Tests**: `PYTHONPATH=worker .venv/bin/pytest backend/app/tests/test_color_service.py -q`
- **Commit**: `feat(backend): add pillow dependency and dominant color extraction service (Planner Step 1)`

### Step 2: Database Migration for Artwork Color & Match Sleeve Preference
- Create `backend/migrations/versions/0033_add_artwork_color_and_match_sleeve.py`.
- Update `backend/app/models.py`:
  - `ArtworkCache.dominant_color: Mapped[str | None] = mapped_column(String(7), nullable=True)`
  - `ListeningEvent.artwork_color: Mapped[str | None] = mapped_column(String(7), nullable=True)`
  - `UserPreference.match_album_sleeve: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)`
- Update `backend/app/schemas/preferences.py` with `match_album_sleeve: bool = True`.
- Update `backend/app/services/preferences_service.py` to persist and return `match_album_sleeve`.
- Run migration test against Postgres and SQLite.
- **Files**: `backend/migrations/versions/0033_add_artwork_color_and_match_sleeve.py`, `backend/app/models.py`, `backend/app/schemas/preferences.py`, `backend/app/services/preferences_service.py`.
- **Tests**: `PYTHONPATH=worker .venv/bin/pytest backend/app/tests/test_preferences.py -q`
- **Commit**: `feat(db): add migration for artwork color and match sleeve preference (Planner Step 2)`

### Step 3: Cache Dominant Color on Ingestion & Serve in API
- In `backend/app/services/setlist_artwork_service.py` and `backend/app/services/ingestion_service.py`:
  - When artwork URL is resolved, fetch/derive dominant color and cache in `ArtworkCache.dominant_color`.
  - Propagate `artwork_color` to `ListeningEvent.artwork_color`.
- In `backend/app/api/users.py`:
  - In `now_playing()`: Look up cached color for `artwork_url` from `ArtworkCache` (or compute if absent) and return in `NowPlayingResponse.artwork_color`.
- Update API responses and tests.
- **Files**: `backend/app/services/setlist_artwork_service.py`, `backend/app/services/ingestion_service.py`, `backend/app/api/users.py`, `backend/app/schemas/social.py`.
- **Tests**: `PYTHONPATH=worker .venv/bin/pytest backend/app/tests/test_ingestion.py backend/app/tests/test_social.py -q`
- **Commit**: `feat(backend): cache dominant color and return artwork_color in scrobble APIs (Planner Step 3)`

### Step 4: Frontend Settings Switch for "Match the album sleeve"
- In `frontend/src/pages/SettingsPage.jsx`:
  - Add `match_album_sleeve` toggle in the Appearance tab below the Skin picker.
  - Wire to `api.updateUserPreferences` and local state.
- Update tests in `frontend/src/pages/SettingsPage.test.jsx`.
- **Files**: `frontend/src/pages/SettingsPage.jsx`, `frontend/src/pages/SettingsPage.test.jsx`.
- **Tests**: `cd frontend && npm test -- src/pages/SettingsPage.test.jsx`
- **Commit**: `feat(settings): add match album sleeve appearance switch (Planner Step 4)`

### Step 5: Frontend Dynamic Sleeve Color & Contrast Helper
- Create `frontend/src/skins/sleeve/sleeveColor.js`:
  - `applySleeveColor(artworkColor, matchAlbumSleeve)`:
    - If enabled and `artworkColor` is present: Set `--sleeve: ${artworkColor}` on `document.documentElement`.
    - Compute relative luminance: if $L > 0.4$ set `--sl-on-sleeve: #1a1305`, else `#ffffff`.
    - If disabled or absent: Remove custom property (falls back to `--color-primary`).
- In `frontend/src/skins/sleeve/slots/SleeveTodayPage.jsx`:
  - Call `applySleeveColor(heroTrack?.artwork_color, preferences?.match_album_sleeve)` on mount and when hero track updates.
- In `frontend/src/skins/sleeve/sleeve.css`:
  - Add `transition: background-color 300ms ease;` to `[data-skin="sleeve"]`.
  - Add `@media (prefers-reduced-motion: reduce) { [data-skin="sleeve"] { transition: none !important; } }`.
- Write unit tests in `frontend/src/skins/sleeve/sleeveColor.test.js`.
- **Files**: `frontend/src/skins/sleeve/sleeveColor.js`, `frontend/src/skins/sleeve/slots/SleeveTodayPage.jsx`, `frontend/src/skins/sleeve/sleeve.css`, `frontend/src/skins/sleeve/sleeveColor.test.js`.
- **Tests**: `cd frontend && npm test -- src/skins/sleeve/sleeveColor.test.js`
- **Commit**: `feat(skins): dynamic sleeve color tinting and contrast calculation (Planner Step 5)`

### Step 6: Full Verification, Screenshots & Preview
- Run full test suite:
  - Backend: `PYTHONPATH=worker .venv/bin/pytest backend/app/tests worker/tests -q`
  - Ruff: `ruff check backend/app worker scripts && ruff format --check backend/app worker scripts`
  - Frontend: `cd frontend && npm run lint && npm test && npm run build`
  - Playwright E2E: `cd frontend && npm run test:e2e`
- Start preview: `scripts/preview.sh up`.
- Capture preview screenshots showing dynamic artwork tinting with real listening data.
- Stop preview: `scripts/preview.sh down`.
- **Files**: `mobile_preview.md`.
- **Commit**: `docs(skins): update mobile preview with phase 8 artwork color screenshots (Planner Step 6)`

---

## 5. Execution Recommendation
I recommend **native execution** directly upon your confirmation so we can build, test, and capture screenshots smoothly.

Confirm to proceed.
