# Critique — frontend-uplift-2026q2-m4 — milestone-web-perf-critic

**Critic:** milestone-web-perf-critic
**Commit range:** d22031e..64fb75b
**Generated:** 2026-05-20T22:09:32Z
**Diff stats:** 3 files changed (src/newtab/App.tsx, src/newtab/App.css, src/types/react-augment.d.ts), +168/-7

---

## Verdict

SHIP

The implementation is architecturally correct and all load-bearing details are right. `useLayoutEffect` is used (not `useEffect`), `animation-fill-mode: both` is present on the incoming keyframe, `inert` is set via `true | undefined` (not `true | false`), dual reduced-motion guards cover both rules, and the `:not([data-staggered])` carve-out prevents double-fade on Today/Sprint/LongTerm. The chunk grows by 0.93 kB (235.47 kB total, well under the 400 kB soft warn). The two findings below — a documented v0 height-floor trade-off and a milestones-wide test-debt carry-over — do not block shipping.

---

## Executive summary

- [MEDIUM] M1: Height jump (CLS) when leaving panel goes `position: absolute` at t=0. Worst realistic case: Gantt→Calendar. The existing `min-height: 400px` floor bounds the collapse; synthesis §3.6 explicitly accepts this for v0. The grid-stacking alternative (all children in `grid-area: 1/1`) is the correct v1 path.
- [MEDIUM] M2: Zero test delta (m1 L5 carry-over). No test infrastructure exists yet. The visual FOUC regression and Tab-escape regression cannot currently be caught by automated CI.
- [LOW] L1: Settings-driven tab change (`sectionVisibility=false` while on gated tab) leaves `leavingTab` tracking a panel that the conditional render has simultaneously unmounted. Harmless — the timeout fires at 250 ms and the functional updater clears correctly — but slightly untidy.
- [LOW] L2: `react-augment.d.ts` delete-on-React-19-upgrade note exists in the file but is not tracked in any tech-debt registry. Low friction risk of persisting past the React 19 upgrade.
- Bundle axis: 235.47 kB initial chunk (+0.93 kB from m5 baseline 234.54). Under 400 kB soft warn and 500 kB hard ceiling. No new npm dependencies.
- Lazy-import discipline: no changes to eager imports. `three.js`/`@react-three/fiber` remain lazy-loaded.
- chrome.storage / useStore invariant: no persistence changes in this diff.
- MV3 service worker lifecycle: no service-worker changes.

---

## Findings

### CRITICAL

(none)

---

### HIGH

(none)

---

### MEDIUM

#### [MEDIUM] M1 — Height jump at t=0 when leaving panel exits normal flow

- **File:** `src/newtab/App.css`
- **Line:** 151–157
- **Anchor:** `.content > [data-leaving="true"] {`
- **What:** When `data-leaving` is set, the leaving panel becomes `position: absolute; inset: 0`, removing it from normal flow. At that same instant (synchronous with the React commit, before first paint), `.content` collapses from the leaving panel's height to the incoming panel's intrinsic height. The existing `min-height: 400px` floor bounds this collapse to the floor value, but if the incoming panel is shorter than 400 px the height jumps instantly from `leaving_height` to `max(incoming_height, 400px)`.
- **Why it matters:** On Gantt→Calendar (or any tall→short switch), the `.content` area collapses by potentially hundreds of pixels in a single frame, producing a measurable CLS score and a visible layout snap for users with content above the fold.
- **Proposed fix (v1):** Replace `position: relative` on `.content` with `display: grid` and add `grid-area: 1 / 1` to both the leaving and incoming panel divs so both occupy the same grid cell. The grid row height follows the taller of the two children automatically, eliminating the collapse. This is brief-2 §3.4 Pattern 2 and synthesis §3.6's "cleaner long-term path." The v0 `min-height: 400px` floor is an acceptable interim mitigation.
- **Regression-guard:** Add a visual-regression snapshot (Playwright or Storybook Chromatic) for a Gantt→Calendar tab switch. Assert that `.content` height does not change by more than X px in the first animation frame. (No test infrastructure exists today — M2 is the gating blocker.)
- **Source critic:** milestone-web-perf-critic
- **Source axis:** Web Axis 7 — Layout shift (CLS)

---

#### [MEDIUM] M2 — Zero test delta across a behavioral animation milestone

- **File:** `src/newtab/App.tsx` (overall)
- **Line:** (entire diff)
- **Anchor:** `useLayoutEffect(() => {`
- **What:** No tests were added or modified for this milestone. The two riskiest behaviors — (a) FOUC if `animation-fill-mode: both` is accidentally removed, and (b) Tab-key escape into the leaving panel if `inert` is accidentally removed — have no automated regression guard.
- **Why it matters:** Both behaviors are silent visual regressions. A future refactor that removes `both` from the animation shorthand or replaces `inert={...}` with `aria-hidden` would not be caught by CI or TypeScript. The project carries zero test infrastructure, making this a milestones-wide gap (m1 L5 carry-over).
- **Proposed fix:** At minimum, add a jsdom integration test that: (1) clicks a tab button, (2) asserts the leaving panel has `data-leaving="true"` AND `inert` on the DOM node within the same synchronous frame, and (3) asserts the incoming panel does NOT have either attribute. This does not require a visual regression suite — jsdom is sufficient for the attribute-presence assertions. `animation-fill-mode` can be asserted via `getComputedStyle` in a jest-environment-jsdom test.
- **Regression-guard:** `src/newtab/__tests__/App.tabpanel-cross-dissolve.test.tsx` — assert leaving panel attributes on tab click.
- **Source critic:** milestone-web-perf-critic
- **Source axis:** Web Axis 4 — useStore()/storage.ts boundary (test-gap analog for state-machine correctness)

---

### LOW

#### [LOW] L1 — Stale `leavingTab` reference when sectionVisibility unmounts the leaving panel

- **File:** `src/newtab/App.tsx`
- **Line:** 414–420 (sectionVisibility useEffect) + 378–400 (leavingTab useLayoutEffect)
- **Anchor:** `if (isVisibilityGated(tab) && !rs.sectionV`
- **What:** When the user hides the currently-active tab via Settings (e.g. today is active, user turns off `sectionVisibility.today`), the `useEffect` fires and calls `setTab(firstVisible)`. This triggers the `useLayoutEffect`, which sets `leavingTab="today"`. But the conditional render `{rs.sectionVisibility.today && (<div ...>)}` returns `null` — the today tabpanel div is unmounted. `leavingTab` now references a panel that does not exist in the DOM for 250 ms.
- **Why it matters:** No visual artifact occurs (unmounted panel = nothing to fade), and the 250 ms timeout clears correctly via the functional updater. However the state is semantically inconsistent: `leavingTab !== null` but the corresponding DOM node does not exist. This could confuse future debugging.
- **Proposed fix:** In the `leavingTab` useLayoutEffect, add a guard: after `setLeavingTab(prev)`, also check whether the incoming tab's panel is going to be rendered (e.g. via `visibleTabs.some(t => t.id === tab)`) and skip setting `leavingTab` if the leaving panel will not be in the DOM. Alternatively, clear `leavingTab` in the same `useEffect` that calls `setTab(firstVisible)` by also calling `setLeavingTab(null)` before the tab change settles. Low-priority.
- **Source critic:** milestone-web-perf-critic
- **Source axis:** Web Axis 3 — MV3 service worker lifecycle (state-machine edge-case analog)

---

#### [LOW] L2 — `react-augment.d.ts` delete-on-upgrade note is file-only, not tracked

- **File:** `src/types/react-augment.d.ts`
- **Line:** 7–8
- **Anchor:** `* React 19+'s types include it natively; this augm`
- **What:** The file contains a clear delete-on-React-19-upgrade instruction in its JSDoc, but this is only discoverable by reading the file. There is no ticket, CLAUDE.md note, or tech-debt tracker entry linking the React 19 upgrade to this deletion.
- **Why it matters:** If the React 19 upgrade lands without consulting this file, the augmentation persists harmlessly (React 19 includes `inert` natively in `@types/react`, so the augmentation becomes a benign duplicate). The risk is minimal since duplicating a known-type is a no-op. Flagged for awareness only.
- **Proposed fix:** Add a one-line comment in CLAUDE.md §Stack reminder: "On React 19 upgrade: delete `src/types/react-augment.d.ts` (inert shim)." This is ≤5 words in context.
- **Source critic:** milestone-web-perf-critic
- **Source axis:** Web Axis 2 — chrome.storage discipline (documentation-drift analog)

---

## What was done well

- **`useLayoutEffect` was used correctly** for both the stagger (m5 precedent) and the new `leavingTab` state machine. This directly applies the m5 lessons.md lesson: any CSS animation toggled by a `data-*` attribute with `animation-fill-mode: both` MUST be committed via `useLayoutEffect`. The prior critique surfaced this; this milestone gets it right from the start.
- **`animation-fill-mode: both` is present and load-bearing**. The CSS shorthand `animation: tabpanel-fade-in 220ms ease-out both` correctly sets `fill-mode: both`, holding `opacity: 0` on the incoming panel before the first paint frame. This is the single most important FOUC defense and it is correctly implemented.
- **`inert={true | undefined}` (not `true | false`)**. The implementation explicitly avoids `false` (which React serializes as the string `"false"` — a truthy HTML attribute that activates inert). Using `undefined` to omit the attribute is the correct "not inert" state. The implement synthesis called this out; the code respects it.
- **Dual reduced-motion guards** correctly null both the leaving-panel CSS transition AND the incoming-panel animation under both `[data-reduced-motion="true"]` (in-app override) and `@media (prefers-reduced-motion: reduce)` (OS-level preference). Mirrors the m5-s9 dual-guard convention precisely.
- **`:not([data-staggered])` carve-out** prevents double-fade on Today/Sprint/LongTerm panels where the m5 stagger already provides the fade-in feel. Only Gantt, Reminders, Calendar, and Closed get the panel-level `tabpanel-fade-in` animation. This eliminates the competing-opacity-curves visual artifact described in synthesis §3.5.
- **Functional updater in the 250 ms clear timeout** (`setLeavingTab((current) => (current === prev ? null : current))`) correctly guards against racing a more-recent `leavingTab` set on rapid tab switches. This is the correct React pattern for async state updates that depend on prior state.
- **Cancel-and-reschedule pattern** for rapid tab switching mirrors the m5-s9 `staggerTimeoutRef` pattern exactly. Rapid clicks (5 in 500 ms) correctly result in `leavingTab` tracking the second-to-last clicked tab; the stale timeout from earlier clicks is cancelled before a new one is scheduled.
- **250 ms timeout (not 220 ms)** provides a 30 ms safety buffer past the CSS transition. On a slow device or under browser load, the 220 ms CSS transition may not have fully completed; the buffer ensures `hidden=` reasserts only after the fade is visually complete.
- **No new npm dependencies**. The entire feature ships in ~175 LOC across two existing files plus a 22-line type shim. Chunk delta is +0.93 kB (235.47 kB total), leaving ~165 kB of headroom before the 400 kB soft warn.
- **`react-augment.d.ts` module augmentation is correct**. The `import "react"` line makes the file a module (required for `declare module` augmentation vs. global declaration); the augmentation extends `HTMLAttributes<T>` (correct for all HTML elements); the delete-on-React-19 note is present. The build passes strict TS with zero errors.

---

## Recommended rectification order

M2, M1, L2, L1

(M2 first because it is a milestones-wide gap; if test infrastructure is added, it also gates the regression-guard for M1. M1 second because the grid-stacking fix is self-contained and strictly improves the UX. L2 and L1 are deferred nits.)

---

## Phase 4 status (filled by orchestrator at rectify time)

- Fixed:
- Deferred:
- Invalidated:
- Regression tests added:
