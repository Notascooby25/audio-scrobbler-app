# How to Apply These Refinements

This is the only file you need to follow step by step. Everything else in this
folder is either (a) something Impeccable reads automatically, or (b) source
material you copy FROM, never a file the agent discovers on its own.

---

## Part 1 — What every file is, and where it lives

| File | What it is | Where it should live | Do you ever open/paste it? |
|---|---|---|---|
| `PRODUCT.md` | Impeccable's stored product context | Repo root (already there) | No — Impeccable reads it automatically every run |
| `DESIGN.md` | Impeccable's stored design system | Repo root (already there) | No — Impeccable reads it automatically every run |
| `old_DESIGN.md` | Superseded design system, kept for history | Repo root (already there) | No — not read by Impeccable; ignore it |
| `SKILL.md` + `reference/*.md` + `scripts/` | The Impeccable skill itself | `.github/skills/impeccable/` in your repo | No — your coding agent auto-loads it |
| `REFINEMENT_SUMMARY.md` | Phase 1 overview/checklist, for YOU to read | Anywhere, e.g. `/docs/design/` | Read only — never paste into chat |
| `REFINEMENT_BRIEF.md` | Phase 1 detailed rationale + CSS, for YOU to read | `/docs/design/` | Read only — never paste into chat |
| `IMPLEMENTATION_PROMPTS.md` | Phase 1 — the actual prompt text | `/docs/design/` | **YES — this is what you copy FROM** |
| `PHASE_2_REFINEMENT_BRIEF.md` | Phase 2 detailed rationale + CSS, for YOU to read | `/docs/design/` | Read only — never paste into chat |
| `PHASE_2_IMPLEMENTATION_PROMPTS.md` | Phase 2 — the actual prompt text | `/docs/design/` | **YES — this is what you copy FROM** |
| `HOW_TO_APPLY.md` (this file) | The instructions you're reading now | `/docs/design/` | Read only |

**The short version:** only two files ever get copy-pasted into the agent chat —
`IMPLEMENTATION_PROMPTS.md` and `PHASE_2_IMPLEMENTATION_PROMPTS.md`. Everything
else is either background reading for you, or infrastructure the agent finds by
itself.

**Suggested folder structure once you set this up:**
```
your-repo/
├── PRODUCT.md                          ← stays at root, Impeccable reads it
├── DESIGN.md                           ← stays at root, Impeccable reads it
├── .github/
│   └── skills/
│       └── impeccable/
│           ├── SKILL.md
│           ├── reference/
│           └── scripts/
└── docs/
    └── design/
        ├── REFINEMENT_SUMMARY.md
        ├── REFINEMENT_BRIEF.md
        ├── IMPLEMENTATION_PROMPTS.md         ← copy FROM this one
        ├── PHASE_2_REFINEMENT_BRIEF.md
        ├── PHASE_2_IMPLEMENTATION_PROMPTS.md ← copy FROM this one
        └── HOW_TO_APPLY.md                   ← this file
```

---

## Part 2 — One-time setup check (before Prompt 1)

1. Open the repo in VS Code (with the Claude Code extension) or Antigravity, at
   the repo root — the folder that directly contains `PRODUCT.md` and `DESIGN.md`.
2. Confirm `.github/skills/impeccable/SKILL.md` exists at that path. If your
   agent uses a different skills directory (Antigravity may not use
   `.github/skills/`), move the `impeccable/` folder to wherever that tool's
   docs say skills belong. If you're not sure, paste this into chat once and
   ask: *"Where do you look for skills in this project?"*
3. Open the agent's chat panel (Claude Code panel in VS Code, or Antigravity's
   agent chat).

You do this once, not before every prompt.

---

## Part 3 — The actual loop (repeat once per prompt)

**Step A — Open the source file.**
Open `IMPLEMENTATION_PROMPTS.md` (Phase 1) or `PHASE_2_IMPLEMENTATION_PROMPTS.md`
(Phase 2) in your editor.

**Step B — Copy exactly one Prompt block.**
Each file is broken into `## Prompt N: ...` sections. Copy everything from the
line starting `**Command:**` down to (and including) the closing ` ``` ` of
that Prompt's code fence. Stop at the next `## Prompt` heading — do not paste
two prompts in one message.

**Step C — Paste that block as your message to the agent.**
Paste it exactly as-is into the chat panel and send it. Nothing needs to be
retyped or reformatted — the block is already written as a complete instruction.

**Step D — Let the agent finish its pass.**
Per `SKILL.md`, the agent will: load the skill → route to the matching
`reference/*.md` file (e.g. `layout.md`, `clarify.md`, `polish.md`) → read your
actual component code → make the edits → take one round of screenshots
(desktop + mobile) → fix anything it finds → stop. You don't need to prompt it
again mid-task; if it stops and asks a clarifying question, answer it, then let
it continue.

**Step E — Check against that prompt's own Acceptance list.**
Every Prompt block ends with an `Acceptance:` checklist. Go through it against
what the agent produced before moving on.

**Step F — Commit.**
Commit with a message referencing the prompt, e.g.
`git commit -m "impeccable: settings categorized tabs (Phase 2, Prompt 4)"`.

**Step G — Move to the next prompt.** Go back to Step A.

---

## Part 4 — Exact order to work through

Do these one at a time, in this order. Each row tells you the exact source
file and exact prompt heading to copy.

| # | Copy from | Prompt heading to copy | Fixes |
|---|---|---|---|
| 1 | `PHASE_2_IMPLEMENTATION_PROMPTS.md` | `Prompt 4: Layout – Settings Categorized Tabs` | Settings page scrolling |
| 2 | `PHASE_2_IMPLEMENTATION_PROMPTS.md` | `Prompt 3: Clarify – Custom Date Range Formatting` | 1912 default bug, date field styling |
| 3 | `IMPLEMENTATION_PROMPTS.md` | `Prompt 2: Clarify – Range Filter Button Hierarchy` | Range filter buttons all blue |
| 4 | `IMPLEMENTATION_PROMPTS.md` | `Prompt 4: Polish – Card Border Consistency Audit` | Inconsistent card borders |
| 5 | `IMPLEMENTATION_PROMPTS.md` | `Prompt 1: Layout Refinement – List Row Density` | Library rows too tall |
| 6 | `PHASE_2_IMPLEMENTATION_PROMPTS.md` | `Prompt 1: Layout – Enlarge Album/Artist Grid Covers` | Small album covers on mobile |
| 7 | `IMPLEMENTATION_PROMPTS.md` | `Prompt 3: Clarify – Settings Form Label Typography` | Uppercase form labels |
| 8 | `IMPLEMENTATION_PROMPTS.md` | `Prompt 5: Polish – Primary Text Color Verification` | Text contrast check |
| 9 | `PHASE_2_IMPLEMENTATION_PROMPTS.md` | `Prompt 2: Feature – Source Attribution Badges` | Spotify/YouTube badges |

**Why this order:** 1–2 are self-contained bug fixes with no dependency on
anything else. 3–5 clean up shared components (buttons, cards, rows) before
6 touches the same grid cards at a bigger scale, so you're not fixing borders
on a card layout that's about to be restructured. 7–8 are low-risk polish.
9 goes last because it depends on your `source` field actually being reliable
in the data layer — confirm that separately if you're not sure it's populated
correctly for every scrobble.

---

## Part 5 — If something goes wrong

- **Agent says it can't find the skill / doesn't recognize the command:**
  Paste the full contents of `SKILL.md` into chat once at the start of the
  session as plain context, then retry the Prompt block.
- **Agent runs `impeccable context` and fails/refuses:** per `SKILL.md`'s own
  fallback instructions, it should tell you "Context loading did not run..."
  and continue by reading `PRODUCT.md`/`DESIGN.md` directly — this is expected
  behavior, not an error you need to fix.
- **You want to stop mid-list and resume later:** just note which row number
  in the Part 4 table you last committed, and pick up from the next row next
  session. Nothing here is order-locked beyond the dependency notes above.
