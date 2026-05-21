# Critique — frontend-uplift-2026q2-m6 — milestone-web-perf-critic

**Critic:** milestone-web-perf-critic
**Commit range:** 5100d6b..81f05dd
**Generated:** 2026-05-20T23:00:00Z
**Diff stats:** 1 file changed, 44 insertions(+), 0 deletions(-)

## Verdict

SHIP-WITH-FIXES

The lift-on-hover implementation is technically sound: pure CSS, zero JS bundle delta, GPU-composited `transform`, correct `@media (hover: hover) and (pointer: fine)` gate, and a correctly mirrored dual-guard reduced-motion block that is itself redundant-to-the-nuclear-reset in `theme.css`. Two MEDIUM findings need attention before shipping: (1) the unconditional `transition` declaration on `.todo-item` will fire on touch/non-hover devices even though the lift values never apply — while functionally harmless today, it arms a 120 ms easing cost any time `transform` or `box-shadow` change on those elements for any future reason; (2) the `position: relative; z-index: 1` flip from `static` at hover-enter is architecturally safe today but undocumented as a "stacking context created" hazard for future descendant `position: fixed` elements. No CRITICALs or HIGHs found.

## Executive summary

- [CLEAN] Initial chunk unchanged at 235.57 kB (75.35 kB gzip) — well under the 400 kB soft warn and 500 kB hard ceiling. Pure CSS change contributes zero JS bytes.
- [CLEAN] `@media (hover: hover) and (pointer: fine)` guard is the correct 2026 pattern; touch devices never engage the lift. Matches codebase's existing `.todo-edit` pattern.
- [CLEAN] Dual-guard reduced-motion (both `[data-reduced-motion="true"]` and `@media (prefers-reduced-motion: reduce)`) correctly mirrors the stagger precedent at sections.css:287–299. The global `theme.css` nuclear reset (transition-duration: 0.01ms !important) provides a third independent layer.
- [CLEAN] `transform: translateY(-2px)` is GPU-composited — zero layout reflow. `box-shadow` is paint-only, also no layout shift. CLS = 0.
- [CLEAN] `position: relative; z-index: 1` applied only inside `:hover` rule, gated behind `@media (hover: hover) and (pointer: fine)`. At rest, `.todo-item` remains `position: static` (user-agent default). The paint-frame flip from static → relative does not cause measurable CLS because transform is composited first.
- [CLEAN] No `will-change` added — correct. The stacking-context overhead per-row would exceed any benefit for a low-frequency, 120 ms hover state.
- [MEDIUM M1] `transition` declared unconditionally on `.todo-item` arms a 120 ms easing window for ALL `transform` and `box-shadow` changes on that element, on ALL devices including touch — even though the hover values only apply on fine-pointer devices.
- [MEDIUM M2] The stacking context created by `transform: translateY(-2px)` on hover is load-bearing — any future `position: fixed` descendant of `.todo-item` would be trapped — but this is not documented in the CSS comments.

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

#### [MEDIUM] M1 — Unconditional transition fires on all devices including touch

- **File:** `src/sections/sections.css`
- **Line:** 33
- **Anchor:** `  transition: transform 120ms ease-out, box-shadow 120ms`
- **What:** The `transition` declaration on the base `.todo-item` rule is unconditional — it applies on touch/coarse-pointer devices where the hover lift values never fire, arming a 120 ms easing cost if `transform` or `box-shadow` are ever set on `.todo-item` by any future rule or JS.
- **Why it matters:** While functionally harmless today (no other rule sets `transform` or `box-shadow` on `.todo-item`), this creates a latent timing trap: any future feature that animates `.todo-item` rows (e.g., a swipe-to-delete gesture or drag-reorder) will inherit the 120 ms ease-out on touch devices without an explicit authoring decision. The canonical pattern — noted in both the research synthesis (§3.3) and brief-2 (§OQ4) as "correct" — places the transition unconditionally because it is needed for hover-leave smoothness; the risk is that "unconditional" was chosen for hover-leave but was not audited for the cross-device latent-animation side-effect.
- **Proposed fix:** Either (a) accept the current approach and add a comment explicitly documenting that the unconditional transition is intentional and that future rules adding `transform`/`box-shadow` to `.todo-item` on touch paths must audit this interaction; or (b) move the `transition` declaration inside the `@media (hover: hover) and (pointer: fine)` block alongside the `:hover` rule. Option (b) is cleaner but breaks the hover-leave animation on very-old browsers that support hover queries but not the combined `and` syntax — which is Baseline 2018 and a non-issue in practice. Recommended: option (a) with an explicit comment, since the research synthesis already chose the unconditional placement deliberately.
- **Regression-guard:** optional (MEDIUM). If option (b) is taken, verify hover-leave animation still fires by inspecting transitions in DevTools on Chrome 121+.
- **Source critic:** milestone-web-perf-critic
- **Source axis:** Web Axis 7 — Paint cost / transition scope

#### [MEDIUM] M2 — Stacking context created by hover `transform` is undocumented

- **File:** `src/sections/sections.css`
- **Line:** 44–49
- **Anchor:** `  .todo-item:hover {`
- **What:** `transform: translateY(-2px)` creates a new stacking context on every hovered `.todo-item`. This is correctly identified in brief-2 §4 (riskiest assumption) and research synthesis §7, but the CSS comments only describe the z-index defensive purpose — not the stacking context hazard for future `position: fixed` descendants.
- **Why it matters:** If any future feature adds a tooltip, popover, or menu with `position: fixed` as a descendant of `.todo-item` (e.g., a right-click context menu, tag autocomplete dropdown), the fixed-position element will be trapped inside the transformed ancestor's stacking context and will not escape to the viewport level. This is a CSS-spec behavior (any `transform` other than `none` establishes a stacking context, and fixed-position descendants of stacking contexts are positioned relative to that context, not the viewport). The failure mode is silent: the element appears positioned but relative to the row, not the screen.
- **Proposed fix:** Add a comment to the `:hover` block noting the stacking context consequence: `/* Note: transform creates a new stacking context — any descendant with position:fixed will be trapped within this row's bounds. Do not add position:fixed children to .todo-item without removing or accounting for this transform. */`. No code change needed — the current `.todo-edit` button is `position: static` and is safe. The comment prevents future regressions.
- **Regression-guard:** optional (MEDIUM). Before adding any `position: fixed` descendant to `.todo-item`, manually verify it escapes to viewport level when the row is hovered.
- **Source critic:** milestone-web-perf-critic
- **Source axis:** Web Axis 6 — Accessibility / paint interactions

### LOW

#### [LOW] L1 — No `focus-within` lift symmetry with the edit-pencil affordance

- **File:** `src/sections/sections.css`
- **Line:** 116–119
- **Anchor:** `.todo-item:hover .todo-edit,`
- **What:** The existing `.todo-edit` affordance reveals on both `:hover` AND `:focus-within` (line 116–117), but the new lift effect only fires on `:hover` (inside the hover media query). Keyboard users tabbing through rows see the focus ring and the pencil button appear, but no lift — creating a minor asymmetry where the two paired affordances no longer fully mirror each other.
- **Why it matters:** This is a discoverability nuance, not a functional break. Keyboard users already see the focus ring as affordance, and the research synthesis §OQ4 explicitly deferred `focus-within` lift to a future polish item. The asymmetry is documented intent.
- **Proposed fix:** Defer to a future polish milestone. If symmetry is desired, add `.todo-item:focus-within { transform: translateY(-2px); box-shadow: 0 4px 12px oklch(0 0 0 / 0.18); position: relative; z-index: 1; }` inside the hover media query (or unconditionally, since keyboard focus is device-agnostic). Not blocking.
- **Regression-guard:** none required.
- **Source critic:** milestone-web-perf-critic
- **Source axis:** Web Axis 6 — Accessibility (WCAG AA focus management)

#### [LOW] L2 — Shadow opacity calibration in dark mode may be too subtle

- **File:** `src/sections/sections.css`
- **Line:** 46
- **Anchor:** `    box-shadow: 0 4px 12px oklch(0 0 0 / 0.18);`
- **What:** `oklch(0 0 0 / 0.18)` is an 18% black alpha shadow. In dark mode the panel background is `oklch(0.14 0.007 252)` (very dark); a black shadow on a near-black surface at 18% opacity may be nearly invisible. Research synthesis §OQ1 flagged this explicitly as "ship 0.18; if reviewer flags it as too subtle in dark mode, rect-bump to 0.24."
- **Why it matters:** The lift visual effect may be imperceptible in dark mode, defeating its affordance purpose. This is a visual polish concern, not a correctness issue.
- **Proposed fix:** Confirm visually in dark mode. If the shadow reads as imperceptible, bump to `oklch(0 0 0 / 0.24)` for dark mode only using `[data-theme="dark"] .todo-item:hover { box-shadow: 0 4px 12px oklch(0 0 0 / 0.24); }` or invert the approach: use a light-color shadow in dark mode `oklch(1 0 0 / 0.06)`. Not blocking for this milestone.
- **Regression-guard:** none required.
- **Source critic:** milestone-web-perf-critic
- **Source axis:** Web Axis 6 — Accessibility (WCAG AA contrast)

## What was done well

- **Correct dual-guard reduced-motion pattern.** Both the `[data-reduced-motion="true"]` attribute selector and `@media (prefers-reduced-motion: reduce)` blocks are present and correctly null both `transform` and `box-shadow` properties. The pattern exactly mirrors the established `sections.css:279–296` stagger guard. The global `theme.css` nuclear reset (transition-duration: 0.01ms !important) provides a third independent protection layer — belt-and-suspenders implemented correctly throughout.
- **Unconditional transition for hover-leave smoothness.** Declaring `transition` on the base `.todo-item` rule (not inside `:hover`) correctly ensures the exit animation fires when hover state leaves. The research synthesis correctly identified this as the "canonical 2026 pattern" and the implementation followed it exactly.
- **Zero JS bundle impact.** The chunk remains at 235.57 kB (75.35 kB gzip), unchanged from the m4 baseline. Pure CSS additions have no impact on the Vite JS output. The build verification confirms this explicitly.
- **GPU-composited transform avoids CLS.** `transform: translateY(-2px)` runs on the compositor thread with zero layout reflow. Combined with `box-shadow` (paint-only, no layout), the implementation produces CLS = 0 — no measurable Cumulative Layout Shift from this feature.
- **Theme-invariant shadow color.** `oklch(0 0 0 / 0.18)` is absolute-black with alpha, which reads correctly in both dark and light themes without requiring a split token. Consistent with the m3 rect convention for the codebase.
- **Correct hover-only gate for touch devices.** `@media (hover: hover) and (pointer: fine)` is the correct combined guard — touch-only phones and tablets get `hover: none` and are excluded. The guard exactly matches the codebase's existing `.todo-edit` hover pattern, maintaining stylistic consistency.
- **Defensive z-index for shadow clipping.** Adding `position: relative; z-index: 1` inside the `:hover` rule prevents the drop shadow from being clipped by the next `.todo-item` in the 4px gap. This is correctly scoped to the hover state (not applied at rest) and correctly noted in comments.
- **No `will-change` added.** Correctly deferred — `will-change: transform` on every list row creates a new stacking context per row, consuming GPU memory. The 120ms short-duration hover does not benefit enough to justify this cost.
- **Comments are load-bearing and accurate.** Each block has a clear rationale comment referencing the milestone (m6-s12), the pattern being mirrored, and the cross-device behavior. Future maintainers will understand exactly why each block exists without consulting research notes.
- **Stagger interaction correctly resolved.** The CSS Transitions Level 1 §application suppression (hover transition not added to cascade during active animation) is correctly cited as the mechanism that prevents transform conflicts during the 0–715ms stagger window post-tab-activation. No code workaround needed; the spec behavior is correct.

## Recommended rectification order

M1, M2, L1, L2

M1 (comment clarifying unconditional transition intent) and M2 (comment documenting stacking context hazard) are cheap one-line-of-comment fixes that harden the implementation for future maintainers. L1 and L2 are deferred — both are explicitly documented as known deferred items in the research synthesis.

## Phase 4 status (filled by orchestrator at rectify time)

- Fixed: —
- Deferred: —
- Invalidated: —
- Regression tests added: —
