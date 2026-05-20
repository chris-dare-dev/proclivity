# Critique — frontend-uplift-2026q2-m5 — milestone-web-perf-critic

**Critic:** milestone-web-perf-critic
**Commit range:** 684aeda..HEAD
**Generated:** 2026-05-20T21:40:33Z
**Diff stats:** 7 files changed, +128/-6 LOC (6 production files + 1 agent-memory)

---

## Verdict

SHIP-WITH-FIXES

The two stories (UPL-16 fluid clock / scrollable tabs, UPL-3 stagger-reveal) are
correctly implemented, within budget (234.53 kB, 165 kB below the 400 kB soft
warn), and pass all hard constraints (no new deps, no storage violations, no CSP
risk, no service-worker changes). One MEDIUM finding — a one-frame FOUC on
tab-switch caused by `useEffect` firing after paint — is a real but shallow visual
artifact fixable in a single import swap. Two LOW findings are knowingly accepted
design trade-offs surfaced here for the record. No HIGH or CRITICAL findings.

---

## Executive summary

- [MEDIUM] M1: Tab-switch triggers `useEffect` (asynchronous, post-paint), causing a
  ~16 ms flash of fully-visible content before the stagger animation's `fill-mode: both`
  hides items again. Fix: `useLayoutEffect` fires pre-paint.
- [LOW] L1: `overflow-x: auto` on `.tabs` implicitly forces `overflow-y: auto`, which
  in theory can clip the `button:focus-visible` outline at the container's top/bottom
  edge. Chrome 121+ does NOT clip outlines in overflow:auto, so this is a no-op in
  the extension's target runtime. Flagged for doc clarity only.
- [LOW] L2: `ArchivedSprintRow` renders a `.todo-list` without passing `index` to
  `<TodoItem>`, so all archived items animate simultaneously at the 0 ms stagger step
  when Sprint tab activates with an expanded archived row. Deliberate per synthesis §3;
  flagged for completeness.
- [PASS] Chunk budget: 234.53 kB (+0.51 kB). Well under 400 kB soft warn and 500 kB
  hard ceiling. No new `dependencies` entries.
- [PASS] `three.js` / `@react-three/fiber` remain lazy-loaded — no eager import
  introduced by this diff.
- [PASS] `chrome.storage.local` discipline upheld: no direct calls in any component.
  All persistence routed through `useStore()`.
- [PASS] CSP: inline `style={{ "--stagger-idx": ... }}` on `<li>` is CSP-safe (CSS
  custom properties via inline style do not violate MV3 CSP). No `dangerouslySetInnerHTML`,
  `eval`, or dynamic `script.src`.
- [PASS] Reduced-motion dual guard: `animation: none` shorthand correctly resets
  `animation-fill-mode` to initial (`none`), so items are NOT stuck at `opacity: 0`
  under either `prefers-reduced-motion: reduce` or `[data-reduced-motion="true"]`.

---

## Findings

### CRITICAL

_(none)_

### HIGH

_(none)_

### MEDIUM

#### [MEDIUM] M1 — Tab-switch stagger has 1-frame FOUC via useEffect (post-paint)

- **File:** `src/newtab/App.tsx`
- **Line:** 329
- **Anchor:** `  useEffect(() => {`
- **What:** `useEffect` fires asynchronously after the browser has committed a paint,
  so on a tab switch there is a render where the new panel is visible (`hidden=false`)
  but `staggeredTab` has not yet been updated to the new tab — items render at their
  default `opacity: 1` for one frame (~16 ms at 60 fps), then `data-staggered="true"`
  is applied and `animation-fill-mode: both` immediately drops items to `opacity: 0`
  before the animation fires.
- **Why it matters:** The resulting visual sequence is: items flash fully visible →
  disappear → fade in, rather than the intended clean fade-in from invisible. At 60 fps
  the flash is ~16 ms, which is at the lower edge of human visual detection but is
  noticeable on hardware that misses the frame boundary.
- **Proposed fix:** Replace `useEffect` with `useLayoutEffect` for the
  `setStaggeredTab(tab)` call only. `useLayoutEffect` fires synchronously after React
  mutates the DOM but before the browser paints, so both `hidden=false` and
  `data-staggered="true"` land in the same committed frame. The 250 ms timeout
  (clear phase) can remain in `useLayoutEffect` — it only schedules a future
  `setState`, not a DOM read. Update the import line accordingly:
  ```tsx
  import { lazy, memo, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
  // ...
  useLayoutEffect(() => {
    setStaggeredTab(tab);
    // ... timeout setup unchanged
    return () => { /* cleanup unchanged */ };
  }, [tab]);
  ```
- **Regression-guard:** Manual smoke: switch tabs rapidly and observe that items never
  flash visible before fading in. DevTools slow-network + CPU-throttle (6×) makes the
  1-frame flash visible if `useEffect` is still used.
- **Source critic:** milestone-web-perf-critic
- **Source axis:** Web Axis 6 / Axis 7 — Accessibility (layout shift / FOUC)

---

### LOW

#### [LOW] L1 — overflow-x:auto on .tabs may clip focus ring on older Chrome builds

- **File:** `src/newtab/App.css`
- **Line:** 100
- **Anchor:** `  overflow-x: auto;`
- **What:** Setting `overflow-x: auto` forces `overflow-y` to `auto` (browsers cannot
  maintain `overflow-y: visible` when `overflow-x` is non-visible). In theory this
  creates a scroll container that can clip the `button:focus-visible` outline (declared
  at line 125 as `2px solid + 2px offset` = 4 px outside the button's border box).
- **Why it matters:** Chrome 121+ (the extension's target) renders `outline` outside
  overflow scroll containers without clipping — this is confirmed browser behavior.
  The concern is moot for the current target. Flagged so it is not rediscovered in a
  future browser-compat audit.
- **Proposed fix:** No action needed at Chrome 121+. If cross-browser portability is
  ever required, add `padding-bottom: 4px` to `.tabs` so the focus outline has paint
  space within the container bounds.
- **Source critic:** milestone-web-perf-critic
- **Source axis:** Web Axis 6 — Accessibility (WCAG AA focus visibility)

---

#### [LOW] L2 — ArchivedSprintRow items animate simultaneously (no stagger index)

- **File:** `src/sections/sprint/SprintManager.tsx`
- **Line:** 610
- **Anchor:** `              {sprintTodos.map((t) => (`
- **What:** `ArchivedSprintRow` renders a `.todo-list` but does not pass `index` to
  `<TodoItem>`, so `--stagger-idx` falls back to `var(--stagger-idx, 0)` for all
  archived items. When the Sprint tab activates with an expanded archived row, all
  archived items animate simultaneously at the 0 ms delay step rather than staggered.
- **Why it matters:** The effect is a simultaneous fade-in for all archived items
  instead of the intended cascade — aesthetically inconsistent but not broken. The
  synthesis (§3) explicitly accepted this as a minor side effect rather than adding a
  CSS scope guard.
- **Proposed fix (if desired):** Either (a) pass `index={idx}` in `ArchivedSprintRow`'s
  `.map` (one-line change, mirrors `TodoList.tsx`), or (b) scope the CSS selector to
  `[data-staggered="true"] > .content > [role="tabpanel"] .todo-list li` to exclude
  the archived row's nested list from the animation entirely.
- **Source critic:** milestone-web-perf-critic
- **Source axis:** Web Axis 6 — Accessibility / animation UX (non-breaking cosmetic)

---

## What was done well

- **Chunk discipline maintained.** At 234.53 kB (+0.51 kB) the initial chunk sits
  165 kB below the 400 kB soft warn threshold. The implementer correctly attributed
  the delta (state machine + index prop forwarding) and validated with a build run.
- **Reduced-motion dual guard is belt-and-suspenders.** Both `[data-reduced-motion="true"]`
  (in-app override) and `@media (prefers-reduced-motion: reduce)` (OS-level) null the
  animation. The `animation: none` shorthand correctly resets `animation-fill-mode` to
  its initial value, so there is no risk of items being stranded at `opacity: 0` for
  users who have motion disabled.
- **`useRef`-tracked timeout prevents stacked callbacks.** Rapid tab switching cancels
  the pending timeout before scheduling the next one, which is the canonical React
  debounce pattern. The cleanup function also fires on unmount — no dangling timer
  leak.
- **`Math.min(idx, 9)` cap enforced at the React call site**, not in CSS. This is the
  right layer: CSS `max()` on a `calc()` delay would require per-element math and is
  harder to read. Keeping the cap in TSX makes it visible and type-safe.
- **`staggeredTab` seeded to `"today"` on initial mount.** The first-paint stagger fires
  without a `useEffect` on mount, because both `tab` and `staggeredTab` start at the
  same value — eliminating FOUC on the initial page load (no prior-render at
  `opacity: 1` before the animation begins).
- **Inline `style` is used correctly for CSS custom properties.** The `as CSSProperties`
  cast is explicitly noted in a comment explaining why it's needed (React's type
  signature doesn't include CSS custom properties). The `staggerStyle` variable is only
  emitted when `index !== undefined`, keeping the inline-style payload minimal and
  avoiding an empty `style={{}}` on every item in non-stagger contexts.
- **`scrollbar-width: thin` is universally supported at the extension's target runtime.**
  Chrome 121 shipped full support; the claim in the commit message is correct and no
  polyfill is needed.
- **`clamp(28px, 6vw, 56px)` is the exact right formula.** 56/28 = 2.0 satisfies the
  MDN 200%-zoom accessibility guideline, and the 6vw central value places the fluid
  scaling band at 467–933 px — covering mobile-width viewports without touching the
  desktop ceiling.
- **No service-worker changes, no manifest changes, no new permissions.** The diff is
  strictly scoped to UI files; the MV3 service-worker lifecycle and permission
  least-authority surface are untouched.

---

## Recommended rectification order

M1, L1 (dismiss / doc), L2 (accept or one-line fix per taste)

M1 is the only actionable fix: change `useEffect` to `useLayoutEffect` in
`src/newtab/App.tsx` (line 329). L1 is a no-op at the current target runtime.
L2 is a cosmetic trade-off explicitly accepted by the synthesis.

---

## Phase 4 status (filled by orchestrator at rectify time)

- Fixed: —
- Deferred: —
- Invalidated: —
- Regression tests added: —
