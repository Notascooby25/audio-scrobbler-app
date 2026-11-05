# Fix BBC Sounds Scrobble 500 Error Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the HTTP 500 Internal Server Error when scrobbling BBC Sounds radio shows by supporting repeat listens over time and gracefully handling duplicate unique constraints during event ingestion.

**Architecture:** 
1. In `backend/app/services/ingestion_service.py`, update `ingest_listening_event` to recognize duplicate collisions on either `uq_listening_event_identity` (`user_id, track_id, played_at`) OR `uq_listening_event_source_identity` (`user_id, source, play_id`), returning `duplicate=True` rather than raising an uncaught `IntegrityError` when `played_at` differs.
2. In `backend/app/api/tools.py` (`scope_creep_scrobble`), embed the session timestamp into `canonical_play_id` (`f"bbc_{req.play_id}_{track.segment_id}_{int(played_at.timestamp())}"`) matching the proven pattern in YouTube scrobbler, enabling legitimate repeat listens over time without colliding with past listens.

**Tech Stack:** FastAPI, Python 3.12, SQLAlchemy 2.0, PostgreSQL / SQLite, Pytest.

**Spec / Root Cause Analysis:**
- Production logs showed `psycopg.errors.UniqueViolation: duplicate key value violates unique constraint "uq_listening_event_source_identity"` with `Key (user_id, source, play_id)=(1, bbc_sounds, bbc_m00332ry_p0pkbt2y) already exists.`
- The user had previously scrobbled or partially scrobbled tracks from this episode.
- When re-scrobbling at a different `listened_at` timestamp (e.g. 07:05 vs earlier), `canonical_play_id = f"bbc_{req.play_id}_{track.segment_id}"` generated identical play IDs.
- In `ingest_listening_event`, catching `IntegrityError` only queried `existing` where `played_at == event.played_at`. Because `played_at` differed, `existing` was `None`, causing `if existing is None: raise` to re-raise `IntegrityError` uncaught, producing HTTP 500.

## Global Constraints

- Never commit or push to `main`; work on branch `fix/bbc-sounds-scrobble-dedup`.
- Keep changes minimal and focused: no unrelated refactoring.
- Run linters (`ruff check backend/app worker scripts`, `ruff format --check backend/app worker scripts`).
- Run backend test suite (`PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q`).

## Review Focus

1. Duplicate re-scrobble with identical timestamp: should report duplicate skipped gracefully, status 200.
2. Re-scrobble or repeat listen with different timestamp: should succeed as distinct scrobbles, status 200.
3. Partial overlap (some tracks already exist with same source + play_id): should scrobble new tracks and skip duplicates without 500 error.
4. Legacy scrobbles with old play_id format (`bbc_{play_id}_{segment_id}`): should not collide or crash when new scrobbles occur.
5. Ingestion of non-BBC sources (Spotify, YouTube, files): existing duplicate detection and behavior must remain intact.

---

### Task 1: Ingestion Service Duplicate Handling for Source Identity Constraint

**Files:**
- Modify: `backend/app/services/ingestion_service.py:5-77`
- Test: `backend/app/tests/test_ingestion.py`

**Interfaces:**
- Consumes: `ListeningEvent`, `ListeningEventCreate`, `ListeningEventResponse`
- Produces: `ingest_listening_event(db: Session, user_id: int, event: ListeningEventCreate) -> ListeningEventResponse`

- [ ] **Step 1: Write failing test in `backend/app/tests/test_ingestion.py` for source play_id conflict with differing played_at**

```python
def test_ingest_duplicate_source_play_id_different_played_at(db: Session):
    # Event 1
    event1 = ListeningEventCreate(
        track_id="spotify:track:test1",
        track_name="Test Track",
        artist_name="Test Artist",
        played_at=datetime(2026, 11, 5, 7, 0, 0),
        source="bbc_sounds",
        play_id="bbc_show1_seg1",
    )
    res1 = ingest_listening_event(db, user_id=1, event=event1)
    assert res1.duplicate is False

    # Event 2 with same source and play_id, but different played_at
    event2 = ListeningEventCreate(
        track_id="spotify:track:test1",
        track_name="Test Track",
        artist_name="Test Artist",
        played_at=datetime(2026, 11, 5, 8, 0, 0),
        source="bbc_sounds",
        play_id="bbc_show1_seg1",
    )
    res2 = ingest_listening_event(db, user_id=1, event=event2)
    assert res2.duplicate is True
    assert res2.event_id == res1.event_id
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest backend/app/tests/test_ingestion.py -k "test_ingest_duplicate_source_play_id_different_played_at"`
Expected: FAIL with `IntegrityError` (UNIQUE constraint failed: listening_events.user_id, listening_events.source, listening_events.play_id)

- [ ] **Step 3: Update `backend/app/services/ingestion_service.py` to check both unique constraints**

Import `and_`, `or_` from `sqlalchemy`. In `except IntegrityError:`, query for existing record matching `(user_id == user_id)` AND either:
`((track_id == event.track_id) & (played_at == event.played_at))` OR
`((source == event.source) & (play_id == canonical_play_id))`.

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/python -m pytest backend/app/tests/test_ingestion.py -k "test_ingest_duplicate_source_play_id_different_played_at"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/ingestion_service.py backend/app/tests/test_ingestion.py
git commit -m "fix(ingestion): handle source play_id unique constraint gracefully as duplicate"
```

---

### Task 2: Embed Session Timestamp in BBC Sounds `canonical_play_id`

**Files:**
- Modify: `backend/app/api/tools.py:505-515`
- Test: `backend/app/tests/test_scope_creep.py`

**Interfaces:**
- Consumes: `ScopeCreepScrobbleRequest`, `ScopeCreepScrobbleResponse`
- Produces: `POST /tools/scope-creep/scrobble`

- [ ] **Step 1: Write failing test in `backend/app/tests/test_scope_creep.py` for repeat listens at different times**

```python
def test_scope_creep_scrobble_repeat_listen_supported():
    setup_function()
    req1 = {
        "play_id": "m00332ry",
        "listened_at": "2026-11-05T07:05:00.000Z",
        "tracks": [
            {
                "segment_id": "seg_1",
                "artist": "Test Artist",
                "title": "Test Title",
                "offset_seconds": 0,
                "duration_seconds": 180,
                "spotify_uri": "spotify:track:test1234",
                "artwork_url": None,
            }
        ],
    }
    res1 = client.post("/tools/scope-creep/scrobble", json=req1)
    assert res1.status_code == 200
    assert res1.json()["scrobbled_count"] == 1

    # Repeat listen at a later date/time
    req2 = {
        "play_id": "m00332ry",
        "listened_at": "2026-11-06T19:00:00.000Z",
        "tracks": req1["tracks"],
    }
    res2 = client.post("/tools/scope-creep/scrobble", json=req2)
    assert res2.status_code == 200
    assert res2.json()["scrobbled_count"] == 1
    assert res2.json()["duplicate_count"] == 0

    # Re-submitting exact same listen at 2026-11-06T19:00:00.000Z
    res3 = client.post("/tools/scope-creep/scrobble", json=req2)
    assert res3.status_code == 200
    assert res3.json()["scrobbled_count"] == 0
    assert res3.json()["duplicate_count"] == 1
```

- [ ] **Step 2: Run test to verify it fails without timestamp in `canonical_play_id`**

Run: `.venv/bin/python -m pytest backend/app/tests/test_scope_creep.py -k "test_scope_creep_scrobble_repeat_listen_supported"`
Expected: FAIL (either 0 scrobbled or duplicate on repeat listen)

- [ ] **Step 3: Update `canonical_play_id` in `backend/app/api/tools.py`**

In `scope_creep_scrobble`, update:
```python
played_at = base_time + timedelta(seconds=track.offset_seconds)
# Embed session timestamp in play_id so repeat listens over time are fully supported
canonical_play_id = f"bbc_{req.play_id}_{track.segment_id}_{int(played_at.timestamp())}"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/python -m pytest backend/app/tests/test_scope_creep.py -k "test_scope_creep_scrobble_repeat_listen_supported"`
Expected: PASS

- [ ] **Step 5: Run all scope creep and ingestion tests**

Run: `.venv/bin/python -m pytest backend/app/tests/test_scope_creep.py backend/app/tests/test_ingestion.py -q`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/tools.py backend/app/tests/test_scope_creep.py
git commit -m "fix(tools): embed session timestamp in BBC Sounds scrobble play_id"
```

---

### Task 3: Full Verification, Linters, and Safe-Change Handoff

**Files:**
- Modified: files from Task 1 and 2

- [ ] **Step 1: Run Ruff linter and formatter checks**

Run:
```bash
.venv/bin/ruff check backend/app worker scripts
.venv/bin/ruff format --check backend/app worker scripts
```
Expected: PASS with 0 errors.

- [ ] **Step 2: Run complete backend and worker test suites**

Run:
```bash
PYTHONPATH=worker .venv/bin/python -m pytest backend/app/tests worker/tests -q
```
Expected: ALL PASS.

- [ ] **Step 3: Run frontend unit tests and production build**

Run:
```bash
cd frontend && npm run lint && npm test && npm run build
```
Expected: ALL PASS.
