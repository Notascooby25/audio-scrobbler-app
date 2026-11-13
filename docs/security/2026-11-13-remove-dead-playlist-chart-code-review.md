# Differential review: remove dead playlist chart code

- **Branch:** `chore/remove-dead-playlist-chart-code` against `main` (`b7c96b6`)
- **Date:** 2026-11-13
- **Strategy:** FOCUSED. Two files changed, so every changed line was read.
- **Overall risk:** LOW. No findings.

## What changed

| File | Change |
|------|--------|
| `backend/app/queries/analytics_queries.py` | Removed the `extract_playlist_uri` SQL helper and the two `entity == "playlists"` branches in `build_top_entities_query`. 22 lines deleted, nothing added. |
| `backend/app/tests/test_charts.py` | Added one test: `build_top_entities_query(..., "playlists")` raises `ValueError`. |

## Phase 1: history of the removed code

The helper came from `343a108` (#19, Reports Playlists tab). The Playlists feature
was removed afterwards (`2acb98b`), and `CHART_ENTITIES` has not listed
`playlists` since then. No security, CVE or access-control commit touched the
removed lines.

## Phase 3: blast radius

- `git grep` for `extract_playlist_uri` and `playlist_uri_expr` finds no use
  outside the deleted code. Callers: 0.
- `build_top_entities_query` has one caller, `analytics_service.py`, reached only
  from `api/analytics.py`. Those routes reject any entity not in `CHART_ENTITIES`
  (`artists`, `tracks`, `albums`, `genres`) with a 400 before the query is built.
- The Spotify playlist features (Rediscover export, BBC Sounds / Scope Creep,
  `spotify_playlist_service.py`) do not use the removed code and are untouched.
- `FunctionElement` and `compiles` are still used by other helpers, so no
  imports changed.

## Security analysis

- **Auth and access control:** `not_blocked_clause` and the per-user filter in the
  query builder are unchanged. No route, permission or follower check changed.
- **Input handling:** the removal narrows what the function accepts. An unknown
  entity already raised `ValueError`; `playlists` now does too. The API layer
  turns bad entities into a 400 before this point, so there is no new 500 path.
- **SQL injection:** the removed code built raw SQL text through a compiler hook.
  Removing it reduces the amount of hand-built SQL. Nothing was added.
- **Schema and data:** no model, migration or table change. `PlaylistCache` and
  the `playlist_cache` table were deliberately left alone.
- **Secrets, external calls, deployment:** none touched.

## Test coverage

The new test fails on `main` (the function returned a query for `playlists`) and
passes with the change. The full backend and worker suite, frontend suite, lint
and build pass (see the pull request).

## Findings

| Severity | Finding |
|----------|---------|
| Critical / High / Medium / Low | None |

## Coverage limits

- Confidence is high. The change is deletion only and its callers were checked.
- No runtime check against a live database was made, because no query path
  reaches the deleted code.
