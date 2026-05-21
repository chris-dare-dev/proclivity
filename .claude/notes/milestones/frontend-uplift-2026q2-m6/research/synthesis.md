# Research synthesis — frontend-uplift-2026q2-m6

**Milestone:** UPL-9 — CSS lift-on-hover for `.todo-item`
**Date:** 2026-05-20
**Author:** orchestrator (main session, Phase 1 fan-in)
**Sources:** brief-1.md (explore — 9 gotchas + file inventory), brief-2.md (general — best-practice + CSS3 cascade analysis)

---

## 1. TL;DR for the implementer

Single-file CSS edit. Pure additive — no existing rule modified, no JS, no React state.

- **`src/sections/sections.css:21-29`** — `.todo-item` block currently has no transition / transform / box-shadow / will-change. Clean insertion point.
- Add `transition: transform 120ms ease-out, box-shadow 120ms ease-out;` to the base `.todo-item` rule (unconditional — transitions need to be declared at rest, not inside `:hover`).
- Add `@media (hover: hover) and (pointer: fine) { .todo-item:hover { transform: translateY(-2px); box-shadow: 0 4px 12px oklch(0 0 0 / 0.18); position: relative; z-index: 1; } }`. The `position: relative; z-index: 1` is defensive against shadow-clipping by sibling rows (brief-1 §4.2 open question).
- Add dual-guard reduced-motion block (mirror `sections.css:287-299` stagger pattern).
- Defer `will-change: transform` — not needed; transform is cheap on the GPU and `will-change` has memory cost (brief-1 §3i).

**Path decision:** `inline` — 1 file, ~25 LOC, well under the ≤5 files / ≤300 LOC threshold.

**Expected chunk delta:** zero (pure CSS, no new selectors that add bytes to JS). Baseline 235.57 kB post-m4; target unchanged.

---

## 2. Affected files (1)

1. **`src/sections/sections.css`** — additions only:
   - Modify `.todo-item` rule (line 21-29) to ALSO include the transition.
   - Add new `@media (hover: hover) and (pointer: fine)` block with the `:hover` rule.
   - Add new dual-guard reduced-motion block after the `:hover` block.

---

## 3. Architecture decisions made during synthesis

### 3.1 Hover lift applies to all `.todo-item` including `.done` rows (brief-1 OQ1)

Done todos are still interactive (toggle back to undone, delete, edit). The lift affordance reinforces "this row is clickable" — gating it to `:not(.done)` would inadvertently signal that done rows are non-interactive, which is wrong. Use the simple `.todo-item:hover` selector.

### 3.2 Add `position: relative; z-index: 1` to the `:hover` rule (brief-1 OQ2)

Sibling rows are stacked with `gap: 4px`. With `translateY(-2px)`, the lifted row moves 2 px into the gap. Without `z-index`, the shadow could be clipped by the next row's background. Brief-1 §4.2 flagged "likely needed — worth verifying visually." Adding it defensively means no follow-up rect cycle if it's actually needed; the cost is one extra line of CSS.

### 3.3 Transition unconditional, hover gated to fine-pointer (brief-2 OQ4)

The transition declaration goes on the base `.todo-item` rule (outside any media query) so it's always "armed." Only the `:hover` rule (which actually applies the lift values) is gated to `@media (hover: hover) and (pointer: fine)`. This is the canonical 2026 pattern and matches the codebase's existing `.todo-edit` pattern (sections.css:70).

### 3.4 Theme-invariant `oklch(0 0 0 / 0.18)` is correct (brief-2 §3.5)

Inline shadow form is fine for a single usage site. The proclivity codebase has no semantic shadow-elevation scale today; introducing `--shadow-1` etc. would be scope creep. The m3 rect convention `oklch(0 0 0 / N%)` is the established theme-invariant shadow form. If future milestones add modal / dropdown / card shadows, a tokens-and-elevations milestone can extract these — flagged for §5d parking lot.

### 3.5 No `will-change` (brief-1 §3i, brief-2 OQ2)

`transform` is cheap on the GPU. The 120 ms transition is short enough that `will-change` provides no measurable benefit. Adding `will-change: transform` creates a new stacking context per row + has memory cost — net negative for a low-frequency hover state.

### 3.6 CSS3 precedence handles the stagger interaction correctly (brief-2 §3.6)

CSS Transitions Level 1 §application: "Implementations must add this value to the cascade if and only if that property is not currently undergoing a CSS Animation on the same element." During the m5-s9 stagger (0-715 ms after tab activation), the hover transition on `transform` is suppressed; the animation wins. After the stagger completes (`animation-fill-mode: both` holds `transform: none`), the hover state engages normally. No code change needed; the spec behavior IS correct.

### 3.7 Dual-guard order matches the codebase precedent

Mirror the stagger block at `sections.css:287-299` exactly: `[data-reduced-motion="true"]` block first, `@media (prefers-reduced-motion: reduce)` block second. Both null both the `transform` and `box-shadow` on `:hover`. The base `.todo-item` `transition: none` is belt-and-suspenders with theme.css's global `!important` reset.

---

## 4. external_writes_required

```yaml
external_writes_required:
  - "git push origin main"
```

---

## 5. Implementation strategy (inline path)

1. Single CSS edit in `src/sections/sections.css`:
   - Modify the existing `.todo-item` block to ALSO include the transition declaration.
   - Insert the `@media (hover: hover) and (pointer: fine) { ... :hover { ... } }` block immediately after.
   - Insert the dual-guard reduced-motion block immediately after that.
2. `npm run build` to verify.
3. Single commit (`feat(style): UPL-9 lift-on-hover for todo rows (m6-s12)`).

Commit subject sanity check: `UPL-9 lift-on-hover for todo rows (m6-s12)` = 43 chars after prefix. Under the 50-char CLAUDE.md cap.

---

## 6. Implementation acceptance criteria

1. **`.todo-item` base rule** has `transition: transform 120ms ease-out, box-shadow 120ms ease-out;` added.
2. **`@media (hover: hover) and (pointer: fine) { .todo-item:hover { ... } }`** block:
   - `transform: translateY(-2px)`
   - `box-shadow: 0 4px 12px oklch(0 0 0 / 0.18)`
   - `position: relative; z-index: 1` (defensive against shadow clipping)
3. **Dual-guard reduced-motion block** (mirroring `sections.css:287-299` precisely):
   - `[data-reduced-motion="true"] .todo-item { transition: none; }`
   - `[data-reduced-motion="true"] .todo-item:hover { transform: none; box-shadow: none; }`
   - Same paired inside `@media (prefers-reduced-motion: reduce)`.
4. **No `will-change`** added.
5. **`npm run build`** passes, strict TS zero errors (no TS files touched), initial chunk unchanged at ≤ 236 kB.
6. **Manual smoke** in dev:
   - Hover a todo row on desktop → 2 px lift + soft shadow within ~120 ms.
   - Lifted row's shadow visible (not clipped by sibling row).
   - Hover state persists on `.todo-item.done` (correct).
   - Mid-stagger hover doesn't snap the row (CSS3 precedence; brief-2 §3.6).
   - Touch device emulation (DevTools) → no hover engages.
   - DevTools forced reduced-motion → no lift, no shadow.
   - `.todo-edit` pencil button still appears correctly on the lifted row.

---

## 7. Riskiest assumption + alternative

**Risk:** brief-2 §4 — the `transform: translateY(-2px)` on `.todo-item` creates a new stacking context (CSS spec: any `transform` other than `none` does). The `.todo-edit` pencil button is `position: static` — should be unaffected — but if any future descendant uses `position: fixed` and tries to escape the row's bounds, the new stacking context would trap it. Defense: the `.todo-edit` button is the only existing descendant that fires on the same `:hover` event, and it's `position: static`. Confirmed safe.

**Mitigation if a visual issue surfaces:** the alternative is `outline-offset: 0 → 3px` (brief-2 §5.3) which doesn't create a stacking context, but the visual quality is weaker. Not recommended unless the stacking context proves problematic.

---

## 8. Open questions for the implementer (≤5)

1. **Light vs dark shadow opacity** — brief-2 §6 raises whether `oklch(0 0 0 / 0.18)` reads correctly in dark mode (black shadow on dark panel = subtle). Decision: ship 0.18 for both; if the visual reviewer flags it as too subtle in dark mode, rect-bump to 0.24 with a theme-aware split. Not blocking for v0.
2. **Stagger / hover overlap visual quality** — brief-2 §3.6 confirms no code-level conflict, but the perceived UX of "row finishes stagger, THEN lifts on hover" might feel slightly delayed during the 715 ms after tab activation. Decide whether to surface this as a known characteristic or treat as nominal. Recommend: nominal (the user rarely hovers within the first 715 ms of opening a tab).
3. **Shadow on hover-leave** — the `transition` declaration is on `.todo-item` unconditionally, so the lift transitions OUT smoothly when hover leaves. Confirm this reads naturally and isn't sticky.
4. **`.todo-item:focus-within`** — should the lift ALSO trigger on focus-within (e.g., when the user tabs to a row via keyboard)? Currently the pencil button reveal uses both `:hover` and `:focus-within`. Symmetry would argue yes; the brief doesn't specify. Recommend: defer (keyboard users see the focus ring already; adding the lift on focus-within is a future polish item).
5. **Mobile fallback** — touch devices get NO hover state. Is there a tap-feedback alternative for mobile (e.g., `:active` state)? Brief is silent. Recommend: defer; the `:active` work is its own milestone (mobile-tap-feedback).

---

## 9. Scope assessment

- **Path:** inline (≤5 files, ~25 LOC)
- **Estimated LOC:** 20-30
- **Worktree:** NO
- **`--allow-large-diff`:** NO
- **Novel architecture:** NO — additive CSS, mirrors established patterns
