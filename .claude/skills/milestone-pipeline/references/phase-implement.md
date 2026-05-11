# Phase 2 — Implement (sequential)

## Goal

A single coherent implementation matching the briefs' acceptance criteria, with the per-diff project check matrix green and a clean commit on `main` (or on a worktree branch awaiting merge if delegated).

## Decision tree

After reading `research/synthesis.md`, decide path BEFORE writing any code:

```
estimated diff ≤ 300 LOC AND ≤ 5 files AND no UI/novel-arch
  → inline (main session writes)

estimated diff 300–800 LOC OR > 5 files OR novel-arch
  → delegated (1× general-purpose Sonnet in worktree)

estimated diff > 800 LOC
  → ABORT with status "scope-exceeded".
    Surface to user. They split into sub-milestones OR pass --allow-large-diff.
```

There is **no specialist build path**. Phase 2 has only `inline` and `delegated`. Build-side specialist agents do not exist in `.claude/agents/`. Adding one would require a new agent definition with hard scope guarantees, not a SKILL.md edit.

## Mid-flight scope checks

Both `inline` and `delegated` re-check after each significant edit:

```bash
git diff --stat <BASE_SHA>..HEAD | tail -1
```

If LOC ≥ 350 OR files-changed ≥ 6: STOP. Commit any partial-but-coherent progress with subject `feat(<scope>): partial — milestone <id> scope exceeded`. Write `implement/scope-exceeded.md` with a summary. Transition `implement-running → implement-aborted-scope`. Surface to user.

**Never silently lane-switch from inline to delegated mid-flight.** Restarting in delegated mode is a deliberate user decision after surfacing.

## Per-diff check matrix (end of phase)

Run only the gates touching the diff:

| Diff touches | Gate |
|---|---|
| `web/**` | `cd web && bun run build:content && bun test` |
| `bin/**` | `cd bin/tests && bats site.bats` |
| `infra/**`, `bin/site`, `docker-compose.yml`, `Pulumi.*.yaml` | `bin/site status` (only if AWS env vars set; else skip with a note) |
| `.gitattributes` | `.claude/scripts/lfs-doctor.sh` |
| any | `git status --porcelain` clean (after commit), on `main` (or worktree branch for delegated) |

`bun run build:content` is **mandatory** before `bun test`. Without it: `Cannot find module '@/.velite'`.

## Hard rules

- Conventional commit format: `<type>(<scope>): <subject>`. Types: feat, fix, refactor, chore, docs, test, style. Scopes: web, infra, cli, dns, docker, repo. Imperative mood. No period.
- Co-author footer required: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- GPG signing required (`commit.gpgsign=true`). NEVER `--no-verify`, NEVER `--no-gpg-sign`, NEVER `--no-edit`.
- `external_writes_required` must be populated in state by end of phase. If the brief listed any, the implementer carries them forward; if the implementation introduced new ones, append them.

## State reads / writes

Reads: `phase`, `research_synthesis`, `external_writes_required` (from research).

Writes (via `checkpoint.py`):
- transition `research-complete → implement-running`
- `implementation_path` = `inline` | `delegated`
- `implementation_base` = git SHA at phase start
- `implementation_commits[]` populated as commits land
- `implementation_branch` = `null` for inline; worktree branch for delegated
- `external_writes_required` may grow
- transition `implement-running → implement-complete` OR `implement-aborted-scope`

## Prompts

For delegated mode see `references/agent-prompts.md` — `## Phase 2 — Implementer (delegated, Sonnet)`. The delegated implementer reads BOTH research briefs before writing code. Brief-inadequate is a return-status, NOT a "soldier on with a vague brief" — the dominant multi-agent failure mode.

## Synthesis (writes `implement/synthesis.md`)

Whether inline or delegated, the orchestrator writes (or the delegated implementer writes and the orchestrator validates):

```markdown
# Implement synthesis — <id>

## Built
- <bullet per acceptance criterion: how it was satisfied, file:line>

## Files touched
- <path> — <one-line role>

## Deferred
- <bullets the milestone deliberately left out>

## external_writes_required
- <YAML list — copied to state.json>

## Test deltas
- <test files added/changed; will be verified by check-rect-tests.sh in Phase 4>
```

## Worktree-vs-`main` precedence (proclivity)

`CLAUDE.md` § Branching is canonical: "All work — including Claude-assisted work — runs directly on `main`." This wins over the orchestrator's default "fresh branch in worktree" instruction for delegated Phase 2.

Resolution for this repo:

- **Delegated Phase 2 commits to `main` directly**, even when dispatched with `isolation: "worktree"`. The worktree exists as a sandbox for failed experiments and to clean up automatically when an agent makes no changes; it is NOT the canonical branch for successful work.
- The implementer must `git checkout main` inside the worktree before the first commit. Git worktrees share refs, so the commit lands on the parent's `main`.
- A successful Phase 2 leaves the assigned worktree branch (`worktree-agent-<id>`) at the base SHA. That is expected.
- An aborted-scope Phase 2 should commit partial-but-coherent progress to the worktree branch (NOT `main`), so the orchestrator can surface the diff for inspection without polluting `main`. The `cleanup-aborted-worktrees.sh` script handles takedown.

Implementers MUST cite this section in the implement synthesis when they choose to commit to `main` rather than the assigned branch — otherwise the choice looks like a contract violation.

## Don't

- Don't switch lanes mid-flight (inline ↔ delegated). Abort, surface, let the user decide.
- Don't use `--allow-large-diff` to push past 800 LOC without writing why in `implement/scope-exceeded.md`.
- Don't skip the per-diff check matrix because "tests are slow" — green-on-current-path is the contract for Phase 3 to start.
- Don't create a feature branch for inline mode. Solo project, all work on `main`. Per the precedence note above, even delegated mode commits to `main` for this repo.
- Don't pass `--no-verify`. If gpg-agent is unresponsive, abort with that error message.
