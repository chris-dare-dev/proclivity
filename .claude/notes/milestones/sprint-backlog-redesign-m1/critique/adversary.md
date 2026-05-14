# Critique — sprint-backlog-redesign-m1 — adversary

**Critic:** adversary
**Commit range:** 70ab9d1..4b35ddb
**Generated:** 2026-05-14T02:35:00Z
**Diff stats:** 11 files, 925 insertions / 3 deletions (productive code+test under `src/`, `scripts/`, `test/`: 335 insertions / 3 deletions; remainder is `.claude/notes/**` documentation)

## Verdict

SHIP-WITH-FIXES. The schema-foundation slice is small, GPG-signed on `main`, builds clean under strict TS, exercises AC#6 correctly, and the manual replay script actually runs (`npx tsx scripts/replay-fixtures.ts` → `3/3 fixtures normalize cleanly`). The defects are localized: the replay assertions never pin down the directional behaviour of the new heuristic (an `endsAt`-blind regression that always returned `"active"` would pass), the export/import path was not extended to backfill `Sprint.state`, and the commit subject uses a non-standard `type(scope)` form that the project has never used before. None of these are production-breaking on their own, but the test gap is the kind of thing m2 will paper over and the import gap will surface the first time a user restores a v1 backup.

## Executive summary

- [HIGH] Replay script never asserts that `"closed"` and `"active"` are produced in the *correct directions* — a bug where the heuristic always returns `"active"` (or is inverted) would pass `3/3 fixtures normalize cleanly`.
- [HIGH] `src/storage/exportImport.ts:199` writes raw imported v1 state via `storage.set` without backfilling `Sprint.state`; the on-disk shape briefly violates the new required field until the next `get()`/`subscribe()` event, and any direct `chrome.storage.local.get` consumer (service worker, debug tools) sees `state: undefined` against a type that says it is non-optional.
- [MEDIUM] Replay script does not include a fixture (or a synthetic case) where `state` is set to a non-literal garbage value; the defensive guard at `storage.ts:92` is unverified — a future refactor that swaps it for `typeof v2.state === "string"` would not be caught.
- [MEDIUM] Commit subject `storage(sprint): land schema v2 fields and normalizer (m1)` invents a `storage(<scope>):` prefix that has never appeared in this repo (`git log` shows only `feat(storage)`, `fix(storage)`, `refactor(storage)`) and `storage` is not in the user-level CLAUDE.md type regex `feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert`.
- [MEDIUM] `localMidnight()` is duplicated (intentionally) but the storage copy now drifts independently from `sprintUtils.todayMidnight()` with no test pinning behavioural parity; a future fix to one definition can silently diverge from the other.
- [LOW] `normalizeState` is now part of the public surface of `storage.ts`; nothing technically prevents future call sites from invoking it directly and bypassing the write chain.
- [LOW] AC#5 reports the bundle delta as `+0.24 kB raw / +0.07 kB gzip` but the AC text never specifies whether the +2 kB ceiling is raw or gzip; both are well under either reading, so it's clarification rather than violation.
- [LOW] `scripts/replay-fixtures.ts:13` documents `node --experimental-strip-types` as an alternative invocation path, but the implement synthesis itself notes this path does not work because of the `@/` alias; the script comment misleads future readers.

## Findings

### CRITICAL

(None. The diff is GPG-signed, on `main`, with no external writes, no new prod deps, no telemetry, no IndexedDB, and AC#6 holds.)

### HIGH

#### [HIGH] H1 — Replay script does not pin directional correctness of the heuristic

- **File:** `scripts/replay-fixtures.ts`
- **Line:** 44-51
- **Anchor:** `function checkSprintStates(after: ProclivityState)`
- **What:** The only sprint-state assertion (`checkSprintStates`) verifies that every sprint ends up with a literal from `{"draft","active","closed"}`. It never checks that `v1-state-mixed.json`'s expired sprint (`sprint-expired`, `endsAt: 1700000000000`) is mapped to `"closed"` or that the future sprint (`sprint-future`, `endsAt: 5000000000000`) is mapped to `"active"`.
- **Why it matters:** This is the only test surface for AC#3 (the legacy heuristic). A regression that inverts the comparison (`endsAt > midnight ? "closed" : "active"`) or always returns one literal (`"active"`) would still pass `3/3 fixtures normalize cleanly`. The whole point of capturing fixtures was to pin this behaviour, and the assertions don't.
- **Proposed fix:** Extend `v1-state-mixed.json` (or the script's per-fixture expectations) with an explicit expectation map keyed by sprint id, e.g. `{ "sprint-expired": "closed", "sprint-future": "active" }`, and add a `checkExpectedStates(after, expected)` call before `checkSprintStates`. One-line patch in the script + a `__expected` key in the JSON or an inline `EXPECTED` constant in the script.
- **Regression-guard:** The proposed `checkExpectedStates` assertion is itself the regression guard.
- **Source critic:** adversary
- **Source axis:** 10. Test discipline / E. Manual replay script

#### [HIGH] H2 — Import path does not backfill `Sprint.state`

- **File:** `src/storage/exportImport.ts`
- **Line:** 199
- **Anchor:** `  await storage.set(merged);`
- **What:** `importBackup` manually backfills `closedAt`, `tags`, and `closedFromSprintId` on todos/reminders before calling `storage.set(merged)`, but does not touch `merged.sprints`. After importing a v1 backup, the persisted `chrome.storage.local` payload contains sprints with no `state` field — yet `Sprint.state` is declared as a required, non-optional union literal in `src/types/index.ts:103`.
- **Why it matters:** Three failure modes follow. (1) Any consumer that reads `chrome.storage.local` directly (the service worker at `src/background/service-worker.ts`, future debug tooling, or a chained `storage.set` that round-trips data without going through `get()`) sees `state: undefined` against a type that promises a literal. (2) The next `storage.set` from React state — which itself may have already been normalised — will overwrite, but for the brief window between import and the next `update()`, the type system is lying. (3) `storage.set` in `update()` writes the React-side value: if any new code path constructs a Sprint object without explicitly including `state`, the import path is the easiest place for that drift to land first.
- **Proposed fix:** Either (a) call `normalizeState(merged)` once just before `storage.set(merged)` in `importBackup`, replacing the duplicated todo/reminder backfill bodies with a single normalisation pass, or (b) add an inline `merged.sprints = merged.sprints.map(...)` block that mirrors `storage.ts:87-97`. (a) is the right long-term shape — the whole reason `normalizeState` was exported was to centralise this logic. The replay script already validates it.
- **Regression-guard:** A fixture-replay assertion that runs `importBackup`'s post-merge shape through a strict-schema validator and rejects sprints without `state`. Cheaper alternative: a one-shot manual test — import `v1-state-mixed.json` via the Settings → Import flow, then `chrome.storage.local.get` and assert every sprint has `state`.
- **Source critic:** adversary
- **Source axis:** C. Normalizer correctness

### MEDIUM

#### [MEDIUM] M1 — Defensive guard at `storage.ts:92` is unverified

- **File:** `scripts/replay-fixtures.ts`
- **Line:** 30-34
- **Anchor:** `const fixtures = [`
- **What:** All three fixtures omit the `state` field entirely on legacy sprints (they were captured pre-v2). None of them carry a sprint with `state: "garbage"`, `state: null`, or any non-literal value. The defensive branch at `src/storage/storage.ts:92` (`if (v2.state === "draft" || v2.state === "active" || v2.state === "closed")`) has zero coverage for the "invalid literal" case.
- **Why it matters:** The whole reason brief-2 argued for the strict-literal guard (vs. `state === undefined`) was to absorb corrupted writes from future code paths. A refactor that loosens this to `typeof v2.state === "string"` or `v2.state != null` would silently let invalid literals through, and the script would report PASS.
- **Proposed fix:** Add a fourth fixture `v1-state-corrupted.json` with a sprint carrying `"state": "ARCHIVED"` and an assertion that the script normalises it to one of the three valid literals (`"closed"` per the heuristic, since the fixture's `endsAt` is in the past). One ~30-line JSON file, one line in the `fixtures` array.
- **Regression-guard:** The fourth fixture is itself the regression guard.
- **Source critic:** adversary
- **Source axis:** C. Normalizer correctness / 10. Test discipline

#### [MEDIUM] M2 — Commit subject uses non-standard `storage(<scope>):` prefix

- **File:** `(commit metadata)`
- **Line:** N/A
- **Anchor:** `storage(sprint): land schema v2 fields and norm`
- **What:** `git log --all` shows `feat(storage)`, `fix(storage)`, `refactor(storage)` for prior storage-layer work; this is the first commit to use `storage` as a top-level type. The user-level CLAUDE.md commit regex is `^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert): .{1,50}`. `storage` is not in that list. The project CLAUDE.md is ambiguous (it conflates types and scopes in one list), but the historical practice is unambiguous.
- **Why it matters:** Doc drift / convention drift. No pre-commit hook is installed today, so nothing rejected the commit, but if Chris ever adds `commitlint` or a regex hook the next time this happens it will fail. More immediately, anyone scanning `git log --oneline` for a "feat" or "refactor" will miss this commit.
- **Proposed fix:** Land subsequent milestone commits as `refactor(storage): <subject>` or `feat(sprint): <subject>` to match the existing pattern. Don't rewrite the published commit — the rule "Never use `--amend` on a commit that has been pushed" applies. Update the milestone-pipeline synthesis template (or wherever `storage(<scope>):` came from) to follow conventional types.
- **Source critic:** adversary
- **Source axis:** 9. Conventional commit + GPG signing / 11. Doc drift

#### [MEDIUM] M3 — `localMidnight()` duplication has no parity guard

- **File:** `src/storage/storage.ts`
- **Line:** 39-43
- **Anchor:** `function localMidnight(): number {`
- **What:** The inlined helper mirrors `src/sections/sprint/sprintUtils.ts:20-24:todayMidnight()` by hand. The docblock instructs future readers to "keep the two definitions behaviorally identical," but nothing enforces it — the replay script never compares them, and the two files have no shared import.
- **Why it matters:** If someone changes `todayMidnight()` (e.g. to add timezone-explicit logic) and forgets to mirror the change here, the normaliser silently diverges from `isArchived()`. The heuristic comment in `normalizeState()` then becomes a lie.
- **Proposed fix:** Either (a) extract both into a layering-safe location (e.g. `src/storage/time.ts` and import from `sprintUtils.ts` instead of the other way around — sections importing from storage is fine), or (b) add a one-line assertion at the top of `scripts/replay-fixtures.ts` that runs both helpers and asserts equality (`assert(localMidnight() === todayMidnight())`). (b) is cheaper and matches the existing manual-replay posture. The "no upward import from sections" rule still holds because storage owns the canonical copy.
- **Regression-guard:** The parity assertion in the replay script is itself the guard.
- **Source critic:** adversary
- **Source axis:** C. Normalizer correctness

### LOW

#### [LOW] L1 — `normalizeState` export widens the public surface of `storage.ts`

- **File:** `src/storage/storage.ts`
- **Line:** 73
- **Anchor:** `export function normalizeState(raw: ProclivityState)`
- **What:** Making `normalizeState` a top-level export means any module under `src/` can import and call it. There's no `_internalForTesting` namespace, no docblock telling callers "do not import this directly," and nothing prevents a well-meaning future change from short-circuiting the write chain by reading `chrome.storage.local` raw and normalising in-place.
- **Why it matters:** Low risk today — only `scripts/replay-fixtures.ts` imports it, which is the intended use. But the surface is now wider than necessary for test-only code.
- **Proposed fix:** Add a JSDoc `@internal` or a comment block above the export, e.g. `// Exported for scripts/replay-fixtures.ts only. Production code paths should go through storage.get() / storage.subscribe().` Optionally, re-export under an `_internal` namespace from a deeper `src/storage/internal.ts`. The comment alone is enough for m1.
- **Source critic:** adversary
- **Source axis:** F. `normalizeState` export

#### [LOW] L2 — `scripts/replay-fixtures.ts:13` documents a node invocation that doesn't work

- **File:** `scripts/replay-fixtures.ts`
- **Line:** 13
- **Anchor:** `*   node --experimental-strip-types scripts/replay`
- **What:** The script header advertises `node --experimental-strip-types scripts/replay-fixtures.ts` as a working alternative to `npx tsx`. The implement synthesis itself notes that this path fails because Node's native strip-types does not resolve the `@/` tsconfig path alias used transitively via `../src/storage/storage` → `@/observability/logger`.
- **Why it matters:** A future reader follows the documented path, gets an opaque module-resolution error, and concludes the script is broken.
- **Proposed fix:** Delete the `node --experimental-strip-types` line in the script header, or annotate it `(does not work — `@/` alias not resolved by native strip-types; use the tsx path)`. One-line edit.
- **Source critic:** adversary
- **Source axis:** E. Manual replay script

#### [LOW] L3 — AC#5 budget unit (raw vs gzip) is unspecified

- **File:** `plans/sprint-backlog-redesign-roadmap.md`
- **Line:** AC#5
- **Anchor:** `Initial newtab chunk size delta from the baseline`
- **What:** AC#5 says "≤ +2 kB" but does not specify raw or gzip. The commit body reports both (`+0.24 kB raw / +0.07 kB gzip`), so this milestone is unambiguously fine, but future milestones with tighter deltas could litigate the reading.
- **Why it matters:** Doc clarity. Not a defect in m1.
- **Proposed fix:** Clarify in the roadmap that the budget is measured in raw kB on `dist/assets/index.html-*.js` (the initial newtab chunk reported by Vite), or in gzip — pick one and pin it.
- **Source critic:** adversary
- **Source axis:** 13. Bundle bloat / 11. Doc drift

## What was done well

- Diff is small (335 productive LOC), well-scoped to types + normaliser + fixtures + manual replay; the implementer correctly chose inline over delegated, in line with brief-2 §3.
- Commit is GPG-signed (`gpg: Good signature from "Chris Dare ..."`) and landed directly on `main` per the project's "no feature branches" rule.
- No external writes introduced. No new prod dependencies. No telemetry. No IndexedDB / server-sync drift. CLAUDE.md "What agents must not do" list cleared.
- AC#6 grep is correctly satisfied: every hit outside `src/types/index.ts` and `src/storage/storage.ts` (the `gantt/*` `parentId` and the `App.tsx` `"closed"` tab id) is verifiable as pre-existing in `git show 70ab9d1`. The implementer was careful to set `state: "active"` (not in the grep pattern) in `SprintManager.createSprint` to keep AC#6 clean — and called this out in the source comment.
- The defensive `state` guard at `storage.ts:92` matches brief-2's stricter recommendation: three-literal exact match rather than `=== undefined`, absorbing corrupted writes from future code paths.
- The cast `s as Sprint & { state?: unknown }` is the minimum widening needed to make the runtime literal-checks well-typed under `strict + exactOptionalPropertyTypes` — it does real work rather than being a stale no-op.
- The inlined `localMidnight()` helper avoids the upward `storage → sections/**` import that brief-1 wanted, preserving the existing layering discipline, with a docblock that points future readers to the canonical copy.
- The commit body is unusually thorough: it lists every file touched, records baseline and post-edit bundle sizes (`199.62 kB → 199.86 kB raw / 63.12 kB → 63.19 kB gzip`), and explicitly resolves all three inline spikes (spike-1 strict TS, spike-2 replay, spike-3 bundle budget).
- `npm run build` passes cleanly under `strict: true + exactOptionalPropertyTypes: true + noUncheckedIndexedAccess: true`; the new required `Sprint.state` was wired through every Sprint constructor site (only one new one in `SprintManager.createSprint`) without breaking existing spreads.
- Axes 2–8 and 12 of the default rubric (Velite, MDX, Next.js, Pulumi, LFS, Tailwind, App Router) are inapplicable to this Chrome-extension project; no time spent litigating them.

## Recommended rectification order

H1, H2, M1, M3, M2, L2, L1, L3
