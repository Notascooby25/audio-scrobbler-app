# Year Wrapped (music and gigs) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each person gets a frozen, per-year "Wrapped" story (music slides, four gig slides, summary, share image) that unlocks on 31 December with a banner, a bell notification and a push, plus an owner-only 2025 sample.

**Architecture:** A new `year_reviews` table stores one JSON snapshot per user, year and stage (`preview`, `unlock`, `final`). One worker job calls a token-protected backend endpoint every 30 minutes; the backend decides from its own London-time clock which stages are due and generates any that are missing (so a worker outage can't miss the night). Stats are calculated in Python from stored scrobbles and gigs. The frontend only reads snapshots: a story page at `/wrapped/:year`, a header banner and year cards on Reports.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Alembic, APScheduler worker, React 18 + Vite, Vitest, `html-to-image` (already installed). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-27-year-wrapped-design.md`

## Global Constraints

- Branch `feat/year-wrapped`; never commit to `main`; commit at each working stage (conventional messages).
- No new dependency (no story or animation library).
- Flat design per `DESIGN.md`: zero gradients, zero `box-shadow`, approved colour tokens only. Do not touch `RetroJukebox`.
- UK English in all user-facing text (`ukSpelling` tests enforce it).
- Dates and hours are grouped in `Europe/London`; stored `played_at` and `event_date` are naive UTC / naive dates.
- Unlock is 18:00 Europe/London on 31 December from the server clock. Preview snapshot: morning of 30 December. Final: just after midnight on 1 January (start of 1 Jan, 00:05 London).
- A user may read only their own `year_reviews` rows. Rows with `is_sample` and every `preview` row are readable only by ids in `WRAPPED_EARLY_ACCESS_USER_IDS` (comma-separated env var; real ids never in the repo).
- Eligibility to get a Wrapped: at least 30 scrobbles or at least 1 gig night in the year. Others get no row, no banner, no locked card.
- No Spotify calls anywhere in this feature. No AI-written text.
- Minutes are "about": sum of `duration_ms` of counted scrobbles; the slide says "estimated from track length".
- Wrapped counts stored scrobbles as they are (ingestion already drops repeats within 15 minutes); no second dedup.
- Top albums: ranked by plays; an album qualifies only with at least 3 different tracks played that year.
- A gig night is a distinct (event date, venue) pair among the user's `attended_concerts` rows, so a headliner plus support acts is one night. Festival nights are nights where any row has `is_festival`.
- Miles are home to venue and back, as the crow flies, via `gig_distance_service.haversine_km` and cached geocodes only (no map calls in a request). No home city means no miles slide. Venues not placed are left out and the slide says how many; city-level placements are included and the slide says how many.
- Snapshot carries `format_version` (start at 1). The story skips any slide whose data is missing or empty.
- Public repo: no hostnames, user ids or secrets in code, tests, docs or the changelog.
- Python: imports at module top; `from __future__ import annotations`; Ruff clean. Tests use a non-autoflush session like `backend/app/db.py`.

## Review Focus

- A scrobble at 23:30 UTC on 30 June (00:30 BST on 1 July) lands in July; one at 23:30 UTC on 31 Dec belongs to the year in London time (test around both clock changes).
- A person with zero scrobbles but gigs (and the reverse) gets a working story with the empty half skipped.
- A user with gigs but no home city, or venues all unplaced: no crash, no miles slide, honest note.
- Generating the same stage twice (worker retry, two overlapping runs) creates one row, one bell notification and one push.
- A 2025 account that only starts mid-year is labelled "from <first scrobble date>", not "1 January".
- Very long artist or venue names and an artist with the same name in different casing don't break slides or share images.
- A viewer asking for another user's year, a 2026 preview, or the 2025 sample without early access gets 404 (not 403, so existence isn't leaked).

---

### Task 1: Table, model and migration

**Files:**
- Create: `backend/migrations/versions/0038_add_year_reviews.py`
- Modify: `backend/app/models.py` (add `YearReview` after `Notification`)
- Test: `backend/app/tests/test_year_review_model.py`; extend the pattern in `backend/app/tests/test_migrations.py`

**Interfaces:**
- Produces: `YearReview` with `id`, `user_id` (indexed), `year: int`, `stage: str` (`"preview" | "unlock" | "final"`), `format_version: int`, `data: dict` (JSON), `is_sample: bool` (default false), `window_start: datetime`, `window_end: datetime`, `generated_at: datetime`, `seen_at: datetime | None`, `dismissed_at: datetime | None`; unique constraint `uq_year_review_user_year_stage` on (`user_id`, `year`, `stage`).

- [ ] **Step 1:** Write `test_unique_per_user_year_stage`: inserting two rows with the same (user, year, stage) raises `IntegrityError`; a different stage is fine.
- [ ] **Step 2:** Run `PYTHONPATH=worker python -m pytest backend/app/tests/test_year_review_model.py -q`; expect FAIL (no model).
- [ ] **Step 3:** Add the model and migration `0038_add_year_reviews` (down_revision `0037_add_gig_discovery_tables`), following the 0037 style.
- [ ] **Step 4:** Run the test (PASS) and `cd backend && alembic upgrade head` on a throwaway Postgres (also `downgrade -1` then `upgrade head`).
- [ ] **Step 5:** Commit `feat(wrapped): year_reviews table and migration`.

### Task 2: Music statistics

**Files:**
- Create: `backend/app/services/wrapped_music_stats.py`
- Test: `backend/app/tests/test_wrapped_music_stats.py`

**Interfaces:**
- Produces: `build_music_stats(db: Session, user_id: int, start: datetime, end: datetime) -> dict | None`, where `start`/`end` are naive UTC and the result is `None` when the user has fewer than 30 scrobbles in the window. Keys: `total_plays: int`, `estimated_minutes: int`, `first_scrobble_at: str`, `months: list[int]` (12 plays per London month), `busiest_month: int`, `top_artists`, `top_songs`, `top_albums` (each a list of up to 5 dicts with `name`, `artist` where relevant, `plays`, `artwork_url`), `top_genres: list[{name, share}]`, `busiest_hour: int`, `busiest_weekday: int`, `listener_label: str` (`"Night owl"`, `"Early bird"` or `"Daytime listener"` from the busiest hour), `biggest_day: {date, plays, minutes}`, `new_artists: int` (first heard in the window, from the user's whole history), `first_song: {name, artist, played_at}`.

- [ ] **Step 1:** Write tests with fixture scrobbles: `test_london_time_grouping_across_bst` (the 23:30 UTC cases from Review Focus), `test_album_needs_three_distinct_tracks`, `test_minutes_use_duration_ms`, `test_returns_none_under_30_plays`, `test_new_artists_use_full_history`, `test_blocked_items_excluded` (use the same `not_blocked_clause` the Reports queries use).
- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** Implement by fetching the user's window rows once and aggregating in Python (avoids dialect-sensitive SQL). For genres, reuse the helper Reports "Top Genres" already uses in `analytics_service.py` rather than writing a second genre lookup.
- [ ] **Step 4:** Run the tests; expect PASS.
- [ ] **Step 5:** Commit `feat(wrapped): music statistics`.

### Task 3: Gig statistics

**Files:**
- Create: `backend/app/services/wrapped_gig_stats.py`
- Modify: `backend/app/services/gig_distance_service.py` (expose the venue-place lookup as a public function if needed; keep behaviour unchanged)
- Test: `backend/app/tests/test_wrapped_gig_stats.py`

**Interfaces:**
- Produces: `build_gig_stats(db: Session, user_id: int, year: int) -> dict | None`, `None` when the user has no gig night in the year. Keys: `nights: int`, `artists: int` (distinct headliners and supports), `venues: int`, `new_venues: int` (not seen in earlier years), `festival_nights: int`, `miles: {total: int, furthest: {venue, city, miles}, left_out: int, by_city: int} | None` (`None` without a home city), `months_with_gigs: list[int]` (months 1 to 12), `busiest_month: {month, nights}`, `most_seen: {artist, times}`, `first_night`, `last_night` (ISO dates), `longest_gap_days: int | None`, `songs_heard_live: int` (sum of `song_count`).

- [ ] **Step 1:** Write tests: `test_headliner_plus_support_is_one_night`, `test_festival_nights_from_flag`, `test_miles_return_trip_haversine` (known pair, doubled), `test_no_home_city_gives_no_miles`, `test_unplaced_venue_left_out_and_counted`, `test_city_level_placement_counted_in_by_city`, `test_support_act_notes_not_included` (no `notes` key anywhere in the result), `test_only_gigs_in_the_year`.
- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** Implement with miles = 2 x km x 0.621371, using cached geocodes only.
- [ ] **Step 4:** Run; expect PASS.
- [ ] **Step 5:** Commit `feat(wrapped): gig statistics`.

### Task 4: Generation, stages and notification

**Files:**
- Create: `backend/app/services/wrapped_service.py`
- Modify: `backend/app/config.py` (add `wrapped_early_access_user_ids` string setting with an `early_access_ids` property returning `list[int]`)
- Test: `backend/app/tests/test_wrapped_service.py`

**Interfaces:**
- Consumes: `build_music_stats`, `build_gig_stats`, `queue_push(user_id, title, body, url)`.
- Produces: `generate_year_review(db, user_id: int, year: int, stage: str, now: datetime, is_sample: bool = False) -> YearReview | None` (upserts; `None` if ineligible; never overwrites an existing `unlock` row); `run_due(db, now: datetime) -> dict[str, int]` which uses London time to find the due stages for `now.year`, generates missing ones for every active user, and returns counts. Stage windows: `preview` from 1 Jan to the generation moment, `unlock` likewise, `final` to the end of the year.

- [ ] **Step 1:** Write tests: `test_run_due_before_30_dec_does_nothing`, `test_preview_due_from_30_dec_morning`, `test_unlock_due_at_1800_london_not_before`, `test_final_due_after_midnight_replaces_visible_stage_and_marks_changed_slides` (data records which slide keys changed since `unlock`), `test_run_due_twice_creates_one_row_one_notification`, `test_unlock_creates_bell_notification_type_wrapped_link_wrapped_year_and_calls_push` (patch `queue_push`), `test_preview_and_final_send_no_notification`, `test_inactive_user_skipped`, `test_ineligible_user_gets_no_row`.
- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** Implement. Commit the notification and the row together; call `queue_push` only after the commit. Remember the session is non-autoflush: `flush()` before querying rows added in the same run.
- [ ] **Step 4:** Run; expect PASS.
- [ ] **Step 5:** Commit `feat(wrapped): generation service with stage clock`.

### Task 5: API routes and worker job

**Files:**
- Create: `backend/app/api/wrapped.py`, `backend/app/schemas/wrapped.py`
- Modify: `backend/app/main.py` (include router), `worker/app.py` (job `run_wrapped_check`, id `wrapped-check`, every `WORKER_WRAPPED_CHECK_INTERVAL_MINUTES`, default 30, modelled on `run_venue_geocoding`)
- Test: `backend/app/tests/test_wrapped_api.py`, `worker/tests/test_app.py` (job posts to the endpoint with the worker token header)

**Interfaces:**
- Produces routes under `/wrapped`: `GET ""` returns `{years: [{year, status: "locked"|"ready", unlocks_at, updated, seen, is_sample}], banner: {year} | null}` (banner when a non-sample `unlock` or `final` row exists, `seen_at` and `dismissed_at` both empty); `GET "/{year}"` returns the newest visible stage's snapshot; `POST "/{year}/seen"` and `POST "/{year}/dismiss"`; `POST "/internal/run-due"` (worker token via `require_worker_token`) returns the `run_due` counts. A user with no eligible row sees no locked entry.

- [ ] **Step 1:** Write tests: `test_cannot_read_another_users_year` (404), `test_preview_hidden_without_early_access` (404), `test_sample_hidden_without_early_access` (404), `test_early_access_user_sees_preview_and_sample`, `test_locked_entry_shows_unlock_time_before_unlock`, `test_banner_clears_after_seen_or_dismiss`, `test_internal_route_rejects_missing_token`, `test_internal_route_does_not_appear_on_public_ingress` (confirm nginx already blocks `/internal/`; if the path is `/wrapped/internal/...` check `nginx.conf` covers it and extend if not).
- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** Implement the routes with Pydantic v2 schemas and the worker job.
- [ ] **Step 4:** Run `PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q`; expect all pass.
- [ ] **Step 5:** Commit `feat(wrapped): API routes and worker check job`.

### Task 6: Story page and music slides

**Files:**
- Create: `frontend/src/api/wrapped.js`, `frontend/src/pages/WrappedPage.jsx`, `frontend/src/components/wrapped/WrappedStory.jsx`, `frontend/src/components/wrapped/musicSlides.jsx`, `frontend/src/components/wrapped/wrapped.css`
- Modify: `frontend/src/App.jsx` (route `/wrapped/:year`)
- Test: `frontend/src/components/wrapped/WrappedStory.test.jsx`, `frontend/src/pages/WrappedPage.test.jsx`

**Interfaces:**
- Produces: `WrappedStory({ snapshot, onClose })` taking the snapshot from `GET /wrapped/{year}`; `buildSlides(snapshot) -> Slide[]` (pure; skips empty slides); API functions `fetchWrapped({ token })`, `fetchWrappedYear({ token, year })`, `markWrappedSeen({ token, year })`, `dismissWrapped({ token, year })`.

- [ ] **Step 1:** Write tests (with `afterEach(() => cleanup())`): `buildSlides skips gig slides when gigs is null`, `tap right advances and tap left goes back`, `progress bar shows position`, `Escape closes`, `hold pauses`, `reduced motion: no auto-advance` (slides never auto-advance faster than a person can read; default is tap only), `markWrappedSeen is called once on opening`.
- [ ] **Step 2:** Run `cd frontend && npx vitest run src/components/wrapped`; expect FAIL.
- [ ] **Step 3:** Implement the story shell and the music slides from the approved mockup (minutes, top artists, months, top songs, albums, genres, listening clock, biggest day, new artists). Static first, flat colours, `text-transform: none` on prose buttons, phone-first layout. Use `RedirectWithSearch` conventions where a redirect is needed.
- [ ] **Step 4:** Run the tests; expect PASS.
- [ ] **Step 5:** Commit `feat(wrapped): story page and music slides`.

### Task 7: Gig slides and summary

**Files:**
- Create: `frontend/src/components/wrapped/gigSlides.jsx`, `frontend/src/components/wrapped/summarySlide.jsx`
- Modify: `frontend/src/components/wrapped/WrappedStory.jsx` (`buildSlides` order: music, gigs, summary)
- Test: `frontend/src/components/wrapped/gigSlides.test.jsx`

- [ ] **Step 1:** Write tests: `gigs at a glance shows nights, artists, venues, festival nights and new venues`; `miles slide wording says "there and back, as the crow flies"` and shows the left-out and by-city notes only when non-zero; `calendar marks the months with a gig and names the busiest`; `highlights show most seen, first, last, longest gap and songs heard live`; `no miles slide when miles is null`; `long names truncate without breaking layout`.
- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** Implement the four gig slides and the summary card to the approved mockup. UK English copy.
- [ ] **Step 4:** Run; expect PASS.
- [ ] **Step 5:** Commit `feat(wrapped): gig slides and summary`.

### Task 8: Share image

**Files:**
- Create: `frontend/src/components/wrapped/ShareSlideButton.jsx`
- Modify: `frontend/src/components/wrapped/WrappedStory.jsx`
- Test: `frontend/src/components/wrapped/ShareSlideButton.test.jsx`

**Interfaces:**
- Produces: `ShareSlideButton({ slideRef, filename })` rendering the current slide off-screen at 1080 x 1920 with `toBlob` from `html-to-image`, then `navigator.share({ files })` when `canShare`, else a download.

- [ ] **Step 1:** Write tests (mock `html-to-image`): `shares a file when navigator.canShare allows files`, `falls back to download when share is unavailable`, `shows an error message and stays usable when rendering fails`, `waits for fonts and images before rendering`.
- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** Implement. Artwork images already on the page are re-used; an image that fails to load is replaced by a plain tile rather than a blank hole. No private notes appear on slides, so none can appear on the image.
- [ ] **Step 4:** Run; expect PASS.
- [ ] **Step 5:** Commit `feat(wrapped): share image`.

### Task 9: Banner and Reports cards

**Files:**
- Create: `frontend/src/components/wrapped/WrappedBanner.jsx`, `frontend/src/components/wrapped/WrappedYearsCard.jsx`
- Modify: `frontend/src/components/Layout.jsx` (render the banner under the header), `frontend/src/pages/ReportsPage.jsx` (add the years card)
- Test: `frontend/src/components/wrapped/WrappedBanner.test.jsx`, `frontend/src/components/wrapped/WrappedYearsCard.test.jsx`, `frontend/src/components/Layout.test.jsx`

- [ ] **Step 1:** Write tests: `banner shows only when the API gives a banner year`, `Play my year links to /wrapped/<year>`, `dismiss calls the API and hides the banner`, `banner does not render for signed-out users`, `years card lists newest year first, locked card shows the unlock date`, `locked card absent when the API returns no entry`, `mobile header grid invariant unchanged` (existing Layout test still passes).
- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** Implement. Search for every consumer of `Layout` and the Reports card grid first (blast radius), and scope selectors under `.wrapped-banner` and `.reports-layout`. The banner uses a flat primary-blue token, no gradient.
- [ ] **Step 4:** Run `cd frontend && npm run lint && npm test && npm run build`; expect pass.
- [ ] **Step 5:** Commit `feat(wrapped): banner and Reports year cards`.

### Task 10: Docs, release housekeeping and 2025 sample check

**Files:**
- Modify: `frontend/src/changelogData.js`, `frontend/package.json` (version `0.55.0`), `frontend/src/components/settings/UserGuideSection.jsx`, `frontend/src/components/settings/FaqSection.jsx`, `agents/page_specs.md`, `HANDOVER.md` and the matching section of `HANDOVER.private.md` (never commit the private one), `.env.example` (placeholder `WRAPPED_EARLY_ACCESS_USER_IDS=`)
- Test: `frontend/e2e` new spec `wrapped.spec.js` (route loads, tap through slides, banner dismiss; use `exact: true` locators)

- [ ] **Step 1:** Add the Playwright spec and make it run against the preview with a seeded user.
- [ ] **Step 2:** Update docs and changelog in plain English. Say in HANDOVER that the host compose file is hand-managed: add `WRAPPED_EARLY_ACCESS_USER_IDS` (backend) and optionally `WORKER_WRAPPED_CHECK_INTERVAL_MINUTES` (worker) by hand and verify with `exec <service> sh -c 'test -n "$VAR"'`.
- [ ] **Step 3:** Run everything CI runs: `ruff check backend/app worker scripts`, `ruff format --check backend/app worker scripts`, `PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q`, `cd frontend && npm run lint && npm test && npm run build`, `npm run test:e2e`, `alembic upgrade head`, gitleaks (redacted), Page check on `/reports` and `/wrapped/2025`.
- [ ] **Step 4:** Start `scripts/preview.sh up`, generate the 2025 sample for the owner with `generate_year_review(..., year=2025, stage="final", is_sample=True)`; check numbers against what the owner remembers, click every control (Share, close, banner dismiss) on phone and PC, and check the Sleeve and Timeline skins. Screenshots go outside the repo.
- [ ] **Step 5:** Run `differential-review`, `pwa-failure-points` quick check and `verification-before-completion`; report results with the real last lines of output. Open the PR with its change record; the owner merges.
- [ ] **Step 6:** After merge and deploy: add the compose variable on the host by hand, confirm migration 0038 applied, confirm the `wrapped-check` job logs, and confirm only the owner sees the 2025 sample.

## Self-review notes

- Spec coverage: unlock rule and stages (Task 4), banner, bell and push (Tasks 4, 9), slides and look (Tasks 6 to 8), gig distance (Task 3), private per person and owner-only sample (Tasks 4, 5), frozen snapshots and format version (Tasks 1, 4, 6), table approval (Task 1), risks section (tests listed under Review Focus).
- One deliberate tightening of the spec: gigs are counted as nights (date plus venue) so a support act on the same night is not a second gig. The spec's "support acts count as gigs attended" still holds for the artists count and "most seen".
- Unlock is gated by the generated row existing, so the clock decision lives in one place (`run_due`) and the read side needs no clock.
