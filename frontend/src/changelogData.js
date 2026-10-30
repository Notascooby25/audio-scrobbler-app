export const CHANGELOG = [
  {
    version: "0.26.0",
    date: "2026-10-30",
    changes: [
      "Festivals: tick This was a festival when you add or edit a gig. Festival gigs are listed under a Festivals heading at the bottom of the Venues tab, newest first, and get a Festival tag in each venue's list.",
      "Gigs tab on Reports: a new Gigs tab next to Listening shows how many gigs you've been to per month and per year (with festivals), the live gap (artists you play a lot but have never seen live) and your gig bump (average Spotify plays in the two weeks before and after each gig).",
    ],
  },
  {
    version: "0.25.0",
    date: "2026-10-29",
    changes: [
      "See a friend's gigs: on the profile of someone you follow, tap View Gigs to browse their gigs, artists seen, songs heard and venues, the same way View Library shows their scrobbles. Their notes stay private, and nothing can be changed from there.",
      "I was there too: on a friend's gig page, tap + I was there too to add that gig (songs and support acts included) to your own gigs in one go. It answers any Were you there? invite for that gig, and they get a notification.",
    ],
  },
  {
    version: "0.24.0",
    date: "2026-10-29",
    changes: [
      "Edit a gig: logged the wrong date, artist or venue? Tap Edit details on the gig's page. The songs you heard move with it, and so do any support acts you logged that night. Refresh from Setlist.fm keeps your corrections and only updates the songs.",
      "Went with: add the people you follow to a gig from its page. They're asked first: a Were you there? box on their My Gigs lets them add it (songs and support acts included) or dismiss it. People who already logged the show are shown first and just linked.",
      "Artwork for gig songs: songs you've streamed reuse their artwork straight away, and the rest is filled in quietly in the background from Deezer or iTunes, or the artist's photo for things like intros and covers. Refreshing a gig keeps its artwork, and artwork you clear stays cleared.",
    ],
  },
  {
    version: "0.23.0",
    date: "2026-10-29",
    changes: [
      "Much lighter on your Setlist.fm allowance: importing your profile now takes about one request per 20 gigs instead of 21, and logging a gig from search results or the bill needs no extra request.",
      "Imports that hit the daily Setlist.fm limit now carry on by themselves after midnight UTC. Import / Export shows how far a paused import has got, with a Cancel link, and you'll get a notification when it finishes.",
      "File imports that ran out of allowance now fetch the missing songs automatically later.",
      "Fixed: Refresh from Setlist.fm now always fetches the latest setlist instead of a saved copy up to a week old.",
    ],
  },
  {
    version: "0.22.0",
    date: "2026-10-29",
    changes: [
      "On the bill: each gig's page now lists the other acts at that venue that night, under My notes, with a tick for the ones you've logged.",
      "Tap + I was there next to an act to log it in place (as a support act when you're on the headliner's page), with Undo straight after.",
      "Faster, quota-friendly support act lookups: who-else-played results are now cached, so revisiting a gig doesn't use your Setlist.fm allowance.",
    ],
  },
  {
    version: "0.21.0",
    date: "2026-10-29",
    changes: [
      "Import from a file: Import / Export can now read back a CSV or JSON file made with Export. Gigs you've already logged are skipped, and any rows that can't be read are listed by line.",
      "Gig already logged: logging a show you already have (or the same artist on the same day) now asks before logging it again.",
      "Undo and Remove: after logging a gig, tap Undo in the confirmation to take it back, and each My Gigs row has a small Remove link for mistakes.",
      "Venues count one visit per night, even when a support act was saved with a slightly different venue spelling or country.",
    ],
  },
  {
    version: "0.20.0",
    date: "2026-10-29",
    changes: [
      "Fixed the Set Lists layout: the previous redesign used styling the app doesn't load, so rows stacked vertically and the bars were invisible. Every Set Lists page and dialog is now properly styled on desktop and mobile.",
      "Setlist.fm-style statistics: Artists, Songs and Venues show rank (shared on ties), name and a light-blue proportional bar, and each row expands in place.",
      "Songs Heard sidebar: filter the table to one year or one artist, and expand any song to see the gigs you heard it at.",
      "Venues now expand to show every act you've seen at each venue.",
      "Gig setlist pages: tap any gig to open its own page with the date, venue, tour, numbered songs and your notes. Refresh, Copy and Delete live here, and Back returns you to the exact list you came from.",
      "Cleaner navigation: folder-style tabs with plain text links for + Log a Gig and Import / Export, and no more blue pill buttons on titles or rows.",
      "Artists Seen is now sorted by times seen, then most recently seen, matching the page description.",
      "My Gigs now shows every gig you've logged (it previously stopped at your 50 most recent), with numbered pages and a choice of 10, 15, 25 or 50 gigs per page.",
    ],
  },
  {
    version: "0.19.1",
    date: "2026-10-29",
    changes: [
      "Authentic Setlist.fm Visual Redesign: eliminated heavy global button backgrounds so artist names, gig titles, and songs render as clean text links without blue pill boxes.",
      "Setlist.fm Tab Strip Layout: sub-navigation tabs now span the full width as clean underlined text links with a solid tab on the active selection, matching Setlist.fm's Concert Statistics / Song Statistics / Attendance Statistics layout.",
      "Attended Shows Row Structure: My Gigs timeline now displays the stacked date badge (Month / Day / Year) with a vertical divider, blue artist text link, and clean subtitle without bulky action buttons.",
      "Proportional Frequency Bars: aligned proportional progress bars and numbers to match the desktop layout from Setlist.fm.",
    ],
  },
  {
    version: "0.19.0",
    date: "2026-10-29",
    changes: [
      "Setlist.fm Dense Table Redesign: transformed Artists Seen, Songs Heard, and Venues into compact, striped data tables matching Setlist.fm layout and density.",
      "Tie-Aware Ranking: items sharing identical attendance counts share the same rank number, displayed only on the first item with subsequent ties blanked out (1, –, 3, –, 5).",
      "Left-Aligned Frequency Bars: proportional frequency bars now render count values inside on the left with clean hairline borders.",
      "Numbered Ellipsis Pagination: browse leaderboard pages using compact numeric pagination with ellipsis jumping (‹ 1 2 3 … 14 ›) and items-per-page selectors.",
      "Setlist Tracklist & Set Times Redesign: setlist detail drawers now feature blue date pills, artist/venue headings, Set Times information cards, slanted section banners, and continuous track numbering with grey annotations for guests and covers.",
      "Upcoming Gig Left-Accent Rails: future concerts and tour dates in My Gigs and search results now display a solid left primary accent rail.",
    ],
  },
  {
    version: "0.18.0",
    date: "2026-10-29",
    changes: [
      "In-Place Actions on Artists Seen Tab: expanding an artist in the Artists Seen leaderboard now lets you view songs & notes in-place and delete gigs with an inline double-confirmation banner directly where pressed.",
      "Direct Setlist.fm Link & Show ID Lookup: paste full Setlist.fm URLs (like /show/... or /setlist/...) or 8-character setlist IDs directly into the search bar to load upcoming tour dates or specific concerts instantly.",
      "Manual Upcoming & Custom Gig Logger: add upcoming concerts or tour dates not yet cataloged on Setlist.fm directly into your live timeline with Artist, Venue, Date, and personal notes.",
      "Multi-Page Month Search Scanning: searches filtered by Month now scan across multiple pages on Setlist.fm to prevent false empty states on active tour calendars.",
      "Mobile Navigation Bar Polish: redesigned sub-navigation tabs into a sleek, horizontally scrollable segmented pill bar with touch momentum, preventing uneven multi-line wrapping on mobile screens.",
    ],
  },
  {
    version: "0.17.0",
    date: "2026-10-29",
    changes: [
      "In-Place Gig Card Actions: 'View Songs' and 'Delete' now expand and confirm directly inline on the concert card where pressed, keeping your scroll position steady on mobile and desktop without jumping to detached top-level modals.",
      "Inline Setlist & Notes Drawer: seamlessly expand structured setlists with encores, tape tags, copy to clipboard, and personal concert memories editor directly inside your timeline cards.",
      "Month Filter for Concert Searches: added Month selector (01 - January through 12 - December) in search filters and backend search endpoint to easily pinpoint upcoming tour dates.",
      "Upcoming Shows & Search Pagination: search results now group into 'Upcoming Shows' and 'Past Shows' matching Setlist.fm layout, with 'View More Shows (+20)' pagination to browse through extensive tours.",
    ],
  },
  {
    version: "0.16.0",
    date: "2026-10-29",
    changes: [
      "Added Setlist Song Detail Modal: click any concert title or 'View Songs' to see the full setlist broken down into main sets and encores with continuous song numbering, guest features, cover artist notes, and tape intro tags.",
      "Added Setlist Copy to Clipboard: copy nicely formatted concert tracklists with one click.",
      "Added Personal Gig Notes & Diary: record memories (standing spots, ticket info, favorite encore moments) directly on your gigs with inline editing and timeline display.",
      "Added Future Gig & 'I'M GOING' support: concerts occurring in the future automatically display '+ I'M GOING' and an 'Upcoming' badge, with timeline sub-filter tabs ('All Gigs', 'Attended', 'Upcoming').",
      "Redesigned Set Lists visual styling inspired by Setlist.fm: stacked calendar date badges (Month, Day, Year) and proportional count bars on Artists Seen, Songs Heard, and Venues leaderboards adhering strictly to Flat-By-Default design rules.",
    ],
  },
  {
    version: "0.15.4",
    date: "2026-10-29",
    changes: [
      "Fixed Setlist.fm username casing resolution: preserves exact casing and transparently queries candidate casing variations (raw, Capitalized, lowercase) to accommodate Setlist.fm API case-sensitivity.",
      "Added support for Setlist.fm '/attended/' URL paths in profile link input.",
      "Added diagnostic request and response logging for Setlist.fm HTTP calls in container logs.",
      "Refined concert search empty-state messaging to suggest checking earlier tour years if results are not found.",
    ],
  },
  {
    version: "0.15.3",
    date: "2026-10-29",
    changes: [
      "Added Setlist.fm server diagnostics endpoint and warning banner if SETLIST_FM_API_KEY is missing or unconfigured in the production environment.",
      "Added URL parsing and username sanitization to accept full Setlist.fm user profile links (e.g. setlist.fm/user/username) as well as raw usernames.",
      "Fixed silent empty response handling from Setlist.fm API, returning explicit error feedback for missing keys, 401/403 authorization failures, and 404 users.",
      "Added explicit empty-state feedback when concert search queries return 0 results with guidance to check spelling or broaden filters.",
    ],
  },
  {
    version: "0.15.2",
    date: "2026-10-29",
    changes: [
      "Fixed reverse proxy routing for Set Lists by aligning API prefix with nginx.conf and Vite proxy rules, resolving JSON parse error on gig search and import preview.",
      "Added Setlist.fm Terms of Service attribution footer on Set Lists page.",
    ],
  },
  {
    version: "0.15.1",
    date: "2026-10-29",
    changes: [
      "Added selective Setlist.fm concert import: preview attended gigs from any username with interactive checkboxes, 'Select All' / 'Deselect All' toggles, and total selection counters.",
      "Optimized desktop top navigation by placing 'Set Lists' directly into the primary menu and moving 'Following' alongside 'Settings' in the Profile section.",
      "Wired SETLIST_FM_API_KEY into Docker Compose and production compose files with documented .env.example guidelines.",
      "Fixed Docker container startup packaging in CI smoke tests by aligning service import paths.",
    ],
  },
  {
    version: "0.15.0",
    date: "2026-10-28",
    changes: [
      "Introduced Set Lists navigation hub for concert and gig attendance tracking powered by Setlist.fm.",
      "Added Setlist.fm gig search with Country, Venue, and Year filters.",
      "Added 'I WAS THERE' 1-click attendance logging with automatic support acts detection on the bill.",
      "Automatic concert scrobbling into listening history with non-overlapping chronological sequencing for support acts and headliners.",
      "Added live music leaderboards: Artists Seen with expandable gig date/venue accordions, Songs Heard Live, and Venues Visited.",
      "Added 1-click Setlist.fm historical profile import with automatic daily rate-limit throttling and JSON/CSV gig export.",
      "Added double-confirmation gig deletion modal with support act cascade and automatic concert scrobble removal.",
    ],
  },
  {
    version: "0.14.1",
    date: "2026-10-28",
    changes: [
      "Optimized YouTube Music & Concert Scrobbler for mobile viewports, completely eliminating horizontal scrolling with fluid track row stacking and responsive input layouts.",
      "Expanded touch targets on channel unfollow buttons and track selection checkboxes to meet the >= 44pt mobile accessibility standard.",
      "Added accessible names (aria-labels) to inline editable track title and artist inputs.",
      "Refined dark mode contrast in feedback alerts and channel selector chips using system theme tokens.",
      "Added native lazy-loading and asynchronous decoding across all concert and channel thumbnail assets.",
    ],
  },
  {
    version: "0.14.0",
    date: "2026-10-28",
    changes: [
      "Introduced YouTube Music & Concert Scrobbler in Settings > Scrobble to extract and scrobble live performances from NPR Tiny Desk, KEXP sessions, BBC Music Live Lounge, and festival concerts.",
      "Added Followed Channels support with instant quick-add chips for NPR Music, KEXP, and BBC Music, plus custom channel handles and direct video URL loading.",
      "Built automatic setlist extraction engine supporting timestamped descriptions, setlist headers, and single-song video title parsing with inline editable song titles and artists.",
      "Added 1-click Spotify playlist export for extracted live concert tracklists and seamless repeat concert scrobbling support without database collisions.",
    ],
  },
  {
    version: "0.13.0",
    date: "2026-10-24",
    changes: [
      "Added a full, friendly User Guide directly in Settings with step-by-step walkthroughs for everyday listening, road trip/party scrobble copying with friends, BBC Sounds radio extraction, and library management.",
      "Added an interactive FAQ section in Settings with instant keyword search and accordion answers covering sync delay timing, duplicate prevention, artwork backfills, and device notifications.",
      "Added direct deep-linking support for Settings tabs via ?tab=guide and ?tab=faq.",
    ],
  },
  {
    version: "0.12.0",
    date: "2026-10-18",
    changes: [
      "Added full listening history data export (CSV and JSON) in Settings > Data with high-performance chunked streaming downloads.",
      "Introduced Time Capsule & Rediscover on the Overview page featuring Forgotten Favorites (unplayed tracks with 3+ past plays) and On This Day anniversary tracks.",
      "Added 1-click Spotify playlist creation from rediscovered tracks directly into the connected Spotify account.",
      "Expanded Spotify track URI normalizer to seamlessly support raw 22-character track IDs for playlist creation.",
    ],
  },
  {
    version: "0.11.11",
    date: "2026-10-18",
    changes: [
      "Distilled the Monthly Listening Summary into a high-density Archive Ledger with stat cards, instant Year filter chips, and relative volume bars.",
      "Streamlined the Connect page by pruning redundant chart panels in favor of direct handoff cards to Overview and Reports.",
      "Transformed recent scrobbles on Connect into a focused Recent Ingestion Activity feed with source badges and a direct link to the full Library.",
      "Removed dead monthly card styles and refined Overview page loading feedback to prevent layout shift during date range switches.",
    ],
  },
  {
    version: "0.11.10",
    date: "2026-10-18",
    changes: [
      "Corrected top-level heading hierarchy on the Connect page (WCAG 1.3.1).",
      "Added standard Escape key dismissal to the Copy Scrobbles modal.",
      "Improved Changelog version badge text contrast to satisfy WCAG AA (>= 4.5:1).",
      "Normalized BBC Scope Creep tools styling to use standard design tokens and 0.5px hairline borders.",
      "Refined loading spinner for reduced-motion preferences, using a gentle opacity pulse instead of an abrupt freeze.",
      "Elevated mobile touch targets across menus, compare toggles, calendar chips, and segmented tabs to the >= 44pt accessibility standard.",
    ],
  },
  {
    version: "0.11.9",
    date: "2026-10-18",
    changes: [
      "Redesigned the Connect page into a unified Data Sources Hub with clear cards for Spotify Streaming, History File Imports, and Radio/Tools.",
      "Replaced raw emoji notification bell with an accessible, crisp SVG outline icon and dynamic screen-reader count announcements.",
      "Isolated developer token bypass tools to local development only (stripped from production builds).",
      "Restored mobile touch parity for Library bulk selection, removing suppression rules and adding a sticky, touch-friendly action bar (>= 44pt touch targets).",
      "Added smooth loading feedback when switching date ranges or user views on the Reports page.",
      "Hardened design token fallbacks and resolved dark mode contrast in the bulk action bar.",
    ],
  },
  {
    version: "0.11.8",
    date: "2026-10-18",
    changes: [
      "Added green (positive) and red (negative) color indicators for percentage differences on the Reports summary cards when comparing previous periods.",
      "Introduced WCAG AA accessible theme tokens (--color-success and dark-mode --color-danger) for clear high-contrast stat comparisons across both light and dark themes.",
    ],
  },
  {
    version: "0.11.7",
    date: "2026-10-18",
    changes: [
      "Added previous period percentage comparisons to Listening minutes and Average per day on the Reports page, giving a complete comparison breakdown across all 3 summary metrics.",
      'Normalized toolbar button text casing so "Compare with Friends" matches the clean title/sentence case of the period comparison toggle.',
    ],
  },
  {
    version: "0.11.6",
    date: "2026-10-18",
    changes: [
      "Streamlined the Reports page layout: removed the clutter banner and unified the summary statistics into a balanced 3-card grid (Scrobbles this period, Listening minutes, and Average per day).",
      'Unified comparison controls: "Compare previous period" and "Compare with friends" now share matching, polished toggle buttons in the toolbar.',
      "Fixed the Overview summary bar grid alignment to evenly balance the active metrics.",
      "Standardized the Following page heading structure to match the rest of the application.",
    ],
  },
  {
    version: "0.11.5",
    date: "2026-10-17",
    changes: [
      "Updated service worker cache name to v5 to ensure existing browsers and installed PWAs immediately load the latest application updates.",
      "Configured production Watchtower instance to ensure future GitHub releases are automatically deployed to the NUC.",
    ],
  },
  {
    version: "0.11.4",
    date: "2026-10-17",
    changes: [
      'Added "Compare with Friends" social listening stats to the Reports page: compare top shared artists, top shared songs, and a minutes-listened leaderboard across your followed friends for any selected date range.',
      "Added responsive cards with individual friend play breakdowns and empty states prompting to follow friends.",
    ],
  },
  {
    version: "0.11.3",
    date: "2026-10-10",
    changes: [
      "Added automated code linting and formatting across the project (Ruff for Python, ShellCheck for Bash scripts, and ESLint + Prettier for React) and wired them into CI alongside the backup restore drill tests.",
      "Fixed a React Hook ordering issue on the Settings page when redirecting to the Changelog, and cleaned up unused imports and legacy scratch scripts.",
    ],
  },
  {
    version: "0.11.2",
    date: "2026-10-09",
    changes: [
      "Increased the default login session duration from 1 hour to 90 days, so you stay logged in without needing to reconnect constantly.",
    ],
  },
  {
    version: "0.11.1",
    date: "2026-10-06",
    changes: [
      "Fixed a bug preventing the notifications page from loading when clicking the bell icon.",
      "Added real-time notification syncing so the bell instantly clears when notifications are read.",
      "Added periodic polling (every 1 minute) to update the unread notification badge automatically while the app is open.",
    ],
  },
  {
    version: "0.10.0",
    date: "2026-10-02",
    changes: [
      "Added support for importing Apple Music (iTunes) listening history exports.",
      "Updated the import functionality to automatically detect processed Apple Music files.",
      "Added Apple Music badge and visual integration to the frontend.",
    ],
  },
  {
    version: "0.9.9",
    date: "2026-09-27",
    changes: [
      "Fixed Scope Creep unfollow button contrast: replaced red-on-blue styling with a high-contrast danger outline design on a transparent background.",
      'Fixed mobile horizontal scrolling in Scope Creep: constrained the "Search BBC Shows" drawer and search results flex layout with text truncation to prevent page overflow on mobile screens.',
      "Added secondary button styling aliases and viewport-safe card constraints in CSS.",
    ],
  },
  {
    version: "0.9.8",
    date: "2026-09-27",
    changes: [
      "Design system & accessibility overhaul: refactored Copy Scrobbles modal to native design tokens and standard modal primitives.",
      "Improved text contrast to meet WCAG AA standards (≥ 4.5:1) for secondary metadata and timestamps.",
      "Eradicated hard-coded light colors across cards, badges, and calendar controls, ensuring clean dark theme rendering.",
      "Expanded mobile touch targets (≥ 44px) for calendar buttons, date presets, and track controls on touchscreen devices.",
      "Made listening heatmap responsive with horizontal scrolling to prevent layout clipping on small viewports.",
      "Enhanced motion performance: removed layout reflows on progress bars and refined like heart animations with clean deceleration.",
    ],
  },
  {
    version: "0.9.7",
    date: "2026-09-27",
    changes: [
      'Redesigned Followed Shows to a visual list with inline "✕ Unfollow" buttons on every show, so you can unfollow any show directly without selecting it first.',
      "Replaced the dropdown picker with a clickable list of followed shows — tap a show to select it, tap again to deselect.",
      "Improved mobile layout for the Followed Shows section with touch-friendly card-style rows.",
    ],
  },
  {
    version: "0.9.6",
    date: "2026-09-27",
    changes: [
      "Added Followed Shows UI and backend support in Scope Creep, allowing you to follow BBC Sounds shows, select episodes, and load tracklists without manual URLs.",
      "Implemented FollowedShow model, migration, and API endpoints for listing, following, unfollowing, fetching episodes, and searching shows.",
      "Updated changelog and bumped frontend version.",
    ],
  },
  {
    version: "0.9.5",
    date: "2026-09-27",
    changes: [
      "Automated playlist loading: added 1-click Spotify authorization in Scope Creep to automatically pull your playlist library without manual links.",
      "Added playlist search filter to quickly find and select any existing playlist from your library.",
      "Expanded playlist fetching to paginate and load up to 200 of your Spotify playlists.",
    ],
  },
  {
    version: "0.9.4",
    date: "2026-09-27",
    changes: [
      "Added Spotify playlist destination choice in Scope Creep: choose between creating a brand new playlist or appending imported tracks directly to an existing Spotify playlist.",
      "Added Spotify playlist selector to choose from your personal playlists, recently used playlists, or paste any Spotify playlist link or ID.",
    ],
  },
  {
    version: "0.9.3",
    date: "2026-09-27",
    changes: [
      "Added the official BBC Sounds logo badge for all tracks and scrobbles imported from BBC Sounds.",
      "Added automatic album artwork resolution for BBC Sounds tracks, displaying official album covers in the tracklist preview and scrobble history.",
      "Fixed Spotify playlist creation error by migrating to Spotify's latest API specifications.",
      "Fixed scrobble timestamps to accurately display your local listening time (e.g. BST) instead of UTC.",
      "Organized Settings: moved the Scope Creep BBC Sounds tool directly into the Scrobble settings tab.",
    ],
  },
  {
    version: "0.9.1",
    date: "2026-09-26",
    changes: [
      "Enhanced Scope Creep with track selection and direct scrobbling: preview show tracklists, uncheck tracks you skipped, and mark them as listened directly in your history.",
    ],
  },
  {
    version: "0.9.0",
    date: "2026-09-26",
    changes: [
      "Added ability to copy someone's scrobbles (Designed to be used if shared a car journey for example).",
      "Added Scope Creep tool to automatically generate a Spotify playlist from a BBC Sounds show URL.",
    ],
  },
  {
    version: "0.8.4",
    date: "2026-09-25",
    changes: [
      "Added Community Leaderboards to the Following page.",
      "Added a Dark Mode theme toggle to the Settings page.",
    ],
  },
  {
    version: "0.8.3",
    date: "2026-09-25",
    changes: [
      "Improved the user interface with updated styling and touch-friendly buttons.",
      "Added delightful empty states with a heart animation.",
    ],
  },
  {
    version: "0.8.2",
    date: "2026-09-24",
    changes: [
      "Fixed missing genres by automatically fetching them from Last.fm when Spotify is restricted.",
      'Fixed a bug causing "Music Ratio" statistics to display incorrectly.',
    ],
  },
  {
    version: "0.8.1",
    date: "2026-09-23",
    changes: [
      "Added the ability to create shareable image cards for your top artists, albums, and tracks.",
      "Added new Explorer vs Repeater and Singles vs Albums listening ratios.",
      "Added an option to clear broken artwork from your library.",
    ],
  },
  {
    version: "0.8.0",
    date: "2026-09-17",
    changes: [
      "Fixed Spotify rate-limiting issues by optimizing background polling.",
      "Removed automatic Liked Tracks sync to prevent Spotify connection drops.",
    ],
  },
  {
    version: "0.7.0",
    date: "2026-08-10",
    changes: [
      "Added Data management settings.",
      "Added ability to backfill missing artwork.",
      "Added advanced delete options by batch or date.",
    ],
  },
];
