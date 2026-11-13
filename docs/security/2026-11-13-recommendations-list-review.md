# Differential review: recommendations list redesign (v0.49.0)

Branch `feat/recommendations-list` against `main`. Frontend only: 8 files, about 900 lines added and 300 removed. Strategy: DEEP (small change set). Overall risk: LOW to MEDIUM.

## Scope and method

- Changed: `FriendRecommendationsCard.jsx` (rewritten), `styles.css` (new `.friend-recs` section), `sleeve.css` (two selector exclusions), tests, changelog, `package.json` version.
- Not changed: backend, API routes, auth, worker, database, nginx, service worker.
- Blast radius: the card is rendered by 3 pages only (classic Overview, Timeline Play, Sleeve Play), found with `git grep`. The two `sleeve.css` selectors affect every Sleeve button, but the added `:not([class*="friend-recs__"])` only excludes buttons whose class contains `friend-recs__`, which exist nowhere else.
- Git history: the card came from #86 and #87. No security code was removed by this change.

## Findings

### F1 - MEDIUM (pre-existing, fixed on this branch): links and cover art from another user were used unchecked

- **Where:** `FriendRecommendationsCard.jsx`, `buildSpotifyUrl` and `Art` (before the fix, the `window.open(targetUrl, ...)` and `<img src={rec.image_url}>` paths). Backend `schemas/recommendations.py` accepts any string for `spotify_url` and `image_url`.
- **Scenario:** a person you follow sends a recommendation with `spotify_url` set to a look-alike phishing page or a `javascript:` URL. The recipient clicks "Play on Spotify" and that URL is opened. A hostile `image_url` makes the recipient's browser request an attacker-chosen address when the card appears (a tracking pixel).
- **Introduced by this change?** No. The old code did the same. It sits in code this change rewrites, so it was fixed here.
- **Fix:** the card now only opens `https://open.spotify.com/...` links (anything else falls back to the `spotify_uri` link or a Spotify search), and only loads cover art whose address is `https`. Tests: 3 unsafe-link cases and 3 unsafe-image cases, each seen failing before the fix.
- **Remaining:** a plain `https` image on an attacker's server is still requested (tracking pixel). Closing that needs the backend to validate or proxy `image_url`, and to validate `spotify_url` on creation. Recommended as a separate backend change; not done here.

### F2 - LOW: failed status saves are silent

If marking a pick listened or dismissed fails, the pick stays and the user sees nothing. Unchanged behaviour (it was ignored before). No security impact.

### Checked and clear

- No `dangerouslySetInnerHTML`, `innerHTML` or `eval`. Names, titles and notes are rendered through React and are escaped.
- External windows still use `noopener,noreferrer`.
- No new network calls, endpoints, storage or secrets. No inline styles remain.
- Access control and follower checks are server-side and untouched.
- Service worker caching rules are untouched.

## Test coverage of changed code

- `FriendRecommendationsCard.test.jsx` (20 tests): rendering, list, promote, play, dismiss, cap of four rows, missing data, failed save, double click, unsafe links, unsafe images.
- `FriendRecommendationsSurfaces.test.jsx` (6 tests): Timeline, Sleeve and classic.
- `friendRecsStyles.test.js` (6 tests): tokens defined, no gradients or shadows, 44px buttons, contrast on all 8 accents, Sleeve exclusions.

## Confidence and limits

High confidence for the frontend diff. Not reviewed: the backend validation gap beyond reading the schema, and any real data in production.
