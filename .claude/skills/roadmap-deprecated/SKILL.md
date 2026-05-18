---
name: roadmap-deprecated
description: DEPRECATED — use the `/roadmap` slash command instead. This stub exists for ~30 days (sunset 2026-06-18) for any session that still resolves the old skill name via cached symlink.
allowed-tools: Read
---

# /roadmap — DEPRECATED location

This skill was converted to a slash command + 4 memory-bearing subagents on
2026-05-18. The skill name `roadmap` now resolves to `.claude/commands/roadmap.md`
(the slash command) before this deprecated stub.

## What to use instead

| Old (this skill)                              | New                                                  |
|-----------------------------------------------|------------------------------------------------------|
| Skill body: `.claude/skills/roadmap/SKILL.md` | Slash command: `.claude/commands/roadmap.md`         |
| (monolithic single-thread run)                | 4 subagents in `.claude/agents/roadmap-*.md`         |
| Scripts: `.claude/skills/roadmap/scripts/*`   | Migrated: `.claude/scripts/roadmap/*` (git-mv'd)     |
| Refs: `.claude/skills/roadmap/references/*`   | Migrated: `.claude/references/roadmap/*` (git-mv'd)  |

## Why this changed

The skill-based pattern loaded into main context as reference material AND ran
in the main thread for all phases. The slash-command + subagents pattern:

- One subagent per phase — fresh context window each (no pollution)
- Body-driven memory per agent — `.claude/agent-memory/<agent>/lessons.md`
  persists across runs (see `.claude/agents/README.md` for the protocol)
- Deterministic math (MoSCoW Must cap, RICE ranking, validator) runs in scripts;
  subagents call via Bash rather than reasoning in-context
- External writes (GitHub Issues, milestone-pipeline handoff) gated in the
  main session per `CLAUDE.md` "External-write boundary"

## Sunset plan

This redirect stub stays in tree for 30 days after the conversion commit lands
on main (sunset date: 2026-06-18). After that, it will be `git rm`'d. Any
session that explicitly invokes the `roadmap-deprecated` skill name after
sunset will get a "skill not found" — the slash command `/roadmap` is the
sole interface.

## Invocation resolution

- `/roadmap <slug>` → resolves to `.claude/commands/roadmap.md` (the slash command)
- `roadmap` skill name (without slash) → also resolves to the slash command via Claude Code's skill discovery
- `roadmap-deprecated` skill name (explicit) → resolves to this redirect message

No prose-skill behavior remains. This stub is a guidepost, not an entry point.

## Co-Authored-By

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
