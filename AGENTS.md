# AGENTS.md

This file exists as a discoverability stub. Proclivity's canonical operating
instructions for agents live in [CLAUDE.md](./CLAUDE.md) at the repo root.

If you are a sub-agent dispatched by the `/milestone-pipeline` slash command,
read `CLAUDE.md` (and this file's pointer) instead of looking for
project-specific rules here. The historical milestone-pipeline expected an
`AGENTS.md` to enumerate external writes and operational invariants;
proclivity collapsed those into `CLAUDE.md` because the project is a
single-developer local-only Chrome extension with no infra surface.

## Canonical references

- [`CLAUDE.md`](./CLAUDE.md) — repo-root operating instructions (branch
  rules, commit conventions, build gates, what agents must not do).
- [`.claude/CLAUDE.md`](./.claude/CLAUDE.md) — project-scope instructions
  loaded every session (milestone-pipeline triggers, state-file layout,
  external-write boundary, agent memory contract).
- [`.claude/commands/milestone-pipeline.md`](./.claude/commands/milestone-pipeline.md)
  — the four-phase pipeline orchestrator (slash command).

## External writes

Proclivity is local-only. The only external writes that ever exist are:

- `git push origin main` (publishes commits to GitHub)
- Future-tentative: Chrome Web Store publish (CLAUDE.md forbids agents
  from attempting this — it is a user-direct action only)

Anything that looks like an external write beyond these (image push, IaC
apply, vendor API mutation) does not apply to proclivity.
