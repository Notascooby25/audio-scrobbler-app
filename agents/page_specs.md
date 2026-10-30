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

- Library, Reports, Set Lists, gig pages and Profile accept `?userId=` (or
  `/profile/:userId`) to show a **followed** user's data.
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
| Summary stats (total scrobbles, unique artists) | `SummaryStatsBar` | `GET /stats/summary` |
| Time Capsule & Rediscover (Forgotten Favorites, On This Day, Spotify Playlist export) | `RediscoverCard` | `GET /analytics/rediscover`, `POST /analytics/rediscover/playlist` |
| Date range | `DateRangeSelector` | |
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
| Bulk selection (Copy / Deselect) | `LibraryViewToggle`, `bulk-action-bar` | Sticky mobile action bar with touch targets ≥ 44pt |
| Pagination and page size | `Pagination`, `PageSizeSelect` | |

`/library/{entity}` also accepts `genres`. Bulk selection controls are fully responsive on mobile touch viewports.

## 4. Reports: `/reports`

Deeper analytics for the selected range. Accepts `?range=` and `?userId=`. The
"View All Time" link on a profile opens `range=all.time`. Displays accessible
loading indicator (`role="status"`, `aria-live="polite"`) during re-fetch on
date range switches.

Sections in page order:

| Section | Component | Data |
|---|---|---|
| Date range & comparison controls (period compare & friends compare) | `DateRangeSelector`, compare toggle buttons | |
| Summary stats: period scrobbles, listening minutes, and average per day (all with color-coded comparison % deltas if comparing: green for positive, red for negative) | report facts (3-card grid) | `GET /reports/summary` |
| Friends comparison section (when toggled open) | `FriendsComparisonSection` | `GET /reports/friends-comparison` |
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
- Links to that user's Reports, Library and Set Lists ("View Gigs") (with
  `?userId=`), including "View All Time".

## 6. Following: `/following`

- The list of people you follow: `GET /users/me/following`.
- "Discover Users" search: `GET /users/search`. Follow and unfollow via
  `FollowButton`.

## 7. Settings: `/settings`

| Section | Endpoint |
|---|---|
| Preferences, e.g. theme, page sizes | `GET` and `PATCH /users/me/settings` |
| Scrobble settings: `poll_interval_minutes`, realtime sync, and BBC Sounds Scope Creep import tool (create playlist or add to existing, scrobble tracks) | `GET` and `PATCH /users/me/settings/scrobble`, `GET /tools/scope-creep/playlists`, `POST /tools/scope-creep/*` |
| Data settings: Liked songs sync, Backfill Missing Artwork (Deezer/iTunes, **not** Spotify), Export Listening History (CSV & JSON) | `POST /artwork/backfill`, `PATCH /users/me/settings/scrobble`, `GET /import/export?format={csv\|json}` |
| User Guide (`?tab=guide`): Plain-English walkthrough of background sync, car trip/party friend scrobble copying, BBC Sounds radio extraction, and library management | Frontend component `UserGuideSection` |
| FAQ (`?tab=faq`): Searchable, accessible accordion Q&A covering sync delays, duplicate prevention, blocking vs deleting, and mobile push setup | Frontend component `FaqSection` |
| Blocked items | `GET` and `DELETE /users/me/blocks` |
| Delete Scrobbles (permanent; confirmation modal) | `/import/*` delete endpoints |

## 8. Connect: `/connect`

Organized into a 3-card Data Sources Hub with an accessible `<h1>` heading ("Connect & Data Sources"):
1. **Spotify Streaming Card:** Active connection status, connect button, and rate-limit notice.
2. **History File Import Card:** File picker for Spotify and YouTube JSON exports with upload progress bar and summary breakdown.
3. **Radio & Liked Songs Tools Card:** Direct shortcut to `/settings?tab=scrobble`.
4. **Monthly Archive Ledger:** High-density scannable archive table with total active months/plays/time stat cards, instant Year filter chips, and relative volume bars.
5. **Analytics Handoff Card:** Direct links to `/overview` and `/reports` (charts pruned from `/connect` to eliminate redundancy).
6. **Recent Ingestion Feed:** Verified recent plays with source badges confirming sync health and direct link to `/library`.

| Section | Endpoint |
|---|---|
| Spotify connection status and connect button | `GET /auth/spotify/status`, `GET /auth/spotify/authorize` |
| Import listening-history files (Spotify, YouTube) with progress and summary | `POST /import/unified`, `POST /import/scrobbles`; see `docs/import_flow.md` |
| Monthly archive ledger | `GET /analytics/monthly-summary` |
| Recent ingestion feed | `GET /analytics/recent-scrobbles` |
| Developer bypass tools | Development only (`import.meta.env.DEV`), stripped from production builds |

## 8a. Set Lists: `/setlists` and gig pages `/gigs/:id`

Setlist.fm-style concert diary. Styled with plain `sfm-*` classes in `styles.css`
(Tailwind is **not** installed). Gig pages live at `/gigs/:id`, not under
`/setlists/`, because nginx and Vite proxy `/setlists/*` to the API. List state
(tab, page, size, open row, filters) is kept in the URL so Back restores it.

| Section | Component | Endpoint |
|---|---|---|
| Tabs: My Gigs, Artists Seen, Songs Heard, Venues; + Log a Gig, Import / Export | `SetlistsPage` | |
| Gig invites ("Were you there?"; Add to my gigs / Dismiss) at the top of My Gigs | `GigInvites` | `GET /setlists/invites`, `POST /setlists/invites/{id}/add\|dismiss` |
| My Gigs (All / Attended / Upcoming, paged 10/15/25/50, Remove) | `MyGigsTimeline`, `GigRows` | `GET /setlists/attendances` |
| Artists, Songs (year/artist sidebar), Venues: ranked bars, expandable rows | `RankedBarList`, `*Leaderboard` | `GET /setlists/stats/{artists\|songs\|venues}` |
| Log a gig (search, support act prompt, already-logged prompt), manual gig | `GigSearchBar`, `SupportActsPromptModal`, `AlreadyLoggedModal`, `ManualConcertModal` | `GET /setlists/search`, `POST /setlists/attend`, `POST /setlists/manual` |
| Import / Export (profile, selected, CSV/JSON file; paused-job notice) | `ImportExportModal` | `POST /setlists/import`, `POST /setlists/import/file`, `GET\|DELETE /setlists/import/job`, `GET /setlists/export` |
| Gig page: header, numbered songs, Refresh / Copy / Edit details / Delete | `SetlistGigPage`, `SetlistSongs`, `EditGigModal`, `DeleteGigConfirmModal` | `GET /setlists/attendances/{id}`, `POST /setlists/{id}/refresh`, `PATCH /setlists/{id}`, `DELETE /setlists/{id}` |
| My notes | `NotesEditor` (in `SetlistGigPage`) | `PATCH /setlists/{id}/notes` |
| On the bill (other acts that night, + I was there) | `GigBill` | `GET\|POST /setlists/attendances/{id}/bill` |
| Went with (people you follow; invited / added; + Add people) | `GigCompanions` | `GET\|POST /setlists/attendances/{id}/companions`, `DELETE .../companions/{friend_id}` |
| Setlist.fm attribution (required by its terms) at the bottom | `SetlistAttribution` | |

- Editing a gig moves its scrobbles and support acts; Refresh only updates songs.
- `?userId=` (a followed user, via "View Gigs" on their profile) makes the list
  and gig pages read-only: the read routes take `user_id` (same follow check as
  Library, `resolve_viewable_user_id` in `api/deps.py`) and blank `notes`. No
  logging, import/export, invites, edit, refresh, delete, notes or Went with;
  the bill shows "✓ Saw them" with links kept on their gigs. "+ I was there too"
  (`POST /setlists/attendances/{id}/add-to-mine?user_id=`) copies the night to
  the viewer's gigs from stored data and answers any pending invite.
- Went with: you can only add people you follow; nothing is written to their
  account until they choose Add. Invites never include the owner's notes.
- Gig scrobbles (source `setlistfm`) reuse artwork from the user's own plays;
  the worker's `setlist-artwork-backfill` job fills the rest. Artwork the user
  cleared is stored as `""` and not refilled.

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
