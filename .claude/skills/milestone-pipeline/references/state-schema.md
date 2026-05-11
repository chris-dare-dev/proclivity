# `state.json` schema and transition rules

Authoritative schema: `references/schemas/state.schema.json`. This file documents intent and transitions; the JSON Schema is what `validate-artifact.py` enforces.

## File location

`<repo-root>/.claude/notes/milestones/<id>/state.json`

Atomic writes only. `checkpoint.py` writes via temp + rename in the same dir as the target — POSIX-atomic. Direct edits are forbidden (breaks the atomicity assumption upstream readers depend on).

## Phases (forward-only, no skips)

```
init
  → research-running
  → research-complete
  → implement-running
  → implement-complete
  → implement-aborted-scope     (terminal-pending; user resolves to research-running OR aborts)
  → critique-running
  → critique-complete
  → rectify-running
  → complete
```

`checkpoint.py <id> <next-phase>` refuses backward transitions and refuses skipped phases. The only way to "go back" is the explicit `--rollback-to <phase>` flag, which writes an `unwind` event to `audit.jsonl` and clears downstream artifacts.

## Top-level fields

| Field | Type | Purpose |
|---|---|---|
| `id` | string | Milestone id; `^[a-z0-9-]+-m[0-9]+$` for roadmap-paired, or `adhoc-<YYYYMMDD>-<sha7>` for ad-hoc. |
| `created_at` | RFC3339 string | First `init-state.sh` invocation. |
| `updated_at` | RFC3339 string | Most recent transition or field write. |
| `phase` | enum | One of the 9 phase strings above (plus `implement-aborted-scope`). |
| `phase_history` | array of `{phase, entered_at, exited_at, duration_seconds}` | Append-only; populated by `checkpoint.py`. |
| `milestone_brief` | string | The brief Phase 1 receives. From `--brief` or extracted from the roadmap section. |
| `milestone_brief_source` | string | `inline` or `<roadmap-path>:<heading>`. |
| `research_mode` | enum | `default` / `deep` / `single`. |
| `research_briefs` | array of `{path, agent_type, model, status, returned_at}` | One entry per dispatched researcher. |
| `research_synthesis` | string \| null | Path to synthesized brief; `null` until written. |
| `implementation_path` | enum \| null | `inline` / `delegated` / `null` until decided. |
| `implementation_base` | string | Git SHA at the start of Phase 2 (for diff anchoring). |
| `implementation_commits` | array of `{sha, subject, files_changed, loc_changed}` | Squashed if delegated. |
| `implementation_branch` | string \| null | `null` for inline; worktree branch for delegated. |
| `external_writes_required` | array of strings | Set by Phase 1 researcher; read by Phase 4 boundary. Examples: `bin/site app release`, `git push origin main`, `pulumi up dns`. |
| `critique_path` | string \| null | Path to merged dedup file. |
| `critics_run` | array of `{name, agent, model, path, returned_at}` | Records which critics fired for the audit trail / rect-commit trailers. |
| `critique_finding_counts` | object | `{critical, high, medium, low}` integers. |
| `rectification_commit` | string \| null | SHA of `rect(<id>): close ...` commit. |
| `fixed_findings` | array of finding ids | E.g. `["C1", "H1", "H3"]`. |
| `deferred_findings` | array of finding ids | LOW or out-of-scope. |
| `invalidated_findings` | array of `{id, reason}` | `reason` ∈ `anchor-not-found`, `code-no-longer-matches-claim`, `superseded-by-other-fix`. |
| `regression_tests_added` | array of file paths | Test files touched by the rect commit. |
| `external_writes_authorized` | array of strings | Subset of `external_writes_required` the user has approved (set by user-direct confirmation in chat). |
| `external_writes_completed` | array of strings | Subset that has been performed by the user (manually marked). |

## State transitions and side effects

| From → To | Side effects |
|---|---|
| `init → research-running` | `phase0-preflight.sh` must have passed. Lock taken at `.claude/notes/milestones/.lock`. Researcher brief paths pre-allocated. |
| `research-running → research-complete` | All researchers returned with `status=complete`. Briefs validated. Synthesis written. |
| `research-complete → implement-running` | `implementation_path` decided. `implementation_base` recorded. |
| `implement-running → implement-complete` | Per-diff check matrix green. `external_writes_required` populated. Implementation commit(s) recorded. |
| `implement-running → implement-aborted-scope` | Mid-flight scope-exceeded check tripped. Partial work committed; `implement/scope-exceeded.md` written. User decides next. |
| `implement-complete → critique-running` | `dispatch-critics.sh` decides which critics fire. Critique paths pre-allocated. |
| `critique-running → critique-complete` | All critics returned. `dedup.md` written. `critique_finding_counts` set. |
| `critique-complete → rectify-running` | Re-verification pass complete (anchor-match for every C+H). Invalidation rate logged. |
| `rectify-running → complete` | Rect commit landed. `rectify/summary.md` written. `external_writes_authorized` covers all `external_writes_required` (or user explicitly skipped each). `metrics.json` written. Lock released. |

## Atomic write idiom

Always write to a sibling tempfile then rename:

```python
def atomic_write(path: Path, data: str) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")  # SAME DIR — load-bearing
    tmp.write_text(data)
    os.replace(tmp, path)
```

`tempfile.NamedTemporaryFile()` defaults to `/tmp` and crosses filesystem boundaries on macOS — `rename` then degrades to copy+unlink and loses atomicity. Always create in the target's parent dir.

## Locking (one milestone at a time)

`.claude/notes/milestones/.lock` contains `<pid>:<milestone-id>:<created-at>`. `phase0-preflight.sh` checks it. If the PID is alive and the id differs from the requested one, refuse. If the PID is dead (crashed session), prompt user to clear via `init-state.sh --release-lock`.

Multi-milestone parallelism is intentionally NOT supported because of: shared `git status`, shared `pulumi` local backend, shared `release-preflight.sh` outputs, and orchestrator readability.
