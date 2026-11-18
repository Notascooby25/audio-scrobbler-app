# Follower notification and remove-follower Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tell a user when someone newly follows them, and let them see and remove their followers.

**Architecture:** Reuse the `follows` table and the existing notification pattern (a `Notification` row plus `queue_push`, as in `api/recommendations.py`). Add two small endpoints and a Followers section on the Following page. No schema change, no migration.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Pydantic v2, pytest; React 18, Vitest + Testing Library.

**Spec:** the approved design in the chat on 2026-11-18 (no separate spec file; the Short design is restated under Global Constraints and Scope below).

## Scope
In: notification on a *new* follow (in-app + push); `GET /users/me/followers`; `DELETE /users/me/followers/{follower_id}`; Followers section with Remove on the Following page; FAQ, guide, changelog, version 0.50.6.
Out: follow approval, blocking, notifying a removed person, changing search/discovery, any model or migration change.

## Global Constraints
- Branch `feat/follower-notify-remove` off `main`. Never commit to `main`. Release 0.50.6.
- Python: `from __future__ import annotations`, imports at module top, Pydantic v2 schemas, ruff-clean. No raw SQL.
- Notification: `type="follow"`, `title="New follower"`, `message=f"{name} started following you"` where `name = display_name or username or "Someone"`, `link="/following"`. Committed before `queue_push(...)`.
- No notification when the follow already existed (idempotent), and none if the same follower already triggered a `follow` notification for that user with the same message in the last 24 hours.
- The followers list returns `id`, `username`, `display_name` only. It must never include `last_scrobble` (a follower's listening is private to people who follow them).
- Removing a follower sends no notification and is idempotent (200 even if the row is absent). A user can only remove followers of their own account.
- Both new routes require a signed-in user (401 otherwise). Only `is_active` users appear in the list.
- Route order: `/me/followers` is registered in the `/me/...` group; it must not be shadowed by `/{user_id}/...` routes.
- Frontend: flat styling (no gradients/shadows), scoped CSS, `text-transform: none` on mixed-case buttons, tests call `cleanup()` in `afterEach`, exact-match Playwright/Testing Library button names.
- User-facing change: update `changelogData.js` (0.50.6 at top), `package.json` and `package-lock.json` versions (edit tool), `FaqSection.jsx` privacy answer, `UserGuideSection.jsx`.
- Public repo: no hostnames, IDs, or weaknesses in commit/PR text; say "security review done" only.

## Review Focus
- A user removing a follower, then that person requesting `/users/{me}/profile` or my reports: they must lose access (403 / no details).
- Spam: follow, unfollow, follow, unfollow repeatedly must produce at most one notification per 24 hours.
- Self-follow and inactive/unknown users still rejected as before.
- Removing someone who is not a follower, or a nonexistent id: harmless 200, no error leak about whether an account exists beyond the existing 404 pattern.
- A follower's `last_scrobble` never appears in `/users/me/followers`.

---

### Task 1: Backend service, notification and endpoints

**Files:**
- Modify: `backend/app/services/social_service.py`, `backend/app/api/users.py`, `backend/app/schemas/users.py`
- Test: `backend/app/tests/test_users.py` (extend; reuse `_seed_users`, `ViewerUser`, `TestingSession`)

**Interfaces:**
- Produces: `social_service.follow_user(db, follower_id, followee_id) -> bool` (True only when a new row was created; still raises `ValueError` for self-follow).
- Produces: `social_service.get_followers(db, user_id: int, limit: int = 50, offset: int = 0) -> list[dict]` returning dicts with `id`, `username`, `display_name`.
- Produces: `social_service.remove_follower(db, owner_id: int, follower_id: int) -> None`.
- Produces: `GET /users/me/followers -> FollowersListResponse` (`results: list[FollowerSummary]`, `FollowerSummary = {id, username, display_name}`); `DELETE /users/me/followers/{follower_id} -> FollowActionResponse` semantics reused as `{"following": false, "follower_count": int}` (new schema `RemoveFollowerResponse = {follower_count: int}` is acceptable if clearer).
- Consumes: `Notification` model, `queue_push` from `backend/app/services/push_service.py`.

- [ ] **Step 1:** `git checkout -b feat/follower-notify-remove main`.
- [ ] **Step 2: Write failing tests** in `test_users.py` (monkeypatch `users_module.queue_push` to record calls):
  - `test_new_follow_creates_notification_and_push`: user 1 follows 2 → one `Notification` for user 2 with the exact title/message/type/link above; `queue_push` called once with `(2, "New follower", message, "/following")`.
  - `test_repeat_follow_does_not_notify_again`: follow twice → still one notification.
  - `test_follow_unfollow_spam_is_rate_limited`: follow, unfollow, follow → one notification.
  - `test_followers_list_has_no_last_scrobble`: 1 follows 2 (2 has events; 1 has events); as user 2, `GET /users/me/followers` → results contain user 1 with keys exactly `{id, username, display_name}`.
  - `test_followers_list_requires_auth` (401) and `test_followers_list_hides_inactive_users`.
  - `test_remove_follower_removes_access`: 1 follows 2; as 2 `DELETE /users/me/followers/1` → 200, `follower_count == 0`; then as 1 `GET /users/2/profile` shows `can_view_details is False`.
  - `test_remove_follower_is_idempotent_and_scoped`: removing a non-follower → 200; removing doesn't delete a follow where I am the follower (user 2 follows 1 stays).
  - `test_remove_follower_sends_no_notification`.
- [ ] **Step 3:** Run `PYTHONPATH=worker python -m pytest backend/app/tests/test_users.py -q`. Expected: the new tests FAIL.
- [ ] **Step 4: Implement** the signatures above. In the `follow` route, call `follow_user`; if it returns True and the 24-hour duplicate check (query `Notification` for `user_id`, `type == "follow"`, same `message`, `created_at >= utc_now() - timedelta(hours=24)`) finds none, add the notification, `db.commit()`, then `queue_push(...)`. Import `Notification`, `queue_push`, `utc_now` at module top.
- [ ] **Step 5:** Run the test file again. Expected: all pass. Then `ruff check backend/app worker scripts` and `ruff format --check backend/app worker scripts`. Expected: clean.
- [ ] **Step 6:** Run the full backend suite: `PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q`. Paste the last lines. Expected: all pass.
- [ ] **Step 7:** Commit `feat(api): notify on new follower and let users remove followers`.

### Task 2: Following page Followers section

**Files:**
- Modify: `frontend/src/api.js`, `frontend/src/pages/FollowingPage.jsx`, `frontend/src/styles.css` (small scoped block only if needed)
- Test: `frontend/src/pages/FollowingPage.test.jsx`, `frontend/src/api.test.js`

**Interfaces:**
- Consumes: Task 1 endpoints.
- Produces: `fetchFollowers({ token }) -> { results: {id, username, display_name}[] }` and `removeFollower({ token, userId }) -> { follower_count }` in `api.js`, following the existing `parseResponse` pattern.

- [ ] **Step 1: Write failing tests:**
  - `api.test.js`: `fetchFollowers calls GET /users/me/followers with a bearer token`; `removeFollower calls DELETE /users/me/followers/7`.
  - `FollowingPage.test.jsx`: `shows a Followers heading with each follower and a Remove button` (use `getByRole("button", { name: "Remove jo_vinyl", exact: true })`, so each button's `aria-label` is `Remove <username>`); `Remove asks for confirmation, then calls removeFollower and drops the row`; `cancelling confirmation keeps the row`; `shows an empty message when nobody follows you yet`.
- [ ] **Step 2:** Run `cd frontend && npx vitest run src/api.test.js src/pages/FollowingPage.test.jsx`. Expected: new tests FAIL.
- [ ] **Step 3:** Add the two API functions. In `FollowingPage.jsx` load followers with the existing Following tab data (`Promise.all` gets a third call), render a `Followers (N)` section under the list with the same row markup as `renderUser` but no "last played" text, and a Remove button that opens an inline confirm ("Remove <name>? They can follow you again.") with Confirm/Cancel; on confirm call `removeFollower` and filter the row out; show errors in the page's existing error area.
- [ ] **Step 4:** Run the two test files again, then `cd frontend && npm run lint && npm test && npm run build`. Paste the last lines. Expected: all pass.
- [ ] **Step 5:** `npx prettier --write` only on files whose style is already Prettier-formatted (check with `--check` first; leave legacy single-quote files alone). Commit `feat(following): show followers with a Remove option`.

### Task 3: Docs, changelog, version, release checks

**Files:**
- Modify: `frontend/src/components/settings/FaqSection.jsx`, `FaqSection.test.jsx`, `UserGuideSection.jsx`, `UserGuideSection.test.jsx`, `frontend/src/changelogData.js`, `frontend/package.json`, `frontend/package-lock.json`

- [ ] **Step 1: Write failing tests:** FAQ `privacy-visibility` answer mentions that you get a notification when someone follows you and can remove followers on the Following page (`toHaveTextContent(/remove/i)` and `/notification/i`); guide mentions "Remove" under Friends.
- [ ] **Step 2:** Run the two test files; expected FAIL. Update the FAQ privacy answer and add one short guide paragraph (Section 3, Friends). Re-run; expected PASS.
- [ ] **Step 3:** Changelog entry `0.50.6` dated `2026-11-18`: "Follower Alerts and Remove Follower: You now get a notification when someone starts following you, and you can see your followers and remove any of them from the Following page." Bump `0.50.5` to `0.50.6` in `package.json` and the two top version lines of `package-lock.json` (edit tool).
- [ ] **Step 4: Full checks** (paste last lines of each): `ruff check backend/app worker scripts`, `ruff format --check backend/app worker scripts`, `PYTHONPATH=worker python -m pytest backend/app/tests worker/tests -q`, `cd frontend && npm run lint && npm test && npm run build`.
- [ ] **Step 5: Navigation changed? No** (no routes/redirects), so the E2E suite is not required; say so in the PR.
- [ ] **Step 6: Preview.** `scripts/preview.sh up`; Page Check from AGENTS.md for all pages; open `/following` on the preview and by hand: confirm the Followers list, the Remove confirm/cancel, and (using two users if the preview data allows) a new follow creating a bell notification. Screenshots with `node e2e/preview-shots.mjs <scratchpad folder> /following` (outside the repo). Then `scripts/preview.sh down`.
- [ ] **Step 7:** Run the `differential-review` skill on the branch (this touches the follow/access path: treat as MEDIUM risk and run adversarial modelling on "removed follower keeps access" and "notification spam"); save the report outside the repo. Fix findings.
- [ ] **Step 8:** Commit docs/version, push the branch, open the PR using `.github/pull_request_template.md`. Stop; the owner gives the go-ahead and merges on GitHub.

---

## Self-review notes
- **Coverage:** notification (T1), dedupe/rate limit (T1 tests), followers list without last_scrobble (T1), remove + access loss (T1), Following page UI (T2), FAQ/guide/changelog/version (T3), differential review and preview (T3).
- **Risk:** MEDIUM, because it touches who can see whose data. The access check itself (`can_view_details`) is not changed; removal just deletes the `follows` row it already reads.
- **Not covered, deliberately:** approval-before-follow, blocking, notifying the removed user.
