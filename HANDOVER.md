# Agent handover: Audio Scrobbler App

> **This is the redacted version, safe to commit because the repo is public.**
> Account IDs, people's names, public hostnames, LAN addresses, NAS
> identifiers and known operational weaknesses have been removed. The full
> version is `HANDOVER.private.md` in the repo root. It is gitignored and only
> exists on the maintainer's machine; if you don't have it, ask Andy.

Last updated: 2026-09-24. Read `AGENTS.md` too; its rules are repeated in
section 1.

---

## 0. Who and what

- **Maintainer:** Andy (GitHub `Notascooby25`). Default branch `main`.
- **App:** a self-hosted music scrobbler.
  - The backend is FastAPI, the frontend is a React PWA built with Vite, and the
    database is PostgreSQL with Alembic migrations.
  - A separate APScheduler worker polls Spotify every 5 minutes.
  - Deployed with Docker Compose.
  - Its old name was "Family Music Scrobbler PWA"; the user-facing name is now
    "Audio Scrobbler App".
- **Dev machine:** Fedora, where `docker` / `docker compose` is actually
  **Podman / podman-compose** under an alias. An old diagnostic PDF in `docs/`
  blamed Podman for Spotify bugs; that was a red herring.
- **Production:** a home server ("the NUC") shared with two other apps (section 4).

---

## 1. Standing rules

### 1a. Version control (from `AGENTS.md`)

- At the end of every task or major step that changes files: stage, commit with a
  message that explains *why*, and push to the current branch. Example:
  `git add -A && git commit -m "feat: <description>" && git push`. If the branch
  has no upstream, use `--set-upstream origin <branch>`.
- **Caveat:** this working tree has at times been shared with another agent
  session that had uncommitted edits. When that is the case:
  - stage by explicit path instead of `git add -A`
  - don't switch branches
  - run `git status` first; if everything in it is yours, `git add -A` is fine.
- **Never commit `HANDOVER.private.md`.** It is gitignored; keep it that way.
- **Pushing to `main` deploys to production.** `ci.yml` builds and pushes images
  to GHCR, and Watchtower on the server redeploys within about 5 minutes. For
  docs-only or script-only commits, put **`[skip ci]`** in the commit message so
  nothing rebuilds or restarts. Code that should deploy must not use
  `[skip ci]`. Pushing to a feature branch publishes nothing.
- Commit style is conventional: `feat(scope): …`, `fix(scope): …`, `docs: …`.
  PRs have been squash-merged.

### 1b. How to work with Andy

- **Manual steps (browser, UI, DevTools console):** give the exact text to paste
  as a plain code block in the chat. Never put it only inside an
  `AskUserQuestion` option or tool description, because Andy can't copy from
  those. He's willing to do fairly involved checks, but:
  - ask for one clear action at a time
  - confirm the result before giving the next step
  - don't bundle several steps into one instruction.
- **Terminal/SSH on the server:** run read-only checks and narrow,
  well-understood actions yourself (e.g. `docker compose up -d <single-service>`)
  instead of pasting them for Andy. **Always confirm before anything destructive
  or broad.**
- **If you give Andy a command block to run, don't also run it yourself.** It has
  raced before.

### 1c. Destructive commands

- Before any delete or wipe (`compose down -v`, `docker volume rm`, `rm -rf`,
  DB drops, `prune -a`), check what it will actually hit: `docker volume ls`,
  `docker ps -a`, and `docker compose config` for the project name.
- **The incident, 2026-09-15:** running
  `docker compose -f docker-compose.prod.yml down -v` for local CI cleanup wiped
  the **dev** stack's real Postgres data. Both `docker-compose.yml` and
  `docker-compose.prod.yml` define a volume called `postgres_data`, and from the
  same directory they resolve to the same Compose project. **It must never
  happen again, especially on the production server.**
- On the server, scope any cleanup to the scrobbler's own container and volume
  names. `sleep_*` and `uk_expense_tracker` state must never be touched. Prefer
  named targets over broad flags, and ask *before*, not after.

### 1d. Secrets

- **Never print or read out** `.env`, `.env.production`, `secrets.toml` or
  `rclone.conf`, and never run `rclone config show`. Never write healthchecks.io
  URLs anywhere.
- **Whenever any of these files changes** (edited, rotated or regenerated):
  - `/srv/sleepwell/.env`
  - `/srv/audio-scrobbler-app/.env.production`
  - `/srv/UK-Expense-Tracker/.streamlit/secrets.toml`
  - `~/.config/rclone/rclone.conf`

  In the same reply, and without being asked, tell Andy his password-manager copy
  is now stale. Give him the command for that file, e.g.
  `base64 -w0 /srv/audio-scrobbler-app/.env.production; echo`, and ask him to
  verify with a hash check. Rotating `REFRESH_TOKEN_KEY`, `JWT_SECRET` or the DB
  password counts too. This is a prompt to Andy, not something you run.
- **Always save secrets as one `base64 -w0` line.** Plain multi-line saves get
  mangled by password managers (this has happened). Restore with `base64 -d`.
- **Hash check:** compare `sha256sum <file>` on the server with the saved line
  piped through `base64 -d | sha256sum`, pasted from the password manager, not
  from the terminal. The rclone drill is in
  `docs/DISASTER_RECOVERY.md#before-you-need-any-of-this`:
  1. decode the saved copy to a temp file (`install -m 600 …`)
  2. `rclone cat --count 5` the newest dump
  3. expect `PGDMP`
  4. `shred -u` the temp file.

  Never re-obscure the saved crypt passwords with `--obscure`; they are already
  obscured.

### 1e. Documentation

- Keep docs current as part of the same piece of work. Re-read the affected doc
  sections before committing, and don't leave "pending" items that are already
  done.
- Backup docs:
  - **sleepwell repo:** `docs/nuc-backup-overview.md`, `docs/backup-runbook.md`,
    `docs/backup-deployment-steps.md`
  - **this repo:** `docs/DISASTER_RECOVERY.md`, `docs/RUNBOOK.md`,
    `docs/CI_CD_PIPELINE.md`
- **Keep this file and `HANDOVER.private.md` in step.** When you update one,
  update the other, keeping the redactions here.

### 1f. Agent prompts (`agents/`) and global Claude agents

Rewritten on 2026-09-24 to match the real code. See `agents/agents.md`.

- `agents/planner_agent.md` **plans**: the protocol, general rules, the real
  architecture, a regression checklist, test commands, deploy steps.
- `agents/implementation_agent.md` **carries out** an approved plan: it edits,
  tests, then commits and pushes each step per `AGENTS.md`.
- `agents/page_specs.md` describes each page's sections, endpoints and
  components, and lists known issues.
- `~/.claude/agents/planner.md` and `implementer.md` are Claude Code agents that
  carry the same general rules across all three projects.
- **When a rule changes, update both sets. When a page changes, update
  `page_specs.md`.**
- Planned-but-never-built items (monthly partitioning, IndexedDB offline sync,
  Background Sync, push notifications) are listed as ideas and are **not**
  enforced.

Also see `DESIGN.md`, `PRODUCT.md`, `OVERVIEW.md` and
`.github/agents/impeccable-*.agent.md` (UI design agents).

---

## 2. Development and testing

- **Local run:** `docker compose up -d` (Podman). Spotify works fully locally; the
  server isn't needed for testing.
- **Local `.env`** is gitignored and holds a real Spotify Client ID and Secret
  from developer.spotify.com.
  - Local redirect URI: `http://127.0.0.1:8000/auth/spotify/callback`. Spotify
    rejects `localhost`; it needs `127.0.0.1` or https.
  - The production HTTPS URL is registered as an **additional** redirect URI.
    Never remove the `127.0.0.1` one.
- **Tests (what CI runs):**
  - backend and worker:
    `PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q`
    (Python 3.12)
  - frontend (Node 20): `npm ci && npm test && npm run build`
  - migrations: `alembic upgrade head` against a clean DB
  - CI also validates both compose files and the monitoring configs, and runs a
    container smoke test.
- **CI** runs on push to `main` and on PRs. It only publishes images to GHCR on a
  push to `main`.
- **Lessons learned the hard way:**
  - **The SQLite test suite hides Postgres-only failures.** SQLite quietly
    coerces bad casts to 0 where Postgres errors. This has caused bugs twice.
    For anything dialect-sensitive in `backend/app/queries/analytics_queries.py`,
    write tests against a **real throwaway Postgres**. CI provides one at
    `localhost:5432`, and the tests should skip gracefully elsewhere. Each test
    must **create and drop its own uniquely named database**. Running
    `create_all()` on the shared CI database broke the later migration step.
  - **Every new model or table needs an Alembic migration.** One table shipped
    without one (fixed in #19).
  - **Never call Spotify inline in a request path.** Use the worker-enrichment
    pattern instead: a worker job, a cache table and internal endpoints. Top
    Genres follows this pattern.
  - **Bulk or paginated Spotify calls caused a rate-limit block** (2026-09-16/17,
    the original un-throttled liked-tracks sync). Its replacement (`3cbfc0a`) is
    opt-in per user and skips while rate-limited. Throttle anything bulk, and
    suspect this first if rate-limiting returns.
  - **Python scoping trap:** a local `from sqlalchemy import func` anywhere in a
    function makes `func` local to the whole function, turning a `NameError`
    into an `UnboundLocalError`. Use module-level imports.
  - When using mutation checks, confirm the new tests actually catch the bug.
- **Shellcheck** isn't installed; use `pip install shellcheck-py` in a throwaway
  venv. Backup-script fixture tests live in `scripts/tests/`. They are hermetic
  and GNU/Linux only.

---

## 3. Deploying the scrobbler

- **The normal path is automatic.** Push to `main`, and `ci.yml` builds
  `ghcr.io/notascooby25/audio-scrobbler-app-{backend,worker,frontend}:latest`. On
  the server, Watchtower polls GHCR every `WATCHTOWER_POLL_INTERVAL` (default
  300s) and recreates any changed service.
- **To verify a deploy**, run `docker logs audio-scrobbler-app-watchtower-1` and
  look for `Found new … image` and `Session done … Updated=N`.
- **`/srv/audio-scrobbler-app` is not a git checkout.** `git pull` and
  `compose up --build` fail there. `docker-compose.prod.yml` and
  `.env.production` there are managed by hand, so a repo change to
  `docker-compose.prod.yml` has to be re-applied on the host manually. Scripts
  are dropped in with `scp` to `/srv/audio-scrobbler-app/scripts/`.
- **`.github/workflows/deploy.yml` is break-glass only.** It has never run
  successfully and shouldn't be used for normal releases.
- **Shell-variable gotcha:** `set -a; source .env.production; set +a` in an SSH
  session exports the variables, and exported variables **override**
  `--env-file`. If the file is edited afterwards, later compose commands in that
  shell silently use the old values. Open a fresh SSH session first.
  - "variable not set, defaulting to blank" warnings from compose were unrelated
    noise.
  - The ground truth is always `docker exec <container> env` and
    `docker compose ps`, not the compose file.
- **Disk is often tight.** Check `df -h /` and `docker system df` before pulling
  images; `docker image prune -f` and `docker builder prune -f` have freed space
  before.

---

## 4. The production server (shared)

Host address, SSH user and public hostname: see `HANDOVER.private.md`.

- **It's multi-tenant; don't treat it as a sandbox.** Apps live under
  `/srv/<app>/`, each with `docker-compose.yml` and `docker-compose.prod.yml`:
  - **sleepwell** (`/srv/sleepwell`): containers `sleep_backend` (owns
    `127.0.0.1:8000`), `sleep_frontend_web` (`8510`), `sleep_db` and
    `sleep_watchtower`.
  - **UK-Expense-Tracker** (`/srv/UK-Expense-Tracker`): container
    `uk_expense_tracker`, port `8501`.
  - **Audio Scrobbler** (`/srv/audio-scrobbler-app`): frontend on `5173`. The
    backend's host port is **`8010`**, set by `BACKEND_HOST_PORT` in
    `.env.production`; compose uses `"${BACKEND_HOST_PORT:-8000}:8000"`. Its
    Postgres is a Docker **named volume**, not under `/srv`.
  - `/srv/shared/` holds backups, mood-images, garmin-tokens, logs and
    postgres-data.
- **Always** run `docker ps -a` and check ports and volume names before creating
  or removing anything.
- **Tailscale Funnel:**
  - Scrobbler: `https://<funnel-host>:8443` → `127.0.0.1:5173`, set up with
    `sudo tailscale funnel --bg --https=8443 5173`. The frontend proxies `/auth`,
    `/api` and so on to the backend.
  - Sleepwell has its own Funnel on port 443: **don't touch it.**
  - Check both with `sudo tailscale serve status`.
- **Vite** needed `VITE_ALLOWED_HOSTS` support; Vite 5.4 blocks unknown Host
  headers.
- **How each repo deploys to the server:**
  - **Sleepwell:** `git pull --ff-only` in `/srv/sleepwell`.
    - Its checkout has server-only drift (a `WATCHTOWER_SCOPE` edit in
      `docker-compose.prod.yml`, and a mode change on
      `push_backups_to_synology.sh`). **Never delete that script upstream**, or
      the pull will conflict.
    - Its CI runs on every push to `main` and redeploys it; use `[skip ci]` for
      docs-only commits.
  - **Expense** is a private repo, and the server can't `git pull` it. Scripts
    are copied with `scp` to `/srv/UK-Expense-Tracker/scripts/`. The app runs
    from its image.
- **rclone** is configured on the server with `gdrive` and `gdrive-crypt`
  remotes.

---

## 5. Backup architecture

**Before claiming anything about backups, re-check the server's live crontab and
the NAS listing.** The live setup has drifted from the repos before.

- **Scrobbler:**
  1. `pg_dump` of the named volume every 6h, via a **systemd user timer**
     (linger on).
  2. Dumps go to `/srv/audio-scrobbler-app/backups/` (3-day retention) and each
     is restore-verified.
  3. rclone copies them to `gdrive-crypt:AudioScrobblerBackups/` (30 days).
  - Don't point it at another app's backup directory.
- **Sleepwell:** twice-daily DB dumps (`MAX_BACKUPS=14`), 6-hourly mood archives
  and a Garmin tarball into `/srv/shared/backups/`, copied to
  `gdrive-crypt:backups/sleep-wellness/` (90 days).
- **Expense:** a tarball of the whole `data/` directory, daily at 03:00, keeping
  14, into `/srv/shared/backups/`. It rides along in sleepwell's copies.
- **NAS:** a Synology on the LAN, reachable only from the server. Its connection
  details live in `~/.config/nas-sync.env` on the server; **never put them in any
  repo.**
  - **A single job owned by the sleepwell repo**, `scripts/push_srv_to_synology.sh`
    (cron `30 */6`), mirrors all of `/srv` to the NAS.
  - `shared/backups` there is append-only. Other folders mirror with
    `_versions/<UTC>/` history (30 days).
  - `/srv/shared/postgres-data` is excluded. **Never rsync it**; the `.dump`
    files are the backup.
  - **Don't edit this job from this repo.**
- **Host-config snapshot:** daily at 04:10 into `/srv/shared/backups/host-config/`.
- **Google sync** has freshness checks and a heartbeat, configured in
  `~/.config/google-sync.env`.
- **healthchecks.io:** URLs are in `~/.config/nas-sync.env` and
  `~/.config/google-sync.env` (mode 600). Only Andy can see the dashboard; you
  can grep the cron logs for "failed to ping".
- **Restore drills:** `scripts/restore_drill.sh {local|nas|gdrive}` here and
  `scripts/test_restore_dump.sh` in sleepwell. All passed on 2026-09-21.

---

## 6. Spotify

- **Flow:** OAuth → the worker polls "recently played" every 5 minutes → backend
  ingestion → DB → the Scrobbles, Reports, Library and Overview pages. Working
  end-to-end in production, including phone login over the Funnel, since
  2026-09-15.
- **Access** is gated by `ALLOWED_SPOTIFY_USER_IDS` in `.env.production`. The
  real values are in `HANDOVER.private.md`.
- Open Spotify hygiene items and known limitations: see `HANDOVER.private.md`
  section 6.

---

## 7. Feature history (recent)

- **#19 `343a108`:** Reports Playlists tab and the missing
  `0015_add_playlist_cache` migration.
- **#20 `548fd35`:** moved playlist-name lookups off the request path into a
  worker job.
- **#21 `8e281d3`:**
  - `range=all.time` crashed `/reports/summary` with `UnboundLocalError` (the
    scoping trap above).
  - An empty `release_date` crashed the Postgres decade query. Fixed with
    `substring(x from '^[0-9]{4}')`.
- **Top Genres shipped on 2026-09-22:**
  - `d4133e1` backend
  - `6bedb4c` worker, with `WORKER_GENRE_CACHE_INTERVAL_MINUTES=5` and
    `WORKER_GENRE_CACHE_BATCH_SIZE=50`
  - `368e83e` fix
  - Genre comes from the Spotify **artist** record, via worker enrichment and a
    cache.
- **The Playlists feature was removed** on 2026-09-22 (`2acb98b`).
- **Also 2026-09-22/23:** listening heatmap, frontend redesign, nginx
  `client_max_body_size` raised for large imports, listening clock restored,
  friends-average removed from the UI, Library share-image feature,
  Explorer-vs-Repeater and Singles-vs-Albums ratios, a "clear artwork" menu
  option and API, iTunes artwork artist validation, and mobile layout fixes.

---

## 8. Open items

- **Dated backup cleanups** are due around 2026-10-20/21, with a NAS retention
  rule needed around 2027. Details are in `HANDOVER.private.md` section 8.
- **A full host-rebuild rehearsal** needs a spare machine; doing it on the dev
  box risks the dev `postgres_data` volume.
- **Spotify hygiene items:** see `HANDOVER.private.md` section 6.
- **Reports ratio panels bug** (Explorer vs. Repeater, Singles vs. Albums): see
  `agents/page_specs.md` section 4.
