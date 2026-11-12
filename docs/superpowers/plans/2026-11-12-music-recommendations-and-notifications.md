# Music Recommendations & Notification Stream Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide a 1-tap music recommendation feature between followed users with a discovery hero on `/play`, and overhaul notifications with dismissal and 30-day retention cleanup.

**Architecture:** Add a `music_recommendations` table and update `notifications` with a link field in Alembic. Add backend endpoints for creating, listing, and transitioning recommendations and deleting notifications. On the frontend, add the share button to track/album lists and grids, create the recommendation modal, embed the recommendations hero card at Position 1 across all 3 Play page skins, and add dismissal controls to Settings notifications.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic, React 18, Vite, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-12-music-recommendations-and-notifications-design.md`

## Global Constraints
- Python: Follow PEP 8 and PEP 484 type hints (`from __future__ import annotations`), SQLAlchemy 2.0 mapped models, top-of-module imports.
- Frontend: Flat-By-Default design rules (zero gradients, zero box-shadow outside approved tokens).
- Protected component: Retro Jukebox cabinet is untouched.
- Reused components: Preserve multi-surface invariants on `ScrobbleList`, `LibraryRankList`, and artwork overlays.
- Never commit or push to `main`; work on a feature branch.

## Review Focus
1. Non-followed recipient: Backend rejects recommendation attempts if sender does not follow receiver (`403 Forbidden`).
2. Self-recommendation: Backend rejects recommendation if `sender_id == receiver_id` (`400 Bad Request`).
3. Recommendation status transitions: Calling status endpoint with invalid transition or wrong user yields `404 Not Found` or `400 Bad Request`.
4. Empty active recommendations: Play page hero renders null when pending count is 0 with zero DOM leakage or spacing shifts.
5. Notification bulk delete safety: `DELETE /api/notifications` with `read_only=true` only purges `is_read == True` notifications.

---

### Task 1: Database Migration for Recommendations & Notification Link

**Files:**
- Create: `backend/migrations/versions/<timestamp>_add_music_recommendations.py`
- Modify: `backend/app/models.py`
- Test: `backend/app/tests/test_recommendations_model.py`

**Interfaces:**
- Produces: `MusicRecommendation` SQLAlchemy model and updated `Notification.link` field.

- [ ] **Step 1: Write the failing model test**
  Assert `MusicRecommendation` model has columns `id`, `sender_id`, `receiver_id`, `item_type`, `title`, `artist_name`, `album_name`, `image_url`, `spotify_uri`, `spotify_url`, `note`, `status`, `created_at`, `updated_at`, and `Notification` has `link`.

- [ ] **Step 2: Run test to verify it fails**
  Run: `PYTHONPATH=worker pytest backend/app/tests/test_recommendations_model.py -v`
  Expected: FAIL (ImportError / AttributeError)

- [ ] **Step 3: Implement model in `backend/app/models.py` and Alembic migration**
  Add `MusicRecommendation` to `backend/app/models.py`, add `link: Mapped[str | None]` to `Notification`. Create Alembic migration script.

- [ ] **Step 4: Run test to verify it passes**
  Run: `PYTHONPATH=worker pytest backend/app/tests/test_recommendations_model.py -v`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add backend/app/models.py backend/migrations/versions/ backend/app/tests/test_recommendations_model.py
  git commit -m "feat(db): add music_recommendations table and notification link"
  ```

---

### Task 2: Recommendations Backend API & Notification Dismissal Endpoints

**Files:**
- Create: `backend/app/api/recommendations.py`
- Create: `backend/app/schemas/recommendations.py`
- Modify: `backend/app/api/notifications.py`
- Modify: `backend/app/main.py`
- Test: `backend/app/tests/test_recommendations_api.py`
- Test: `backend/app/tests/test_notifications_cleanup.py`

**Interfaces:**
- Consumes: `MusicRecommendation`, `Notification`, `Follow` models.
- Produces:
  - `POST /api/recommendations`
  - `GET /api/recommendations/active`
  - `PATCH /api/recommendations/{id}/status`
  - `DELETE /api/notifications/{id}`
  - `DELETE /api/notifications`

- [ ] **Step 1: Write failing API tests**
  Test creating recommendation to followed user (creates recommendation + in-app notification with link `/play`), test 403 when not following, test fetching active recommendations, test status transition to `listened` and `dismissed`, test notification deletion (single and clear read).

- [ ] **Step 2: Run tests to verify they fail**
  Run: `PYTHONPATH=worker pytest backend/app/tests/test_recommendations_api.py backend/app/tests/test_notifications_cleanup.py -v`
  Expected: FAIL (404/500 endpoints do not exist)

- [ ] **Step 3: Implement schemas and API router**
  Create `backend/app/schemas/recommendations.py`, `backend/app/api/recommendations.py`, and update `backend/app/api/notifications.py` with `DELETE` endpoints and 30-day cleanup logic. Register router in `backend/app/main.py`.

- [ ] **Step 4: Run tests to verify they pass**
  Run: `PYTHONPATH=worker pytest backend/app/tests/test_recommendations_api.py backend/app/tests/test_notifications_cleanup.py -v`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add backend/app/api/ backend/app/schemas/ backend/app/main.py backend/app/tests/
  git commit -m "feat(api): implement recommendations and notification cleanup endpoints"
  ```

---

### Task 3: Frontend API Client & Recommend Share Modal

**Files:**
- Create: `frontend/src/components/recommend/RecommendModal.jsx`
- Create: `frontend/src/components/recommend/RecommendButton.jsx`
- Modify: `frontend/src/api.js`
- Test: `frontend/src/components/recommend/RecommendModal.test.jsx`
- Test: `frontend/src/components/recommend/RecommendButton.test.jsx`

**Interfaces:**
- Consumes: Backend recommendations API.
- Produces: `RecommendButton` component rendering share icon next to heart, opening `RecommendModal`.

- [ ] **Step 1: Write failing frontend component tests**
  Test `RecommendButton` renders with proper accessible label and contrast badge in grid vs list; test `RecommendModal` lists followed users, accepts note input, and calls API on submit.

- [ ] **Step 2: Run tests to verify they fail**
  Run: `cd frontend && npm test -- RecommendModal RecommendButton`
  Expected: FAIL

- [ ] **Step 3: Implement `api.js` methods, `RecommendButton`, and `RecommendModal`**
  Add `sendRecommendation`, `getActiveRecommendations`, `updateRecommendationStatus`, `deleteNotification`, and `clearReadNotifications` to `api.js`. Implement UI components.

- [ ] **Step 4: Run tests to verify they pass**
  Run: `cd frontend && npm test -- RecommendModal RecommendButton`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add frontend/src/api.js frontend/src/components/recommend/
  git commit -m "feat(ui): add RecommendButton and RecommendModal components"
  ```

---

### Task 4: Integrate Recommend Button into Library and Scrobble Views

**Files:**
- Modify: `frontend/src/components/LibraryRankList.jsx`
- Modify: `frontend/src/components/ScrobbleList.jsx`
- Modify: `frontend/src/skins/timeline/slots/TimelineScrobbleRow.jsx`
- Test: `frontend/src/components/LibraryRankList.test.jsx`
- Test: `frontend/src/components/ScrobbleList.test.jsx`

**Interfaces:**
- Consumes: `RecommendButton`.
- Produces: Everywhere a heart appears in lists and grids, the share button sits to its left.

- [ ] **Step 1: Write failing integration tests**
  Assert share icon appears adjacent to the like button in list and grid rows.

- [ ] **Step 2: Run tests to verify they fail**
  Run: `cd frontend && npm test -- LibraryRankList ScrobbleList`
  Expected: FAIL

- [ ] **Step 3: Implement RecommendButton integration**
  Update list and grid item renderers to include `RecommendButton` with item metadata (`itemType`, `title`, `artist`, `album`, `imageUrl`, `spotifyUri`).

- [ ] **Step 4: Run tests to verify they pass**
  Run: `cd frontend && npm test -- LibraryRankList ScrobbleList`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add frontend/src/components/LibraryRankList.jsx frontend/src/components/ScrobbleList.jsx frontend/src/skins/
  git commit -m "feat(ui): integrate RecommendButton into scrobble and library views"
  ```

---

### Task 5: Play Page Hero Card Across All Skins

**Files:**
- Create: `frontend/src/components/recommend/FriendRecommendationsCard.jsx`
- Modify: `frontend/src/pages/OverviewPage.jsx`
- Modify: `frontend/src/skins/sleeve/slots/SleevePlayPage.jsx`
- Modify: `frontend/src/skins/timeline/slots/TimelinePlayPage.jsx`
- Test: `frontend/src/components/recommend/FriendRecommendationsCard.test.jsx`

**Interfaces:**
- Consumes: `getActiveRecommendations`, `updateRecommendationStatus`.
- Produces: `FriendRecommendationsCard` mounted at Position 1 (above Jukebox) in all 3 skins.

- [ ] **Step 1: Write failing card tests**
  Test card displays sender note, metadata, "Play on Spotify" button, dismiss button, and pager if multiple items. Test clicking "Play on Spotify" marks status as `listened`. Test returns `null` when recommendations empty.

- [ ] **Step 2: Run test to verify it fails**
  Run: `cd frontend && npm test -- FriendRecommendationsCard`
  Expected: FAIL

- [ ] **Step 3: Implement `FriendRecommendationsCard` and integrate into Play pages**
  Implement card and add to top of `OverviewPage.jsx`, `SleevePlayPage.jsx`, and `TimelinePlayPage.jsx`.

- [ ] **Step 4: Run test to verify it passes**
  Run: `cd frontend && npm test -- FriendRecommendationsCard`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add frontend/src/components/recommend/FriendRecommendationsCard.* frontend/src/pages/OverviewPage.jsx frontend/src/skins/
  git commit -m "feat(play): add FriendRecommendationsCard to Position 1 across all skins"
  ```

---

### Task 6: Notification Deletion UI & End-to-End Verification

**Files:**
- Modify: `frontend/src/pages/SettingsPage.jsx`
- Modify: `frontend/src/changelogData.js`
- Modify: `frontend/package.json`
- Test: `frontend/src/pages/SettingsPage.test.jsx`

**Interfaces:**
- Consumes: Notification deletion API.
- Produces: "Clear read" button and per-item delete icon in Settings notifications tab.

- [ ] **Step 1: Write failing Settings notifications test**
  Test that clicking "Clear read" and individual delete button trigger the API and remove notifications from view.

- [ ] **Step 2: Run test to verify it fails**
  Run: `cd frontend && npm test -- SettingsPage`
  Expected: FAIL

- [ ] **Step 3: Implement Settings notifications UI updates**
  Add "Clear read" button, delete icons, and bump version / changelog entry.

- [ ] **Step 4: Run full verification suite**
  Run:
  - `ruff check backend/app worker scripts`
  - `PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q`
  - `cd frontend && npm run lint && npm test && npm run build`
  Expected: ALL PASS

- [ ] **Step 5: Commit**
  ```bash
  git add frontend/src/pages/SettingsPage.* frontend/src/changelogData.js frontend/package.json
  git commit -m "feat(notifications): add notification deletion and clear read controls"
  ```
