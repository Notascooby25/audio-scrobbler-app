# Differential Security Review & Site Integrity Audit: Comprehensive Site & Protocol Check

**Date:** 2026-11-06  
**Target:** Recent releases & branch changes (v0.30.0 through v0.33.0, PRs #40–#51, commits up to `a03f060`)  
**Auditor:** Antigravity (Superpowers differential-review & safe-change skills)  

---

## 1. Executive Summary

A comprehensive integrity check and security protocol audit was conducted across the Audio Scrobbler App codebase, configuration files, and deployment infrastructure. This review evaluated authentication, OAuth token encryption, access control (IDOR prevention), third-party API hygiene, secret leakage, reverse proxy routing, and automated test suite health.

| Severity | Count |
|---|:---:|
| 🔴 **CRITICAL** | 0 |
| 🟠 **HIGH** | 0 |
| 🟡 **MEDIUM** | 1 (Configuration drift on production host) |
| 🟢 **LOW** | 0 |
| ℹ️ **INFORMATIONAL** | 3 |

**Overall Site Status:** **HEALTHY & SECURE**  
**Automated Verification:** **100% PASSING** (411 backend/worker tests, 366 frontend tests, 120 fixture tests, clean linters, and clean production build)  
**Recommendation:** **CONDITIONAL** (Update `SPOTIFY_SCOPES` on live NUC server to resolve configuration drift for two-way Spotify library likes).

### Key Audit Metrics
- **Files Analyzed:** 30+ modified files across backend, worker, scripts, and frontend (v0.30.0–v0.33.0).
- **Backend & Worker Tests:** 411 passed, 13 skipped, 0 failed.
- **Frontend Tests & Build:** 62 test files, 366 unit tests passed, 0 failed; Vite production build generated cleanly.
- **Linters:** Ruff check passed (0 errors); ShellCheck passed (0 warnings); ESLint passed (0 errors).
- **Script Fixture Tests:** 120 passed (52 restore drill, 17 settings check, 51 preview).
- **Database Migrations:** Linear graph up to `0031_add_1001_albums_tables` (head).

---

## 2. Scope & Changed Surfaces (Recent Commits Audited)

| Component / Subsystem | Risk Level | Blast Radius | Security Posture |
|---|:---:|:---:|---|
| **1001 Albums Generator** (`api/jukebox_1001.py`, `services/catalog_1001_service.py`, migration `0031`) | Medium | Isolated to Jukebox 1001 | Strict `current_user.id` scoping; ID bounds checks ($1 \le \text{album\_id} \le 1001$); parameterized SQL. |
| **BBC Sounds Repeat Listen Fix** (`api/tools.py`, `services/ingestion_service.py`) | Low | BBC Sounds scrobbling | Embeds timestamp into `canonical_play_id` to prevent false unique-constraint collision; duplicate source play handled idempotently. |
| **Category Page Sizes** (`schemas/preferences.py`, `services/preferences_service.py`, migration `0030`) | Low | Settings & pagination | Strict enum set validation (`{5, 10, 20, 25, 50, 100, 150, 200, 250}`); user isolated. |
| **Two-Way Spotify Likes Resolution** (`services/spotify_library_service.py`) | Medium | Spotify API interaction | Strict regex validation (`[A-Za-z0-9_-]{5,40}`) on track/album IDs; exact string normalization on search fallback; timeout bounded (10s). |
| **Preview Script & Settings Checker** (`scripts/preview.sh`, `scripts/preview_settings_check.sh`) | Low | Dev / Preview tooling | Zero secret exposure; hashes compared via SHA-256 without outputting secret values; isolated Docker network. |
| **Header Navigation & What's New Dialog** (`HeaderNav.jsx`, `WhatsNewModal.jsx`, `Footer.jsx`) | Low | UI shell | Accessible modal markup (`role="dialog"`, `aria-modal="true"`); strict React state binding (no raw HTML injection). |

---

## 3. Security Protocols Audit

### 3.1 Authentication & Token Security
- **JWT Signing & Verification:**
  - Tokens are signed using HMAC-SHA256 (`HS256`) with `JWT_SECRET`.
  - The decoding logic (`decode_access_token`) explicitly specifies `algorithms=["HS256"]`, eliminating algorithm confusion attacks (e.g. `alg: none` or asymmetric public key confusion).
  - Subject claim (`sub`) is validated as a positive numeric user ID.
  - Expiration (`exp`) claim is enforced on all tokens.
- **Development Token Protection:**
  - The `/auth/dev-token` route strictly verifies `settings.environment.lower() != "development"`. In production environments (`APP_ENV=production`), the endpoint returns an HTTP 404 Not Found, preventing unauthorized token generation.

### 3.2 Spotify OAuth & Token Cryptography
- **Token Encryption at Rest:**
  - Spotify refresh tokens are encrypted using AES/Fernet cryptography (`cryptography.fernet.Fernet`), deriving keys via SHA-256 of `REFRESH_TOKEN_KEY`. Plaintext tokens are never stored in the database.
- **Token Rotation:**
  - Whenever Spotify issues a rotated refresh token during polling or re-authentication, the new token is encrypted and persisted immediately.
- **OAuth CSRF State:**
  - Authorization state parameters are signed JWTs containing a 10-minute expiry and `purpose: "spotify-oauth"` claim, validated upon callback.
- **Allowlist Enforcement:**
  - The `ALLOWED_SPOTIFY_USER_IDS` setting is checked immediately after Spotify profile resolution. Unlisted accounts receive `SpotifyAccessDeniedError` (HTTP 403) before any session or database record can be established.
- **Rate-Limit Backoff:**
  - Spotify HTTP 429 responses trigger `_mark_spotify_rate_limited` with an automatic pause (minimum 60s, default 1800s), honoring `Retry-After` headers and preventing quota bans.

### 3.3 Authorization & Access Control (IDOR & Privacy)
- **User Isolation:**
  - All personal endpoints (`/jukebox/*`, `/users/me/settings`, `/spotify/like-track/*`, `/spotify/like-album/*`, `/import/*`) resolve the user strictly from the authenticated JWT bearer token (`current_user.id`).
- **Social & Friend Access:**
  - Multi-user routes that accept a target `?user_id=` parameter pass through `resolve_viewable_user_id()`. This enforces `social_service.can_view_details()`, verifying an active following relationship before returning data, returning HTTP 403 Forbidden otherwise.
- **Internal Worker Protection:**
  - All `/internal/*` endpoints (`/ingestion/internal/events`, `/import/internal/*`, `/setlists/internal/*`, `/spotify/internal/*`) enforce `require_worker_token`, validating the `X-Worker-Token` header against `settings.worker_ingestion_token`. In production, default tokens are blocked by `settings.validate()`.
- **Content Blocking:**
  - Blocked artists and tracks are filtered across queries via `not_blocked_clause`.

### 3.4 Third-Party API Integration & Rate Limiting
- **Setlist.fm:**
  - Profile and search results are cached in `setlist_cache`.
  - Negative/empty responses are cached for only 1 hour, preventing long-term negative cache poisoning, while valid setlists cache for 7–90 days.
  - Casing is preserved on artist lookups with multi-casing fallbacks.
- **Nominatim (OpenStreetMap):**
  - Venue geocoding is rate-limited to 1 request per second and cached in `geo_cache` (90 days for hits, 1 hour for misses).
- **BBC Sounds:**
  - Broadcast scrobbles incorporate session timestamps into the `play_id` to allow repeat listens over time without database constraint collisions.

### 3.5 Transport, Routing & Ingress Security
- **Reverse Proxy Routing (`frontend/nginx.conf`):**
  - API path prefixes (`/import`, `/auth`, `/analytics`, `/stats`, `/spotify`, `/users`, `/preferences`, `/blocks`, `/artwork`, `/health`, `/readyz`, `/metrics`, `/tools`, `/notifications`, `/jukebox`, and sub-paths `/library/`, `/reports/`, `/setlists/`) are correctly routed to `backend:8000`.
  - Internal worker ingestion routes (`/ingestion`) are omitted from nginx exposure, remaining accessible only on the internal Docker network.
- **DNS Rebinding & Host Validation:**
  - In development, `VITE_ALLOWED_HOSTS` protects the Vite dev server. In production, Nginx handles static file delivery and proxies without dynamic host evaluation risks.
- **CORS Protection:**
  - Production environments prohibit wildcard (`*`) origins via startup validation in `Settings.validate()`.

### 3.6 Secret Hygiene & Data Protection
- **Repository Cleanliness:**
  - Automated scanning confirmed 0 private keys, 0 plain-text API secrets, 0 healthchecks.io URLs, and 0 LAN IP addresses in tracked repository files.
  - `.env`, `.env.production`, and `HANDOVER.private.md` are properly gitignored.
  - Safe placeholder values are consistently used in `.env.example`.

---

## 4. Findings & Actionable Remediation

### 🟡 Finding 1 (Medium / Configuration Drift): Live Production `SPOTIFY_SCOPES` Divergence

- **File:** Live server host configuration (`/srv/audio-scrobbler-app/docker-compose.prod.yml` or `.env.production`) vs. repository `docker-compose.prod.yml`.
- **Detection Method:** `bash scripts/preview_settings_check.sh`
- **Output:**
  ```text
  SPOTIFY_SCOPES: different on live from this branch's default
  1 setting(s) to check before going live.
  ```
- **Description:**
  In commit `ed97ba0` (v0.30.1), `user-library-modify` was added to `SPOTIFY_SCOPES` to support the two-way Spotify heart liking capability:
  ```yaml
  SPOTIFY_SCOPES: ${SPOTIFY_SCOPES:-user-read-recently-played user-library-read user-library-modify user-read-currently-playing playlist-read-private playlist-read-collaborative playlist-modify-private playlist-modify-public}
  ```
  Because the NUC production host (`/srv/audio-scrobbler-app`) does not pull git updates directly and manages compose files manually, the running backend container on the server is still operating with the older scope definition (missing `user-library-modify`).
- **Impact:**
  When users click the interactive heart icon on the live site, they may encounter a prompt indicating they need to reconnect Spotify. However, re-authorizing will continue using the old scope list until the live server's configuration is updated.
- **Remediation:**
  Update `SPOTIFY_SCOPES` in `/srv/audio-scrobbler-app/docker-compose.prod.yml` (or `.env.production`) on the NUC host to include `user-library-modify`, then recreate the backend container:
  ```bash
  # Step 1: SSH into the production host
  ssh andy@192.168.68.126

  # Step 2: In /srv/audio-scrobbler-app/docker-compose.prod.yml, ensure line 41 has:
  # SPOTIFY_SCOPES: ${SPOTIFY_SCOPES:-user-read-recently-played user-library-read user-library-modify user-read-currently-playing playlist-read-private playlist-read-collaborative playlist-modify-private playlist-modify-public}

  # Step 3: Recreate the backend service with updated compose configuration:
  cd /srv/audio-scrobbler-app
  docker compose --env-file .env.production -f docker-compose.prod.yml up -d --no-deps backend
  ```

---

## 5. Automated Verification Summary

```text
=== Python Linters & Checks ===
ruff check backend/app worker scripts: All checks passed!

=== Shell Script Linter ===
shellcheck scripts/*.sh scripts/tests/*.sh: Clean (0 errors, 0 warnings)

=== Fixture Tests ===
scripts/tests/test_restore_drill.sh: passed=52 failed=0
scripts/tests/test_preview_settings_check.sh: passed=17 failed=0
scripts/tests/test_preview.sh: passed=51 failed=0
Total Script Fixture Tests: 120 passed

=== Backend & Worker Pytest ===
411 passed, 13 skipped, 0 failed in 11.35s

=== Frontend Tests & Build ===
Vitest: 62 test files passed, 366 tests passed (0 failed)
ESLint: Clean (0 errors)
Vite Build: dist/ generated successfully in 1.92s

=== Database Migrations ===
Linear Alembic head: 0031_add_1001_albums_tables
```

---

## 6. Conclusion

The application demonstrates strong architectural security, robust token encryption, comprehensive authorization checks, and exemplary automated test coverage. All core security protocols are functioning as designed. Resolving the single configuration drift item on the live host will ensure full two-way Spotify library functionality without user re-auth loops.
