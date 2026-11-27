# FAQ and User Guide catch-up, Timeline FAQ audit, Timeline as default skin

Date: 2026-11-27. Status: draft, awaiting owner approval.

## Intent and why
The FAQ and User Guide have fallen behind recent releases (Discover filters, cover/tribute tag,
Jukebox play, gig report widgets, Wrapped, Timeline skin, Share Scrobbles limits). The FAQ page has
not been design-audited in Timeline. The owner wants Timeline to be the skin new people see first.

## Three separate changes (one branch, preview and go-ahead each, in this order)

### 1. FAQ and User Guide catch-up
- Add FAQ answers: Discover filters and criteria cog; Cover band / Tribute act tick box; Album
  Jukebox play (Lucky Dip, 3-roll limit, Flat vs Arcade switch); gig report widgets and the widget
  customiser; Wrapped (past years live on Reports, Wrapped tab, own reports only; slide Share
  button); Timeline source markers, quiet gaps and Library Grid/List toggle; Share Scrobbles
  cannot be undone and shared songs are not marked.
- Fix the page-map answer (Today page, Discover tab, Wrapped tab) and check Settings tab names in
  every answer against the real tabs (General, Views, Scrobble, Data, Notifications, User Guide,
  FAQ, Danger Zone).
- Mirror the same gaps in `UserGuideSection.jsx`.
- Every claim is checked against the code or the preview before it is written. UK spelling.
- Touches `FaqSection.jsx`, `UserGuideSection.jsx`, their tests, `changelogData.js`, version bump.

### 2. Impeccable audit of the FAQ page (Timeline first)
- Audit at phone, small-phone and PC sizes, light and dark: search box, open and closed items,
  category headings, contrast, tap targets, focus rings, long-answer wrapping.
- Fix findings with Timeline-scoped CSS only. Classic and Sleeve unchanged. Flat-by-default
  (no gradients, no box-shadow), approved tokens only. Retro Jukebox untouched.
- Click every control in a real browser; run the page check; screenshots.

### 3. Timeline as the default skin (option A, chosen by owner)
- New accounts get Timeline. Existing users keep their stored skin. No migration of existing rows.
- Change the default in: `DEFAULT_SKIN_ID` (frontend/src/skins/index.js), `preferences_service.py`
  defaults, the Pydantic schema default, the model column default, and a new numbered Alembic
  migration changing the column `server_default` only. The old migration is not edited.
- Settings still lists all three skins; Classic and Sleeve are options. Changelog notes that
  Timeline is the new default and existing users are unchanged.
- Needs owner approval for the schema change (asked and answered: option A).

## Approaches considered (change 3)
- Change the default everywhere, with a new migration for the column default (chosen: keeps
  frontend, API and database in step, so a new user never flashes the wrong skin).
- Frontend-only fallback (rejected: the database would still say classic and disagree).
- Migrate all existing users (rejected by owner: would override people who chose Classic).

## Goals / non-goals / anti-goals
- Goals: accurate help text; a polished Timeline FAQ; Timeline first for new users.
- Non-goals: redesigning Classic or Sleeve; changing existing users' skins; new features.
- Anti-goals: documenting anything not verified; leaking Classic styles into Timeline rules.

## Constraints
AGENTS.md rules: planner then implementer, branch per change, lint/tests/build, e2e if routes or
nav touched, differential-review, Page check, changelog and version bump once per release.

## Left to the builder
Exact wording of answers, ordering within categories, which CSS fixes the audit finds.
