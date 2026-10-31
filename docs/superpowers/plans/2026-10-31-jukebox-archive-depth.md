# Jukebox Library Archive Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable users to configure their Album Jukebox archive depth (top 100, 150, 200, 250, 300 scrobbled albums) via a new preference setting when using the Library Archive catalog source.

**Architecture:** Add `jukebox_archive_limit` (integer, default 100, constrained to `{100, 150, 200, 250, 300}`) to `UserPreferences` model, Alembic migrations, Pydantic schemas, and preferences service. Update the `/jukebox/albums` endpoint to apply `prefs.jukebox_archive_limit` dynamically in the SQL query limit. In `SettingsPage.jsx`, display the archive depth selector conditionally when `jukebox_source === "library_archive"`.

**Tech Stack:** Python 3.12/FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2, React 18, Vite.

**Spec:** In-conversation spec from 2026-10-31 brainstorming: `jukebox_archive_limit` with allowed values 100, 150, 200, 250, 300, defaulting to 100, exposed under the Album Jukebox settings when Library Archive source is chosen.

## Global Constraints

- Never reformat unrelated code; follow existing PEP 8/ESLint style.
- Never edit applied migration files; create a new numbered Alembic migration (`0029_add_jukebox_archive_limit.py`).
- Follow "Flat-By-Default" rule in `SettingsPage.jsx`: standard form controls and semantic tokens.
- Keep changes focused and test-driven.

## Review Focus

1. **Unsupported archive limits:** Values not in (100, 150, 200, 250, 300) must return HTTP 400.
2. **Missing user preferences fallback:** If a user has no preferences row yet, `/jukebox/albums` must safely default to 100.
3. **Frontend dynamic rendering:** When user changes `jukebox_source` to `library_archive`, the archive depth dropdown appears immediately without page reload.
4. **Clean label clarity:** Dropdown option for source should say "Library Archive (Top Scrobbled Albums)" instead of a stale hardcoded "Top 100".
5. **Database constraint & migration:** Migration must cleanly add the column with default 100 and a check constraint.

---

### Task 1: Backend Model, Migration, and Schemas for `jukebox_archive_limit`

**Files:**
- Modify: `backend/app/models.py:34-65`
- Create: `backend/migrations/versions/0029_add_jukebox_archive_limit.py`
- Modify: `backend/app/schemas/preferences.py:1-67`
- Modify: `backend/app/services/preferences_service.py:1-57`
- Test: `backend/app/tests/test_preferences.py`

**Interfaces:**
- Consumes: `UserPreferences` model, `preferences_service.update()`
- Produces: `UserPreferences.jukebox_archive_limit`, `UserPreferencesResponse.jukebox_archive_limit`, `UserPreferencesUpdate.jukebox_archive_limit`

- [ ] **Step 1: Write the failing tests in `backend/app/tests/test_preferences.py`**

Add tests verifying that:
1. `GET /users/me/settings` includes `jukebox_archive_limit: 100` by default.
2. `PATCH /users/me/settings` accepts valid limits: `{"jukebox_archive_limit": 200}` updates successfully.
3. `PATCH /users/me/settings` rejects invalid limits: `{"jukebox_archive_limit": 500}` returns HTTP 400.

```python
def test_settings_returns_jukebox_archive_limit_default():
    response = client.get("/users/me/settings", headers={"Authorization": "Bearer demo"})
    assert response.status_code == 200
    assert response.json()["jukebox_archive_limit"] == 100


def test_settings_updates_jukebox_archive_limit():
    response = client.patch(
        "/users/me/settings",
        json={"jukebox_archive_limit": 250},
        headers={"Authorization": "Bearer demo"},
    )
    assert response.status_code == 200
    assert response.json()["jukebox_archive_limit"] == 250


def test_settings_rejects_invalid_jukebox_archive_limit():
    response = client.patch(
        "/users/me/settings",
        json={"jukebox_archive_limit": 500},
        headers={"Authorization": "Bearer demo"},
    )
    assert response.status_code == 400
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PYTHONPATH=worker pytest backend/app/tests/test_preferences.py -k jukebox_archive_limit`
Expected: FAIL (AttributeError or ValidationError because `jukebox_archive_limit` is not recognized).

- [ ] **Step 3: Update `backend/app/models.py`, `backend/app/schemas/preferences.py`, and `backend/app/services/preferences_service.py`**

1. In `backend/app/models.py`:
   - Add check constraint: `CheckConstraint("jukebox_archive_limit IN (100, 150, 200, 250, 300)", name="ck_user_preferences_jukebox_archive_limit")` to `UserPreferences.__table_args__`.
   - Add column: `jukebox_archive_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=100)`
2. In `backend/app/schemas/preferences.py`:
   - Add `JUKEBOX_ARCHIVE_LIMITS = {100, 150, 200, 250, 300}`.
   - Add `jukebox_archive_limit: int = 100` to `UserPreferencesResponse`.
   - Add `jukebox_archive_limit: int | None = None` to `UserPreferencesUpdate`.
3. In `backend/app/services/preferences_service.py`:
   - Add `"jukebox_archive_limit": 100` to `DEFAULTS`.
   - In `update()`, add validation:
     ```python
     if key == "jukebox_archive_limit" and value not in {100, 150, 200, 250, 300}:
         raise ValueError("Unsupported jukebox archive limit")
     ```
4. In `backend/app/tests/test_preferences.py`:
   - In `FakeDB.add()`, initialize `value.jukebox_archive_limit = 100` if None.
5. Create `backend/migrations/versions/0029_add_jukebox_archive_limit.py`:
   - Add Alembic migration with `upgrade()` and `downgrade()` for `user_preferences.jukebox_archive_limit`.

- [ ] **Step 4: Run test to verify it passes**

Run: `PYTHONPATH=worker pytest backend/app/tests/test_preferences.py`
Expected: PASS (all tests pass).

- [ ] **Step 5: Commit backend preferences changes**

```bash
git add backend/app/models.py backend/migrations/versions/0029_add_jukebox_archive_limit.py backend/app/schemas/preferences.py backend/app/services/preferences_service.py backend/app/tests/test_preferences.py
git commit -m "feat(jukebox): add jukebox_archive_limit to user preferences"
```

---

### Task 2: Apply `jukebox_archive_limit` in `/jukebox/albums` Query

**Files:**
- Modify: `backend/app/api/jukebox.py:53-99`
- Modify: `backend/app/tests/test_jukebox_api.py`

**Interfaces:**
- Consumes: `prefs.jukebox_archive_limit` from `UserPreferences`
- Produces: `/jukebox/albums` response with dynamic limit applied to library archive query

- [ ] **Step 1: Write the failing test in `backend/app/tests/test_jukebox_api.py`**

Add a test that configures `jukebox_archive_limit = 150` on `UserPreferences` and asserts that the SQL query limit receives 150 when querying library archive.

- [ ] **Step 2: Run test to verify it fails**

Run: `PYTHONPATH=worker pytest backend/app/tests/test_jukebox_api.py`
Expected: FAIL.

- [ ] **Step 3: Update `backend/app/api/jukebox.py`**

In `get_jukebox_albums()`:
```python
archive_limit = getattr(prefs, "jukebox_archive_limit", 100) or 100
...
scrobble_albums = (
    ...
    .order_by(func.count().desc())
    .limit(archive_limit)
    .all()
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `PYTHONPATH=worker pytest backend/app/tests/test_jukebox_api.py`
Expected: PASS.

- [ ] **Step 5: Commit jukebox endpoint changes**

```bash
git add backend/app/api/jukebox.py backend/app/tests/test_jukebox_api.py
git commit -m "feat(jukebox): support configurable archive limit in jukebox albums query"
```

---

### Task 3: Frontend Settings UI for Jukebox Archive Limit

**Files:**
- Modify: `frontend/src/pages/SettingsPage.jsx:483-500`
- Modify: `frontend/src/changelogData.js`
- Modify: `frontend/src/components/settings/UserGuideSection.jsx`
- Modify: `frontend/package.json`

**Interfaces:**
- Consumes: `settings.jukebox_source`, `settings.jukebox_archive_limit`, `changeSetting()`
- Produces: Reactive archive depth selector in settings and documentation update

- [ ] **Step 1: Update `SettingsPage.jsx`**

1. In the `Album Jukebox` section:
   - Change option label: `<option value="library_archive">Library Archive (Top Scrobbled Albums)</option>`.
   - When `settings.jukebox_source === "library_archive"`, render a dropdown:
     ```jsx
     {settings.jukebox_source === "library_archive" && (
       <label style={{ marginTop: "1rem" }}>
         Archive depth (top albums)
         <select
           value={settings.jukebox_archive_limit || 100}
           onChange={(event) => changeSetting("jukebox_archive_limit", Number(event.target.value))}
         >
           <option value={100}>Top 100</option>
           <option value={150}>Top 150</option>
           <option value={200}>Top 200</option>
           <option value={250}>Top 250</option>
           <option value={300}>Top 300</option>
         </select>
       </label>
     )}
     ```

- [ ] **Step 2: Update Changelog, User Guide, and bump version**

1. In `frontend/package.json`: bump version (e.g. from current version to next patch).
2. In `frontend/src/changelogData.js`: add entry for configurable Jukebox Archive Depth.
3. In `frontend/src/components/settings/UserGuideSection.jsx`: document the Archive depth option.

- [ ] **Step 3: Run linters, unit tests, and production build**

Run:
```bash
ruff check backend/app worker scripts
ruff format --check backend/app worker scripts
cd frontend && npm run lint && npm test && npm run build
```
Format modified files with prettier:
```bash
npx prettier --write frontend/src/pages/SettingsPage.jsx frontend/src/changelogData.js frontend/src/components/settings/UserGuideSection.jsx frontend/package.json
```

- [ ] **Step 4: Commit frontend changes**

```bash
git add frontend/src/pages/SettingsPage.jsx frontend/src/changelogData.js frontend/src/components/settings/UserGuideSection.jsx frontend/package.json
git commit -m "feat(settings): add jukebox archive depth selector and docs"
```
