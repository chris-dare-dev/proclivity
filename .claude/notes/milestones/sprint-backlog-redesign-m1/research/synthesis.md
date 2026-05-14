# sprint-backlog-redesign-m1 — Research synthesis

**Phase 1 mode:** default (1× Explore Haiku + 1× general-purpose Sonnet).
**Briefs:** `research/brief-1.md` (codebase context), `research/brief-2.md` (external + writes + risk).
**Injection attempts reported across briefs:** 0.

---

## Affected files (deduped across briefs)

| Path | Role in m1 |
|---|---|
| `src/types/index.ts` | Add `Todo.parentId?`, `Todo.targetDate?`, `Sprint.goal?`, `Sprint.retroNote?` (all optional), and `Sprint.state` (required, union of three string literals). |
| `src/storage/storage.ts` | Extend `normalizeState()` (lines 49-63) with a `.sprints` map that backfills `state` from the legacy `endsAt < todayMidnight()` heuristic on absent **or invalid** values. |
| `test/fixtures/v1-state-empty.json` | New — minimal empty state, normalizes to itself plus `EMPTY_STATE` defaults. |
| `test/fixtures/v1-state-mixed.json` | New — mix of active and expired sprints with v1 shape (no `state` field). |
| `test/fixtures/v1-state-with-closed-todos.json` | New — verifies sprint normalization doesn't interfere with the existing `closedAt` todo backfill. |
| `scripts/replay-fixtures.ts` | New — reads the three fixtures, calls the normalizer, asserts each sprint has a valid `state` and the input round-trips without data loss. |

Files **NOT** in scope for m1: `src/sections/sprint/sprintUtils.ts` (the `isArchived()` rewrite is m2), any UI files, `src/storage/constants.ts`, and the bundle-size gate script.

---

## Acceptance criteria (deduped, verbatim from the milestone brief)

1. `src/types/index.ts` declares the five new fields with the optionality shape specified.
2. `npm run build` (`tsc -b && vite build`) passes under strict + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess` with zero new errors.
3. `storage.get()` normalizer backfills `Sprint.state = "closed"` when `endsAt < todayMidnight()`, else `"active"`. Inline comment cites the legacy heuristic location.
4. Three fixture files exist at `test/fixtures/v1-state-{empty,mixed,with-closed-todos}.json` and a fixture-replay assertion (the project has no test runner — use a `scripts/replay-fixtures.ts` invoked manually) confirms each round-trips through the normalizer without data loss.
5. Initial newtab chunk delta ≤ +2 kB from baseline. Both numbers recorded in the commit body.
6. `grep -rn "parentId\|targetDate\|\.goal\|\.retroNote\|\"draft\"\|\"closed\"" src/` outside `src/types/index.ts` and `src/storage/storage.ts` returns zero hits.

---

## external_writes_required

```yaml
external_writes_required:
  - command: "git push origin main"
    authorization: "pre-authorized per CLAUDE.md branching policy (solo + private repo, no review gate)"
```

No other external writes. Specifically: no Chrome Web Store publish, no network calls, no new npm dependencies *unless* the implementer opts for `tsx` to run the replay script (`npm install --save-dev tsx` — small dev-only dep with one-line justification; flag in Phase 4 if installed). No `--force` push.

---

## Resolved open questions (orchestrator-decided)

The two researchers disagree on one point. Resolved here so the implementer doesn't re-litigate:

1. **`todayMidnight()` location.** brief-1 recommends extracting to `src/storage/constants.ts`; brief-2 recommends inlining as a private helper in `storage.ts`. **Decision: inline.** Smallest diff, preserves the existing storage-layer isolation (no upward imports from sections), matches the file's existing posture. Add an inline comment citing `src/sections/sprint/sprintUtils.ts:20-24` (the canonical helper) so future readers can find the parallel.

2. **Fixture location.** `test/fixtures/v1-state-*.json`. Confirmed by brief-2 to be outside both `tsconfig.json` `include` and the Vite bundle — zero bytes against AC#5, zero TS gate exposure against AC#2.

3. **Replay surface.** `scripts/replay-fixtures.ts`. Manual invocation only (no CI gate yet). Prefer running via `node --experimental-strip-types scripts/replay-fixtures.ts` if Node ≥ 22.6 is available; otherwise install `tsx` as a one-line dev dep and run `npx tsx scripts/replay-fixtures.ts`. Document the invocation at the top of the script. Either invocation path is acceptable.

4. **Bundle-size baseline.** Capture before any edits (`git stash || true; npm run build; <record>; git stash pop || true`) — or in our case, capture from `main` HEAD which is currently clean. Record baseline and post-merge sizes in the rect commit body.

5. **Invalid-`state` handling.** brief-2's defensive guard wins: treat any value that is not one of the three exact strings (`"draft"`, `"active"`, `"closed"`) as "apply the heuristic." Don't narrow to `=== undefined`. Silent correction, no console warning — matches the existing `closedAt` backfill's silent-fix posture.

---

## Open questions still pending implementer judgment (max 5)

1. **Does `tsx` get installed as a devDep?** Depends on local Node version. If Node ≥ 22.6 supports `--experimental-strip-types` cleanly, skip the install. Otherwise add `tsx` with the justification "runs the replay-fixtures script without a full test-runner footprint; devDep only; no runtime bundle impact." Either choice is fine; document in the commit body.
2. **Should the replay script also assert that `Todo.parentId` and `Todo.targetDate` are correctly typed `undefined` when absent?** Probably yes (a one-line `assert(todo.parentId === undefined)` per fixture), since AC#1 is about field shape and AC#4 is the only enforcement surface.
3. **Commit scope.** `storage` (since the normalizer lives there) or `feat`? brief-1 leans `storage`; the project conventions list both. `storage` is the right choice — this is a storage-layer schema change.
4. **Should the inline normalizer comment also reference the roadmap doc path?** Probably no — `plans/` is gitignored. Reference `src/sections/sprint/sprintUtils.ts:20-24` (the canonical `todayMidnight()` location) and the closedAt backfill above it.
5. **Should `Sprint.retroNote` and `Sprint.goal` allow empty strings, or only `undefined`?** No reader writes these in m1, so either is fine. Recommend treating empty string as "no goal/note" in m2 readers; for m1 the type accepts both. Don't add a normalizer pass for these — they only get values when a user types them, which is m2/m3.

---

## Footguns surfaced for the implementer

From CLAUDE.md and the briefs:

- Work directly on `main`. No feature branches. Push when committed and verified.
- `npm run build` must pass cleanly — full `tsc -b && vite build` under strict + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`.
- No new dependencies without one-line justification. Initial newtab chunk stays under ~200 kB; bundle gate fails CI at 220 kB.
- Never use `--no-verify` or skip GPG signing. Pre-commit hooks honored.
- Commit format: `storage(<scope>): <subject>` — imperative, ≤ 50 chars after prefix. Co-author trailer required.
- The normalizer must NOT import from `src/sections/**` — that's an upward import that breaks the existing layering. Inline the heuristic.
- AC#6 enforces that NO reader/writer of the new fields ships in m1 outside the type file and the normalizer. The implementer must self-check with the grep before commit.

---

## Synthesis status

Both briefs cleared schema validation. Disagreement on `todayMidnight()` resolved in favor of inlining. The milestone is ready to implement.

**Recommended next action:** transition to `research-complete`, then proceed to Phase 2 (Implement). The diff estimate based on the briefs is ~80-120 LOC (5 type-field additions + ~15 LOC normalizer extension + ~30 LOC replay script + 3 small JSON fixtures of ~10-30 LOC each). Well under the inline-path threshold (≤ 300 LOC, ≤ 5 files); this is an **inline implementation** done in the main session, not a delegated worktree.
