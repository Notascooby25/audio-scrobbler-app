# Selective Setlist Import & API Key Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to configure `SETLIST_FM_API_KEY` in environment files and selectively import attended concerts from another user's Setlist.fm profile using checkboxes.

**Architecture:** Pass `SETLIST_FM_API_KEY` through Docker Compose to backend and worker. Add `GET /api/setlists/import/preview` to fetch shows with pagination and an `already_logged` status. Update `POST /api/setlists/import` to accept `setlist_ids`. Update `ImportExportModal.jsx` with an interactive checkbox selection UI.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Pydantic v2, React 18, Vite, Vitest, Pytest.

**Spec:** [2026-10-29-selective-setlist-import-design.md](file:///home/andyl/Audio%20Scrobbler%20App/docs/superpowers/specs/2026-10-29-selective-setlist-import-design.md)

## Global Constraints
- Python 3.12, PEP 8, SQLAlchemy 2.0 typed models, Pydantic v2 schemas.
- Node 20, Vite, React 18, Flat-by-default styling, zero gradients, zero box-shadow.
- Strict rate limiting: max 2 requests/sec, max 1,400 daily requests.
- No hardcoded secrets; API keys loaded via environment variables.

## Review Focus
1. User provides an empty username or non-existent username: return clean 404 or empty list without 500 error.
2. User selects concerts that are already in their library: backend gracefully skips them without duplicates.
3. Pagination on profile preview: preserves existing selections across pages or displays all pages clearly.
4. Quota exhaustion during selective import: pauses gracefully and returns accurate imported count.
5. Formula injection in export remains defended after updates.

---

### Task 1: Environment & Docker Compose Wiring

**Files:**
- Modify: `docker-compose.yml:25-75`
- Modify: `docker-compose.prod.yml:25-75`
- Modify: `.env.example:100-111`

**Interfaces:**
- Produces: `SETLIST_FM_API_KEY` environment variable in `backend` and `worker` containers.

- [ ] **Step 1: Update `docker-compose.yml`**
Add `SETLIST_FM_API_KEY: ${SETLIST_FM_API_KEY:-}` under `backend.environment` and `worker.environment`.

- [ ] **Step 2: Update `docker-compose.prod.yml`**
Add `SETLIST_FM_API_KEY: ${SETLIST_FM_API_KEY}` under `backend.environment` and `worker.environment`.

- [ ] **Step 3: Update `.env.example`**
Add `SETLIST_FM_API_KEY=` with comments describing the Setlist.fm API key.

- [ ] **Step 4: Commit**
```bash
git add docker-compose.yml docker-compose.prod.yml .env.example
git commit -m "chore(config): wire SETLIST_FM_API_KEY into docker compose and env example"
```

---

### Task 2: Backend API: Selective Import & Preview Endpoints

**Files:**
- Modify: `backend/app/schemas/setlists.py`
- Modify: `backend/app/api/setlists.py`
- Modify: `backend/app/tests/test_setlist_routes.py`

**Interfaces:**
- Consumes: `SetlistService.get_user_attended(username, p)`
- Produces: `GET /api/setlists/import/preview`, `POST /api/setlists/import` with `setlist_ids`

- [ ] **Step 1: Write tests for preview and selective import**
In `backend/app/tests/test_setlist_routes.py`, add:
```python
def test_import_preview_and_selective_import():
    # Test GET /api/setlists/import/preview?username=testuser
    # Test POST /api/setlists/import with {"username": "testuser", "setlist_ids": ["show_123"]}
```

- [ ] **Step 2: Run test to verify it fails**
Run: `PYTHONPATH=worker .venv/bin/pytest backend/app/tests/test_setlist_routes.py -k test_import_preview_and_selective_import`
Expected: FAIL (endpoint not found / schema error)

- [ ] **Step 3: Update schema `SetlistImportRequest`**
In `backend/app/schemas/setlists.py`, add `setlist_ids: list[str] | None = None` to `SetlistImportRequest`. Add `SetlistPreviewResponse` and `SetlistPreviewItem`.

- [ ] **Step 4: Implement `GET /api/setlists/import/preview` in `backend/app/api/setlists.py`**
Calls `SetlistService.get_user_attended(username=username, p=page)`, formats response with `already_logged` checked against database.

- [ ] **Step 5: Run tests and ensure all pass**
Run: `PYTHONPATH=worker .venv/bin/pytest backend/app/tests/test_setlist_routes.py -q`
Expected: PASS

- [ ] **Step 6: Commit**
```bash
git add backend/app/schemas/setlists.py backend/app/api/setlists.py backend/app/tests/test_setlist_routes.py
git commit -m "feat(api): add setlist import preview and selective import endpoints"
```

---

### Task 3: Background Worker: Selective Import Support

**Files:**
- Modify: `worker/setlist_import.py`
- Modify: `worker/tests/test_setlist_import.py`

**Interfaces:**
- Consumes: `SetlistAttendanceService.log_concert_attendance`
- Produces: `sync_user_setlist_history(..., selected_setlist_ids: list[str] | None = None)`

- [ ] **Step 1: Write test for selective import in `worker/tests/test_setlist_import.py`**
Test that passing `selected_setlist_ids=["id1", "id2"]` only logs those specified setlists.

- [ ] **Step 2: Run test to verify it fails**
Run: `PYTHONPATH=worker .venv/bin/pytest worker/tests/test_setlist_import.py -k test_selective_import`
Expected: FAIL

- [ ] **Step 3: Update `worker/setlist_import.py`**
Add parameter `selected_setlist_ids: list[str] | None = None`. If provided, iterate through `selected_setlist_ids`, checking existing and calling `attendance_svc.log_concert_attendance`.

- [ ] **Step 4: Run tests to verify all worker tests pass**
Run: `PYTHONPATH=worker .venv/bin/pytest worker/tests/test_setlist_import.py -q`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add worker/setlist_import.py worker/tests/test_setlist_import.py
git commit -m "feat(worker): support selective setlist ids in sync_user_setlist_history"
```

---

### Task 4: Frontend API & Interactive Import Modal with Checkboxes

**Files:**
- Modify: `frontend/src/api/setlists.js`
- Modify: `frontend/src/components/setlists/ImportExportModal.jsx`
- Modify: `frontend/src/components/setlists/SetlistsStats.test.jsx`

**Interfaces:**
- Consumes: `/api/setlists/import/preview`, `/api/setlists/import`
- Produces: Interactive preview, checkboxes per concert, "Select All", "Deselect All", selective import.

- [ ] **Step 1: Update `frontend/src/api/setlists.js`**
Add `previewSetlistsImport(username, page = 1)`. Update `importSetlistsFromProfile(username, setlistIds = null)`.

- [ ] **Step 2: Update `ImportExportModal.jsx`**
Add preview state, checkbox management (`selectedIds` set), "Select All", "Deselect All", "Import Selected (N)", and page navigation.

- [ ] **Step 3: Write tests for selective import modal in `SetlistsStats.test.jsx`**
Test fetching preview, clicking checkboxes, and triggering import with selected IDs.

- [ ] **Step 4: Run frontend tests and linter**
Run: `cd frontend && npm run lint && npm test`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add frontend/src/api/setlists.js frontend/src/components/setlists/ImportExportModal.jsx frontend/src/components/setlists/SetlistsStats.test.jsx
git commit -m "feat(frontend): add interactive gig selection checkboxes to import modal"
```

---

### Task 5: Desktop Navigation Optimization & Profile Following Link

**Files:**
- Modify: `frontend/src/components/HeaderNav.jsx`
- Modify: `frontend/src/pages/ProfilePage.jsx`
- Modify: `frontend/src/components/HeaderNav.test.jsx`
- Modify: `frontend/src/pages/ProfilePage.test.jsx`

**Interfaces:**
- Produces: Cleaner desktop topbar with Set Lists taking Following's place; Following link in Profile page action row to the right of Settings.

- [ ] **Step 1: Update `frontend/src/components/HeaderNav.jsx`**
Update `NAV_LINKS`: remove `/following`, place `/setlists` in the main bar:
`Overview`, `Library`, `Reports`, `Set Lists`, `Profile`, `Connect`.

- [ ] **Step 2: Update `frontend/src/pages/ProfilePage.jsx`**
In `profile-button-row`, add `<Link className="profile-settings-button" to="/following">Following</Link>` to the right of Settings.

- [ ] **Step 3: Update `HeaderNav.test.jsx` and `ProfilePage.test.jsx`**
Verify Following is no longer in topbar nav links and is present on the Profile page action row.

- [ ] **Step 4: Commit**
```bash
git add frontend/src/components/HeaderNav.jsx frontend/src/pages/ProfilePage.jsx frontend/src/components/HeaderNav.test.jsx frontend/src/pages/ProfilePage.test.jsx
git commit -m "refactor(frontend): move Following to profile button row and place Set Lists in navbar"
```

---

### Task 6: Full Verification, Security Review & Changelog

**Files:**
- Modify: `frontend/package.json` (bump to 0.15.1)
- Modify: `frontend/src/changelogData.js`
- Modify: `frontend/src/components/settings/UserGuideSection.jsx`

- [ ] **Step 1: Run complete backend and worker tests**
Run: `PYTHONPATH=worker .venv/bin/pytest backend/app/tests worker/tests -q`
Expected: 100% PASS.

- [ ] **Step 2: Run Ruff check and format check**
Run: `ruff check backend/app worker scripts && ruff format --check backend/app worker scripts`
Expected: Clean.

- [ ] **Step 3: Run frontend lint, test, and build**
Run: `cd frontend && npm run lint && npm test && npm run build`
Expected: Clean.

- [ ] **Step 4: Differential security review**
Review authorization, rate limiting, and parameter validation.

- [ ] **Step 5: Final commit & push**
```bash
git status
git commit -m "feat: complete selective setlist import, compose key wiring, and nav optimization"
git push origin main
```

