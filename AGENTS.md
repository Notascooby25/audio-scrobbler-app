# How to Work on This Repo
- Every time you have an issue, bug, or update to make: Follow `agents/planner_agent.md` to plan it and wait for the user's approval, then follow `agents/implementation_agent.md` to implement it.
- When presenting a plan, if you recommend native execution, execute via native directly upon plan approval instead of prompting for execution approaches. Only prompt when there is a genuine choice without a clear recommendation.
- Before any code change, read `HANDOVER.md` (and `HANDOVER.private.md` if it exists; it is gitignored, so never commit or quote it).
- For page work, check `agents/page_specs.md` and `DESIGN.md`. See `agents/agents.md` for the overall workflow.
- If the user explicitly says to skip planning for a small fix, skip the plan, but still follow the testing, security review, commit, and safety rules below.
- For manual steps in the browser or UI, provide the exact text in a plain chat code block, NOT buried in an `AskUserQuestion` option, so the user can easily copy it.

# Coding Standards & Style
- **Python (`backend/` and `worker/`, Python 3.12):** Follow **PEP 8** and **PEP 484** type hints (`from __future__ import annotations`), using SQLAlchemy 2.0 typed models (`Mapped`, `mapped_column`) and Pydantic v2 schemas. Always place imports at the top of the module (never inside functions, which causes `UnboundLocalError` scoping bugs).
- **JavaScript / React (`frontend/`, Node 20 + Vite):** Follow **Standard ES Modules (ES2022+)** and **React 18** functional components and Hooks conventions (`PascalCase` for components, `camelCase` for variables/functions). Strictly follow `DESIGN.md` ("Flat-By-Default" and "One Voice Rule": zero gradients, zero `box-shadow`, and only approved color tokens).
- **Shell Scripts (`scripts/`):** Follow POSIX/Bash strict mode (`set -euo pipefail`).
- **Third-Party API Integrations & Caching:** When integrating external REST APIs (e.g. Setlist.fm, BBC, iTunes), preserve exact casing on user-provided identifiers (avoid destructive `.lower()` conversions), support full profile URLs, and implement multi-casing retry fallbacks (`exact`, `capitalized`, `lowercase`) if lookups return 404 or empty. Never cache empty or 0-result responses for long durations in database cache tables (`SetlistCache`) to prevent negative cache poisoning. Ensure visible, clickable attribution links complying with third-party Terms of Service are placed at the bottom of relevant pages.

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
- **Spotify API Rate-Limit Bans:** Never call the Spotify API inline during an HTTP web request. Use background worker jobs (`worker/`) + database cache tables, check `spotify_rate_limit_blocked_until()`, throttle bulk/paginated fetches, and honor HTTP `429` `Retry-After` headers.
- **Broken Access Control & Privacy Leaks:** Require signed JWT bearer tokens on user routes and `WORKER_INGESTION_TOKEN` on `/internal/` worker routes. Enforce follower permission checks (`403 Forbidden`) when viewing another user's data (`?userId=`), exclude blocked items (`not_blocked_clause`), and filter background syncs by `is_active == True`.
- **Untrusted Input, Injection & CORS:** Validate and sanitize all user inputs, uploaded history exports (Spotify/YouTube JSON), and external metadata (BBC Sounds/iTunes/Deezer) using Pydantic schemas and parameterized SQLAlchemy queries. Never use raw string-interpolated SQL, and never allow wildcard (`*`) `CORS_ORIGINS` in production.

# Pre-Commit Security Review, Changelog & Version Control
- **Mandatory Security Review:** Always run the `differential-review` skill on every change before anything is committed or merged, and report findings by severity.
- **Changelog & User Guide:** Whenever implementing a new feature, improvement, or bug fix, update `frontend/src/changelogData.js` with a new version entry at the top and bump `version` in `frontend/package.json`. If adding or changing user-facing capabilities, also update `frontend/src/components/settings/UserGuideSection.jsx` and `frontend/src/components/settings/FaqSection.jsx`.
- **Commit & Push:** Check `git status` first. At the end of every task or major step that modifies files, stage your changes, commit with a descriptive conventional message (`feat:`, `fix:`, `docs:`), and push to GitHub. Pushing to `main` automatically deploys to production via GHCR and Watchtower; add `[skip ci]` to docs-only commits.

# Files, Folders & Systems That Must Never Be Edited
- **Dead / Legacy Code:** Never edit `backend/app/db/queries/analytics_queries.py` (it is a dead copy from the initial commit; the live file is `backend/app/queries/analytics_queries.py`).
- **Local Secrets, Data & Build Artifacts:** Never edit or commit `.env`, `.env.production`, `HANDOVER.private.md`, `backups/`, `*.db`, `monitoring/*.prom`, `frontend/node_modules/`, `frontend/dist/`, `.venv/`, or `backend/venv/`.
- **Applied Migrations:** Never rewrite existing Alembic migration files in `backend/migrations/versions/` that have already run in production; create a new numbered migration instead.
- **Shared NUC Host (`192.168.68.126`) & Volumes:** The NUC is a shared production server also running `/srv/sleepwell` and `/srv/UK-Expense-Tracker`—never touch their containers, volumes, Tailscale Funnels, or NAS sync scripts. Always use `docker compose --env-file .env.production -f docker-compose.prod.yml` on the NUC, and **never** run `docker compose down -v` or delete volumes without checking `docker volume ls` and `docker ps -a` and getting explicit user confirmation (local dev and prod compose files share the `postgres_data` volume name). When giving the user terminal commands to deploy or reload updated services on the NUC, always specify `docker compose ... pull <service> && docker compose ... up -d <service>` so the container does not restart with a stale cached image while waiting for Watchtower's background poll cycle.
