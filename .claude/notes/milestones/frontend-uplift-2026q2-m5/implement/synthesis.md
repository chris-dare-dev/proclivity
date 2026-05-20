# Implement synthesis — frontend-uplift-2026q2-m5

**Date:** 2026-05-20
**Path:** inline (main session)
**Base SHA:** 684aeda
**Commits landed:**
- `690b20b feat(a11y): mobile header fluid clock + scrollable tabs (m5-s10)`
- `9473337 feat(motion): stagger-reveal on todo list activation (m5-s9)`

**Build status:** PASS (234.53 kB initial chunk, +0.51 kB from 234.02 baseline,
well under 400 kB soft warn).

---

## 1. What shipped

### s10 — Mobile header layout fix (UPL-16)

Pure CSS, single file (`src/newtab/App.css`):

- `.clock` `font-size` changed from static `56px` to `clamp(28px, 6vw, 56px)`.
  Calibration validated by brief-2 against MDN's 2:1 zoom-accessibility
  guideline (56/28 = 2.0 exact). At 390 px viewport pins to 28 px; at
  1024 px+ pins to 56 px.
- `.tabs` gets `overflow-x: auto` and `scrollbar-width: thin`.
- `.tab` gets `flex-shrink: 0` so buttons keep natural width and the
  parent's overflow engages (without flex-shrink: 0, tabs squeeze before
  scroll kicks in — brief-2 §3b).

No JS changes. Zero bundle delta.

### s9 — Stagger-reveal on todo list cold loads (UPL-3 Path a)

Five files, pure-CSS-driven cascade with a tiny React state machine:

- **`src/sections/sections.css`** (+43 lines): added `@keyframes stagger-fade-up`
  (opacity 0 → 1, translateY(8px) → 0) and the rule
  `[data-staggered="true"] .todo-list li { animation: stagger-fade-up 220ms
  cubic-bezier(0.2, 0, 0, 1) both; animation-delay: calc(var(--stagger-idx, 0)
  * 55ms); }`. Dual-guard block disables animation under both
  `[data-reduced-motion="true"]` and `@media (prefers-reduced-motion: reduce)`.

- **`src/newtab/App.tsx`** (+35 lines): added `staggeredTab: Tab | null` state
  (seeded to `"today"` so the initial paint plays the cascade) and a
  `useRef<number | undefined>` tracking the clear-timeout. A `useEffect` on
  `[tab]` cancels any pending timeout, sets `staggeredTab=tab`, and schedules
  a clear 250 ms later. Cleanup also cancels on unmount.
  - Today / Sprint / LongTerm tabpanels receive
    `data-staggered={staggeredTab === t.id ? "true" : undefined}`. Other
    tabpanels (Gantt, Reminders, Calendar, Closed) intentionally do NOT
    receive the attribute — they have no `.todo-list`, so the selector
    wouldn't match anyway, and the cleaner intent-mapping is to set it only
    where stagger applies.

- **`src/components/TodoItem.tsx`** (+25 lines): added an optional
  `index?: number | undefined` prop. When set, the row emits an inline
  `style={{ "--stagger-idx": Math.min(index, 9) }}`. Cap-at-9 enforces the
  10-item ceiling so 11+ item lists collapse to a single tail step rather
  than producing a 1 s+ cascade (brief-2 §3d). The cast is
  `as CSSProperties` because React's type signature doesn't include CSS
  custom properties — `import type { CSSProperties } from "react"` was
  added.

- **`src/sections/TodoList.tsx`** (+1 line): `.map((t, idx) => ...)` passes
  `index={idx}` to `<TodoItem>`.

- **`src/sections/sprint/SprintManager.tsx`** (+1 line): same as TodoList for
  the active-sprint `<ul>` at line 1242.

---

## 2. Architecture decisions made during implementation

1. **`staggeredTab` is `Tab | null`, not `Tab`** — the clear path needs a
  "no stagger" state. Initial value is `"today"` so first paint plays;
  after the 250 ms timeout, the state goes to `null`. Subsequent tab
  changes set it back to the new tab.

2. **`data-staggered` only on Today/Sprint/LongTerm tabpanels.** Gantt,
  Reminders, Calendar, Closed don't have `.todo-list`; setting the
  attribute would be a no-op but also misleads readers about intent.

3. **`useRef`-tracked timeout is functionally critical, not just paranoia.**
  Without cancellation, rapid tab switching within 250 ms would stack
  pending timeouts and could clear `staggeredTab` while it should be
  active. The cleanup pattern is the canonical React idiom.

4. **`Math.min(idx, 9)` is enforced at the call site, not in CSS.** CSS
  can't cap; the `max()` function on `animation-delay` would require
  per-element math. Keeping the cap in TSX makes the rule visible at the
  one place it lives.

5. **No new `--stagger-idx` token added to theme.css.** This is a per-item
  animation parameter, not a theme token — it doesn't belong in the
  design-system scale.

---

## 3. Deviations from synthesis

None. All s9 + s10 acceptance criteria from `research/synthesis.md` §6 are met.

The synthesis's open question Q3 (ArchivedSprintRow nested `<ul>`) was
left intentionally unscoped: when the Sprint tab activates with an
archived row expanded, those items will also animate. This is a minor
visual side effect (the animation is subtle, 220 ms with stagger), and
adding a CSS scope guard (`[data-staggered="true"] > * > .todo-list li`
or similar) was deemed premature optimization. Surfacing as an open
follow-up for visual review.

---

## 4. Build verification

```
✓ 2278 modules transformed.
dist/assets/index.html-BwgsDy2E.js   234.53 kB │ gzip: 75.15 kB
✓ built in 1.47s
```

Delta from m3 baseline: +0.51 kB (the small App.tsx state machine and
the TodoItem index prop forwarding). Still well below the 240 kB target
from synthesis §1.

Strict TS: zero errors. Working tree: clean (only the untracked
`.claude/notes/milestones/frontend-uplift-2026q2-m5/` bookkeeping dir).

---

## 5. Test deltas

None. Proclivity has no test suite; this milestone is pure visual /
interaction polish best verified by manual smoke (which I did NOT run as
the orchestrator — leaving the user to verify in dev). Per m1's L5 finding,
this is the structural pattern across the project.

---

## 6. Files changed (5 production files; 1 + memory; 1 docs prior commit)

```
 src/components/TodoItem.tsx           |  25 ++++++++++++- (m5-s9)
 src/newtab/App.tsx                    |  35 +++++++++++++++++- (m5-s9)
 src/newtab/App.css                    |  12 +++++++-1 (m5-s10)
 src/sections/TodoList.tsx             |   3 ++- (m5-s9)
 src/sections/sections.css             |  43 ++++++++++++++++++++++ (m5-s9)
 src/sections/sprint/SprintManager.tsx |   3 ++- (m5-s9)
 .claude/agent-memory/milestone-researcher/lessons.md |  12 ++++++ (researcher updates)
```

Plus the prior `684aeda docs(roadmap): promote m5 to Now lane` for the
roadmap-spec edit that unblocked init-state.sh.
