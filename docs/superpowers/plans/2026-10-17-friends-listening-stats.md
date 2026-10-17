# Friends Listening Stats in Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Compare with Friends" social feature to the Reports page that displays top shared artists, top shared songs, and a minutes-listened leaderboard across the user and their followed friends for any selected date range.

**Architecture:** A new backend API endpoint `GET /reports/friends-comparison` retrieves the authenticated user's followed accounts, applies the active date range and block filters, and aggregates shared artists/tracks (where user + at least one friend listened) plus listening minutes into a structured response. A responsive frontend component `FriendsComparisonSection` is rendered in `ReportsPage` when toggled by a new `[ 👥 Compare with Friends ]` button.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Pydantic v2, PostgreSQL, React 18, Vite, Vitest, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-17-friends-listening-stats-design.md`

## Global Constraints

- **Python:** Python 3.12, PEP 8, PEP 484 type hints (`from __future__ import annotations`), SQLAlchemy 2.0 typed models, Pydantic v2 schemas. All imports placed at module top.
- **Frontend / CSS:** React 18 functional components and hooks. Strictly adhere to `DESIGN.md`: "Flat-By-Default" (zero box-shadow, zero gradients), 0.5px hairline borders (`#E5E5E5`), white card surfaces (`#FFFFFF`), neutral canvas (`#F7F7F7`), and blue accent (`#0066FF`).
- **Data Privacy & Security:** Respect follower permissions; aggregate only for users actively followed by `current_user`. Exclude blocked items via `not_blocked_clause`.
- **FastAPI Route Ordering:** Place `GET /reports/friends-comparison` strictly ABOVE `@reports_router.get("/{entity}")` to prevent route collision.

## Review Focus

- Empty friend list: User follows 0 people; returns `has_friends=False` with guidance to visit `/following`.
- No shared music in range: Friends listened to music, but zero artists/tracks overlap with user; leaderboard renders normally while cards display "No shared music found".
- Follower isolation: Non-followed users must never appear in queries or results, even if listening occurred at the same timestamp.
- Custom date range & presets: Presets (`last.week`, `last.month`, `last.year`, `all.time`) and custom ISO ranges parse without timezone or date-math errors.
- Blocked items exclusion: If user blocked an artist or track, that item must not appear in their shared stats even if friends played it heavily.

---

### Task 1: Backend Schemas and Query Aggregation

**Files:**
- Create: `backend/app/schemas/friends_comparison.py`
- Modify: `backend/app/queries/analytics_queries.py`
- Test: `backend/app/tests/test_friends_comparison_queries.py`

**Interfaces:**
- Consumes: `ListeningEvent`, `Follow`, `User`, `not_blocked_clause`, `resolve_date_range`
- Produces: `FriendsComparisonResponse` and `get_friends_comparison_data(db: Session, user_id: int, start_date: datetime | None, end_date: datetime | None) -> FriendsComparisonResponse`

- [ ] **Step 1: Write failing query tests**

Create `backend/app/tests/test_friends_comparison_queries.py` testing:
1. `test_get_friends_comparison_no_following`: returns `has_friends=False` when user follows no one.
2. `test_get_friends_comparison_shared_overlap`: correctly identifies top shared artist and track played by both current user and followed friend, with individual scrobble counts and total.
3. `test_get_friends_comparison_leaderboard`: correctly calculates minutes listened leaderboard ranked descending.
4. `test_get_friends_comparison_blocked_item`: verifies blocked artist/track is omitted from shared list.

- [ ] **Step 2: Run test to verify it fails**

Run: `PYTHONPATH=worker python -m pytest backend/app/tests/test_friends_comparison_queries.py -q`  
Expected: FAIL with missing module/function.

- [ ] **Step 3: Implement schemas in `backend/app/schemas/friends_comparison.py`**

Define Pydantic v2 models:
- `FriendContribution`: `user_id: int`, `username: str`, `scrobbles: int`
- `SharedEntity`: `name: str`, `artist_name: str | None = None`, `total_scrobbles: int`, `contributions: list[FriendContribution]`
- `LeaderboardEntry`: `user_id: int`, `username: str`, `is_current_user: bool`, `minutes_listened: int`, `scrobbles: int`, `rank: int`
- `FriendsComparisonResponse`: `has_friends: bool`, `top_artists: list[SharedEntity]`, `top_tracks: list[SharedEntity]`, `leaderboard: list[LeaderboardEntry]`

- [ ] **Step 4: Implement `get_friends_comparison_data` in `backend/app/queries/analytics_queries.py`**

Signature:
```python
def get_friends_comparison_data(
    db: Session,
    user_id: int,
    start_date: datetime | None,
    end_date: datetime | None,
) -> FriendsComparisonResponse:
```
1. Fetch followed user IDs from `Follow` where `follower_id == user_id`.
2. If none, return `FriendsComparisonResponse(has_friends=False, top_artists=[], top_tracks=[], leaderboard=[])`.
3. Query `listening_events` for `user_id IN ([user_id] + followed_ids)` within `[start_date, end_date]` and applying `not_blocked_clause(user_id)`.
4. Group by artist for shared artists where count(distinct user_id) >= 2 and `user_id` is present; sort by sum(scrobbles) DESC limit 5.
5. Group by track + artist for shared tracks where count(distinct user_id) >= 2 and `user_id` is present; sort by sum(scrobbles) DESC limit 5.
6. Group by user_id for minutes (sum duration_ms / 60000) and count; join `User` for username; rank entries descending.

- [ ] **Step 5: Run tests to verify they pass**

Run: `PYTHONPATH=worker python -m pytest backend/app/tests/test_friends_comparison_queries.py -q`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas/friends_comparison.py backend/app/queries/analytics_queries.py backend/app/tests/test_friends_comparison_queries.py
git commit -m "feat(backend): add friends listening comparison schemas and query aggregation"
```

---

### Task 2: Backend API Route Integration

**Files:**
- Modify: `backend/app/api/analytics.py`
- Test: `backend/app/tests/test_friends_comparison_api.py`

**Interfaces:**
- Consumes: `get_friends_comparison_data`, `FriendsComparisonResponse`, `resolve_date_range`
- Produces: `GET /reports/friends-comparison`

- [ ] **Step 1: Write failing API integration tests**

Create `backend/app/tests/test_friends_comparison_api.py`:
1. `test_friends_comparison_route_auth_required`: unauthenticated request returns 401.
2. `test_friends_comparison_route_success`: authenticated user with date preset returns 200 with `FriendsComparisonResponse` payload.
3. `test_friends_comparison_route_custom_dates`: custom `start_date` and `end_date` resolve and filter properly.
4. `test_friends_comparison_route_route_order`: verify `/reports/friends-comparison` does not trigger `{entity}` handler.

- [ ] **Step 2: Run test to verify it fails**

Run: `PYTHONPATH=worker python -m pytest backend/app/tests/test_friends_comparison_api.py -q`  
Expected: FAIL (404 or missing route)

- [ ] **Step 3: Add endpoint in `backend/app/api/analytics.py`**

Add right before `@reports_router.get("/{entity}")`:
```python
@reports_router.get("/friends-comparison", response_model=FriendsComparisonResponse)
def reports_friends_comparison(
    range: str = Query(default="last.week", description="One of: last.week, last.month, last.year, all.time, custom"),
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FriendsComparisonResponse:
    if range not in DATE_RANGE_PRESETS:
        raise HTTPException(status_code=400, detail=f"Unsupported range: {range!r}")
    try:
        period_start, period_end, _, _, _ = resolve_date_range(range, start_date, end_date)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return get_friends_comparison_data(db, current_user.id, period_start, period_end)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `PYTHONPATH=worker python -m pytest backend/app/tests/test_friends_comparison_api.py -q`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/analytics.py backend/app/tests/test_friends_comparison_api.py
git commit -m "feat(api): add GET /reports/friends-comparison endpoint"
```

---

### Task 3: Frontend API Client and FriendsComparisonSection Component

**Files:**
- Modify: `frontend/src/api.js`
- Create: `frontend/src/components/reports/FriendsComparisonSection.jsx`
- Test: `frontend/src/components/reports/FriendsComparisonSection.test.jsx`

**Interfaces:**
- Consumes: `fetchFriendsComparison({ token, dateRange })`
- Produces: `<FriendsComparisonSection token={token} dateRange={dateRange} />`

- [ ] **Step 1: Write failing component tests**

Create `frontend/src/components/reports/FriendsComparisonSection.test.jsx`:
1. `renders loading state initially`
2. `renders no-friends callout when has_friends is false`
3. `renders top artists, top songs, and leaderboard cards with scrobble counts`
4. `renders empty state when friends exist but no mutual music found`

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/components/reports/FriendsComparisonSection.test.jsx`  
Expected: FAIL

- [ ] **Step 3: Add `fetchFriendsComparison` in `frontend/src/api.js`**

```javascript
export async function fetchFriendsComparison({ token, dateRange }) {
  const query = buildDateRangeParams(dateRange)
  return request(`/reports/friends-comparison?${query}`, { token })
}
```

- [ ] **Step 4: Implement `FriendsComparisonSection.jsx`**

Create component matching `DESIGN.md`:
- Flat cards, 0.5px hairline borders, `#FFFFFF` background.
- Card 1: Top Artists with Friends (rank, artist name, total plays pill, breakdown list of friends with individual counts).
- Card 2: Top Songs with Friends (rank, track name, artist name, total plays pill, breakdown list).
- Card 3: Minutes Listened Leaderboard (rank, username, bold minutes listened, highlight current user with `#0066FF`).
- Empty / edge state handling with link to `/following` when `has_friends === false`.

- [ ] **Step 5: Run component tests to verify they pass**

Run: `cd frontend && npm test -- src/components/reports/FriendsComparisonSection.test.jsx`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api.js frontend/src/components/reports/FriendsComparisonSection.jsx frontend/src/components/reports/FriendsComparisonSection.test.jsx
git commit -m "feat(frontend): add FriendsComparisonSection component and api client"
```

---

### Task 4: Reports Page Integration and Styling

**Files:**
- Modify: `frontend/src/pages/ReportsPage.jsx`
- Modify: `frontend/src/App.css`
- Modify: `frontend/src/changelogData.js`
- Modify: `frontend/package.json`
- Test: `frontend/src/pages/ReportsPage.test.jsx`

**Interfaces:**
- Consumes: `FriendsComparisonSection`
- Produces: Integrated comparison toggle in Reports page

- [ ] **Step 1: Write failing ReportsPage test for toggle**

In `frontend/src/pages/ReportsPage.test.jsx`:
Add test verifying that clicking the "Compare with Friends" button renders `FriendsComparisonSection`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/pages/ReportsPage.test.jsx`  
Expected: FAIL

- [ ] **Step 3: Update `ReportsPage.jsx`**

1. Add state `const [showFriendsComparison, setShowFriendsComparison] = useState(false)`.
2. Beside `<DateRangeSelector />`, add toggle button:
```jsx
{isOwnReport && (
  <button
    type="button"
    className={`button-secondary compare-friends-btn ${showFriendsComparison ? 'active' : ''}`}
    onClick={() => setShowFriendsComparison((prev) => !prev)}
    aria-expanded={showFriendsComparison}
  >
    👥 {showFriendsComparison ? 'Hide Friends Comparison' : 'Compare with Friends'}
  </button>
)}
```
3. When `showFriendsComparison` is true, render:
```jsx
<FriendsComparisonSection token={session.accessToken} dateRange={dateRange} />
```
directly below the report banner.

- [ ] **Step 4: Update CSS in `frontend/src/App.css`**

Add CSS for:
- `.compare-friends-btn`: flat utilitarian button, active state with blue border/text.
- `.friends-comparison-grid`: 3-column CSS grid on desktop, 1-column on mobile (<768px).
- `.friends-card`, `.friends-breakdown`, `.friends-leaderboard-row`.

- [ ] **Step 5: Update `changelogData.js` and bump version in `package.json`**

Bump `frontend/package.json` version (e.g. `0.2.14` or next patch).
Add changelog entry to `frontend/src/changelogData.js` explaining the new "Compare with Friends" feature in Reports.

- [ ] **Step 6: Run tests and build**

Run: `cd frontend && npm test && npm run build`  
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/ReportsPage.jsx frontend/src/App.css frontend/src/changelogData.js frontend/package.json frontend/src/pages/ReportsPage.test.jsx
git commit -m "feat(reports): integrate Compare with Friends toggle and changelog entry"
```

---

### Task 5: End-to-End Verification and Linting

**Files:**
- None modified directly (verification task)

- [ ] **Step 1: Python Linting & Formatting**

Run:
```bash
ruff check backend/app worker scripts
ruff format --check backend/app worker scripts
```
Fix any formatting or lint warnings.

- [ ] **Step 2: Backend and Worker Test Suite**

Run:
```bash
PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q
```
Expected: All tests pass.

- [ ] **Step 3: Frontend Lint, Test, and Build**

Run:
```bash
cd frontend && npm run lint && npm test && npm run build
```
Expected: Clean linting, all tests pass, build succeeds.

- [ ] **Step 4: Differential Security Review**

Run `differential-review` on the git diff before any merge.
Verify no leaks of non-followed user data and no unparameterized queries.
