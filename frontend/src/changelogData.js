export const CHANGELOG = [
  {
    version: '0.11.9',
    date: '2026-10-18',
    changes: [
      'Redesigned the Connect page into a unified Data Sources Hub with clear cards for Spotify Streaming, History File Imports, and Radio/Tools.',
      'Replaced raw emoji notification bell with an accessible, crisp SVG outline icon and dynamic screen-reader count announcements.',
      'Isolated developer token bypass tools to local development only (stripped from production builds).',
      'Restored mobile touch parity for Library bulk selection, removing suppression rules and adding a sticky, touch-friendly action bar (>= 44pt touch targets).',
      'Added smooth loading feedback when switching date ranges or user views on the Reports page.',
      'Hardened design token fallbacks and resolved dark mode contrast in the bulk action bar.'
    ]
  },
  {
    version: '0.11.8',
    date: '2026-10-18',
    changes: [
      'Added green (positive) and red (negative) color indicators for percentage differences on the Reports summary cards when comparing previous periods.',
      'Introduced WCAG AA accessible theme tokens (--color-success and dark-mode --color-danger) for clear high-contrast stat comparisons across both light and dark themes.'
    ]
  },
  {
    version: '0.11.7',
    date: '2026-10-18',
    changes: [
      'Added previous period percentage comparisons to Listening minutes and Average per day on the Reports page, giving a complete comparison breakdown across all 3 summary metrics.',
      'Normalized toolbar button text casing so "Compare with Friends" matches the clean title/sentence case of the period comparison toggle.'
    ]
  },
  {
    version: '0.11.6',
    date: '2026-10-18',
    changes: [
      'Streamlined the Reports page layout: removed the clutter banner and unified the summary statistics into a balanced 3-card grid (Scrobbles this period, Listening minutes, and Average per day).',
      'Unified comparison controls: "Compare previous period" and "Compare with friends" now share matching, polished toggle buttons in the toolbar.',
      'Fixed the Overview summary bar grid alignment to evenly balance the active metrics.',
      'Standardized the Following page heading structure to match the rest of the application.'
    ]
  },
  {
    version: '0.11.5',
    date: '2026-10-17',
    changes: [
      'Updated service worker cache name to v5 to ensure existing browsers and installed PWAs immediately load the latest application updates.',
      'Configured production Watchtower instance to ensure future GitHub releases are automatically deployed to the NUC.'
    ]
  },
  {
    version: '0.11.4',
    date: '2026-10-17',
    changes: [
      'Added "Compare with Friends" social listening stats to the Reports page: compare top shared artists, top shared songs, and a minutes-listened leaderboard across your followed friends for any selected date range.',
      'Added responsive cards with individual friend play breakdowns and empty states prompting to follow friends.'
    ]
  },
  {
    version: '0.11.3',
    date: '2026-10-10',
    changes: [
      'Added automated code linting and formatting across the project (Ruff for Python, ShellCheck for Bash scripts, and ESLint + Prettier for React) and wired them into CI alongside the backup restore drill tests.',
      'Fixed a React Hook ordering issue on the Settings page when redirecting to the Changelog, and cleaned up unused imports and legacy scratch scripts.'
    ]
  },
  {
    version: '0.11.2',
    date: '2026-10-09',
    changes: [
      'Increased the default login session duration from 1 hour to 90 days, so you stay logged in without needing to reconnect constantly.'
    ]
  },
  {
    version: '0.11.1',
    date: '2026-10-06',
    changes: [
      'Fixed a bug preventing the notifications page from loading when clicking the bell icon.',
      'Added real-time notification syncing so the bell instantly clears when notifications are read.',
      'Added periodic polling (every 1 minute) to update the unread notification badge automatically while the app is open.'
    ]
  },
  {
    version: '0.10.0',
    date: '2026-10-02',
    changes: [
      'Added support for importing Apple Music (iTunes) listening history exports.',
      'Updated the import functionality to automatically detect processed Apple Music files.',
      'Added Apple Music badge and visual integration to the frontend.'
    ]
  },
  {
    version: '0.9.9',
    date: '2026-09-27',
    changes: [
      'Fixed Scope Creep unfollow button contrast: replaced red-on-blue styling with a high-contrast danger outline design on a transparent background.',
      'Fixed mobile horizontal scrolling in Scope Creep: constrained the "Search BBC Shows" drawer and search results flex layout with text truncation to prevent page overflow on mobile screens.',
      'Added secondary button styling aliases and viewport-safe card constraints in CSS.',
    ]
  },
  {
    version: '0.9.8',
    date: '2026-09-27',
    changes: [
      'Design system & accessibility overhaul: refactored Copy Scrobbles modal to native design tokens and standard modal primitives.',
      'Improved text contrast to meet WCAG AA standards (≥ 4.5:1) for secondary metadata and timestamps.',
      'Eradicated hard-coded light colors across cards, badges, and calendar controls, ensuring clean dark theme rendering.',
      'Expanded mobile touch targets (≥ 44px) for calendar buttons, date presets, and track controls on touchscreen devices.',
      'Made listening heatmap responsive with horizontal scrolling to prevent layout clipping on small viewports.',
      'Enhanced motion performance: removed layout reflows on progress bars and refined like heart animations with clean deceleration.',
    ]
  },
  {
    version: '0.9.7',
    date: '2026-09-27',
    changes: [
      'Redesigned Followed Shows to a visual list with inline "✕ Unfollow" buttons on every show, so you can unfollow any show directly without selecting it first.',
      'Replaced the dropdown picker with a clickable list of followed shows — tap a show to select it, tap again to deselect.',
      'Improved mobile layout for the Followed Shows section with touch-friendly card-style rows.',
    ]
  },
  {
    version: '0.9.6',
    date: '2026-09-27',
    changes: [
      'Added Followed Shows UI and backend support in Scope Creep, allowing you to follow BBC Sounds shows, select episodes, and load tracklists without manual URLs.',
      'Implemented FollowedShow model, migration, and API endpoints for listing, following, unfollowing, fetching episodes, and searching shows.',
      'Updated changelog and bumped frontend version.',
    ]
  },
  {
    version: '0.9.5',
    date: '2026-09-27',
    changes: [
      'Automated playlist loading: added 1-click Spotify authorization in Scope Creep to automatically pull your playlist library without manual links.',
      'Added playlist search filter to quickly find and select any existing playlist from your library.',
      'Expanded playlist fetching to paginate and load up to 200 of your Spotify playlists.',
    ]
  },
  {
    version: '0.9.4',
    date: '2026-09-27',
    changes: [
      'Added Spotify playlist destination choice in Scope Creep: choose between creating a brand new playlist or appending imported tracks directly to an existing Spotify playlist.',
      'Added Spotify playlist selector to choose from your personal playlists, recently used playlists, or paste any Spotify playlist link or ID.',
    ]
  },
  {
    version: '0.9.3',
    date: '2026-09-27',
    changes: [
      'Added the official BBC Sounds logo badge for all tracks and scrobbles imported from BBC Sounds.',
      'Added automatic album artwork resolution for BBC Sounds tracks, displaying official album covers in the tracklist preview and scrobble history.',
      'Fixed Spotify playlist creation error by migrating to Spotify\'s latest API specifications.',
      'Fixed scrobble timestamps to accurately display your local listening time (e.g. BST) instead of UTC.',
      'Organized Settings: moved the Scope Creep BBC Sounds tool directly into the Scrobble settings tab.',
    ]
  },
  {
    version: '0.9.1',
    date: '2026-09-26',
    changes: [
      'Enhanced Scope Creep with track selection and direct scrobbling: preview show tracklists, uncheck tracks you skipped, and mark them as listened directly in your history.',
    ]
  },
  {
    version: '0.9.0',
    date: '2026-09-26',
    changes: [
      'Added ability to copy someone\'s scrobbles (Designed to be used if shared a car journey for example).',
      'Added Scope Creep tool to automatically generate a Spotify playlist from a BBC Sounds show URL.'
    ]
  },
  {
    version: '0.8.4',
    date: '2026-09-25',
    changes: [
      'Added Community Leaderboards to the Following page.',
      'Added a Dark Mode theme toggle to the Settings page.'
    ]
  },
  {
    version: '0.8.3',
    date: '2026-09-25',
    changes: [
      'Improved the user interface with updated styling and touch-friendly buttons.',
      'Added delightful empty states with a heart animation.'
    ]
  },
  {
    version: '0.8.2',
    date: '2026-09-24',
    changes: [
      'Fixed missing genres by automatically fetching them from Last.fm when Spotify is restricted.',
      'Fixed a bug causing "Music Ratio" statistics to display incorrectly.'
    ]
  },
  {
    version: '0.8.1',
    date: '2026-09-23',
    changes: [
      'Added the ability to create shareable image cards for your top artists, albums, and tracks.',
      'Added new Explorer vs Repeater and Singles vs Albums listening ratios.',
      'Added an option to clear broken artwork from your library.'
    ]
  },
  {
    version: '0.8.0',
    date: '2026-09-17',
    changes: [
      'Fixed Spotify rate-limiting issues by optimizing background polling.',
      'Removed automatic Liked Tracks sync to prevent Spotify connection drops.'
    ]
  },
  {
    version: '0.7.0',
    date: '2026-08-10',
    changes: [
      'Added Data management settings.',
      'Added ability to backfill missing artwork.',
      'Added advanced delete options by batch or date.'
    ]
  }
]
