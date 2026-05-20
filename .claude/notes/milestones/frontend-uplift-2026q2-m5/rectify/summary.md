# Rectify summary — frontend-uplift-2026q2-m5

**Date:** 2026-05-20
**Critique input:** `critique/dedup.md` (C=0 H=1 M=6 L=1)
**Build verified:** 234.54 kB initial chunk, unchanged (+0.01 kB from 234.53
implementer baseline — the 0.01 is the useLayoutEffect import string), zero
TS errors, 1.49s.

---

## Fixed (5 of 8)

### HIGH

- **H1 — Archived sprint rows animate without `--stagger-idx`.** Now pass
  `index={idx}` from `ArchivedSprintRow`'s `.map((t, idx) => ...)` so
  archived rows stagger correctly when expanded at the moment the Sprint
  tab activates. Brought into spec rather than documented-as-deferred —
  it's a 1-line change for proper behavior.
  - File: `src/sections/sprint/SprintManager.tsx:609-619`

### MEDIUM

- **M3 — `.todo-list` selector also matched `.card-fallback-list`.** Scoped
  the stagger selector to `[data-staggered="true"] .todo-list:not(.card-fallback-list) li`
  (and same for both reduced-motion guards). Card mode's narrow-viewport
  fallback `<ul>` carries the `.todo-list` class verbatim; without the
  `:not()` it would silently match and produce a simultaneous fade
  instead of the intended exclusion. Now explicit.
  - File: `src/sections/sections.css:277-279, 287-294`

- **M4 — Research synthesis §3.6 made a false card-mode claim.** Rewrote
  the synthesis bullet to reflect reality: card mode partially matches
  via `.card-fallback-list`, which is why we need the `:not()` scope.
  Pairs with M3.
  - File: `.claude/notes/milestones/frontend-uplift-2026q2-m5/research/synthesis.md:52`

- **M6 — Tab-switch stagger had 1-frame FOUC via post-paint `useEffect`.**
  Swapped the stagger `useEffect` to `useLayoutEffect` so the
  `data-staggered` toggle commits synchronously before the browser
  paints the new tab — eliminating the visible "items flash visible at
  full opacity, then jump back to opacity 0 when the animation's `from`
  state takes hold" sequence the web-perf critic identified. The effect
  body is two state sets and a `setTimeout` schedule, so the layout-
  blocking cost is negligible.
  - File: `src/newtab/App.tsx:1, 320-345`

### LOW

- **L1 — `staggeredTab` initial value duplicated hard-coded `"today"`.**
  Now seeded from `tab` state via `useState<Tab | null>(tab)` so any
  future change to the initial-tab source (e.g. honoring a stored
  last-active-tab) flows through automatically. Single source of truth.
  - File: `src/newtab/App.tsx:321`

---

## Deferred (3 of 8)

- **M1 — `feat(motion):` scope not in CLAUDE.md.** Edit to CLAUDE.md
  scope list is blocked by `protect-ops-files.mjs` hook (project-contract
  file requires user-initiated edit with `CLAUDE_ALLOW_OPS_EDITS=1`).
  The commit is also already pushed, so the scope can't be amended even
  if we wanted to. Defer to a user-initiated CLAUDE.md update —
  `motion` is the third such scope drift this quarter (alongside `deps`,
  `icons`, `theme` flagged in m3 L2) so bundling them in one edit is the
  most efficient path.

- **M2 — `feat(a11y):` subject is 52 chars vs 50-char cap.** Pushed
  already; CLAUDE.md says never `--amend` on a pushed commit. Going-
  forward fix only: tighter forms like `feat(a11y): fluid mobile clock
  + scrollable tabs (m5-s10)` (50 chars) would have fit. Treat as a
  reminder, not a rectifiable item.

- **M5 — `scrollbar-width: thin` is universal-on.** Per the finding's
  own recommendation: "Defer. If a user complains, wrap in
  `@media (max-width: 599px) { .tabs { scrollbar-width: thin; } }`."
  The synthesis §3.5 explicitly chose universal-on for simplicity.
  Defer until/unless a user reports a desktop-Firefox UX issue.

---

## Invalidated

None.

---

## Re-verification status

Each finding was re-read against the diff before fixing:

- **H1**: confirmed at `SprintManager.tsx:609-619` — ArchivedSprintRow's
  `sprintTodos.map((t) => ...)` had no `idx` destructured and no `index=`
  prop on `<TodoItem>`. Fix is symmetric with the active-sprint and
  TodoList call sites already patched in s9.
- **M3**: confirmed via `grep -rn "card-fallback-list" src/` — class
  appears at `TodoCardSection.tsx:175` and `RemindersCardSection.tsx:407`.
  Reminders' tabpanel doesn't get `data-staggered` so it's already
  excluded by the parent attribute; TodoCardSection (Today/LongTerm tab
  card-mode fallback) IS inside a `data-staggered` tabpanel and was the
  real leak. The `:not()` scope is correct.
- **M4**: confirmed by reading synthesis §3.6 alongside `TodoCardSection.tsx:175`.
- **M6**: confirmed against `App.tsx:329` — `useEffect` schedules
  `setStaggeredTab(tab)` after paint, so on first commit of the new tab
  the items render visible-at-rest (no `data-staggered`), then on the
  effect firing they snap to `opacity: 0` for the animation `from` state.
  `useLayoutEffect` runs before paint, eliminating the gap.
- **L1**: confirmed — both `useState` calls had `"today"` literal.

Invalidation rate: 0/5 fixed (0%). Below the 40% threshold.

---

## Build gate

```
✓ 2278 modules transformed.
dist/assets/index.html-CPljtrV3.js   234.54 kB │ gzip: 75.15 kB
✓ built in 1.49s
```

Chunk delta from implementer (234.53): +0.01 kB (literally just the
`useLayoutEffect` named-import string). No functional bundle impact.
Strict TS: zero errors.

---

## Known script limitation

`check-rect-tests.sh` will FAIL because proclivity has no test suite for
visual or interaction regressions to live in. This is the same false-
positive carry-over from m1 L5 / m3 — the script doesn't model projects
without tests. The proper regression-guard for this rect is manual
visual smoke in dev (tab-switch FOUC; archived sprint row stagger;
narrow-viewport card-mode no longer plays the cascade). Documented here
so the next pipeline run isn't confused.
