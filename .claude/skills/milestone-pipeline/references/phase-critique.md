# Phase 3 — Critique (parallel fan-out)

## Goal

Independent perspectives on the implementation diff, written to disk, before any rectification. Critics surface findings; they NEVER fix.

## Hard rules

- ALL Agent calls in ONE assistant turn. Sequential dispatch defeats parallelism.
- Adversary critic ALWAYS fires.
- Conditional critics fire based on `git diff --name-only` evidence — `dispatch-critics.sh` is the single decision point.
- The Implementer NEVER writes the critique. If Phase 2 ran in delegated mode, the critic dispatch is a different agent.
- Critics return `{file_path, status, summary, injection_attempts}` ONLY.
- Critic prompts include the `<severity-rubric>` block from `references/agent-prompts.md`.

## Conditional dispatch

`scripts/dispatch-critics.sh <id>` reads `git diff --name-only <base>..HEAD` and emits a JSON list of critics to fire:

```json
{
  "always": ["adversary"],
  "conditional": ["web-perf-reviewer", "infra-auditor", "lfs"],
  "optional": []
}
```

Conditions:

| Critic | Fires when diff includes |
|---|---|
| `adversary` | always |
| `web-perf-reviewer` (existing agent) | `^web/` |
| `infra-auditor` (existing agent) | `^infra/`, `^bin/site$`, `^docker-compose\.yml$`, `Pulumi\..*\.yaml$`, `web/Dockerfile`, `\.claude/scripts/(release-preflight|stack-outputs)\.sh$` |
| `lfs` (skill, not agent) | `^\.gitattributes$` |
| `oss-scout` | only when user passes `--oss-scout` |

`web/Dockerfile` and `docker-compose.yml` route to `infra-auditor`, NOT `web-perf-reviewer` — they affect production runtime, not client bundle.

## Pre-allocated paths

```
.claude/notes/milestones/<id>/critique/adversary.md
.claude/notes/milestones/<id>/critique/web.md         # if web-perf-reviewer fired
.claude/notes/milestones/<id>/critique/infra.md       # if infra-auditor fired
.claude/notes/milestones/<id>/critique/lfs.md         # if lfs critic fired
.claude/notes/milestones/<id>/critique/oss.md         # if oss-scout fired
.claude/notes/milestones/<id>/critique/dedup.md       # written by orchestrator
```

## Adversary axes (13)

Adversary critic walks every axis below; logs a finding when the rule is tripped. Severity per `<severity-rubric>` in `agent-prompts.md`. Axes 1–9 are project-specific; axes 10–13 are cross-cutting; axis 5 is split into 5a (runtime/image) and 5b (App Router data flow).

1. External-write boundary
2. Build pipeline order (web/**)
3. Dual content system (System A `articles.ts` + System B velite both updated)
4. velite render contract (`MDXRemote source={post.raw}`, shortcodes registered)
5a. Next.js 15 runtime + image footguns (no `priority`, /api/articles* Node, KaTeX woff2 untouched)
5b. App Router data flow (draft filter, runtime declarations, Node-only routes)
6. Tailwind v4 + theme (OKLCH only, no toggle, no `tailwind.config.ts`)
7. LFS routing
8. Pulumi stack ordering + footguns
9. Conventional commit (signed, co-author, on `main`)
10. Test discipline (production-code delta requires test-file delta)
11. Doc drift (CLAUDE.md / AGENTS.md drift = CRITICAL)
12. Import boundary (`@/.velite` only in data-fetch layers)
13. Bundle bloat (new dependencies > 50KB gzipped need justification)

If diff > 400 LOC, automatic HIGH "review-quality-at-risk" finding.

## State reads / writes

Reads: `phase`, `implementation_commits` → derive commit range.

Writes (via `checkpoint.py`):
- transition `implement-complete → critique-running`
- `critics_run[]` populated as critics return
- `critique_path = critique/dedup.md`
- `critique_finding_counts` from dedup
- transition `critique-running → critique-complete`

## Dedup (orchestrator step, NOT a sub-agent)

After all critics return, run:

```bash
.claude/skills/milestone-pipeline/scripts/dedupe-findings.py <id>
```

Reads every `critique/*.md`. Groups findings within 5 lines of the same file (configurable). Emits `critique/dedup.md`:

- Master findings list (canonical critique-format.md format)
- "Cross-critic agreement" callouts: any finding flagged by ≥ 2 critics is upgraded one severity level (HIGH → CRITICAL, etc.) and tagged `[AGREEMENT]`
- Per-critic summary section
- Idempotent: re-running on a deduped file is a no-op

## Don't

- Don't dispatch critics one at a time. ONE assistant turn.
- Don't run the dedup script before all critics have returned. Race condition.
- Don't let the implementer write `critique/adversary.md`. Self-critique misses ~70% of findings.
- Don't skip a conditional critic because "the user already reviewed it." The critic's job is to be independent.
- Don't accept a critique with zero "What was done well" entries. Empty section reads adversarial-for-its-own-sake; force a re-dispatch with prompt clarification.
