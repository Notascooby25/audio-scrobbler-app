# Year Wrapped (music and gigs): design

Status: approved by the owner, 2026-11-27 (open questions answered; next step is the written plan). Source research: "Spotify Wrapped and building your own" (supplied by the owner, not committed).

## 1. Intent and why

Give each person who uses the app a Spotify-Wrapped-style "your year" story, with a gigs section Spotify doesn't have (gigs attended, miles travelled, months with a gig). It should be as representative of the whole calendar year as possible, so it unlocks on 31 December rather than in early December. It must be obvious it has arrived: a banner, a bell notification and a push notification. A 2025 version is built first as a sample of the 2026 one, for anyone with 2025 scrobbles or gigs.

## 2. Goals, non-goals, anti-goals

**Goals**
- Per-user story of full-screen slides: music slides, then gig slides, then a summary, each with a Share image.
- Numbers are calculated once, saved, and never silently recalculated ("frozen").
- Past years stay reopenable from the Reports page.
- 2025 sample generated and viewable well before 31 December.

**Non-goals**
- No viewing a friend's Wrapped (private per person; sharing is by image only).
- No Spotify API calls, no music playback behind slides, no AI-written text, no "Listening Age", Clubs or personality cards in the first release (candidates for later).
- No "top X% of all listeners" claims.

**Anti-goals (failure even if it technically works)**
- A number that changes after the person has seen it.
- A wrong day or hour because of UTC against UK time.
- Gig slides for someone with no gigs, or a music slide with nothing to show (empty slides are skipped).
- Distances presented as road miles.
- Anything private (notes, another person's data) on a share image.

## 3. Constraints

- Public repo: no hostnames, IDs or known weaknesses in code, tests or docs.
- Follows AGENTS.md: flat design (no gradients or box-shadow), approved colour tokens, UK English, no new dependency without asking, mobile layout invariants, tests that mirror production (non-autoflush session, Postgres for dialect-sensitive queries).
- Nothing calls Spotify inline in a request. The worker does the calculating.
- A new table needs an Alembic migration (next number after 0037) and the owner's approval before it is built.
- The server clock decides whether a year is unlocked, in Europe/London time. The phone clock is never trusted.
- `listening_events` stores `played_at` (UTC, naive) and `duration_ms` (track length), but not time actually played, skips or the listener's timezone. So minutes are "about", based on track length, and the slide says so.

## 4. Approaches considered

1. **Saved snapshot in the database plus an in-app story page (chosen).** New `year_reviews` table; worker job calculates; page only reads. Frozen, checkable before launch, covered by existing database dumps. Needs a migration.
2. Calculate live on every open. No table, but numbers can drift (late genres, edited gigs), queries are heavy, and "frozen 2025" isn't frozen. Rejected.
3. JSON files on the shared server disk. Outside the database dumps, with extra volume and backup risk on shared production. Rejected.

## 5. Decisions made with the owner

- **Unlock rule ("option C"):** a preview snapshot is taken the morning of 30 December for checking. A second snapshot is generated at the unlock time on 31 December and is what people see. Gigs logged after that show only in the 1 January final version.
- **Where it shows up:** banner in the app header on every page until opened or dismissed, one bell notification, one push notification (if the person has push on). Before unlock, the Reports page shows a locked card with the unlock date.
- **Slides (look approved from the mockup):** music (minutes, top artists, months, plus top songs, albums, genres, listening clock, biggest day, new artists), then four gig cards (gigs at a glance; miles travelled; gig calendar of 12 months; highlights), then a summary card. Slides with no data are skipped.
- **Gig distance:** as the crow flies, home city to venue and back, using the existing home city and venue geocoding. Wording says "there and back, as the crow flies".
- **Unlock time:** 18:00 Europe/London on 31 December, from the server clock (my suggestion, not objected to).
- **1 January final version (owner chose "a"):** it quietly replaces the 31 December version, with a small "updated" tag on any slide whose numbers changed. No second banner or notification. The 31 December version is kept in the table (stage `unlock`) and the final is stage `final`; people are shown the newest stage.
- **2025 sample:** visible only to the owner at first, no banner or notification. Opening it to everyone with 2025 data is a later switch.
- **Table approved:** the new `year_reviews` table (migration 0038) is approved by the owner (2026-11-27).
- **Private per person**, share by image only.
- **Built as option 1** with an in-house story component (no new dependency) and the existing `html-to-image` for share images.

## 6. Calls I made (the owner can overrule these)

- Counting rules: Wrapped reads the stored scrobbles as they are. Ingestion already drops repeats of the same track within 15 minutes, so Wrapped totals match the Reports page and no second dedup is added (the research document's 30-second rule is dropped). Dates and hours grouped in Europe/London.
- Top artists by plays. Top albums rank by plays, and an album only qualifies if the person played at least 3 different tracks from it that year (we don't hold full album track lists, so "most of the album" can't be tested). Genres come from the existing `genre_cache`, with "Unknown" allowed.
- Gigs: one `attended_concerts` row is one gig, with an `is_festival` flag, so festival days are counted from that flag (same as the Reports Gigs tab). Support-act and cover-band gigs count as gigs attended. A gig whose venue can't be placed is left out of the miles and the slide says how many were left out. Approximate (city-level) placements are included in the miles and the slide says "includes N placed by city".
- A person with no home city set gets no miles slide (the other gig slides still show). Gigs near home still count towards the miles.
- Preview snapshots (30 December) are never shown to users and send no banner or notification. People below the threshold see no banner and no locked card. Seen and dismissed state are columns on `year_reviews`, so there is one new table, not two.
- Snapshot carries a `format_version`. A slide missing from an older snapshot is skipped instead of crashing.
- The share image is made at 1080 by 1920 from the slide, with no names of other people and no gig notes.
- Wrapped is produced for every active user with at least a minimum amount of listening or any gig in the year (threshold left to the builder; suggest 30 scrobbles or 1 gig).
- Banner dismissals and "seen" state are stored per user and year so the banner doesn't come back.

## 7. Left to the builder

- Exact table columns, API routes and worker schedule (follow the existing `recaps-generation` and `venue-geocoding` patterns; new worker env settings must be added to the hand-managed production compose file).
- Slide order details, copy, animation (static first), and the exact "equivalent distance" wording.
- How to treat a partial 2025 (label "from <first scrobble date>" when records start mid-year).
- Test data: about 20,000 fake plays covering duplicates, midnight plays and March/October clock changes, tested on a real throwaway Postgres.

## 8. Risks and checks

- Timezone and clock-change bugs (tested explicitly).
- Gig geocoding gaps (venues falling back to city, `approximate` already tracked).
- Banner or notification firing twice (one row per user, year and stage; idempotent job).
- Access control: a user can only read their own `year_reviews` rows; tested.
- 2025 sample is checked in the private preview with real data, never with screenshots saved inside the repo.
- Production rollout: migration applies on deploy; worker settings added to the host compose file by hand.
