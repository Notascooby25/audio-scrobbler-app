# How to Work on This Repo
- Every time you have an issue, bug, or update to make: Follow `agents/planner_agent.md` to plan it and wait for the user's approval, then follow `agents/implementation_agent.md` to implement it.
- Before any code change, read `HANDOVER.md` (and `HANDOVER.private.md` if it exists; it is gitignored, so never commit or quote it).
- For page work, check `agents/page_specs.md`. See `agents/agents.md` for the overall workflow.
- If the user explicitly says to skip planning for a small fix, skip the plan, but still follow the testing, commit and safety rules in those files.

# Version Control Rules
- At the end of every task or major step that involves modifying files, you MUST use the `run_command` tool to stage all changes, commit them with a descriptive commit message explaining the reason for the changes, and push them to the current branch on GitHub.
- Example command: `git add -A && git commit -m "feat: <description of changes>" && git push` (If the branch has no upstream, use `--set-upstream origin <branch-name>`).

# NUC and Deployment Instructions
- NUC host: `192.168.68.126`. It is a shared production box also running `sleepwell` and `UK-Expense-Tracker`. Treat it as multi-tenant, not a sandbox.
- Run terminal/SSH actions directly on the NUC for narrowly-scoped actions (e.g. restarting a service) rather than asking the user to copy/paste, but ALWAYS confirm before destructive actions.
- Destructive-command caution: Always check the blast radius (`docker volume ls`, `docker ps -a`) before any delete/wipe/teardown on the NUC to avoid accidentally wiping shared volumes (e.g. Postgres data).
- Resave secrets after editing: Whenever you touch `.env`, `.env.production`, `secrets.toml`, or `rclone.conf`, proactively remind the user to re-save the base64 copy in their password manager and verify with a hash check.

# UI and Manual Steps
- For manual steps in the browser or UI, provide the exact text in a plain chat code block, NOT buried in an `AskUserQuestion` option, so the user can easily copy it.

# Project Context (Audio Scrobbler)
- Spotify scrobbling: Verified working end-to-end on the NUC (including phone login via Tailscale Funnel) as of 2026-09-15.
- Spotify rate-limit audit (2026-09-17): Root cause was the (now-removed) liked-tracks sync. `is_active` is never revoked in code.
- Backup architecture: NUC backs up to Google Drive (crypt) + Synology NAS for all 3 apps. Plaintext Drive copies deleted. `rclone.conf` saved as base64.
- Open tasks as of 2026-09-23: dated cleanups (~Oct 2026).
