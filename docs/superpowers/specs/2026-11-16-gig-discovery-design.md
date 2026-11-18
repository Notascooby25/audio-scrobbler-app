# Gig Discovery & Local Radar Design Document

**Date:** 2026-11-16
**Status:** Built. Update 2026-11-18: Skiddle is now the first live source (owner holds a Skiddle API key); Ticketmaster stays built but dormant until its key arrives. See section 7.

---

## 1. Intent and Why

Right now, the **Gigs** page (`/gigs`) is a concert diary powered by Setlist.fm. Its *Upcoming* filter only shows future gigs that the user has already logged manually or been invited to by a friend. Setlist.fm is built for past setlists and does not reliably surface newly announced tours or local ticketed shows.

The owner wants two practical ways to discover gigs without leaving the app:
1. **Your Artists (wide radar):** Catch upcoming and newly announced gigs from artists they regularly listen to (UK, worldwide, or filtered by country).
2. **Local Radar ("at a loose end"):** Quickly see what live music is on within a user-defined radius (e.g., 5–6 miles) of their saved home city/postcode—especially for an upcoming weekend—with a simple filter to switch between **My Artists only** and **All Local**, and the ability to **save** those filter preferences.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- Add a **Discover** tab to `/gigs` (`SetlistsPage.jsx`) with a clean filtration system:
  - **Mode / Scope:**
    - **My Artists (Wide):** Upcoming and newly announced gigs for artists the user listens to or has seen live, across all locations or filtered by country.
    - **Local Radar:** Gigs within the user's chosen radius (e.g., 5 or 6 miles, configurable in miles) around their saved `home_lat` / `home_lng`, with a toggle between **My Artists only** and **All Local**.
  - **Date & Status Filters:** Quick pills for **All Upcoming**, **This Weekend**, **Next 7 Days**, **Next 30 Days**, and **Newly Announced**.
  - **Saved Preferences:** Persist the user's preferred local radius and default filter settings in `user_preferences` so they don't have to re-select them on every visit.
- Sync Ticketmaster event data in a **background worker** into a local database cache (`discovered_gigs`) so `/gigs` loads instantaneously and never calls Ticketmaster inline on HTTP requests.
- Let the user click **"+ I'm going"** on any discovered gig to add it to their *My Gigs → Upcoming* list (`attended_concerts`), **"I'm interested"** to bookmark it for later without committing it to *My Gigs*, or open the external ticket/event URL.
- Design the storage schema (`source` + `external_id`) so **Skiddle** (UK grassroots venues) can be added as a second source in a future release without breaking changes.

### Non-Goals
- Integrating **Songkick** or **Bandsintown** (neither offers free personal/hobbyist API keys).
- ~~Integrating Skiddle in this release.~~ Reversed on 2026-11-18: Skiddle shipped first (section 7).
- Automatic push notifications for every new gig announcement (can be layered later on top of `discovered_gigs`).
- Showing the Discover tab when viewing a followed friend's gigs (`?userId=...`); Discover is strictly for the signed-in user.

### Anti-Goals
- Calling Ticketmaster Discovery API inline inside user-facing FastAPI request handlers.
- Hardcoding a fixed local radius instead of letting each user set their own.
- Breaking existing *My Gigs*, *Artists*, *Songs*, or *Venues* tabs or mobile layout invariants.

---

## 3. Constraints

- **API Quota & Secrets:**
  - Uses a free **Ticketmaster Discovery API** key (`TICKETMASTER_API_KEY` in `.env` / `.env.production`, placeholder in `.env.example`), never committed to git.
  - Free tier allows 5,000 calls/day and 5 req/sec. Worker sync must throttle requests (e.g. ≤ 3 req/sec) and respect `429 Retry-After` backoffs.
  - If `TICKETMASTER_API_KEY` is not set, the Discover tab must degrade gracefully with a clear setup message rather than throwing 500 errors.
- **Database & Migrations:**
  - Every schema/model change requires an Alembic migration in `backend/migrations/versions/`.
  - All queries must be PostgreSQL-compatible (no SQLite-only assumptions).
- **Security & Privacy:**
  - Worker sync endpoint (`/setlists/internal/discover-sync`) must require `WORKER_INGESTION_TOKEN` using constant-time comparison (`secrets.compare_digest`) and be shielded from public Nginx ingress (existing `/internal/` rule).
  - Artist matching for "My Artists" must exclude `blocked_items` (`not_blocked_clause`).
  - External ticket links must use `target="_blank" rel="noopener noreferrer"` and validate URL schemes (`http://` / `https://`).
- **Design System:**
  - Follow `DESIGN.md` and `timeline.css` / `sfm-*` tokens (zero gradients, zero `box-shadow`, no Tailwind, mobile-safe with no horizontal overflow).

---

## 4. Approaches Considered

1. **Ticketmaster Discovery API + Background Worker Sync + Saved Filter Tab *(Selected)***
   - Free self-service API key (5,000 calls/day). Background worker caches artist + local events in Postgres (`discovered_gigs`). Instant filtering, supports "Newly Announced" tracking, and stores a `source` column for future Skiddle support.
2. **Dual-Source: Ticketmaster + Skiddle** *(adopted 2026-11-18, order reversed: Skiddle first)*
   - Adds UK grassroots coverage. Skiddle's key arrived before Ticketmaster's, so Skiddle went live first. Cross-source event deduplication is still deferred (the overlap is small because Skiddle is mostly UK grassroots shows).
3. **Live On-Demand Search Only (No Worker)**
   - Simpler, but slow on every filter change, risks rate-limit errors, and cannot track newly announced gigs proactively. Rejected.

---

## 5. Architecture & Decided Behaviour

### 5.1 Data Model & Migration
1. **New table `discovered_gigs`:**
   - `id` (PK)
   - `source` (`String(32)`, e.g. `'ticketmaster'`, indexed)
   - `external_id` (`String(128)`, unique constraint on `(source, external_id)`)
   - `artist_name` (`String(255)`), `artist_key` (`String(255)`, normalized lowercase key matching app conventions, indexed)
   - `attraction_names` (`JSONB` / `JSON`, default `[]`) & `attraction_keys` (`JSONB` / `JSON`, default `[]`) — *(builder call)* stores all artists on a multi-artist bill or festival so support acts and festival appearances match "My Artists" too.
   - `event_name` (`String(255)`)
   - `venue_name` (`String(255)`), `city` (`String(128)`), `country_code` (`String(8)`)
   - `lat` (`Float`, nullable), `lng` (`Float`, nullable)
   - `event_date` (`Date`, indexed), `event_time` (`String(16)`, nullable)
   - `onsale_start_at` (`DateTime`, nullable) — Ticketmaster `sales.public.startDateTime`
   - `first_seen_at` (`DateTime`, default UTC now)
   - `last_synced_at` (`DateTime`, default UTC now)
   - `ticket_url` (`String(512)`, nullable), `image_url` (`String(512)`, nullable)
   - `is_cancelled` (`Boolean`, default `False`)
2. **New table `discovered_gig_interests`:**
   - `id` (PK), `user_id` (FK → `users.id`, indexed), `discovered_gig_id` (FK → `discovered_gigs.id`, `ON DELETE CASCADE`), `created_at` (DateTime).
   - Unique constraint on `(user_id, discovered_gig_id)` to store gigs the user marked **"I'm interested"**.
3. **Extend `user_preferences`:**
   - `local_gig_radius_miles` (`Integer`, default `10`, nullable=False)
   - `gig_discovery_filters` (`JSONB` / `JSON`, nullable) — stores `{ scope, local_only_my_artists, date_window, country_code, my_artists_mode, my_artists_limit, my_artists_min_plays, my_artists_months, include_seen_live }` (defaults: `my_artists_mode='top_n'`, `my_artists_limit=100`, `my_artists_min_plays=5`, `my_artists_months=12`, `include_seen_live=True`) so saved defaults and "My Artists" criteria persist across sessions.

### 5.2 Background Worker Sync
- New APScheduler job in `worker/app.py` (e.g. `gig-discovery-sync`, configurable interval via `WORKER_GIG_DISCOVERY_INTERVAL_MINUTES`, default e.g. `360` / every 6 hours) calling `POST /setlists/internal/discover-sync`.
- Each run performs two throttled sweeps against Ticketmaster Discovery v2 (`classificationName=music`, `size=50`–`100`):
  1. **Artist Sweep:** Collects distinct artists matching each active user's configured "My Artists" criteria (default: top 100 artists by scrobble count in the last 12 months + artists from `attended_concerts`, excluding `blocked_items`), queries Ticketmaster for upcoming events, and upserts into `discovered_gigs`.
  2. **Local Sweep:** For each active user with `home_lat` and `home_lng` set, converts coordinates to a Ticketmaster `geoPoint` geohash and queries upcoming music events within `max(user.local_gig_radius_miles, 25)` miles so local filtering and radius tweaks work immediately from cache.
- *(Builder call)* **Immediate on-change trigger:** When a user sets/changes `home_city` or saves a `local_gig_radius_miles` / "My Artists" setting that widens their coverage, the backend fires a debounced async request to `INGESTION_WORKER_URL` to run a targeted sync right away (so they don't have to wait up to 6 hours for the next scheduled tick).
- Prunes past events (`event_date < today - 1 day`) to keep the table lean.

### 5.3 Backend API Endpoints
- `GET /setlists/discover` (authenticated):
  - Query params: `scope` (`my_artists` | `local`), `only_my_artists` (`bool`, used when `scope=local`), `radius_miles` (`int`, defaults to `user_preferences.local_gig_radius_miles`), `date_window` (`all` | `weekend` | `7d` | `30d` | `newly_announced` | `interested`), `country` (optional ISO code).
  - Matches "My Artists" against both `artist_key` and `attraction_keys` using the user's saved criteria (either **Top N artists** or **Played at least X times** in the last Y months, plus `attended_concerts` if enabled, excluding `blocked_items`).
  - Computes distance in miles from `home_lat`/`home_lng` using Haversine when coordinates exist.
  - Annotates each result with `is_my_artist` (and scrobble count / "Seen live" flag), `is_newly_announced` (`onsale_start_at` within last 14 days or `first_seen_at` within last 7 days), `distance_miles`, `is_interested` (from `discovered_gig_interests`), and `already_going` (whether a matching `attended_concerts` row already exists for that artist + date).
  - Returns `{ configured: bool, has_home_city: bool, saved_radius_miles: int, saved_filters: dict, items: [...] }`.
- `PATCH /users/me/settings/gig-discovery` (authenticated):
  - Updates `local_gig_radius_miles` (validated 1–100) and/or `gig_discovery_filters` (including `my_artists_mode`, `my_artists_limit`, `my_artists_min_plays`, `my_artists_months`, `include_seen_live`) on `user_preferences`.
- `POST /setlists/discover/{gig_id}/attend` (authenticated):
  - Creates an `attended_concerts` entry (future/upcoming gig) from the cached `discovered_gigs` row, idempotently returning the existing entry if already logged.
- `POST` & `DELETE /setlists/discover/{gig_id}/interest` (authenticated):
  - Toggles/saves or removes a gig in `discovered_gig_interests` for the current user.

### 5.4 Frontend UI (`/gigs` → Discover Tab)
- Add a **Discover** tab to `SetlistsPage.jsx` (only shown on own `/gigs`, hidden when `?userId=` is set).
- **Filter Bar:**
  - Scope toggle: **My Artists** | **Local Radar**
  - When **Local Radar** is active:
    - Shows current `home_city` + editable **Radius (miles)** input (e.g. `6`)
    - Toggle/checkbox: **My artists only** vs **All local**
    - If `home_city` is not set, displays a clear prompt with a link to `/settings` to set it.
  - When **My Artists** is active:
    - Optional Country dropdown (e.g. All countries, UK, US, etc., derived from results or common codes).
  - Date / status pills: **All Upcoming**, **This Weekend**, **Next 7 Days**, **Next 30 Days**, **Newly Announced**, and **Interested**.
  - **Settings cog** button opening a small popover/modal to customise **"My Artists" criteria**:
    - Mode: **Top N artists** (e.g. 50 / 100 / 200) *or* **Played at least X times** (custom play count)
    - Timeframe: last **Y months** (e.g. 3 / 6 / 12 / 24 months or All time)
    - Toggle: **"Include artists I've seen live"**
  - **"Save as default"** action to persist current radius + filters via `PATCH /users/me/settings/gig-discovery`.
- **Results List:**
  - Clean cards/rows matching `sfm-*` styling: Date badge, Artist & Event title, Venue + City + Distance (`~4.2 mi`), badges for **Newly Announced** and **Your Artist** / **Seen Live**, **Tickets** external link, **"I'm interested"** toggle button, and **"+ I'm going"** button (turns into **"✓ Going"** with link to the gig page once added).

---

## 6. What's Left to the Builder

- Exact Ticketmaster geohash encoding helper (pure Python, no heavy dependency required, or standard lightweight geohash function).
- Exact definition of "This Weekend" (Friday 17:00 or Saturday–Sunday local/UTC window, handling when today is already Saturday/Sunday).
- Exact batch size, artist cap per sync, and rate-limit sleep intervals in the worker job to stay comfortably within 5,000 calls/day.
- Exact `sfm-*` CSS classes and mobile responsive breakpoints (`@media (max-width: 720px)`).
- Updating `agents/page_specs.md`, `.env.example`, and `UserGuideSection.jsx` / `FaqSection.jsx` + `changelogData.js` during implementation.

---

## 7. Skiddle source (added 2026-11-18)

**Why:** the owner's Skiddle API key was approved before the Ticketmaster key. The `source` + `external_id` columns already allowed a second source, so there is **no migration**.

**Client (`backend/app/services/skiddle_service.py`)** follows Skiddle's client guidelines: a User-Agent naming the app, version and URL on every request (`SKIDDLE_USER_AGENT_URL` overrides the default public repo URL); one request at a time with a 1 second pause; 8 second timeout; up to 3 attempts with exponential back-off plus jitter on 429 / 5xx / timeouts, honouring `Retry-After`; never retrying other 4xx; a 401/403 or repeated failure stops the whole sweep; the key is sent from the server only, in the query string, so logs record status codes and error types only, never URLs or exception text.

**Sweeps (`gig_discovery_sync_service.py`)**, in priority order, about 41 requests per full run:
1. **Local:** one geo search (`latitude`, `longitude`, `radius` of at least 25 miles, `eventcode=LIVE`, `minDate=today`, nearest first), up to 3 pages of 100, once per distinct home location.
2. **Your artists:** one keyword search per favourite artist (top 30 per user by plays in the user's criteria, then artists seen live; 60 overall, shared artists searched once; blocked artists never).
3. **UK-wide:** four date windows (next 30 days, then to 3, 6 and 12 months), up to 2 pages each, only on a full sweep when someone has artists. A single-user refresh (home city or criteria changed) does only 1 and 2.

Listings whose start date is already past (courses, exhibitions) are ignored. The job runs every `WORKER_GIG_DISCOVERY_INTERVAL_MINUTES` with up to 15 minutes of random jitter, so it never fires on the hour.

**Matching:** artist keys are compared in a canonical form (lower case, `&` = `and`). Skiddle often lists no artists; then the event title is the only name held. If one of the user's artists appears in such a title as whole words (artist name at least 4 characters, title not a tribute night, source is Skiddle, artist not blocked) the gig is returned with `is_my_artist` and `is_possible_match` both true and the UI shows **Possible match** instead of **Your artist**.

**Display and terms:** the Discover tab shows "Event listings from" with the official unaltered Skiddle logo (light and dark versions in `frontend/public/skiddle/`), a link to skiddle.com and a line saying the app is not affiliated with or endorsed by Skiddle. Each Skiddle event links with **View on Skiddle** using the link Skiddle returned, unmodified. Event data is stored as received and is for personal, non-commercial use. Event images are linked, not copied (Skiddle's terms are silent on images; the owner is asking them).

**Unknowns:** Skiddle publishes no daily or hourly limits and may change them at any time; watch worker logs for 429s. The per-artist and UK-window caps are the knobs (`SKIDDLE_ARTISTS_PER_USER`, `SKIDDLE_ARTIST_SEARCH_CAP`, `SKIDDLE_UK_*`).

**Configuration:** `SKIDDLE_API_KEY` (and optional `SKIDDLE_USER_AGENT_URL`) in `.env` / `.env.production`, passed through both compose files. With no key the source does nothing; the Discover tab works when either key is set. The preview uses a placeholder key and has no internet, so Skiddle is never called from it.
