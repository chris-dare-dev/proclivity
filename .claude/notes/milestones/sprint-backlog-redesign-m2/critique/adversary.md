# Critique — sprint-backlog-redesign-m2 — adversary

**Critic:** adversary
**Commit range:** a649efa..766b7d0
**Generated:** 2026-05-13T22:50:00-04:00
**Diff stats:** 7 files changed, 1044 insertions / 28 deletions (src/ subset: 3 files, ~260 LOC)

## Verdict

SHIP-WITH-FIXES

The diff cleanly wires the m1 lifecycle into the UI: the state-machine partition is consistent, optional-property handling respects `exactOptionalPropertyTypes`, the commit is conventional and GPG-signed, and the cumulative bundle delta (+2.54 kB raw) stays well inside the +6 kB AC budget. Two HIGH issues block a clean ship — a stale `useState`-initializer bug in `StaleSprintBanner` that leaks dismissal state across sprint switches, and an unfiltered sprint picker in `TodoEditModal` that lets users assign a todo to a `closed` sprint where it then becomes invisible (closed-todo filter in `ArchivedSprintRow`). The remaining findings are MEDIUM/LOW polish; none of the new affordances has automated coverage, but the project's established discipline is manual walkthrough in the commit body, so that gap is consistent rather than novel.

## Executive summary

- [HIGH] `StaleSprintBanner.dismissed` state survives an `activeSprintId` change because the `useState` initializer only runs on mount; switching from a dismissed stale sprint to a freshly stale sprint shows it as already dismissed.
- [HIGH] `TodoEditModal` lists every sprint (including `closed` ones) in the sprint picker; assigning a todo there parks it in the archived rail where it's hidden by the existing `!t.done` filter — silent data loss.
- [MEDIUM] `closeSprint` lacks the `sp.state === "active"` guard that `startSprint` has; double-clicking the close dialog confirm on a sprint that just got closed in another tab is a (narrow) re-entry path that overwrites a previously-saved `retroNote`.
- [MEDIUM] Initial-chunk bundle is 202.16 kB raw — past the "~200 kB" guidance in `CLAUDE.md` and into the CI gate's warn band (warn ≥ 200 kB, fail ≥ 220 kB per m1 brief-1).
- [MEDIUM] Empty trimmed retro on confirm does NOT clear a previously-set `retroNote`; the conditional spread `...(trimmed ? { retroNote: trimmed } : {})` is a one-way write — only matters if the same sprint is closed twice, which is reachable only via direct state mutation, but the behavior is undocumented.
- [MEDIUM] No automated test for any of the m2 UI surfaces — Start button, Close dialog, stale banner, retro disclosure are manual-walkthrough-only.
- [LOW] `daysAgo` math in `StaleSprintBanner` mixes `Date.now()` (wall-clock) with `sprint.endsAt` (local-midnight) — produces the right number ≥99% of the time but is internally inconsistent with the banner-trigger predicate which uses `todayMidnight()`.
- [LOW] JSX nesting in the m2 task-surface gate (lines 935–1024) wraps a fragment without re-indenting the children, making the diff harder to read and the `}/>` closer ambiguous to the eye.

## Findings

### CRITICAL

(None.)

### HIGH

#### [HIGH] H1 — Stale banner dismissal leaks across sprint switches

- **File:** `src/sections/sprint/SprintManager.tsx`
- **Line:** 349-357
- **Anchor:** `function StaleSprintBanner({ sprint, onClose }`
- **What:** `StaleSprintBanner` uses `useState(() => sessionStorage.getItem(storageKey) === "1")` to seed its `dismissed` flag. The initializer runs only on the first mount. The component is mounted unconditionally inside `{isStaleSprint(activeSprint) && <StaleSprintBanner sprint={activeSprint} ... />}` — when `activeSprintId` flips via `switchSprint` and the new active sprint is *also* stale, React reconciles by element type and reuses the same component instance with new props. The `storageKey` recomputes (it's a const inside the function body) but `dismissed` retains the previous sprint's value.
- **Why it matters:** A user who dismissed the banner on sprint A then switches to sprint B (also stale, never dismissed) sees no banner — silently dropping the nudge for B. Conversely, if B was dismissed in a previous session and A was not, switching A→B will keep A's `false` and ignore B's persisted `"1"` in sessionStorage. The bug is observable on day 1.
- **Proposed fix:** Force a remount on sprint id change by passing a `key`. Change the call site at line 904-909 to `<StaleSprintBanner key={activeSprint.id} sprint={activeSprint} onClose={...} />`. Alternative: convert `dismissed` to a derived value via `useSyncExternalStore` over `sessionStorage`, or compute it on every render with a `useEffect` that resets state when `sprint.id` changes. The `key` approach is cheapest and matches React's idiomatic "remount on identity change."
- **Regression-guard:** Manual reproduction step in the commit body — open two stale sprints, dismiss on A, switch tab to B, observe whether banner shows. Document this in the next manual walkthrough section. (No vitest harness exists in the project.)
- **Source critic:** adversary
- **Source axis:** G. Banner rendering during sprint switch

#### [HIGH] H2 — TodoEditModal allows assigning a todo to a closed sprint

- **File:** `src/components/TodoEditModal.tsx`
- **Line:** 151
- **Anchor:** `                {sprints.map((s) => (`
- **What:** `SprintManager` passes its full `sprints` array (live + closed) to `TodoEditModal` (`sprints={sprints}` at SprintManager.tsx:1051). The modal renders every entry in the picker `<select>` with no `state` filter. After m2, a "closed" sprint is no longer self-evident from `endsAt < today` (closed sprints can be any date), so a user can re-assign a todo to a closed sprint without warning. The todo then lands in that sprint's `ArchivedSprintRow`, which filters to `!t.done` — so an active (`done: false`) todo IS visible there, but only inside the archived disclosure that the user is unlikely to open.
- **Why it matters:** This is a silent UX trap unique to m2: pre-m2 the same code path existed but the picker was implicitly bounded by "the date heuristic kept old sprints from looking pickable" — that bound is now gone. A user who edits an old todo and picks a closed sprint by mistake will have the todo vanish from every visible surface until they hunt for it inside the archived disclosure for that specific sprint. The risk is amplified by the `<select>` showing only `s.name`, no date, no state badge.
- **Proposed fix:** Filter the picker options in `TodoEditModal` to `sprints.filter(s => s.state !== "closed")`. Optionally include the current sprintId even if closed (so an existing assignment can be preserved without forcing a move). One-line patch: `{sprints.filter(s => s.state !== "closed" || s.id === todo.sprintId).map(...)`. As a stretch, also disable the option visually when sprint is `"draft"` or show a `(draft)` / `(closed)` suffix on the label so users see the lifecycle when picking.
- **Regression-guard:** Manual walkthrough step — create a closed sprint, edit a long-term todo, change scope to "sprint", verify closed sprint is not in the picker.
- **Source critic:** adversary
- **Source axis:** B. Lifecycle state machine correctness (Edit-dialog bypass)

### MEDIUM

#### [MEDIUM] M1 — Initial newtab chunk 202.16 kB exceeds ~200 kB target

- **File:** `CLAUDE.md`
- **Line:** 64 (the "Initial newtab chunk should stay under ~200 kB" rule)
- **Anchor:** `  initial newtab chunk should stay under ~200 kB`
- **What:** Post-m2 raw size of the initial chunk is 202.16 kB. CLAUDE.md says "should stay under ~200 kB" and m1 brief-1 establishes the CI bundle gate as warn ≥ 200 kB, fail ≥ 220 kB. The diff is within the milestone's local +6 kB AC budget but lands the cumulative size in the warn band.
- **Why it matters:** The CI gate (added in m1 per brief-1's hand-off) will start warning on every build until the chunk is trimmed. Future feature work (m3 sprint.goal display, e3 carryover dialog, e5 cross-scope linkage) only piles on. Crossing 220 kB before m3 lands is a realistic risk.
- **Proposed fix:** Two cheap candidates: (a) lazy-import `ConfirmDialog`'s close-sprint instantiation — though it's the same component used for delete, so this saves nothing. (b) Inline the stale-banner trigger as a hook rather than a separate component to skip the `useState` overhead — saves bytes but is a refactor. (c) Most pragmatic: defer to the m3 budget audit. Acknowledge the breach in the rectification artifact and either bump the soft target in CLAUDE.md (200 → 210) with explicit reasoning or block m3 on a CSS-prune pass first. Do NOT silently leave 202 kB sitting against a "≤200 kB" rule.
- **Regression-guard:** GitHub Actions bundle-budget job from m1 — confirm it currently warns and is not configured to auto-pass at 202 kB.
- **Source critic:** adversary
- **Source axis:** 11/13. Doc drift + Bundle bloat

#### [MEDIUM] M2 — `closeSprint` overwrites retroNote with no state guard

- **File:** `src/sections/sprint/SprintManager.tsx`
- **Line:** 686-702
- **Anchor:** `  const closeSprint = async () => {`
- **What:** Unlike `startSprint` (line 671-676 — guards on `sp.state === "draft"`), `closeSprint` unconditionally writes `state: "closed"` and spreads the trimmed retro into the matched sprint. If the active sprint is already `"closed"` (e.g. closed in another window, sync arrives mid-dialog), confirming the dialog rewrites `state: "closed"` and conditionally overwrites `retroNote`. The double-write is harmless for `state` but destructive for a pre-existing retroNote when the user confirms with an empty draft.
- **Why it matters:** Reachable narrowly via multi-tab use (this extension supports it — `chrome.storage.local` syncs across newtab pages). Tab A opens the close dialog, tab B closes the sprint with retro "shipped on time"; tab A user types nothing, hits confirm; tab A's empty-string condition fails the spread, but it ALSO writes `state: "closed"` — no harm. However: if tab A user types a *different* retro and confirms, they'll silently overwrite tab B's note. Same class as a lost-update race.
- **Proposed fix:** Either (a) match the `startSprint` guard pattern: only mutate when `sp.state === "active"`, leave closed sprints untouched; or (b) accept the last-writer-wins behavior and add a comment documenting it. (a) is cheaper and consistent.
- **Regression-guard:** None automated. Add a comment in the rectification commit body referencing the multi-tab risk.
- **Source critic:** adversary
- **Source axis:** B. Lifecycle state machine correctness

#### [MEDIUM] M3 — Empty retro cannot clear an existing retroNote

- **File:** `src/sections/sprint/SprintManager.tsx`
- **Line:** 696
- **Anchor:** `              ...(trimmed ? { retroNote: trimmed } : {}),`
- **What:** Conditional spread persists `retroNote` only when `trimmed` is non-empty. Combined with M2 above: if a sprint has `retroNote: "v1"` (set in a previous close) and the user re-opens the close dialog and confirms with empty retro, the existing `"v1"` stays.
- **Why it matters:** The brief is ambiguous about whether empty-retro-on-reopen should clear. The current behavior is "preserve unless explicitly overwritten with new non-empty text." It's defensible but undocumented in the code. Combined with M2's guard absence, this is the only way to clear a retro: open the close dialog (works because the button is gated on `state !== "draft"`, not `state === "active"`... actually wait — header line 280-288 shows close-btn for all non-draft, but closed sprints never render the active header at all because they're filtered into `archivedSprints`. So this path is dead via UI; only reachable via storage mutation).
- **Proposed fix:** Either codify the "no clearing" rule with a comment, or change to `retroNote: trimmed || undefined` so empty explicitly clears. Pick one and add a one-line code comment. Given the path is UI-unreachable in practice, "no clearing + comment" is fine.
- **Regression-guard:** None needed (UI-unreachable).
- **Source critic:** adversary
- **Source axis:** F. closeSprint retro persistence

#### [MEDIUM] M4 — No automated coverage for any m2 UI behavior

- **File:** `src/sections/sprint/SprintManager.tsx`
- **Line:** 667-702
- **Anchor:** `  const startSprint = async () => {`
- **What:** `startSprint`, `closeSprint`, `isStaleSprint`, `StaleSprintBanner`, the close-dialog retro flow, and the task-surface gating on `state === "active"` have zero automated coverage. The project has no vitest/jest harness; the existing test surface is `scripts/replay-fixtures.ts` which covers the m1 normalizer only. The commit relies on the manual walkthrough in its body (AC#8).
- **Why it matters:** Each of these new code paths has a defect class the manual walkthrough doesn't catch: H1 (multi-sprint dismissal leak) requires switching active sprints with the banner already dismissed — unlikely to come up in a single walkthrough. H2 (closed-sprint reassignment) requires editing an old todo and picking a closed sprint — out of the walkthrough's happy-path scope.
- **Proposed fix:** Two options. (1) Accept the established manual-walkthrough pattern and explicitly enumerate the dismissal-leak and reassignment edge cases in the m2 walkthrough section of the next rectification commit. (2) Introduce a thin `@testing-library/react` harness in m3 — out of m2 scope, so flag and move on. Recommendation: option (1) for m2, raise (2) as an m3 prereq if it isn't already in the roadmap.
- **Regression-guard:** Add manual walkthrough steps 12-13 covering H1 and H2 paths in the rectification artifact.
- **Source critic:** adversary
- **Source axis:** 10. Test discipline

### LOW

#### [LOW] L1 — daysAgo math mixes wall-clock with local-midnight

- **File:** `src/sections/sprint/SprintManager.tsx`
- **Line:** 361-364
- **Anchor:** `  const daysAgo = Math.max(`
- **What:** The trigger predicate at line 341 is `sprint.endsAt < todayMidnight() - 86_400_000` (both sides midnight-aligned), but the display computation at 361-364 is `Math.floor((Date.now() - sprint.endsAt) / 86_400_000)` — wall-clock minus midnight. The display can read one day larger than the predicate would suggest, because `Date.now() ≥ todayMidnight()`.
- **Why it matters:** At, say, 11:30 PM on day D, with `endsAt = D-2 midnight`: predicate uses D-midnight − 1 day = D-1 midnight; D-2 < D-1 → triggers. Display: `(D 23:30 − (D-2) 00:00) / 86_400_000 = 2.98 → floor = 2`. So "2 days ago" — internally consistent. At 12:01 AM on day D: predicate uses D-midnight − 1 day = D-1 midnight; D-2 < D-1 → triggers. Display: `(D 00:01 − (D-2) 00:00) / 86_400_000 = 2.00 → floor = 2`. Still consistent. The drift mostly cancels via `Math.max(1, ...)`. Worst case: a sprint that ends EXACTLY `86_400_001` ms before today's midnight will display "1 day ago" — correct. Nothing user-visible is wrong, but the two units (midnight vs wall-clock) make audit harder.
- **Proposed fix:** Use `todayMidnight()` in the display math: `Math.max(1, Math.floor((todayMidnight() - sprint.endsAt) / 86_400_000))`. Same result in practice, but symbolic of the underlying calendar-day semantics.
- **Regression-guard:** Not needed.
- **Source critic:** adversary
- **Source axis:** E. Stale-sprint banner edge cases

#### [LOW] L2 — Nested fragment without re-indentation hurts diff readability

- **File:** `src/sections/sprint/SprintManager.tsx`
- **Line:** 935-1024
- **Anchor:** `          {activeSprint.state === "active" && (`
- **What:** The new outer `{activeSprint.state === "active" && (<>...</>)}` wraps ~90 lines of existing JSX, but the wrapped children keep their previous indentation. The fragment's closing `</>` + `)` sits at the same indent as the children, making it hard to scan the conditional boundary.
- **Why it matters:** Future churn risk. Anyone touching the inner task surface will misread the conditional's scope and produce a worse diff next time.
- **Proposed fix:** Re-indent the wrapped block by 2 spaces, or extract the inner JSX into a `<DraftSprintTaskSurface>` / `<ActiveSprintTaskSurface>` component. Re-indentation alone is the minimum.
- **Regression-guard:** Not needed.
- **Source critic:** adversary
- **Source axis:** I. Diff size and review-quality

#### [LOW] L3 — `<details>` retro disclosure lacks an explicit summary id for AT context

- **File:** `src/sections/sprint/SprintManager.tsx`
- **Line:** 443-448
- **Anchor:** `          {sprint.retroNote && (`
- **What:** The `<details><summary>Retro note</summary><p>…</p></details>` uses the native browser semantics, which is fine, but the `<summary>` text "Retro note" is generic across all archived rows. A screen-reader user navigating by disclosure widgets hears "Retro note … Retro note … Retro note" with no sprint context.
- **Why it matters:** Minor a11y polish; the sprint name is already announced by the parent button's `aria-label` so contextual location is recoverable. The issue is rotor-navigation when jumping by `<details>` element.
- **Proposed fix:** Either include the sprint name in the summary text (`Retro note — {sprint.name}`) or add `aria-label={`Retro note for ${sprint.name}`}` on the `<details>`.
- **Regression-guard:** Not needed.
- **Source critic:** adversary
- **Source axis:** J. Accessibility

## What was done well

- Conventional commit `feat(sprint): explicit lifecycle (draft/active/closed) + stale banner (m2)` parses cleanly under the project's `^(feat|fix|...): .{1,50}` rule and is GPG-signed by the user's key.
- Optional-property handling for `retroNote` uses the spread pattern `...(trimmed ? { retroNote: trimmed } : {})`, which correctly satisfies `exactOptionalPropertyTypes: true` — no `retroNote: undefined` literal that would have failed strict mode.
- `startSprint` is properly idempotent — the `sp.state === "draft"` guard prevents double-flip on a fast double-click. Apply the same pattern to `closeSprint` (see M2).
- `sessionStorage.getItem` and `sessionStorage.setItem` calls in `StaleSprintBanner` are both wrapped in try/catch, correctly handling private-browsing storage exceptions on both read and write sides.
- The stale-banner trigger predicate is correctly mounted under `mode === "view"` so it doesn't render alongside the edit form — avoids competing focus targets.
- Task-surface gating on `state === "active"` (line 935) correctly excludes both draft AND closed sprints from the task input/list, even though closed sprints already wouldn't reach this branch via `isArchived`. Belt-and-suspenders pattern.
- Bundle delta (+2.54 kB raw) is well within the milestone's +6 kB AC budget. The CSS additions are reasonable for the affordances introduced — no obvious bloat.
- `isArchived` rewrite is a single-line change with a thorough docstring explaining the semantic shift and pointing at the m1 normalizer for legacy data continuity.
- The retroNote disclosure correctly uses native `<details>`/`<summary>` rather than reimplementing collapse with role/aria — better a11y baseline.
- `closeSprint` resets `retroDraft` to `""` after the update, and the dialog's `onClose` also resets it, so there's no stale retro draft leaking between sprints — the cleanup is redundant-but-correct.
- The diff strictly avoids new npm dependencies and stays purely UI — no server calls, no telemetry, no IndexedDB drift, fully consistent with the local-only stance in CLAUDE.md.

## Recommended rectification order

H1, H2, M2, M3, M1, M4, L1, L2, L3
