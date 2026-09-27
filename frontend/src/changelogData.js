export const CHANGELOG = [
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
