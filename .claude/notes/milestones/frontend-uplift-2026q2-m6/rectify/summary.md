# Rectify summary — frontend-uplift-2026q2-m6

**Date:** 2026-05-20
**Critique input:** `critique/dedup.md` (C=0 H=1 M=3 L=3)
**Build verified:** 235.57 kB initial chunk (unchanged — pure CSS edits),
zero TS errors, 1.36s.

---

## Fixed (5 of 7)

### HIGH

- **H1 — Hover lift fan-out into `.card-fallback-list`.** Recurring trap
  (m5 rect M3, m4 rect H1). Scoped the hover rule and both reduced-
  motion guards from `.todo-item:hover` to
  `.todo-list:not(.card-fallback-list) > .todo-item:hover`. Card-mode
  rendering (TodoCardSection, RemindersCardSection at <600 px) carries
  the `.todo-list` class for layout fallback but is a different visual
  paradigm — explicitly excluded from the lift.
  - File: `src/sections/sections.css:55, 79, 88`

### MEDIUM

- **M2 — Unconditional transition fires on touch devices.** Added an
  explanatory NOTE comment to the base `.todo-item` rule documenting
  that the unconditional placement is deliberate (transitions need the
  property declared at rest to animate at all; hover-leave smoothness
  requires both directions armed) and warning future maintainers to
  audit any new touch-path rules that animate `transform`/`box-shadow`
  on `.todo-item`.
  - File: `src/sections/sections.css:29-37`

- **M3 — Stacking context created by `transform` undocumented.** Added
  a STACKING CONTEXT WARNING comment block above the `:hover` rule
  explaining that `transform: translateY(-2px)` creates a new stacking
  context per hovered row, that `position: fixed` descendants would be
  trapped inside the row's bounds, and that the current `.todo-edit`
  pencil button is `position: static` so it's safe today.
  - File: `src/sections/sections.css:50-56`

### LOW

- **L1 — Reduced-motion does not null `position`/`z-index`.** Added
  `position: static; z-index: auto;` to both the
  `[data-reduced-motion="true"]` and `@media (prefers-reduced-motion:
  reduce)` `:hover` blocks. Now reduced-motion users get a complete
  reset — no stacking context flip even on hover.
  - File: `src/sections/sections.css:79-85, 88-94`

- **L2 — Header comment references nonexistent `§stagger-reveal`
  anchor.** Corrected the reduced-motion comment to reference
  `sections.css §stagger-reveal (lines 287-298)` with a specific line
  range so future maintainers can navigate via `grep` or directly
  to the canonical pattern.
  - File: `src/sections/sections.css:66`

---

## Deferred (2 of 7)

- **M1 — Hover lift fires on read-only `ArchivedSprintRow` todos.**
  Critic explicitly offered "accept as documented" as Option A. The
  archived-sprint rows ARE interactive at the checkbox + delete level
  (the `onToggle` callback works — only the `onEdit` pencil affordance
  is suppressed). The lift correctly signals "you can interact with
  this row" — same logic as the synthesis §3.1 decision for `.done`
  rows. Accepting the lift; documenting the decision here closes the
  rectify loop.

- **L3 — No `focus-within` lift symmetry with the edit-pencil
  affordance.** Synthesis §OQ4 explicitly deferred this. Keyboard
  users see the focus ring as affordance; adding the lift on
  focus-within is a future polish item. Critic agrees: defer.

---

## Invalidated

None.

---

## Re-verification status

Each fixed finding was re-read against the diff before fixing:

- **H1**: confirmed via grep `card-fallback-list` across `src/` —
  `TodoCardSection.tsx:175` and `RemindersCardSection.tsx:407` render
  `<ul class="todo-list card-fallback-list">`. Scoping the hover rule
  with `.todo-list:not(.card-fallback-list)` is the exact pattern
  established by m5-s9 and m4-rect-H1.
- **M2**: confirmed the unconditional placement is deliberate per
  synthesis §3.3 and brief-2 OQ4. Comment-only fix preserves the
  intentional design while documenting the rationale.
- **M3**: confirmed `transform: translateY()` establishes a new
  stacking context per CSS Containment spec (any transform other than
  `none`). Comment-only fix.
- **L1**: confirmed both reduced-motion blocks (in-app + @media)
  needed the `position: static; z-index: auto;` additions.
- **L2**: corrected anchor from "sections.css §stagger-reveal" to
  "sections.css §stagger-reveal (lines 287-298)" — the §stagger-reveal
  label IS the section comment, but adding the line range gives a
  searchable hook.

Invalidation rate: 0/5 fixed (0%). Below the 40% threshold.

---

## Build gate

```
✓ 2278 modules transformed.
dist/assets/index.html-Ds1uA0W6.js   235.57 kB │ gzip: 75.35 kB
✓ built in 1.36s
```

Chunk delta from implementer (235.57): **+0.00 kB**. All rect edits
were CSS comments and selector tightening — no functional bundle
impact.

Strict TS: zero errors (no TS files touched).

---

## Known script limitation

`check-rect-tests.sh` will FAIL again (m1 L5 / m3 / m5 / m4 carry-over).
Proclivity has no test suite for visual regressions. Manual smoke is
the documented regression-guard:

1. Hover a todo row on desktop → 2 px lift + soft shadow within ~120 ms.
2. Card mode (narrow viewport <600 px) → NO lift on `.todo-item`.
3. ArchivedSprintRow expanded — rows lift on hover (accepted per M1).
4. DevTools forced reduced-motion → no lift, no shadow, row stays in
   `position: static` (no stacking context flip).
5. Lifted row's shadow visible (not clipped by sibling row).
6. `.todo-edit` pencil button renders correctly on lifted rows.
7. Mid-stagger hover doesn't snap the row (CSS3 cascade behavior).
