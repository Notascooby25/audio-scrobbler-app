# Differential Security Review: Set List Tracking & Concert Scrobbling Feature

- **Target:** Set List Tracking (PR / Main Integration)
- **Date:** 2026-10-28
- **Reviewer:** Antigravity (Differential Security Review Skill)
- **Risk Level:** MEDIUM (New external API, DB migrations, user authentication, and data export)
- **Status:** PASSED (0 Critical, 0 High, 0 Medium, 0 Low outstanding)

---

## 1. Executive Summary
The Set List Tracking feature allows users to search Setlist.fm for concerts they attended, record their attendance, auto-sequence tracks into `ListeningEvent` listening history, view aggregate concert statistics (artists seen, songs heard live, venues visited), and import/export attendance history.

All code was analyzed across authorization, rate limiting, token safety, parameter sanitization, formula injection, and denial-of-service risks.

---

## 2. Threat Modeling & Security Controls

| Area | Threat | Control Implemented | Status |
|---|---|---|---|
| **API Key Safety** | Setlist.fm API key exposure in commits or logs | Loaded strictly via `os.getenv("SETLIST_FM_API_KEY")`. Not exposed in frontend code, client responses, or logs. | Verified Safe |
| **Setlist.fm Quota & Bans** | Exceeding 2 req/sec or 1,440 daily requests | Central DB token-bucket table `setlist_api_usage` using `SELECT ... FOR UPDATE` enforces >= 0.5s spacing and 1,400 daily limit across backend and worker containers. | Verified Safe |
| **Festival DoS Flood** | Multi-day/multi-stage festivals returning dozens of acts | `get_venue_date_setlists` caps support act lookups at 10 items to prevent cascade queries. Response cached in `setlist_cache` with 7-day TTL. | Verified Safe |
| **Broken Access Control** | Viewing or deleting another user's gigs or stats | Every route requires JWT `get_current_user`. All DB operations (`delete`, `stats`, `export`) filter strictly on `AttendedConcert.user_id == current_user.id`. | Verified Safe |
| **SQL Injection** | Malicious artist or venue queries | 100% parameterized SQLAlchemy 2.0 ORM queries. Zero raw string-interpolated SQL statements. | Verified Safe |
| **CSV Formula Injection** | Malicious concert names beginning with `=`, `+`, `-`, `@` triggering spreadsheet execution on export | `_sanitize_csv_cell` detects formula trigger prefixes and prefixes cells with a single quote `'`. | Verified Safe & Tested |
| **Duplicate Scrobbles** | Duplicate scrobble creation on re-import or support act logging | Unique composite identity constraint on `(user_id, source, play_id)` ensures idempotent inserts without scrobble pollution. | Verified Safe |

---

## 3. Test Coverage Summary
- Backend & Worker Tests: 236 passed, 0 failed
- Frontend Tests: 42 test suites, 216 tests passed, 0 failed
- Frontend Production Build: Clean (0 errors)
- ShellCheck: Passed (0 warnings)
- Ruff Linter & Formatter: Passed (0 errors)

---

## 4. Conclusion
The implementation adheres to all security requirements in `AGENTS.md` and global user rules. No vulnerabilities were detected. Safe to push to production.
