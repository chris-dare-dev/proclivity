# Scripts index

All 13 scripts in `.claude/skills/milestone-pipeline/scripts/`. All are `chmod +x`.
The slash command calls them by absolute path; scripts detect `REPO_ROOT` via
`$REPO_ROOT` env var or `git rev-parse --show-toplevel`.

| Script | What it does | Called by |
|---|---|---|
| `phase0-preflight.sh` | Readiness check at pipeline start: git clean, on `main`, GPG agent alive, required tools present (`bun bats jq yq python3 git gpg`), no stale milestone lock. Flags: `--needs-aws`, `--needs-tools <csv>`. Exit non-zero = abort pipeline. | Orchestrator, Phase 0 |
| `init-state.sh` | Idempotent state bootstrap. First run: writes `state.json` at `init`, takes the lock at `.claude/notes/milestones/.lock`. Re-run on existing state: prints `RESUMING phase=<X>` and exits 0. Flags: `--brief`, `--from-roadmap`, `--research-mode`, `--release-lock`. | Orchestrator, Phase 0 |
| `checkpoint.py` | Forward-only state machine writer. Advances phase, reads/sets/appends individual fields, rolls back with `--rollback-to`. Atomic writes via temp+rename in same dir. Never go backward without an explicit rollback that logs an unwind event to `audit.jsonl`. | Orchestrator, every phase transition |
| `log-event.sh` | Append one JSON line to `audit.jsonl`. Args: `<id> <event-type> [k=v ...]`. Values JSON-parsed if possible, else stored as strings. Append-only — never truncates. | Orchestrator, every significant event |
| `status.sh` | Human-readable pipeline state dump for a milestone. Reads `state.json` and `audit.jsonl`; prints phase, timing, finding counts, last event. Flags: `--repo-root`. | Orchestrator (on resume), hooks, user |
| `parse-roadmap-milestone.py` | Extract a milestone section from a `plans/<slug>-roadmap.md` file. Matches `## Milestone <id>` or `### <id>` headings; returns body up to next same-or-higher heading. Args: `<roadmap-path> <milestone-id>`. | Orchestrator, Phase 0 (brief extraction) |
| `validate-artifact.py` | JSON-schema-validate a brief, critique, state, or rect-summary artifact against `references/schemas/*.schema.json`. Args: `state|brief|critique|rect-summary <path>`. Exit 0 = valid; 1 = invalid; 2 = usage error. | Orchestrator, after each researcher/critic returns |
| `dispatch-critics.sh` | Decide which critics fire for a milestone based on `git diff --name-only <base>..HEAD`. Emits JSON `{"always": [...], "conditional": [...], "optional": [...]}`. Flags: `--include-oss`. Reads `implementation_base` from state if no base SHA given. | Orchestrator, Phase 3 |
| `dedupe-findings.py` | Merge all `critique/*.md` (excluding `dedup.md`), group findings within ±N lines of the same file, upgrade cross-critic agreement one severity level (`[AGREEMENT]` tag), write `critique/dedup.md`. Idempotent. Flags: `--window <N>`. | Orchestrator, Phase 3 fan-in |
| `compute-metrics.py` | Read `state.json` + `audit.jsonl`; write `metrics.json` (tokens, $ per phase, wall clock, finding counts, invalidation rate, loop iterations); append one-line summary to `.claude/notes/milestones/_index.jsonl`. | Orchestrator, Phase 4 completion |
| `check-rect-tests.sh` | Assert that the rect commit includes a test-file delta whenever it changes production code. Doc-only commits (`.md` only) are exempt. Exit non-zero = rect commit rejected; caller must `git reset --soft HEAD~1`. Args: `[<commit-sha>]` (default HEAD). | Orchestrator, Phase 4 post-commit |
| `cleanup-aborted-worktrees.sh` | Remove dirty worktrees from aborted milestone phases. Stashes any changes to `.claude/notes/milestones/<id>/aborted-worktrees/<branch>.patch` before removing. Clean-exit worktrees (no changes) are auto-cleaned by the platform; this script handles dirty ones only. | Orchestrator, on `implement-aborted-scope` |
