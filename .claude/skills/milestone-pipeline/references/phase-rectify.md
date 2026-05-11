# Phase 4 — Rectify (main session ONLY)

## Goal

Fix the findings worth fixing, add regression guards, land a single signed commit, and **stop at the external-write boundary**. The user authorizes any push / release / infra mutation directly — Phase 4 never crosses that line.

## Hard rules

- **Phase 4 runs in the main session.** Do NOT delegate to a sub-agent. Load-bearing isolation: separate critic + main-session rectifier outperforms self-rectify by a wide margin (actor-critic literature). If a fresh sub-agent is required (e.g. main session is out of context budget), it must be a sub-agent that did NOT write the implementation.
- Re-verify each CRITICAL + HIGH against live code BEFORE fixing.
- Fix ALL CRITICAL and HIGH. Fix MEDIUM if cheap (≤ 30 LOC AND small test surface). Defer LOW.
- For every fixed CRITICAL + HIGH, add a regression test/assert/snapshot.
- Single rect commit, signed, with `Reviewed-by:` trailers.
- **STOP at external-write boundary.** Do NOT invoke `release-deputy`, do NOT push, do NOT call any `bin/site` mutating verb.

## Re-verification protocol (anchor on text, not line numbers)

For each CRITICAL + HIGH finding the critique cites at `<file>:<line>`:

```python
# Conceptually:
cited_text = read_critique_finding(finding).first_40_chars
window = read_file(finding.file, line - WINDOW, line + WINDOW)
WINDOW = 30  # for code
       = 10  # for prose / MDX / config (denser, smaller windows)

if cited_text not in window:
    mark_invalidated(finding, reason="anchor-not-found")
    skip
elif current_code_no_longer_matches_critic_claim(finding):
    mark_invalidated(finding, reason="code-no-longer-matches-claim")
    skip
else:
    proceed_to_fix(finding)
```

Log invalidation rate to `audit.jsonl`. Surface in `status.sh`.

**> 40% invalidation = the critic was working from stale code.** Re-run `dispatch-critics.sh` against the post-implement diff and re-critique BEFORE rectifying. Don't push through.

## Loop caps

- **Inner loop (per-finding):** 3 attempts. Try fix → re-run relevant gate → if gate fails, refine fix. After 3 attempts, escalate.
- **Outer loop (full check matrix):** 3 iterations. After all findings addressed, run check matrix; if fails, identify new failures, patch them. After 3 outer rounds, escalate.

Escalation triggers:
- Cap exhausted.
- Same error string twice in a row (highest signal — agent is looping).
- Zero diff overlap between attempt N and attempt N-1 (thrashing).

Escalate by: writing `rectify/escalation.md` with last error + diff history, surfacing to user with explicit "human needed" message, exiting Phase 4 in `rectify-running` state. User decides: `--resume rectify --start-fresh [--model opus]` (resets counters, optionally upgrades tier) or manual fix.

## Severity decision

| Severity | Action |
|---|---|
| CRITICAL | Always fix, always add regression guard. |
| HIGH | Always fix, always add regression guard. |
| MEDIUM | Fix iff diff ≤ 30 LOC AND no new test files needed beyond a single assert. Otherwise defer to a follow-up milestone. |
| LOW | Defer by default. Surface in `rectify/summary.md` "Deferred" section. |

## Regression-guard structural check

After local commit, run:

```bash
.claude/skills/milestone-pipeline/scripts/check-rect-tests.sh
```

The script asserts: if the rect commit changed any production code (anything outside `*.md`, `*.test.*`, `_test.go`, `*.bats`, `test_*.py`), it must also change at least one test file. Doc-only rect commits exempt. **If the check fails, the rect commit is rejected** — `git reset --soft HEAD~1`, fix, re-commit. Prompt-only enforcement is not enough under context pressure.

## Rect commit

```
rect(<id>): close C1, H1, H2

Closes critique findings: C1, H1, H2
Reviewed-by: adversary-critic <noreply@anthropic.com>
Reviewed-by: web-perf-reviewer <noreply@anthropic.com>
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

Use `git interpret-trailers --in-place --trailer "Reviewed-by: <agent> <noreply@anthropic.com>"` for each critic that ran (not just those that found something). Trailer normalization survives. `Co-Authored-By:` is added the same way.

Subject ≤ 50 chars after the prefix; if more findings to enumerate, list in body. Imperative, no period. Signed (GPG via `commit.gpgsign=true`).

## External-write boundary (THIS IS THE STOP)

After commit lands and `check-rect-tests.sh` passes:

1. Read `state.external_writes_required`.
2. If non-empty, print to user:

   ```
   Pipeline complete locally. External writes pending:
     - bin/site app release   (push image, restart EC2 container)
     - git push origin main   (publishes to GitHub)

   To proceed:
     - For release: invoke /release-deputy (it will run preflight, then prompt).
     - For push: confirm authorization, then run: git push origin main
     - To skip: reply with "skip" for each.

   None of these will run automatically. The pipeline is paused at rectify-running
   until you reply.
   ```

3. Wait for user-direct reply. Do NOT proceed without explicit per-write authorization. Do NOT auto-invoke `release-deputy` — that collapses the user-direct authorization chain (AGENTS.md is explicit on this point).
4. As the user authorizes each, append to `state.external_writes_authorized`. Once the user marks each as completed (or explicitly skipped), append to `state.external_writes_completed`.
5. When `external_writes_required ⊆ external_writes_authorized ∪ external_writes_skipped`, transition `rectify-running → complete`. Run `compute-metrics.py`. Release the lock.

## State reads / writes

Reads: `phase`, `critique_path`, `critique_finding_counts`, `external_writes_required`.

Writes (via `checkpoint.py`):
- transition `critique-complete → rectify-running`
- `fixed_findings[]`, `deferred_findings[]`, `invalidated_findings[]`
- `regression_tests_added[]`
- `rectification_commit` = SHA
- `external_writes_authorized[]` and `external_writes_completed[]` as user replies
- transition `rectify-running → complete`

## Don't

- Don't delegate Phase 4 to a sub-agent unless the main session is out of context AND the sub-agent is NOT the implementer.
- Don't fix a finding without re-verifying its anchor first.
- Don't push through a > 40% invalidation rate. Re-critique.
- Don't add `--no-verify` to bypass a failing pre-commit hook. Investigate, fix the root cause.
- Don't skip the regression-guard structural check. The check is the discipline; the prompt is just intent.
- Don't auto-invoke `release-deputy`. Print the one-liner; let the user invoke it.
- Don't `git revert` a rect commit silently. If the user notices a regression after the fact, document the revert as `git revert <rect-sha>` followed by a fresh milestone if needed.
