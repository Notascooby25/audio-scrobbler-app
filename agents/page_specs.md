# Page specs: Audio Scrobbler App

What each page shows, which endpoints and components it uses, and the rules all
pages share. The Planner uses this for any page work, and the Implementation
Agent checks against it. Replaces the old `Planner Agent Master Document.md`
and `Overview Library and Reports.md`.

**The code is the source of truth.** This spec was rebuilt from the code on
2026-09-24. If you change a page, update its section here in the same commit.
Visual design rules are in `DESIGN.md` and `PRODUCT.md`.

---

## 1. Rules for every page

### 1.1 Layout and navigation

- Every route in `frontend/src/App.jsx` renders inside `Layout`, which contains
  `HeaderNav`.
- The header links to Overview, Library, Reports, Profile, Following and
  Connect. It highlights the active page, collapses to a menu on mobile, and is
  accessible (ARIA and focus states).
- Settings is at `/settings`.
- Analytics pages use the `AnalyticsPage` wrapper (eyebrow and title).

### 1.2 Date ranges

- Every analytics view has a `DateRangeSelector` using the shared model from
  `dateRange.js`: `{ range, start_date, end_date, compare_to_previous }`.
- Presets: `last.week`, `last.month`, `last.year`, `all.time`, `custom`.
- Changing the range re-fetches every panel with no page reload.
- Reports reads `?range=` from the URL for presets.

### 1.3 Viewing another user

- Library, Reports and Profile accept `?userId=` (or `/profile/:userId`) to show
  a **followed** user's data.
- The backend returns 403 when you don't follow them. The page shows "Follow
  this user to see their reports." or its equivalent.
- The title shows `@username`.

### 1.4 Data rules

- All listening data comes from `listening_events`. Aggregates group by
  `artist_name`, `album_name` and `track_name`.
- Genres come from `genre_cache`, per artist, filled by the worker.
- **Blocked items** (`blocked_items`, via `not_blocked_clause`) are excluded
  from every aggregate.
- Lists use `limit`/`offset` pagination. The user's page size comes from their
  preferences (`/users/me/settings`).
- **Artwork:** `artwork_url` and `artist_artwork_url`, plus `artwork_cache`. The
  Deezer/iTunes fallback validates the artist.

### 1.5 Presentation

- Artwork uses `object-fit: cover`.
- Numeric stats are bold and prominent.
- Charts use one shared palette.
- Pages use a modular grid that stacks on mobile.
- Every panel handles empty data without crashing.
- Mobile layout matters. Recent fixes covered the Reports layout and the share
  dialog height, so check both at phone width.

### 1.6 Tests expected for page work

- **Component tests** (Vitest + React Testing Library) next to the component,
  plus `pages/AnalyticsPages.test.jsx`.
- **E2E** (Playwright): `frontend/e2e/navigation.spec.js` and
  `date-filtering.spec.js`. Run with `npm run test:e2e`; not in CI.
- **API tests** in `backend/app/tests/` for every endpoint you change. Include a
  real-Postgres test for any dialect-sensitive aggregation (see the planner
  §3).

---

## 2. Overview: `/` and `/overview`

A quick snapshot of listening for the selected range.

| Section | Component | Endpoint |
|---|---|---|
| Date range | `DateRangeSelector` | |
| Summary stats (total scrobbles, unique artists) | `SummaryStatsBar` | `GET /stats/summary` |
| Top artists (10) | `RankedList` | `GET /stats/top-artists` |
| Top albums (10) | `RankedList` | `GET /stats/top-albums` |
| Top tracks (10) | `RankedList` | `GET /stats/top-tracks` |

The "Loved Tracks" stat was removed (`8469a4f`).

## 3. Library: `/library`

The full listening history, with breakdowns by artist, album and track.

| Section | Component | Endpoint |
|---|---|---|
| Date range | `DateRangeSelector` | |
| Tabs: Scrobbles, Artists, Albums, Tracks | `LibraryPage` | |
| Scrobbles list (search; filter by entity/name) | `LibraryScrobbleList` | `GET /library/scrobbles` |
| Ranked artists, albums or tracks, with a list/grid toggle | `LibraryRankList`, `LibraryViewToggle` | `GET /library/{artists\|albums\|tracks}` |
| Scrobbles over time | `TimelineChart` | `GET /library/timeline` |
| Per-entry menu: Block, Clear Artwork, Delete | `EntryMenu`, `ConfirmDeleteModal` | `POST /users/me/blocks`, `POST /library/clear-artwork`, `POST /library/delete-entries`, `POST /library/delete-scrobbles` |
| Share top artists/albums/tracks as an image (grid or list; Download PNG or Share) | `ShareDialog`, `ShareCard` (uses `html-to-image`) | |
| Pagination and page size | `Pagination`, `PageSizeSelect` | |

`/library/{entity}` also accepts `genres`.

## 4. Reports: `/reports`

Deeper analytics for the selected range. Accepts `?range=` and `?userId=`. The
"View All Time" link on a profile opens `range=all.time`.

Sections in page order:

| Section | Component | Data |
|---|---|---|
| Date range | `DateRangeSelector` | |
| Banner: period scrobbles, plus "% versus previous period" when comparison is on | report banner | `GET /reports/summary` (`period_scrobbles`, `comparison_percent`) |
| Facts: listening minutes, average per day, previous period (when comparing) | report facts | `GET /reports/summary` |
| Scrobbles over time | `BarTrendChart` | `GET /reports/charts` → `weekly_scrobbles` |
| Listening routines (hour × weekday heatmap) | `ListeningHeatmap` | `listening_heatmap` |
| Listening clock | `ListeningClockChart` | `listening_clock` |
| Music by decade | `BarTrendChart` | `music_by_decade` |
| Top genres | `GenreBarList` | `GET /reports/genres` |
| Top artists, albums, tracks (10 each) | `LibraryRankList` | `GET /reports/{artists\|albums\|tracks}` |
| Music ratio: Explorer vs. Repeater (scrobbles per artist) | inline panel | summary counts (see the known issue below) |
| Music ratio: Singles vs. Albums (tracks per album) | inline panel | summary counts (see the known issue below) |

- `/reports/summary` also returns `following_average_scrobbles`, but it isn't
  shown: friends-average was removed from the UI in `e8df17f`.
- **Postgres-sensitive queries:**
  - The decade query extracts the year with `substring(x from '^[0-9]{4}')`
    so a bad `release_date` gives NULL instead of an error (`8e281d3`).
  - `range=all.time` must keep working; it once crashed with
    `UnboundLocalError`.
- **Removed:** the Playlists tab (`2acb98b`). `playlist_cache` and its migration
  remain.



## 5. Profile: `/profile` and `/profile/:userId`

- `@username` header and now-playing, from `GET /users/{id}/profile` and
  `GET /users/{id}/now-playing`, fed by the worker's `currently-playing-sync`.
- `FollowButton`: `POST` and `DELETE /users/{id}/follow`.
- Links to that user's Reports and Library (with `?userId=`), including "View
  All Time".

## 6. Following: `/following`

- The list of people you follow: `GET /users/me/following`.
- "Discover Users" search: `GET /users/search`. Follow and unfollow via
  `FollowButton`.

## 7. Settings: `/settings`

| Section | Endpoint |
|---|---|
| Preferences, e.g. theme, page sizes | `GET` and `PATCH /users/me/settings` |
| Scrobble settings: `poll_interval_minutes`, and "Liked Songs" (opt-in `liked_tracks_sync_enabled`) | `GET` and `PATCH /users/me/settings/scrobble` |
| Blocked items | `GET` and `DELETE /users/me/blocks` |
| Backfill Missing Artwork (Deezer/iTunes, **not** Spotify) | `POST /artwork/backfill` |
| Delete Scrobbles (permanent; confirmation modal) | `/import/*` delete endpoints |

## 8. Connect: `/connect`

| Section | Endpoint |
|---|---|
| Spotify connection status and connect button | `GET /auth/spotify/status`, `GET /auth/spotify/authorize` |
| Import listening-history files (Spotify, YouTube) with progress and summary | `POST /import/unified`, `POST /import/scrobbles`; see `docs/import_flow.md` |
| Monthly summary | `GET /analytics/monthly-summary` |
| Charts panel | `GET /analytics/charts/{user_id}` |
| Recent scrobbles | `GET /analytics/recent-scrobbles` |

---

## 9. Ideas from the original spec, not built

These were in the first planning documents. They are **not** requirements, so
don't assume they exist. Plan one only if Andy asks for it.

- Listening Fingerprint (radar), Artist Map, Community leaderboards (scrobble
  and discovery), Quick Facts streaks.
- Top Tags stream graph, superseded by Top genres.
- IndexedDB offline caching of reports and a sync queue, Background Sync, push
  notifications. The service worker caches the app shell only.
- Monthly partitioning of `listening_events`.
