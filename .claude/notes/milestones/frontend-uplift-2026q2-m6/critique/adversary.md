# Adversary critique — frontend-uplift-2026q2-m6 (UPL-9)

**Critic:** milestone-adversary-critic
**Milestone:** `frontend-uplift-2026q2-m6` — CSS lift-on-hover for `.todo-item`
**Commit range:** `5100d6b..HEAD` (1 commit: `81f05dd`)
**Generated:** 2026-05-20
**Diff stats:** 1 file changed, +44 / -0 (`src/sections/sections.css`)

---

## Verdict — SHIP-WITH-FIXES

The implementation is well-scoped and prescriptive: a 44-LOC additive CSS edit
to one file, with build clean at 235.57 kB (verified independently — exactly
matches the implementer's claim and the m4 baseline). All 13 axes pass cleanly,
commit hygiene is correct (42-char subject, GPG-signed, co-authored, `style`
scope). The lift fires only on fine-pointer / hover-capable devices and is
dual-guarded for reduced-motion. Two MEDIUM findings concern selector fan-out
into contexts the synthesis did not explicitly bless (card-fallback-list and
archived sprint rows) — both the recurring m5 trap shape. Two LOW findings
note residual stacking-context creation under reduced-motion and a minor
doc-drift anchor in the file header comment. None block ship; address the
MEDIUM items either by carve-out or by explicit "ship-as-is" architectural
note.

---

## Executive summary

- [MEDIUM] Hover lift fan-out into `.card-fallback-list` rows on narrow-window
  desktop mirrors the recurring m5 trap; synthesis did not address it.
- [MEDIUM] Hover lift fires on `ArchivedSprintRow` (read-only) todo rows —
  affordance suggests editability that's intentionally absent.
- [LOW] Under reduced-motion, `position: relative; z-index: 1` is not nulled
  on `:hover`; stacking context still created, but visually harmless.
- [LOW] Header comment at sections.css:53 references "sections.css
  §stagger-reveal" — no such anchor comment exists; minor doc-drift.
- [PASS] Build clean at 235.57 kB (independent re-run, matches implementer
  claim and m4 baseline exactly — third consecutive milestone validating
  this anchor).
- [PASS] Commit hygiene clean: 42-char subject, `feat(style)` scope in active
  list, GPG-signed, co-author trailer present.
- [PASS] Dual-guard reduced-motion mirrors the established stagger pattern
  (lines 58-73 ≈ lines 287-296).
- [PASS] All axes 1-13 pass: no external writes, no storage changes, no TS
  files touched (no strict-mode risk), no manifest changes, no Node imports.

---

## Findings

### CRITICAL — none

### HIGH — none

### MEDIUM

#### [MEDIUM] M1 — Hover lift fan-out into `.card-fallback-list` is unscoped

- **File:** `src/sections/sections.css`
- **Line:** 43-50
- **Anchor:** `@media (hover: hover) and (pointer: fine) {`
- **What:** The new `.todo-item:hover` rule does NOT carve out the card-mode
  fallback list (`<ul class="todo-list card-fallback-list">`). The m5-s9
  stagger explicitly added `:not(.card-fallback-list)` to its selector
  (sections.css:326) precisely because TodoCardSection.tsx:175 and
  RemindersCardSection.tsx:407 reuse the `.todo-list` class for the
  <600 px viewport fallback. A fine-pointer device viewing the page at
  ≤599 px width (developer resizing the window, touchscreen-laptop in
  mouse mode) WILL see the lift fire on rows inside the fallback list.
  The synthesis (§3.1-§3.7) did not address card-mode interaction; the
  implementer carried this gap forward.
- **Why it matters:** Recurring trap shape (see m5 lessons.md entry):
  reusing the `.todo-list` class across list-mode AND card-fallback-mode
  means any selector keyed on `.todo-list .todo-item` (or `.todo-item`
  globally inside one) fans out into both contexts unless explicitly
  excluded. The visual outcome in card-fallback mode is a row that lifts
  + shadows in the fallback list, which the rest of the card-mode UX
  doesn't reinforce (no other card-mode element has a hover-lift
  affordance). Mild visual inconsistency, not a correctness bug.
- **Proposed fix:** Either (a) scope the hover rule to exclude card mode:
  `.todo-list:not(.card-fallback-list) .todo-item:hover { ... }` (mirrors
  m5), or (b) accept the fan-out and add a synthesis §3.x decision note
  documenting the deliberate symmetry. (a) is the safer default; the
  fan-out wasn't deliberate per the synthesis.
- **Regression-guard:** N/A — no test suite (m1 L5 carry-over). Manual:
  resize Chrome to 599 px, hover a row in the Today/Long-term tabs; the
  fallback list should match whichever decision is made.
- **Source critic:** milestone-adversary-critic
- **Source axis:** m6-axis-H (card mode interaction) + recurring trap

#### [MEDIUM] M2 — Hover lift fires on read-only `ArchivedSprintRow` todos

- **File:** `src/sections/sprint/SprintManager.tsx`
- **Line:** 609-621
- **Anchor:** `<ul className="todo-list">`
- **What:** `ArchivedSprintRow` (sprint/SprintManager.tsx:557) renders
  TodoItems with `onEdit` intentionally absent (read-only per cross-plan
  #14). The pencil button does not render. But the new `.todo-item:hover`
  lift fires uniformly because the class is the same. The affordance now
  signals "this row reacts to you" while only toggle (un-done) and delete
  remain available — softer interactivity than the lift implies.
- **Why it matters:** The synthesis §3.1 explicitly argued done rows
  should retain the lift because they remain interactive (toggle / delete
  / edit). The same logic does not apply cleanly to archived-sprint rows,
  where edit is suppressed by design. This is a UX consistency issue, not
  a correctness bug — it surfaces an architectural decision the synthesis
  did not make.
- **Proposed fix:** Two options: (a) accept the lift on archived rows as
  reinforcing "toggle / delete still work" (probably fine — and consistent
  with §3.1's reasoning extended); (b) scope the lift to non-archived
  rows via a parent selector like `.sprint-archived-tasks .todo-item:hover
  { transform: none; box-shadow: none; }` overriding the base rule.
  Recommend (a) — document in rect summary that the lift is deliberately
  retained on archived rows because toggle/delete remain valid actions.
- **Regression-guard:** N/A — no test suite. Manual: expand an archived
  sprint, hover a row; the lift firing is the new visible behavior.
- **Source critic:** milestone-adversary-critic
- **Source axis:** m6-axis-H (fan-out into all `.todo-item` contexts)

### LOW

#### [LOW] L1 — Reduced-motion does not null `position`/`z-index`

- **File:** `src/sections/sections.css`
- **Line:** 58-73
- **Anchor:** `[data-reduced-motion="true"] .todo-item:hover {`
- **What:** The dual-guard reduced-motion block (lines 58-73) nulls
  `transform`, `box-shadow`, and `transition` — but does NOT null the
  `position: relative` and `z-index: 1` declarations from the hover rule
  at line 44-49. Under reduced-motion, hovering a row still creates a new
  stacking context (via `position: relative` + non-auto `z-index`) for
  the duration of the hover. Visually a no-op (transform/shadow nulled,
  so nothing escapes the row's bounds anyway), but the stacking-context
  side effect persists.
- **Why it matters:** Cosmetic / theoretical. A future descendant of
  `.todo-item` that uses `position: fixed` or relies on document-level
  z-stacking would be trapped within the new stacking context during
  hover even under reduced-motion. No such descendant exists today
  (`.todo-edit` is `position: static`, `.todo-delete` is `position: static`).
  Low severity, defer.
- **Proposed fix:** Add `position: static; z-index: auto;` to the
  reduced-motion `:hover` blocks. Cost: 2 lines × 2 blocks = 4 lines.
  Optional; not required for ship.
- **Source critic:** milestone-adversary-critic
- **Source axis:** m6-axis-F (reduced-motion completeness)

#### [LOW] L2 — Header comment references nonexistent anchor

- **File:** `src/sections/sections.css`
- **Line:** 52-53
- **Anchor:** `Mirrors the stagger pattern at sections.css §stagger-reveal`
- **What:** The new comment at line 53 references "sections.css
  §stagger-reveal" as if it were a named section anchor in the file. The
  actual stagger block lives at lines 298-343 and is introduced by the
  comment `/* ── Stagger-reveal on todo list cold loads (UPL-3 / m5-s9)
  ─────...`. There is no explicit `§stagger-reveal` anchor token to
  jump to.
- **Why it matters:** Doc-drift. A future maintainer searching for
  `§stagger-reveal` will get no hits. Cheap to fix.
- **Proposed fix:** Replace `sections.css §stagger-reveal` with `sections.css:298`
  (or `sections.css §"Stagger-reveal on todo list cold loads"`). One-line edit.
- **Source critic:** milestone-adversary-critic
- **Source axis:** axis-12 (doc drift)

---

## What was done well

- **Independent `npm run build` verified the implementer's chunk-size claim
  to the byte** (235.57 kB matches m4 baseline exactly — pure CSS edit
  delta is genuinely 0). Fourth consecutive milestone where the implementer's
  bundle claim is accurate.
- **Transition declared on base rule, not in `:hover`** — armed in BOTH
  hover-enter AND hover-leave directions. This is the correct 2026 pattern
  and matches the codebase's existing `.todo-edit` pattern (line 114).
- **`@media (hover: hover) and (pointer: fine)` gate** correctly excludes
  touch devices from the hover affordance — touch laptops with passive
  hover capability would still pass `(hover: hover)`, but the `(pointer:
  fine)` AND-conjunction excludes coarse pointers. Tight and intentional.
- **Dual-guard reduced-motion** mirrors the established
  `closed-scope-counter` / stagger precedent exactly: both
  `[data-reduced-motion="true"]` (in-app toggle) and `@media
  (prefers-reduced-motion: reduce)` (OS-level) null the lift values.
- **`oklch(0 0 0 / 0.18)` is theme-invariant** per the m3 rect convention —
  black-shadow alpha-blends naturally on both light and dark panels. The
  implementer's open-question OQ1 about dark-mode subtlety is correctly
  flagged for future visual review without blocking ship.
- **`position: relative; z-index: 1` defensive z-stacking** prevents the
  next-row's background from clipping the lifted row's shadow — proactive
  given the 4 px `.todo-list` gap.
- **No `will-change` added** — implementer correctly declined the GPU hint
  for a low-frequency hover state. Memory-cost-vs-benefit reasoning is
  documented in synthesis §3.5 and the absence here ships clean.
- **Commit hygiene exemplary**: 42-char subject after `feat(style): ` prefix
  (well under the 50-char CLAUDE.md cap), `style` scope in the active list,
  GPG-signed (`G` status), co-author trailer present, body documents both
  mechanism AND interaction notes (stagger animation precedence and
  `.todo-edit` co-existence).
- **Implement synthesis** is precise: §1 names the exact line ranges, §3
  enumerates the synthesis decisions followed, §4 quotes the build output
  verbatim. No deviations from synthesis.

---

## Recommended rectification order

1. **M1** — decide carve-out vs. accept for `.card-fallback-list`. If
   carving out, add `:not(.card-fallback-list)` ancestor scope (mirror m5).
   If accepting, document in rect summary.
2. **M2** — decide if archived rows keep the lift. Recommend accept +
   document (cleanest extension of §3.1 reasoning).
3. **L2** — fix the `§stagger-reveal` anchor reference to a concrete line
   number. One-line edit, ride along with the M1/M2 rect commit.
4. **L1** — defer unless rectifier is touching the reduced-motion blocks
   anyway. No user-visible impact today.

---

## Phase 4 status

_(leave blank — orchestrator fills this at rectify time)_
