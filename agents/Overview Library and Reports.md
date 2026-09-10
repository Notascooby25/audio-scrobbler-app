Overview, Library, and Reports Planner Documents

This page contains the clean Planner documents for the three core pages of the Audio Scrobbler App: Overview, Library, and Reports. Each document is designed to be placed in the /agents/ folder of your workspace and used by the Planner Agent when generating plans.

Overview Page Planner

Purpose

The Overview Page provides a high-level snapshot of the user's listening activity.

Required Sections

SummaryStatsBar: Scrobbles, Artists, Loved Tracks

Top Artists Preview (limit 5)

Top Albums Preview (limit 5)

Top Tracks Preview (limit 8)

Backend Requirements

Endpoints:

GET /stats/summary

GET /stats/top-artists

GET /stats/top-albums

GET /stats/top-tracks

Frontend Requirements

Components:

SummaryStatsBar

TopArtistsGrid

TopAlbumsGrid

TopTracksList

Layout Requirements

Clean landing page layout

Preview sections with artwork

"More…" links to Library pages

Library Page Planner

Purpose

The Library Page displays all scrobbles and detailed breakdowns by artist, album, and track.

Required Sections

StatsHeader: Total scrobbles, average per day

Tabs: Scrobbles, Artists, Albums, Tracks

Ranked Lists for each tab

DateRangeChart showing scrobbles per year

Backend Requirements

Endpoints:

GET /library/scrobbles

GET /library/artists

GET /library/albums

GET /library/tracks

Frontend Requirements

Components:

LibraryTabs

ScrobbleList

ArtistRankList

AlbumRankList

TrackRankList

DateRangeChart

Layout Requirements

Two-column layout (list + chart)

Responsive collapse to single column

Reports Page Planner

Purpose

The Reports Page provides deep analytics, infographics, and comparative metrics.

Required Sections

ReportSummaryBanner: total scrobbles + comparison vs previous period

Category Panels: Artists, Albums, Tracks

Charts Section:

Weekly Scrobbles

Listening Clock

Top Tags

Extended Analytics:

Music Ratio

Listening Fingerprint

Music by Decade

Artist Map

Community Section:

Scrobble Leaderboard

Discovery Leaderboard

Quick Facts: listening time, streaks, averages

Backend Requirements

Endpoints:

GET /reports/summary

GET /reports/artists

GET /reports/albums

GET /reports/tracks

GET /reports/charts

GET /reports/community

Frontend Requirements

Components:

ReportSummaryBanner

ReportCategoryPanel

WeeklyScrobblesChart

ListeningClockChart

TopTagsStreamGraph

MusicRatioChart

ListeningFingerprintRadar

MusicByDecadeChart

ArtistMap

CommunityLeaderboard

QuickFactsPanel

Layout Requirements

Modular grid layout

High-contrast charts

Pastel accent blocks

Responsive stacking
