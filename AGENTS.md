# Set-up answers
- **What it is and who uses it:** a personal music-listening tracker for the owner and a few followers.
- **GitHub:** public. **Real data:** on the production server only, never in this repo.
- **How it goes live:** merging to `main` builds images and Watchtower updates production. **Master copy:** GitHub.
- **Preview:** `scripts/preview.sh`. **Process:** full (`safe-change` skill).

# How to Work on This Repo
- Every time you have an issue, bug, or update to make: Follow `agents/planner_agent.md` to plan it and wait for the user's approval, then follow `agents/implementation_agent.md` to implement it.
- When presenting a plan, if you recommend native execution, execute via native directly upon plan approval instead of prompting for execution approaches. Only prompt when there is a genuine choice without a clear recommendation.
- Before any code change, read `HANDOVER.md` (and `HANDOVER.private.md` if it exists; it is gitignored, so never commit or quote it).
- For page work, check `agents/page_specs.md` and `DESIGN.md`. See `agents/agents.md` for the overall workflow.
- Follow the shared `safe-change` skill for every change: probe, agree, build on a branch, check, screenshots, try the preview, fix on the same branch, go live, live check.
- If the user explicitly says to skip planning for a small fix, skip the plan and the questions, but still follow the branch, preview, testing, security review and safety rules below.
- For manual steps in the browser or UI, provide the exact text in a plain chat code block, NOT buried in an `AskUserQuestion` option, so the user can easily copy it.

# Coding Standards & Style
- **Python (`backend/` and `worker/`, Python 3.12):** Follow **PEP 8** and **PEP 484** type hints (`from __future__ import annotations`), using SQLAlchemy 2.0 typed models (`Mapped`, `mapped_column`) and Pydantic v2 schemas. Always place imports at the top of the module (never inside functions, which causes `UnboundLocalError` scoping bugs).
- **JavaScript / React (`frontend/`, Node 20 + Vite):** Follow **Standard ES Modules (ES2022+)** and **React 18** functional components and Hooks conventions (`PascalCase` for components, `camelCase` for variables/functions). Strictly follow `DESIGN.md` ("Flat-By-Default" and "One Voice Rule": zero gradients, zero `box-shadow`, and only approved color tokens).
  - *Exception / Protected Component:* The **Retro Jukebox** (`frontend/src/components/jukebox/RetroJukebox.jsx` and `RetroJukebox.module.css`) is an intentionally skeuomorphic novelty arcade cabinet preserving your brother's original retro aesthetic (custom pastels, shadows, marquees, and turntable). Never modify or restyle it when performing site-wide theme, accent color, or design system adjustments.
- **Shell Scripts (`scripts/`):** Follow POSIX/Bash strict mode (`set -euo pipefail`).
- **Reused Components & CSS Blast-Radius Protection:** Before modifying styles, layout, or CSS selectors for a shared or reusable component (e.g. `LibraryRankList`, `ScrobbleList`, `Artwork`, `LikedHeart`), always search the codebase (`git grep`) to identify every parent surface and page where that component is rendered.
  - *Scope Page-Specific Adjustments:* When tailoring a component for a specific page's needs, always namespace the CSS selectors with the parent page container (e.g. `.library-layout .library-rank-panel ...` rather than generic `.library-rank-panel ...`).
  - *Verify Across Breakpoints:* Check that mobile `@media` queries do not override specialized layout rules of other consumer pages.
  - *Lock In Multi-Surface Invariants:* When refactoring a shared component's layout, add or update automated tests asserting that all pages embedding that component retain their visual and layout invariants.
- **Third-Party API Integrations & Caching:** When integrating external REST APIs (e.g. Setlist.fm, BBC, iTunes), preserve exact casing on user-provided identifiers (avoid destructive `.lower()` conversions), support full profile URLs, and implement multi-casing retry fallbacks (`exact`, `capitalized`, `lowercase`) if lookups return 404 or empty. Never cache empty or 0-result responses for long durations in database cache tables (`SetlistCache`) to prevent negative cache poisoning. Ensure visible, clickable attribution links complying with third-party Terms of Service are placed at the bottom of relevant pages.
- **Button Text-Transform & Case Sensitivity:** The global stylesheet defines `button { text-transform: uppercase; }`. Any button rendering semantic mixed-case prose, release versions (e.g. `v0.33.0 • What's new`), or modal action buttons must explicitly declare `text-transform: none;` in its scoped class.
- **Mobile Header Grid Layout Invariant:** On mobile viewports (`@media (max-width: 720px)`), the header topbar uses CSS Grid (`grid-template-areas: "brand icons" ". toggle" "links links"`). The brand title sits on the left with the 3 outline action icons (`Profile`, `Connect`, `Notifications`) on the top right. The `Menu` toggle button sits directly below the icons on row 2. When open, navigation links expand on row 3 horizontally beneath the toggle (`flex-direction: row; justify-content: flex-end; flex-wrap: wrap;`), never floating left or displacing the top-row icons.
- **Frontend Component Test Cleanup:** Because `vitest.config.js` does not set `globals: true`, always import and call `afterEach(() => cleanup())` from `@testing-library/react` in component tests that render overlays, dialogs, or multiple component instances to prevent DOM element leakage across tests.

# Linter, Formatter & Test Commands
- **Python Linter & Formatter (Ruff):**
  ```bash
  ruff check backend/app worker scripts
  ruff format --check backend/app worker scripts
  ```
- **Shell Script Linter (ShellCheck):**
  ```bash
  .venv/bin/shellcheck scripts/*.sh scripts/tests/*.sh
  ```
- **Frontend Linter & Formatter (ESLint + Prettier):**
  ```bash
  cd frontend && npm run lint
  # Format only your modified files with Prettier (avoid 'npm run format' on the full src/ tree to prevent reformatting untouched code):
  npx prettier --write <path/to/modified/file>
  ```
- **Backend & Worker Tests:**
  ```bash
  PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q
  ```
- **Frontend Unit Tests & Production Build:**
  ```bash
  cd frontend && npm run lint && npm test && npm run build
  ```
- **Runtime Verification:** After every change, run all applicable linters and tests above. For any runtime or UI behavior not covered by automated tests, run the app (`docker compose up -d`) and describe what you checked.
- **Preview (before handing any change over):** see the shared `safe-change` skill.
  ```bash
  scripts/preview.sh up            # add --phone for home Wi-Fi access; a private copy using real data
  scripts/preview.sh down          # stop it and delete its data copy
  bash scripts/preview_settings_check.sh   # settings this branch expects versus live; no values leave the server
  cd frontend && node e2e/preview-shots.mjs <folder-outside-this-repo> /reports /library   # desktop and phone screenshots; they show real data
  ```
- **Frontend End-to-End Tests (when changing navigation or date filtering):**
  ```bash
  cd frontend && npm run test:e2e
  ```
- **Database Migrations (when changing models or migrations, against a throwaway Postgres DB):**
  ```bash
  cd backend && alembic upgrade head
  ```
- **Backup Script Tests (when changing `scripts/`):**
  ```bash
  bash scripts/tests/test_restore_drill.sh
  ```

# Secrets & Configuration Handling
- Secrets and environment settings live in `.env` (local dev), `.env.production` (on the NUC), `scripts/systemd/audio-scrobbler-backup.env` (backup heartbeat URL), and host-level `~/.config/rclone/rclone.conf`, `~/.config/nas-sync.env`, and `~/.config/google-sync.env`. Only safe placeholders belong in `.env.example`.
- **Never commit, print, or quote secrets** or `HANDOVER.private.md`. Never run `rclone config show` or write healthchecks.io URLs in code or docs.
- **Resave secrets after editing:** Whenever you touch `.env`, `.env.production`, `secrets.toml`, `rclone.conf`, or rotate `JWT_SECRET`, `REFRESH_TOKEN_KEY`, or database passwords, proactively remind the user to re-save the single-line `base64 -w0` copy in their password manager and verify it with a `sha256sum` hash check.

# Security Risks & How to Avoid Them
- **Spotify OAuth & Token Theft:** Always encrypt Spotify refresh tokens at rest using `REFRESH_TOKEN_KEY` via `backend/app/security.py` (Fernet/AES). Persist rotated refresh tokens immediately. Keep `ALLOWED_SPOTIFY_USER_IDS` set on any publicly reachable tunnel (e.g. Tailscale Funnel) so unauthorized Spotify accounts cannot register.
- **Token Rotation & Transaction Commits:** Never rely on `db.flush()` for rotated OAuth tokens or security credentials. When a rotated refresh token is received, the persistence helper must execute an immediate `db.commit()` so credentials are never discarded if the calling request finishes without writing data or encounters an error.
- **Spotify API Rate-Limit Bans:** Never call the Spotify API inline during an HTTP web request. Use background worker jobs (`worker/`) + database cache tables, check `spotify_rate_limit_blocked_until()`, throttle bulk/paginated fetches, and honor HTTP `429` `Retry-After` headers.
- **Background Worker Loop Quotas & In-Memory Token Caching:** Never call token refresh endpoints on recurring polling loop ticks (e.g. 10-second sync). Maintain active access tokens in memory until their TTL approaches expiration (e.g. within 5 minutes of expiry), eliminating redundant API requests.
- **Service Worker & Client Cache Isolation:** Service workers must only cache static application shell assets (`/`, `/assets/*`, `manifest.json`). Never cache authenticated, private API endpoints (`/library`, `/setlists`, `/reports`, `/notifications`, `/preferences`, etc.) in browser CacheStorage. Ensure sign-out actions explicitly purge all client-side CacheStorage entries.
- **Production UI Invariants:** Essential authentication and session controls (such as "Sign out") must be accessible to everyday users in production and must never be scoped inside development-only conditional blocks (`import.meta.env.DEV`).
- **Reverse Proxy Path Shielding & Ingress:** Never expose worker-internal routes (`/internal/`) or raw diagnostic/metrics endpoints (`/metrics`, `/worker-metrics`) to public internet ingress. Explicitly return 404 for `/internal/` in Nginx and restrict metrics to the internal Docker network. Always use constant-time comparison (`secrets.compare_digest` or `hmac.compare_digest`) for token headers.
- **Broken Access Control & Privacy Leaks:** Require signed JWT bearer tokens on user routes and `WORKER_INGESTION_TOKEN` on `/internal/` worker routes. Enforce follower permission checks (`403 Forbidden`) when viewing another user's data (`?userId=`), exclude blocked items (`not_blocked_clause`), and filter background syncs by `is_active == True`.
- **Untrusted Input, Injection & CORS:** Validate and sanitize all user inputs, uploaded history exports (Spotify/YouTube JSON), and external metadata (BBC Sounds/iTunes/Deezer) using Pydantic schemas and parameterized SQLAlchemy queries. Never use raw string-interpolated SQL, and never allow wildcard (`*`) `CORS_ORIGINS` in production.

# Pre-Commit Security Review, Changelog & Version Control
- **Mandatory Security Review:** Always run the `differential-review` skill on every change before anything is committed or merged, and report findings by severity.
- **Differential Review vs. Full Site Integrity Audits:**
  - A *Differential Review* (`differential-review` skill) is for reviewing specific PRs or branch changes against the main branch.
  - When the user asks for a *Site Integrity Check*, *Security Check*, or *Architecture Audit*, you MUST NOT restrict analysis to recent git diffs. A full audit requires a whole-system review covering:
    1. Dependency vulnerability scans (`pip-audit` on backend/worker and `npm audit` on frontend).
    2. Client caching and service worker boundaries (`service-worker.js`).
    3. Production ingress, reverse proxy routing, and exposed ports (`nginx.conf`, `docker-compose.prod.yml`).
    4. Database transaction lifecycles (verifying `db.commit()` occurs on sensitive state).
    5. Scheduled background job quotas and external rate limits.
    6. Container startup and migration rollback safety.
    7. Production build parity (verifying production builds do not compile out critical UI controls).
- **Changelog & User Guide:** Once per release, on the branch just before the go-ahead, for any new feature, improvement, or bug fix, update `frontend/src/changelogData.js` with a new version entry at the top and bump `version` in `frontend/package.json`. If adding or changing user-facing capabilities, also update `frontend/src/components/settings/UserGuideSection.jsx` and `frontend/src/components/settings/FaqSection.jsx`.
- **Commit & Push:** Check `git status` first. Commit with a descriptive conventional message (`feat:`, `fix:`, `docs:`) and push to the working branch, never to `main`. A merge to `main` deploys to production via GHCR and Watchtower, so the owner merges, or gives the go-ahead for that specific merge. Never use `[skip ci]` in a pull request, as it would leave required checks waiting. Docs-only merges don't redeploy.

# Files, Folders & Systems That Must Never Be Edited
- **Dead / Legacy Code:** Never edit `backend/app/db/queries/analytics_queries.py` (it is a dead copy from the initial commit; the live file is `backend/app/queries/analytics_queries.py`).
- **Local Secrets, Data & Build Artifacts:** Never edit or commit `.env`, `.env.production`, `HANDOVER.private.md`, `backups/`, `*.db`, `monitoring/*.prom`, `frontend/node_modules/`, `frontend/dist/`, `.venv/`, or `backend/venv/`.
- **Applied Migrations:** Never rewrite existing Alembic migration files in `backend/migrations/versions/` that have already run in production; create a new numbered migration instead.
- **Shared NUC Host & Volumes:** The NUC is a shared production server also running `/srv/sleepwell` and `/srv/UK-Expense-Tracker`—never touch their containers, volumes, Tailscale Funnels, or NAS sync scripts. Always use `docker compose --env-file .env.production -f docker-compose.prod.yml` on the NUC, and **never** run `docker compose down -v` or delete volumes without checking `docker volume ls` and `docker ps -a` and getting explicit user confirmation (local dev and prod compose files share the `postgres_data` volume name). When giving the user terminal commands to deploy or reload updated services on the NUC, always specify `docker compose ... pull <service> && docker compose ... up -d <service>` so the container does not restart with a stale cached image while waiting for Watchtower's background poll cycle.
