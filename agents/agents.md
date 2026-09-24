# Agents: Audio Scrobbler App

Prompts for AI agents working on this repo. They work with any tool: paste them
as a system prompt, or point the agent at the file.

| File | Use it for |
|---|---|
| [planner_agent.md](planner_agent.md) | **Planning** any non-trivial change: protocol, general rules, the real architecture, regression checklist, test commands, deploy and verification. |
| [implementation_agent.md](implementation_agent.md) | **Carrying out** an approved plan: edit, test, then commit and push each step. |
| [page_specs.md](page_specs.md) | What each page (Overview, Library, Reports, Profile, Following, Settings, Connect) shows, its endpoints and components, shared page rules, known issues. |

## Workflow

1. Andy asks for a change.
2. The **Planner** reads `AGENTS.md`, `HANDOVER.md` and the code, then produces
   numbered steps with files, tests, risks and commit messages, ending with
   `Confirm to proceed.`
3. Andy approves.
4. The **Implementation Agent** carries out each step. It edits, runs the tests,
   commits and pushes, then reports.
5. Every push to `main` redeploys production (CI → GHCR → Watchtower), except
   commits marked `[skip ci]`, which are for docs-only changes.

A small, obvious fix can skip the formal plan if Andy says so. The testing,
commit and safety rules still apply.

## Related files

- `AGENTS.md` (repo root): Andy's standing rules. They override these files.
- `HANDOVER.md`: the project handover (redacted, public). `HANDOVER.private.md`
  is the full version: gitignored, local only, and never committed.
- **Claude Code global agents** in `~/.claude/agents/` (`planner.md`,
  `implementer.md`): the same general rules, for use across all of Andy's
  projects.
- `.github/agents/impeccable-*.agent.md`: UI design and review agents.

## Keeping these in step

- When a rule changes, update the planner and implementer here **and** the
  global agents in `~/.claude/agents/`.
- When a page changes, update [page_specs.md](page_specs.md) in the same commit.
- This repo is **public**. Never add IPs, hostnames, account or user IDs, NAS
  details, secrets or known operational weaknesses to these files. Those
  belong only in `HANDOVER.private.md`.
