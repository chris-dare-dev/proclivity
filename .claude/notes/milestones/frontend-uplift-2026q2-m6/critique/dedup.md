# Critique — frontend-uplift-2026q2-m6 — DEDUPED MERGE

**Sources:** adversary, web
**Counts:** C=0 H=1 M=3 L=3

## Verdict

**SHIP-WITH-FIXES** (aggregated from: SHIP-WITH-FIXES)

## Executive summary

- [HIGH] Hover lift fan-out into `.card-fallback-list` is unscoped
- [MEDIUM] Hover lift fires on read-only `ArchivedSprintRow` todos
- [MEDIUM] Unconditional transition fires on all devices including touch
- [MEDIUM] Stacking context created by hover `transform` is undocumented
- [LOW] Reduced-motion does not null `position`/`z-index`
- [LOW] Header comment references nonexistent anchor
- [LOW] No `focus-within` lift symmetry with the edit-pencil affordance

## Findings

### CRITICAL

### HIGH

#### [HIGH] H1 — Hover lift fan-out into `.card-fallback-list` is unscoped [AGREEMENT]

- **File:** `src/sections/sections.css`
- **Line:** 43-50
- **Anchor:** `@media (hover: hover) and (pointer: fine) {`
- **What:** The new `.todo-item:hover` rule does NOT carve out the card-mode
- **Why it matters:** Recurring trap shape (see m5 lessons.md entry):
- **Proposed fix:** Either (a) scope the hover rule to exclude card mode:
- **Regression-guard:** N/A — no test suite (m1 L5 carry-over). Manual:
- **Source critic:** adversary, flagged by: adversary, web
- **Source axis:** m6-axis-H (card mode interaction) + recurring trap
- **Original id:** M1

### MEDIUM

#### [MEDIUM] M1 — Hover lift fires on read-only `ArchivedSprintRow` todos

- **File:** `src/sections/sprint/SprintManager.tsx`
- **Line:** 609-621
- **Anchor:** `<ul className="todo-list">`
- **What:** `ArchivedSprintRow` (sprint/SprintManager.tsx:557) renders
- **Why it matters:** The synthesis §3.1 explicitly argued done rows
- **Proposed fix:** Two options: (a) accept the lift on archived rows as
- **Regression-guard:** N/A — no test suite. Manual: expand an archived
- **Source critic:** adversary
- **Source axis:** m6-axis-H (fan-out into all `.todo-item` contexts)
- **Original id:** M2

#### [MEDIUM] M2 — Unconditional transition fires on all devices including touch

- **File:** `src/sections/sections.css`
- **Line:** 33
- **Anchor:** `  transition: transform 120ms ease-out, box-shadow 120ms`
- **What:** The `transition` declaration on the base `.todo-item` rule is unconditional — it applies on touch/coarse-pointer devices where the hover lift values never fire, arming a 120 ms easing cost if `transform` or `box-shadow` are ever set on `.todo-item` by any future rule or JS.
- **Why it matters:** While functionally harmless today (no other rule sets `transform` or `box-shadow` on `.todo-item`), this creates a latent timing trap: any future feature that animates `.todo-item` rows (e.g., a swipe-to-delete gesture or drag-reorder) will inherit the 120 ms ease-out on touch devices without an explicit authoring decision. The canonical pattern — noted in both the research synthesis (§3.3) and brief-2 (§OQ4) as "correct" — places the transition unconditionally because it is needed for hover-leave smoothness; the risk is that "unconditional" was chosen for hover-leave but was not audited for the cross-device latent-animation side-effect.
- **Proposed fix:** Either (a) accept the current approach and add a comment explicitly documenting that the unconditional transition is intentional and that future rules adding `transform`/`box-shadow` to `.todo-item` on touch paths must audit this interaction; or (b) move the `transition` declaration inside the `@media (hover: hover) and (pointer: fine)` block alongside the `:hover` rule. Option (b) is cleaner but breaks the hover-leave animation on very-old browsers that support hover queries but not the combined `and` syntax — which is Baseline 2018 and a non-issue in practice. Recommended: option (a) with an explicit comment, since the research synthesis already chose the unconditional placement deliberately.
- **Regression-guard:** optional (MEDIUM). If option (b) is taken, verify hover-leave animation still fires by inspecting transitions in DevTools on Chrome 121+.
- **Source critic:** web
- **Source axis:** Web Axis 7 — Paint cost / transition scope
- **Original id:** M1

#### [MEDIUM] M3 — Stacking context created by hover `transform` is undocumented

- **File:** `src/sections/sections.css`
- **Line:** 44–49
- **Anchor:** `  .todo-item:hover {`
- **What:** `transform: translateY(-2px)` creates a new stacking context on every hovered `.todo-item`. This is correctly identified in brief-2 §4 (riskiest assumption) and research synthesis §7, but the CSS comments only describe the z-index defensive purpose — not the stacking context hazard for future `position: fixed` descendants.
- **Why it matters:** If any future feature adds a tooltip, popover, or menu with `position: fixed` as a descendant of `.todo-item` (e.g., a right-click context menu, tag autocomplete dropdown), the fixed-position element will be trapped inside the transformed ancestor's stacking context and will not escape to the viewport level. This is a CSS-spec behavior (any `transform` other than `none` establishes a stacking context, and fixed-position descendants of stacking contexts are positioned relative to that context, not the viewport). The failure mode is silent: the element appears positioned but relative to the row, not the screen.
- **Proposed fix:** Add a comment to the `:hover` block noting the stacking context consequence: `/* Note: transform creates a new stacking context — any descendant with position:fixed will be trapped within this row's bounds. Do not add position:fixed children to .todo-item without removing or accounting for this transform. */`. No code change needed — the current `.todo-edit` button is `position: static` and is safe. The comment prevents future regressions.
- **Regression-guard:** optional (MEDIUM). Before adding any `position: fixed` descendant to `.todo-item`, manually verify it escapes to viewport level when the row is hovered.
- **Source critic:** web
- **Source axis:** Web Axis 6 — Accessibility / paint interactions
- **Original id:** M2

### LOW

#### [LOW] L1 — Reduced-motion does not null `position`/`z-index`

- **File:** `src/sections/sections.css`
- **Line:** 58-73
- **Anchor:** `[data-reduced-motion="true"] .todo-item:hover {`
- **What:** The dual-guard reduced-motion block (lines 58-73) nulls
- **Why it matters:** Cosmetic / theoretical. A future descendant of
- **Proposed fix:** Add `position: static; z-index: auto;` to the
- **Source critic:** adversary
- **Source axis:** m6-axis-F (reduced-motion completeness)
- **Original id:** L1

#### [LOW] L2 — Header comment references nonexistent anchor

- **File:** `src/sections/sections.css`
- **Line:** 52-53
- **Anchor:** `Mirrors the stagger pattern at sections.css §stagger-reveal`
- **What:** The new comment at line 53 references "sections.css
- **Why it matters:** Doc-drift. A future maintainer searching for
- **Proposed fix:** Replace `sections.css §stagger-reveal` with `sections.css:298`
- **Source critic:** adversary
- **Source axis:** axis-12 (doc drift)
- **Original id:** L2

#### [LOW] L3 — No `focus-within` lift symmetry with the edit-pencil affordance

- **File:** `src/sections/sections.css`
- **Line:** 116–119
- **Anchor:** `.todo-item:hover .todo-edit,`
- **What:** The existing `.todo-edit` affordance reveals on both `:hover` AND `:focus-within` (line 116–117), but the new lift effect only fires on `:hover` (inside the hover media query). Keyboard users tabbing through rows see the focus ring and the pencil button appear, but no lift — creating a minor asymmetry where the two paired affordances no longer fully mirror each other.
- **Why it matters:** This is a discoverability nuance, not a functional break. Keyboard users already see the focus ring as affordance, and the research synthesis §OQ4 explicitly deferred `focus-within` lift to a future polish item. The asymmetry is documented intent.
- **Proposed fix:** Defer to a future polish milestone. If symmetry is desired, add `.todo-item:focus-within { transform: translateY(-2px); box-shadow: 0 4px 12px oklch(0 0 0 / 0.18); position: relative; z-index: 1; }` inside the hover media query (or unconditionally, since keyboard focus is device-agnostic). Not blocking.
- **Regression-guard:** none required.
- **Source critic:** web
- **Source axis:** Web Axis 6 — Accessibility (WCAG AA focus management)
- **Original id:** L1

## What was done well

  - **Independent `npm run build` verified the implementer's chunk-size claim  _(adversary)_
  - **Transition declared on base rule, not in `:hover`** — armed in BOTH  _(adversary)_
  - **`@media (hover: hover) and (pointer: fine)` gate** correctly excludes  _(adversary)_
  - **Dual-guard reduced-motion** mirrors the established  _(adversary)_
  - **`oklch(0 0 0 / 0.18)` is theme-invariant** per the m3 rect convention —  _(adversary)_
  - **`position: relative; z-index: 1` defensive z-stacking** prevents the  _(adversary)_
  - **No `will-change` added** — implementer correctly declined the GPU hint  _(adversary)_
  - **Commit hygiene exemplary**: 42-char subject after `feat(style): ` prefix  _(adversary)_
  - **Implement synthesis** is precise: §1 names the exact line ranges, §3  _(adversary)_
  ---  _(adversary)_

## Recommended rectification order

H1, M1, M2, M3, L1, L2, L3
