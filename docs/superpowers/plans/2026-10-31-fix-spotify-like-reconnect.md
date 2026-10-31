# Fix Spotify Two-Way Like Reconnect & Scopes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the root causes preventing track/album liking from working and triggering the "Please reconnect your Spotify account" banner, and provide an effortless 1-click reconnect experience.

**Root Causes Identified:**
1. **Missing `user-library-modify` in Docker Compose default variables:** In `docker-compose.yml` and `docker-compose.prod.yml`, the default fallback for `SPOTIFY_SCOPES` was not updated when `user-library-modify` was introduced in commit `0512da0f`. When running with Docker without an overridden `.env` value, the container defaults to the old scopes without `user-library-modify`.
2. **Missing 1-Click "Reconnect Spotify" Action in Settings & Alerts:** The alert banner tells the user *"Please reconnect your Spotify account in Settings to enable liking."*, but in `SettingsPage.jsx` there was no explicit "Reconnect Spotify" button (it was only in ScopeCreepTools if playlist permissions were missing), making it confusing for users to grant the new scope.
3. **Backend Discarding Spotify Diagnostic Details:** `_call_user_spotify` in `backend/app/services/spotify_library_service.py` caught HTTP 403 and immediately raised `HTTPException(status_code=403, detail="needs_spotify_reconnect")` without logging Spotify's error body (`resp.text`), obscuring whether 403 was due to scopes, account restrictions, or request format.
4. **Spotify API Payload Standards:** Spotify Web API documentation prefers `json={"ids": [track_id]}` over empty-body `PUT` queries for `/v1/me/tracks` and `/v1/me/albums` to avoid HTTP 400/403 rejections on proxies or strict endpoints.
5. **Minor Component Prop Mismatch:** `LikedHeart.jsx` accepts `title`, but `LibraryScrobbleList.jsx` and `LibraryRankList.jsx` passed `label=...`.

---

## Tasks

### Task 1: Update Docker Compose Scopes & Backend Spotify Request Handling

**Files:**
- Modify `docker-compose.yml`
- Modify `docker-compose.prod.yml`
- Modify `backend/app/services/spotify_library_service.py`
- Modify `backend/app/tests/test_spotify_library_likes.py`

**Steps:**
- [ ] **Step 1: Write backend tests in `backend/app/tests/test_spotify_library_likes.py`**
  - Verify `toggle_like_track` and `toggle_like_album` pass `json={"ids": [id]}` request bodies.
  - Verify `_call_user_spotify` logs Spotify's exact response body on error before raising.
- [ ] **Step 2: Run pytest to see baseline test output**
  ```bash
  python -m pytest backend/app/tests/test_spotify_library_likes.py
  ```
- [ ] **Step 3: Update `docker-compose.yml` and `docker-compose.prod.yml`**
  - Add `user-library-modify` to the `${SPOTIFY_SCOPES:-...}` default strings.
- [ ] **Step 4: Update `backend/app/services/spotify_library_service.py`**
  - In `_call_user_spotify`, log `logger.warning("Spotify API %s %s returned %s: %s", method, url, resp.status_code, resp.text)` before raising exceptions.
  - In `toggle_like_track`, use `json={"ids": [track_id]}` on PUT and pass ids properly to avoid empty PUT body issues.
  - In `toggle_like_album`, use `json={"ids": [resolved_id]}` on PUT.
- [ ] **Step 5: Run tests to verify they pass**
  ```bash
  python -m pytest backend/app/tests/test_spotify_library_likes.py
  ```

---

### Task 2: Add 1-Click Reconnect Button & Direct Actions

**Files:**
- Modify `frontend/src/pages/SettingsPage.jsx`
- Modify `frontend/src/pages/LibraryPage.jsx`
- Modify `frontend/src/pages/OverviewPage.jsx`
- Modify `frontend/src/pages/HomePage.jsx`
- Modify `frontend/src/components/LikedHeart.jsx`
- Modify `frontend/src/components/LibraryScrobbleList.jsx`
- Modify `frontend/src/components/LibraryRankList.jsx`

**Steps:**
- [ ] **Step 1: Update `LikedHeart.jsx` prop handling**
  - Accept `label` or `title` seamlessly in `LikedHeart.jsx` so callers passing either work cleanly without warnings.
- [ ] **Step 2: Add a dedicated Spotify Account Reconnect card in `SettingsPage.jsx`**
  - Inside the "General" or "Scrobble" settings tab, render a clear status block showing the connected Spotify account with a 1-click **"Reconnect Spotify (Update Permissions)"** button that initiates OAuth with `force_dialog=true`.
- [ ] **Step 3: Upgrade the reconnect alert banner in `LibraryPage.jsx`, `OverviewPage.jsx`, and `HomePage.jsx`**
  - Instead of a plain text banner *"Please reconnect your Spotify account in Settings to enable liking."*, make it an interactive banner containing a direct **"Reconnect Spotify"** button that immediately triggers the OAuth reconnect flow.
- [ ] **Step 4: Run frontend tests & lint**
  ```bash
  cd frontend && npm run lint && npm test
  ```

---

### Task 3: Verification & Documentation

**Files:**
- Modify `frontend/src/changelogData.js`
- Modify `frontend/package.json`

**Steps:**
- [ ] **Step 1: Bump version and add changelog entry in `frontend/src/changelogData.js`**
- [ ] **Step 2: Run all linters and tests across frontend, backend, and worker**
  ```bash
  ruff check backend/app worker scripts
  ruff format --check backend/app worker scripts
  PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q
  cd frontend && npm run lint && npm test && npm run build
  ```
- [ ] **Step 3: Run differential-review skill and review changes**
