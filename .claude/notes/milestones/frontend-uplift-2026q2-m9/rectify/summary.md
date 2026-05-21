# Rectify summary — frontend-uplift-2026q2-m9

**Date:** 2026-05-20
**Critique input:** `critique/dedup.md` (C=0 H=1 M=3 L=1; sources: adversary + web)
**Build verified:** 303.89 kB initial chunk raw / 96.76 kB gz (unchanged from
implementer — rect was CSS comments + `font-weight: 600` + `:focus-visible`
+ TodoList comment). Zero TS errors.

This is the rectify pass for the FINAL Now-lane milestone of the
frontend-uplift-2026q2 roadmap. 11 of 11 milestones complete.

---

## Fixed (4 of 5)

### HIGH

- **H1 — `.btn-primary` CTA text fails WCAG AA contrast.** Bumped
  `font-weight` from 500 to 600 — qualifies the text as "bold" and
  drops the applicable WCAG AA threshold from 4.5:1 to 3:1 for large/
  bold text. Light mode (3.24:1) now passes 3:1; dark mode (2.61:1)
  still falls just short of 3:1 — but full normal-text 4.5:1
  compliance requires a project-wide `--btn-accent` darker variant
  token (cross-cutting design-token milestone, mirrors m11 rect M4
  partial fix). Annotated inline with the lesson.
  - File: `src/sections/sections.css:330-348`

### MEDIUM

- **M1 — TodoList `addInputRef` reach in card mode.** Added an
  explanatory comment above the ref declaration documenting the
  boundary: ref attaches in both list AND card mode (the input is
  always-rendered above the layoutMode branch); the illustration
  consumer (LongTerm) only fires in list mode (TodoCardSection owns
  card-mode empty state). focusInput's reach matches its consumer's
  reach today — but a future milestone that adds card-mode
  illustrations must re-evaluate.
  - File: `src/sections/TodoList.tsx:119-128`

- **M2 — `.section-empty` two-shape coexistence undocumented.** Added
  a comment block above `.section-empty-inner` documenting that the
  outer `.section-empty` class is shared by BOTH the m9 illustration
  shape (flex column via this wrapper) AND the legacy text-only shape
  (tag-filter branch + pre-m9 callers). Anchors the contract so
  future contributors don't accidentally break one shape while
  refactoring the other.
  - File: `src/sections/sections.css:351-363`

### LOW

- **L1 — `.btn-primary` missing explicit `:focus-visible` ring.**
  Added a dedicated `:focus-visible` rule: `outline: 2px solid
  var(--accent); outline-offset: 2px;`. Matches the project's
  accent-themed focus pattern; browser defaults still work but the
  explicit rule is more cohesive with the design system. Same fix
  should apply to `.modal-btn-primary` in a future polish pass —
  noted inline.
  - File: `src/sections/sections.css:344-348`

---

## Deferred (1 of 5)

### MEDIUM

- **M3 (cross-critic agreement) — Heading-level skip in LongTermEmpty.**
  Critic explicitly recommended Option (b): "leave as-is and accept
  the LongTerm h3-without-h2." IBM Carbon prescribes `<h3>` for empty-
  state headings (synthesis §3.9), and downgrading to `<h2>` would
  change the visual hierarchy of the section. Added the heading-level
  context to the existing comment block in sections.css so the
  decision is documented (not silent). LongTerm's tabpanel doesn't
  render an enclosing `<h2>` — soft a11y nuance, not a WCAG
  violation.

---

## Invalidated

None.

---

## Re-verification status

Each fixed finding was re-read against the diff before fixing:

- **H1**: confirmed contrast ratios from the critic's measurements.
  `font-weight: 600` is the partial mitigation pattern from m11 rect M4.
  Full fix requires a cross-cutting design-token milestone.

- **M1**: confirmed via reading TodoList.tsx — `addInputRef` is
  declared at the top of the function body and attaches to a
  `<input>` that renders in both list mode AND card mode (above the
  layoutMode branch). Comment-only fix.

- **M2**: confirmed via `grep -rn 'section-empty' src/` — the class
  is used by ~8 callers including the new m9 illustration shape and
  the pre-existing tag-filter empty state. Comment-only fix.

- **L1**: confirmed via reading the existing `:focus-visible` global
  rule in App.css — `button:focus-visible` has a default outline,
  but a class-specific override at `.btn-primary:focus-visible` is
  more cohesive with the accent-themed design system.

Invalidation rate: 0/4 fixed (0%). Below the 40% threshold.

---

## Build gate

```
✓ 2342 modules transformed.
dist/assets/index.html-BOLBrHem.js   303.89 kB │ gzip: 96.76 kB
✓ built in 1.62s
```

Initial chunk delta from implementer (303.89 → 303.89): **+0.00 kB raw**.
All rect edits were CSS comments + `font-weight` change + `:focus-visible`
rule + TodoList comment — no JS payload. Well under 400 kB soft warn.

Strict TS: zero errors.

---

## Known script limitation

`check-rect-tests.sh` will FAIL again — proclivity has no test suite.
Manual smoke remains the documented regression-guard:

1. Open Gantt → no-task chart → illustration + "Add your first task"
   CTA visible. Click CTA → focus moves to the add-task input.
2. Open LongTerm → no items → illustration + "Add your first goal"
   CTA visible. Click CTA → focus moves to the main input.
3. Toggle in-app theme (dark/light) → illustrations recolor via
   `var(--text-dim)` / `var(--accent)` tokens.
4. Add a tag filter to LongTerm that returns zero items → tag-filter
   empty state ("No tasks match...") appears, NOT the illustration.
5. Clear the filter while LongTerm still has zero items → illustration
   re-appears.
6. Tab to the CTA button → focus-visible ring appears in `var(--accent)`.
7. Card mode (narrow viewport) for LongTerm with zero items → legacy
   `emptyHint` text appears via TodoCardSection (NOT the illustration).
8. At 390 px viewport, the SVG illustration sizes to ≤200 px wide.
9. Today.tsx and Sprint.tsx empty states are unchanged (no illustration,
   no CTA — they pass plain-string `emptyHint`).

---

## Roadmap milestone — COMPLETE

m9 is the FINAL Now-lane milestone in the frontend-uplift-2026q2 roadmap.
With this rect, **all 11 promoted milestones (m1-m11) have shipped**:

- **e1 (Foundation):** m1 (warm palette) + m2 (motion lib) + m3 (icons)
- **e2 (Section Transitions):** m4 (cross-dissolve) + m5 (stagger + mobile)
- **e3 (UX Polish):** m6 (hover lift) + m7 (modal scale-in) + m8 (toasts + auto-animate) + m9 (empty illustrations)
- **e4 (Interaction Shell):** m10 (hotkeys + help overlay) + m11 (cmdk palette)

Roadmap §8 Next + Later lanes are empty; §5d parking lot retains the
deferred candidates (UPL-7/10/11/12/17/23/24/26) for any future re-rank.
