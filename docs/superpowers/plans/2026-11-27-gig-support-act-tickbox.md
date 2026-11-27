# Gig Support Act Tick Box Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let the owner tick "Support act" on a gig (edit and manual log) to label it, link it to the same-night headliner and fix its timeline order.

**Architecture:** One new service method `_set_support_act` on `SetlistAttendanceService`, called from `update_concert_details` and `log_manual_concert`. A new optional `is_support_act` field flows through schemas, routes and the JS API client to a checkbox in two modals.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Pydantic v2, pytest; React 18, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-27-gig-support-act-tickbox-design.md`

## Global Constraints
- No DB migration. UK English. Imports at module top. Support slot first scrobble 18:45 (+45 min per already-linked support); headliner slot 20:00.
- Branch `feat/gig-support-act-tickbox`; never push to `main`.

## Review Focus
- Tick with no other gig that night: labelled, no parent, no error.
- Tick on a gig that has its own linked supports: 400 "Remove its support acts first."
- Tick on a gig with no scrobbles (manual gig): no crash, no time shift.
- Date changed and tick in the same save: parent is looked up on the new date.
- Another user's gigs at same venue/date are never chosen as headliner.

---

### Task 1: Backend service

**Files:**
- Modify: `backend/app/services/setlist_attendance_service.py` (`update_concert_details` ~466, `log_manual_concert` ~548)
- Test: `backend/app/tests/test_gig_support_tickbox.py` (new; copy the `db_session` fixture style from `test_festival_name.py`)

**Interfaces:**
- Produces: `SetlistAttendanceService._set_support_act(self, user_id: int, concert: AttendedConcert, is_support: bool) -> None` (does not commit); new kwarg `is_support_act: bool | None = None` on `update_concert_details`, and `is_support_act: bool = False` on `log_manual_concert`.

- [ ] **Step 1: Write failing tests** in `test_gig_support_tickbox.py`:
  - `test_tick_links_to_same_night_headliner_and_moves_scrobbles_to_support_slot`: two gigs, same venue/date, Fat Dog (id first) and LEMONSUCKR, each with one `ListeningEvent` (see `_gig_events` for how events are matched); update LEMONSUCKR with `is_support_act=True`; assert `is_support_act is True`, `parent_setlist_id == fat_dog.setlist_id`, its event `played_at == 2026-11-26 18:45`.
  - `test_untick_clears_link_and_returns_to_headliner_slot` (event at 20:00, parent None, flag False).
  - `test_tick_with_no_other_gig_only_labels` (parent None, no error).
  - `test_tick_refused_when_gig_has_its_own_supports` (`pytest.raises(ValueError, match="Remove its support acts first")`).
  - `test_other_users_gig_is_never_the_headliner`.
  - `test_tick_with_date_change_uses_new_date`.
  - `test_manual_log_with_support_flag_links_to_headliner`.
- [ ] **Step 2:** Run `PYTHONPATH=worker python -m pytest backend/app/tests/test_gig_support_tickbox.py -q`. Expected: FAIL (unexpected keyword `is_support_act`).
- [ ] **Step 3: Implement `_set_support_act`.** If `is_support` equals the current flag, return. Tick: refuse (ValueError) if linked supports exist with `parent_setlist_id == concert.setlist_id`; headliner = same `user_id`, same date, `_venue_key(venue_name, city)` match, `is_support_act` False, id differs, lowest id; set flag, `parent_setlist_id` (or None); target start = day + 18:45 + 45 min × existing supports of that headliner. Untick: flag False, parent None, target 20:00. Shift that gig's `ListeningEvent`s (via `self._gig_events`) by target minus earliest `played_at`; skip when no events. Call it from `update_concert_details` after the existing gig loop (when `is_support_act is not None`) and from `log_manual_concert` before commit (when True).
- [ ] **Step 4:** Re-run the new file, then the whole backend suite `PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q`. Expected: all pass.
- [ ] **Step 5:** Commit `feat: support act tick box in gig service` (check output file for "failed" first).

### Task 2: Schemas and routes

**Files:**
- Modify: `backend/app/schemas/setlists.py` (manual request ~31 gets `is_support_act: bool = False`; `UpdateConcertRequest` ~46 gets `is_support_act: bool | None = None`), `backend/app/api/setlists.py` (~218 and ~248 pass `is_support_act=payload.is_support_act`).
- Test: `backend/app/tests/test_setlist_routes.py`

- [ ] **Step 1:** Add route tests: PATCH with `is_support_act: true` returns 200 and `is_support_act` true with the parent set; PATCH on a gig with own supports returns 400 with the message above; POST `/setlists/manual` with the flag.
- [ ] **Step 2:** Run them; expected FAIL. **Step 3:** make the schema and route edits. **Step 4:** run full backend suite; expected pass. **Step 5:** commit `feat: accept is_support_act on gig update and manual log`.

### Task 3: Frontend

**Files:**
- Modify: `frontend/src/api/setlists.js` (`updateConcert` ~162 and `logManualConcert` ~95: add `isSupportAct` param, sent as `is_support_act`; omit in update when null), `frontend/src/components/setlists/EditGigModal.jsx` (state from `gig.is_support_act`, checkbox "Support act" after the Cover band one, pass `isSupportAct`), `frontend/src/components/setlists/ManualConcertModal.jsx` (same, default false).
- Test: `EditGigModal.test.jsx` (add; existing test at ~68 shows the pattern), the ManualConcertModal test file if present. Use `afterEach(() => cleanup())`.

- [ ] **Step 1:** Tests: box starts ticked when `gig.is_support_act`; ticking and saving calls `updateConcert` with `isSupportAct: true`; manual form sends `isSupportAct`. **Step 2:** run `cd frontend && npx vitest run src/components/setlists`; expect FAIL. **Step 3:** implement. **Step 4:** `cd frontend && npm run lint && npm test && npm run build`; expect pass. **Step 5:** commit `feat: support act tick box in gig forms`.

### Task 4: Docs, release and checks

**Files:** `frontend/src/changelogData.js` (new top entry; version chosen at release time because v0.54.0 on `feat/share-scrobbles` is unmerged), `frontend/package.json` version, `frontend/src/components/settings/UserGuideSection.jsx` (~530, mention the box), `FaqSection.jsx` (one Q&A: "A support act was labelled the wrong way round").

- [ ] Update the files above; run `frontend/src/ukSpelling.test.js` via `npm test`.
- [ ] Run `ruff check backend/app worker scripts`, `ruff format --check backend/app worker scripts`, `npm run test:e2e`, differential-review, pwa-failure-points quick check, gitleaks (redacted).
- [ ] `scripts/preview.sh up`, page check on `/gigs`, try-out: edit LEMONSUCKR, tick Support act, save; it shows the label and sits under Fat Dog's "On the bill".
- [ ] Push branch, open PR with change record. Owner merges.
