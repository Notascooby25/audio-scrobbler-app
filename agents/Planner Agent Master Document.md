Planner Agent Master Document — Overview, Library, Reports Pages
Planner Agent Master Document - Overview, Library, Reports Pages
This master document defines all planning requirements for generating the three core pages of the Audio Scrobbler App: Overview, Library, and Reports. These pages form the primary user-facing analytics experience and must follow consistent architectural, visual, and data-driven patterns.

1. Purpose of This Document
This document extends the Planner Agent with unified rules for:
    • Planning and validating the Overview (Landing Page)
    • Planning and validating the Library Page
    • Planning and validating the Reports Page
    • Ensuring consistent data contracts, aggregation logic, and UI layout across all pages
    • Producing Implementation-Agent-ready task lists for backend, frontend, and data layers
    • Maintaining alignment with the existing architecture (FastAPI, PostgreSQL, React, PWA offline behaviour)

2. Global Requirements Across All Pages
2.1 Data Model Requirements
All pages rely on the same underlying scrobble dataset. The Planner Agent must ensure:
    • Scrobbles table includes: user_id, track_id, artist_id, album_id, played_at, ms_played, source
    • Artist, Album, Track tables include: names, artwork URLs, external IDs
    • Time-range filtering is consistent across all pages (7d, 30d, all, week, month, year)
    • Pagination is supported (limit, offset)
    • All aggregation queries are index-optimised
2.2 Backend API Requirements
The Planner Agent must define and validate endpoints for:
    • Summary stats
    • Top artists, albums, tracks
    • Full library listings
    • Reports analytics (charts, leaderboards, comparisons)
All endpoints must:
    • Accept user_id
    • Accept time-range parameters
    • Return artwork URLs where applicable
    • Return metadata for charts and comparisons
2.3 Frontend Component Architecture
The Planner Agent must enforce creation of reusable components:
    • Stats bars
    • Preview grids
    • Ranked lists
    • Charts (bar, radar, circular, stream graphs)
    • Leaderboards
    • Tabs and navigation
All components must:
    • Use consistent spacing, typography, and card layout
    • Support responsive behaviour
    • Support offline caching via the PWA service worker
2.4 Visual Layout Requirements
Across all pages:
    • Section titles must follow consistent styling
    • Artwork must use object-fit: cover
    • Numeric stats must be bold and prominent
    • Charts must follow a unified colour palette
    • Pages must follow a modular grid layout

3. Overview Page Requirements (Landing Page)
3.1 Purpose
The Overview Page provides a high-level snapshot of the user's listening activity.
3.2 Required Sections
    • SummaryStatsBar: Scrobbles, Artists, Loved Tracks
    • Top Artists Preview (limit 5)
    • Top Albums Preview (limit 5)
    • Top Tracks Preview (limit 8)
3.3 Backend Requirements
Endpoints:
    • GET /stats/summary
    • GET /stats/top-artists
    • GET /stats/top-albums
    • GET /stats/top-tracks
3.4 Frontend Requirements
Components:
    • SummaryStatsBar
    • TopArtistsGrid
    • TopAlbumsGrid
    • TopTracksList
3.5 Layout Requirements
    • Clean landing page layout
    • Preview sections with artwork
    • “More...” links to Library pages

4. Library Page Requirements
4.1 Purpose
The Library Page displays all scrobbles and detailed breakdowns by artist, album, and track.
4.2 Required Sections
    • StatsHeader: Total scrobbles, average per day
    • Tabs: Scrobbles, Artists, Albums, Tracks
    • Ranked Lists for each tab
    • DateRangeChart showing scrobbles per year
4.3 Backend Requirements
Endpoints:
    • GET /library/scrobbles
    • GET /library/artists
    • GET /library/albums
    • GET /library/tracks
4.4 Frontend Requirements
Components:
    • LibraryTabs
    • ScrobbleList
    • ArtistRankList
    • AlbumRankList
    • TrackRankList
    • DateRangeChart
4.5 Layout Requirements
    • Two-column layout (list + chart)
    • Responsive collapse to single column

5. Reports Page Requirements
5.1 Purpose
The Reports Page provides deep analytics, infographics, and comparative metrics.
5.2 Required Sections
    • ReportSummaryBanner: total scrobbles + comparison vs previous period
    • Category Panels: Artists, Albums, Tracks
    • Charts Section:
        ◦ Weekly Scrobbles
        ◦ Listening Clock
        ◦ Top Tags
    • Extended Analytics:
        ◦ Music Ratio
        ◦ Listening Fingerprint
        ◦ Music by Decade
        ◦ Artist Map
    • Community Section:
        ◦ Scrobble Leaderboard
        ◦ Discovery Leaderboard
    • Quick Facts: listening time, streaks, averages
5.3 Backend Requirements
Endpoints:
    • GET /reports/summary
    • GET /reports/artists
    • GET /reports/albums
    • GET /reports/tracks
    • GET /reports/charts
    • GET /reports/community
5.4 Frontend Requirements
Components:
    • ReportSummaryBanner
    • ReportCategoryPanel
    • WeeklyScrobblesChart
    • ListeningClockChart
    • TopTagsStreamGraph
    • MusicRatioChart
    • ListeningFingerprintRadar
    • MusicByDecadeChart
    • ArtistMap
    • CommunityLeaderboard
    • QuickFactsPanel
5.5 Layout Requirements
    • Modular grid layout
    • High-contrast charts
    • Pastel accent blocks
    • Responsive stacking

6. Testing Requirements (All Pages)
The Planner Agent must include:
    • Unit tests for aggregation SQL
    • API tests for each endpoint
    • Frontend component rendering tests
    • Chart data consistency tests
    • Offline behaviour tests

7. Deployment & Monitoring Requirements
The Planner Agent must ensure:
    • All endpoints are included in CI/CD workflows
    • Aggregation performance is monitored
    • Indexes are added for all time-series queries

8. Planner Agent Behaviour Extensions
When planning any of the three pages, the Planner Agent must:
    • Validate alignment with the existing architecture
    • Break tasks into backend, frontend, and data layers
    • Ensure naming conventions match the Audio Scrobbler App
    • Produce Implementation-Agent-ready task lists

9. Example Output Structure
When asked to plan any of the three pages, the Planner Agent must output:
    1. Goal
    2. Data Model Requirements
    3. Backend API Requirements
    4. Frontend Component Requirements
    5. UI Layout Specification
    6. Testing Requirements
    7. Deployment Notes
    8. Implementation Agent Task List
