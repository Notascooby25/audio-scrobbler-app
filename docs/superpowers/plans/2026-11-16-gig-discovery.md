# Gig Discovery & Local Radar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a **Discover** tab to `/gigs` that surfaces upcoming and newly announced gigs for a user's regularly listened / seen-live artists and within a user-configurable local radius, backed by a scheduled Ticketmaster Discovery API worker sync.

**Architecture:** A background worker job (`worker/app.py`) periodically sweeps Ticketmaster Discovery API v2 for active users' artists and local `home_lat`/`home_lng` coordinates, caching events (and all bill attractions) in a new `discovered_gigs` Postgres table. FastAPI endpoints serve filtered results from Postgres (computing Haversine distance, "Newly Announced" status, "My Artists" matching, and "I'm interested" bookmarks), while `SetlistsPage.jsx` adds a `Discover` tab with saved filter defaults and a criteria settings cog.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic, PostgreSQL 16, APScheduler, httpx, React 18, Vite, Vitest + Testing Library, Playwright.

**Spec:** [2026-11-16-gig-discovery-design.md](file:///home/andyl/Audio%20Scrobbler%20App/docs/superpowers/specs/2026-11-16-gig-discovery-design.md)

## Global Constraints

- Never call Ticketmaster Discovery API inline inside user-facing FastAPI request handlers; all external calls run in the background worker / internal sync job.
- `TICKETMASTER_API_KEY` must come from environment variables (`.env` / `.env.production`), never hardcoded or committed; if unset, `/setlists/discover` degrades gracefully (`configured: false`) without 500 errors.
- Respect Ticketmaster's 5,000 calls/day and 5 req/sec limits (throttle <= 3 req/sec, honor `429 Retry-After`).
- Every schema/model change requires an Alembic migration in `backend/migrations/versions/` tested against a throwaway PostgreSQL database.
- Internal sync endpoint `/setlists/internal/discover-sync` must require `WORKER_INGESTION_TOKEN` via constant-time comparison (`secrets.compare_digest`).
- Artist matching must exclude `blocked_items` (`not_blocked_clause`).
- Frontend styling must use existing `sfm-*` / `timeline.css` tokens (zero gradients, zero `box-shadow`, no Tailwind, `text-transform: none` on mixed-case buttons, mobile-safe with no horizontal overflow).
- Component tests must import and call `afterEach(() => cleanup())` from `@testing-library/react`.

## Review Focus

- **Unset `TICKETMASTER_API_KEY` or `home_city`:** `GET /setlists/discover` returns HTTP 200 with `configured: false` / `has_home_city: false` and empty items; UI renders clear setup guidance without crashing.
- **Multi-artist bills & festivals:** An event whose headliner is unknown but whose support/festival lineup (`attraction_keys`) includes a user's artist must still match "My Artists".
- **Blocked artists:** An artist in `blocked_items` must never trigger `is_my_artist` or appear in `scope=my_artists` / `only_my_artists=true`, even if previously scrobbled.
- **External ticket URLs:** Non-`http://`/`https://` URLs (e.g. `javascript:`) from external APIs must be stripped/rejected before storing or rendering.
- **"This Weekend" boundary on Saturday/Sunday:** When today is Saturday or Sunday, "This Weekend" must include the rest of the current weekend (today through Sunday), not jump to next weekend.

---

### Task 1: Database Models & Alembic Migration

**Files:**
- Modify: `backend/app/models.py`
- Create: `backend/migrations/versions/0037_add_gig_discovery_tables.py`
- Test: `backend/app/tests/test_gig_discovery_models.py`

**Interfaces:**
- Produces:
  - `DiscoveredGig` model (`id`, `source`, `external_id`, `artist_name`, `artist_key`, `attraction_names`, `attraction_keys`, `event_name`, `venue_name`, `city`, `country_code`, `lat`, `lng`, `event_date`, `event_time`, `onsale_start_at`, `first_seen_at`, `last_synced_at`, `ticket_url`, `image_url`, `is_cancelled`)
  - `DiscoveredGigInterest` model (`id`, `user_id`, `discovered_gig_id`, `created_at`)
  - `UserPreferences.local_gig_radius_miles: Mapped[int]` (default `10`)
  - `UserPreferences.gig_discovery_filters: Mapped[dict | None]` (JSON)

- [ ] **Step 1: Write the failing test**

```python
def test_discovered_gig_and_interest_constraints(db_session):
    gig = DiscoveredGig(
        source="ticketmaster",
        external_id="tm-123",
        artist_name="Fontaines D.C.",
        artist_key="fontaines d.c.",
        attraction_names=["Fontaines D.C.", "Kneecap"],
        attraction_keys=["fontaines d.c.", "kneecap"],
        event_name="Fontaines D.C. Live",
        venue_name="Finsbury Park",
        city="London",
        country_code="GB",
        event_date=date(2026, 7, 5),
    )
    db_session.add(gig)
    db_session.commit()
    assert gig.id is not None
    prefs = UserPreferences(user_id=1)
    db_session.add(prefs)
    db_session.commit()
    assert prefs.local_gig_radius_miles == 10
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PYTHONPATH=worker python -m pytest backend/app/tests/test_gig_discovery_models.py -v`
Expected: FAIL with `ImportError` / `AttributeError` for `DiscoveredGig`.

- [ ] **Step 3: Add `DiscoveredGig`, `DiscoveredGigInterest`, and `UserPreferences` columns in `backend/app/models.py` and create `0037_add_gig_discovery_tables.py`**

Create `0037_add_gig_discovery_tables.py` with `down_revision = "0036_add_music_recommendations"`, creating `discovered_gigs` (with `UniqueConstraint("source", "external_id", name="uq_discovered_gigs_source_external_id")`), `discovered_gig_interests` (with `UniqueConstraint("user_id", "discovered_gig_id", name="uq_discovered_gig_interest_user_gig")`), and adding `local_gig_radius_miles` (`server_default="10"`) and `gig_discovery_filters` (`sa.JSON()`) to `user_preferences`.

- [ ] **Step 4: Run test and migration drill**

Run: `PYTHONPATH=worker python -m pytest backend/app/tests/test_gig_discovery_models.py -v`
Expected: PASS. Also verify `alembic upgrade head` on a throwaway Postgres DB if available.

- [ ] **Step 5: Commit**

```bash
git add backend/app/models.py backend/migrations/versions/0037_add_gig_discovery_tables.py backend/app/tests/test_gig_discovery_models.py
git commit -m "feat(db): add discovered_gigs, interests, and discovery preferences (Planner Step 1)"
```

---

### Task 2: Ticketmaster Client & Background Sync Service

**Files:**
- Create: `backend/app/services/gig_discovery_sync_service.py`
- Modify: `backend/app/config.py`, `.env.example`, `docker-compose.yml`, `docker-compose.prod.yml`
- Test: `backend/app/tests/test_gig_discovery_sync.py`

**Interfaces:**
- Consumes: `DiscoveredGig`, `UserPreferences`, `ListeningEvent`, `AttendedConcert`, `BlockedItem` (`not_blocked_clause`)
- Produces:
  - `encode_geohash(lat: float, lng: float, precision: int = 7) -> str`
  - `sanitize_external_url(url: str | None) -> str | None`
  - `get_user_discovery_artists(db: Session, user_id: int, filters: dict | None = None) -> set[str]`
  - `sync_discovered_gigs(db: Session, user_id: int | None = None) -> dict[str, int]`

- [ ] **Step 1: Write the failing tests**

```python
def test_sanitize_external_url_blocks_non_http():
    assert sanitize_external_url("https://ticketmaster.co.uk/event/1") == "https://ticketmaster.co.uk/event/1"
    assert sanitize_external_url("javascript:alert(1)") is None

def test_get_user_discovery_artists_supports_min_plays_and_excludes_blocked(db_session):
    # Seed plays: artist A (6 plays), artist B (2 plays), artist C (10 plays, blocked)
    # With mode="min_plays", min_plays=5, months=12 -> returns {"artist a"}, excludes C
    ...

def test_sync_discovered_gigs_upserts_multi_attraction_and_prunes_past(db_session, monkeypatch):
    # Mock Ticketmaster HTTP response with 2 attractions on one event + 1 past event in DB
    # Verify DiscoveredGig has both attraction_keys and past event is deleted
    ...
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `PYTHONPATH=worker python -m pytest backend/app/tests/test_gig_discovery_sync.py -v`
Expected: FAIL with `ModuleNotFoundError`.

- [ ] **Step 3: Implement `gig_discovery_sync_service.py` and wire `TICKETMASTER_API_KEY` in `config.py`, `.env.example`, and compose files**

Include:
- Pure-Python `encode_geohash(lat, lng, precision=7)`
- `TicketmasterClient` using `httpx.Client(timeout=15.0)`, throttling to `<= 3 req/sec`, handling HTTP `429 Retry-After`
- `get_user_discovery_artists` supporting `my_artists_mode` (`"top_n"` default limit 100, or `"min_plays"` default 5), `my_artists_months` (default 12, `0` = all time), and `include_seen_live` (default `True`), always filtering out `blocked_items`
- `sync_discovered_gigs(db, user_id=None)` sweeping artist queries + local `geoPoint` (`max(radius, 25)` miles) and pruning `event_date < today - 1 day`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `PYTHONPATH=worker python -m pytest backend/app/tests/test_gig_discovery_sync.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/gig_discovery_sync_service.py backend/app/config.py .env.example docker-compose.yml docker-compose.prod.yml backend/app/tests/test_gig_discovery_sync.py
git commit -m "feat(gigs): add Ticketmaster discovery sync service and config (Planner Step 2)"
```

---

### Task 3: Discovery Query, Interest, Attend & Preferences Endpoints

**Files:**
- Create: `backend/app/services/gig_discovery_service.py`
- Modify: `backend/app/schemas/setlists.py`, `backend/app/schemas/preferences.py`
- Modify: `backend/app/api/setlists.py`, `backend/app/api/preferences.py`
- Test: `backend/app/tests/test_gig_discovery_api.py`

**Interfaces:**
- Consumes: `get_user_discovery_artists`, `DiscoveredGig`, `DiscoveredGigInterest`, `AttendedConcert`, `UserPreferences`
- Produces:
  - `GET /setlists/discover`
  - `POST /setlists/discover/{gig_id}/attend`
  - `POST /setlists/discover/{gig_id}/interest` & `DELETE /setlists/discover/{gig_id}/interest`
  - `POST /setlists/internal/discover-sync` (protected by `require_worker_token`)
  - `PATCH /users/me/settings/gig-discovery`

- [ ] **Step 1: Write the failing API tests**

Test:
1. `GET /setlists/discover` when `TICKETMASTER_API_KEY` is unset returns `configured: False, items: []` (HTTP 200).
2. `scope=my_artists` matches both `artist_key` and `attraction_keys` (festival/support) and excludes blocked artists.
3. `scope=local` filters by Haversine `distance_miles <= radius_miles`, toggling `only_my_artists=True/False`.
4. `date_window=weekend` on a Saturday includes Saturday and Sunday; `date_window=newly_announced` filters by recent `onsale_start_at` or `first_seen_at`; `date_window=interested` returns bookmarked gigs.
5. `POST /setlists/discover/{gig_id}/interest` and `DELETE .../interest` toggle `is_interested`.
6. `POST /setlists/discover/{gig_id}/attend` creates an `AttendedConcert` idempotently.
7. `PATCH /users/me/settings/gig-discovery` persists `local_gig_radius_miles` (1–100) and `gig_discovery_filters`.
8. `POST /setlists/internal/discover-sync` rejects missing/wrong `WORKER_INGESTION_TOKEN` with 401/403.

- [ ] **Step 2: Run tests to verify they fail**

Run: `PYTHONPATH=worker python -m pytest backend/app/tests/test_gig_discovery_api.py -v`
Expected: FAIL with 404 / `ImportError`.

- [ ] **Step 3: Implement `gig_discovery_service.py`, schemas, and API routes**

Also fire a non-blocking async trigger to `INGESTION_WORKER_URL` (with short timeout, ignoring errors so UI never blocks) when `put_home_city` or `PATCH /users/me/settings/gig-discovery` widens coverage.

- [ ] **Step 4: Run tests to verify they pass**

Run: `PYTHONPATH=worker python -m pytest backend/app/tests/test_gig_discovery_api.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/gig_discovery_service.py backend/app/schemas/setlists.py backend/app/schemas/preferences.py backend/app/api/setlists.py backend/app/api/preferences.py backend/app/tests/test_gig_discovery_api.py
git commit -m "feat(api): add gig discovery, interest, attend, and filter preference endpoints (Planner Step 3)"
```

---

### Task 4: Worker Scheduled Job & On-Demand Sync Endpoint

**Files:**
- Modify: `worker/app.py`
- Test: `worker/tests/test_gig_discovery_worker.py`

**Interfaces:**
- Consumes: `POST /setlists/internal/discover-sync` with `X-Worker-Token`
- Produces:
  - Scheduled job `gig-discovery-sync` (`WORKER_GIG_DISCOVERY_INTERVAL_MINUTES`, default `360`)
  - Debounced HTTP trigger endpoint on worker (`POST /internal/trigger-gig-discovery`)

- [ ] **Step 1: Write the failing test**

```python
def test_run_gig_discovery_sync_posts_internal_endpoint(monkeypatch):
    # Mock httpx.post to /setlists/internal/discover-sync and verify headers & status tracking
    ...
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PYTHONPATH=worker python -m pytest worker/tests/test_gig_discovery_worker.py -v`
Expected: FAIL with `AttributeError`.

- [ ] **Step 3: Implement `run_gig_discovery_sync` and register job + debounced trigger in `worker/app.py`**

- [ ] **Step 4: Run test to verify it passes**

Run: `PYTHONPATH=worker python -m pytest worker/tests/test_gig_discovery_worker.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/app.py worker/tests/test_gig_discovery_worker.py
git commit -m "feat(worker): schedule gig-discovery-sync job and debounced trigger (Planner Step 4)"
```

---

### Task 5: Frontend Discover Tab, Filters, Settings Cog & Styling

**Files:**
- Modify: `frontend/src/api/setlists.js`, `frontend/src/styles.css`, `frontend/src/components/setlists/SetlistsPage.jsx`
- Create: `frontend/src/components/setlists/DiscoverGigsTab.jsx`, `frontend/src/components/setlists/DiscoverSettingsModal.jsx`, `frontend/src/components/setlists/DiscoverGigsTab.test.jsx`

**Interfaces:**
- Consumes: `GET /setlists/discover`, `POST /setlists/discover/{id}/attend`, `POST|DELETE /setlists/discover/{id}/interest`, `PATCH /users/me/settings/gig-discovery`
- Produces: `Discover` tab in `SetlistsPage.jsx` (own view only; hidden when `isViewing === true`)

- [ ] **Step 1: Write the failing component tests (`DiscoverGigsTab.test.jsx`)**

Include `afterEach(() => cleanup())` and test:
1. Renders `My Artists` vs `Local Radar` toggle, radius input, `My artists only` vs `All local` toggle, date pills (`All Upcoming`, `This Weekend`, `Next 7 Days`, `Next 30 Days`, `Newly Announced`, `Interested`), and `Save as default`.
2. Clicking the Settings cog opens the criteria modal with `Top N artists` vs `Played at least X times in last Y months` + `Include artists I've seen live` and saves via `PATCH`.
3. Clicking `I'm interested` toggles interest state; clicking `+ I'm going` calls attend and updates to `✓ Going`.
4. Unconfigured API or missing `home_city` renders a clear, non-crashing setup notice.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/setlists/DiscoverGigsTab.test.jsx`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement API helpers, `DiscoverGigsTab.jsx`, `DiscoverSettingsModal.jsx`, `SetlistsPage.jsx` integration, and `styles.css` rules**

Ensure all mixed-case buttons declare `text-transform: none;`, external ticket links use `rel="noopener noreferrer"`, and mobile (`<= 720px`) stacks cleanly with zero horizontal overflow.

- [ ] **Step 4: Run frontend tests and lint**

Run: `cd frontend && npm run lint && npm test && npm run build`
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/setlists.js frontend/src/styles.css frontend/src/components/setlists/SetlistsPage.jsx frontend/src/components/setlists/DiscoverGigsTab.jsx frontend/src/components/setlists/DiscoverSettingsModal.jsx frontend/src/components/setlists/DiscoverGigsTab.test.jsx
git commit -m "feat(gigs): add Discover tab with local radar, filters, and criteria cog (Planner Step 5)"
```

---

### Task 6: Documentation, Changelog & Full Verification

**Files:**
- Modify: `agents/page_specs.md`, `frontend/src/components/settings/UserGuideSection.jsx`, `frontend/src/components/settings/FaqSection.jsx`, `frontend/src/changelogData.js`, `frontend/package.json`

- [ ] **Step 1: Update `agents/page_specs.md`, `UserGuideSection.jsx`, `FaqSection.jsx`, `changelogData.js`, and bump `frontend/package.json` version**
- [ ] **Step 2: Run all CI checks locally**
  - `ruff check backend/app worker scripts && ruff format --check backend/app worker scripts`
  - `.venv/bin/shellcheck scripts/*.sh scripts/tests/*.sh`
  - `PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q`
  - `cd frontend && npm run lint && npm test && npm run build && npm run test:e2e`
- [ ] **Step 3: Commit**

```bash
git add agents/page_specs.md frontend/src/components/settings/UserGuideSection.jsx frontend/src/components/settings/FaqSection.jsx frontend/src/changelogData.js frontend/package.json
git commit -m "docs(gigs): document Gig Discovery tab and bump changelog (Planner Step 6)"
```
