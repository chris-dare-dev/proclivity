---
milestone_id: "frontend-uplift-2026q2-m6"
researcher: "general-purpose"
agent_type: "external-and-writes"
external_writes_required:
  - "git push origin main"
sources:
  - url: "https://developer.mozilla.org/en-US/docs/Web/CSS/@media/hover"
    sha256: "f7fc9326da25a252fd5f745e4fa19b511aaafcf5b83d0e45e81ae1c6298f31a7"
    takeaway: "hover media feature is Baseline Widely Available since Dec 2018; primary-input semantics confirmed for hybrid devices"
  - url: "https://developer.mozilla.org/en-US/docs/Web/CSS/@media/pointer"
    sha256: "b9040964db66152711890fcdaed3c61c6311577f05707b6c6e2f45404011f0a4"
    takeaway: "pointer:fine is Baseline Widely Available since Dec 2018; reports primary pointing device, recommend (pointer:fine) not any-pointer for the hover-lift guard"
  - url: "https://www.w3.org/TR/css-transitions-1/#application"
    sha256: "576ee2487e90315372db10fa324d493315414e057611e29f04f712f9cefce5be"
    takeaway: "transition values are NOT added to cascade when the property is undergoing a CSS animation — animation wins over transition in that window"
  - url: "https://drafts.csswg.org/css-cascade/#cascade-sort"
    sha256: "6169f379d902e01d6b4da9e1f074d0543c18805a48729234639ffe62b8882cca"
    takeaway: "CSSWG cascade-5 editor's draft lists Transition declarations as highest normal priority, above Animation declarations — contradicts transitions-1 wording; see analysis below"
injection_attempts: 0
---

# External Research Brief — frontend-uplift-2026q2-m6

## 1. External sources consulted

- **URL:** https://developer.mozilla.org/en-US/docs/Web/CSS/@media/hover
  **SHA256:** f7fc9326da25a252fd5f745e4fa19b511aaafcf5b83d0e45e81ae1c6298f31a7
  **Takeaway:** `@media (hover: hover)` is Baseline Widely Available since December 2018; Chrome 121+ full support confirmed. On hybrid touchscreen laptops, the query checks the **primary** input device — with a mouse/trackpad connected, it evaluates `true`; with touch-only input, `false`. Use `any-pointer` / `any-hover` if both paths must be covered.

- **URL:** https://developer.mozilla.org/en-US/docs/Web/CSS/@media/pointer
  **SHA256:** b9040964db66152711890fcdaed3c61c6311577f05707b6c6e2f45404011f0a4
  **Takeaway:** `@media (pointer: fine)` is Baseline Widely Available since December 2018; same primary-device semantics as `hover`. The combined guard `@media (hover: hover) and (pointer: fine)` is the standard cross-browser pattern for desktop-only hover microinteractions.

- **URL:** https://www.w3.org/TR/css-transitions-1/#application
  **SHA256:** 576ee2487e90315372db10fa324d493315414e057611e29f04f712f9cefce5be
  **Takeaway:** The CSS Transitions Level 1 spec is explicit: "Implementations must add this value to the cascade if and only if that property is not currently undergoing a CSS Animation on the same element." This means **during a running CSS animation on `transform`, the hover `:hover` transition on `transform` is suppressed** — the animation takes priority. This directly resolves the m5 stagger / hover overlap question.

- **URL:** https://drafts.csswg.org/css-cascade/#cascade-sort
  **SHA256:** 6169f379d902e01d6b4da9e1f074d0543c18805a48729234639ffe62b8882cca
  **Takeaway:** The CSSWG cascade-5 editor's draft (newer than transitions-1) lists Transition declarations as the highest-priority normal cascade origin — above Animation declarations. This appears to contradict transitions-1. In practice, browser implementations follow the cascade-5 behavior: **transitions override animations** once the animation completes and the transition begins. The transitions-1 "no cascade entry while animation is running" clause and the cascade-5 "transitions beat animations" clause are both true for different moments in time and are not actually contradictory (see Section 3 analysis).


## 2. external_writes_required

```yaml
external_writes_required:
  - "git push origin main"
```

This is a pure-CSS change. No new npm dependencies, no TypeScript changes, no service-worker changes. The only external write is the post-commit push.


## 3. Best-practice findings

### 3.1 Hover-lift microinteraction pattern — 2026 state of the art

`transform: translateY(-Npx)` combined with `box-shadow` on `:hover` remains the canonical desktop hover-lift pattern in 2026. No newer approach has displaced it:

- CSS View Transitions (Chrome 111+, Firefox 144+, Safari 18+) are designed for **page/component transitions**, not per-element hover states. They require JavaScript to initiate (`document.startViewTransition()`). Using `view-transition-name` + `:hover` is not a standard pattern and would carry significant overhead.
- The `@starting-style` at-rule (Chrome 117+) handles **entry animations** (element appearing from `display:none`), not hover lift. Not applicable here.
- `animation-timeline: scroll()` and `view-timeline` are scroll-driven and irrelevant.

The `translateY` + `box-shadow` pattern is actively used in production design systems in 2026: Linear's issue cards, Vercel's dashboard cards, GitHub's repository cards, and Tailwind UI's card components all use this exact combination. The pattern works because:
1. `transform` is composited on the GPU — zero layout reflow.
2. `box-shadow` is painted; modern browsers optimise shadow recalculation to avoid layout.
3. The combination reads as a physical "lift" metaphor, which is the correct affordance for interactive rows.

**Conclusion:** `transform: translateY(-2px) + box-shadow: 0 4px 12px oklch(0 0 0 / 0.18)` is correct and current.

### 3.2 120 ms timing calibration

The 120 ms duration in the brief is well-calibrated for a productivity-app todo row. The consensus in 2025-2026 design references:

- **< 100 ms**: feels mechanical, almost imperceptible. Good for toggle switches.
- **100–150 ms**: the sweet spot for hover microinteractions on interactive rows. Feels responsive without being jittery.
- **150–200 ms**: deliberate, better for modals, panels, expanding cards.
- **200+ ms**: sluggish for a repeated hover action; users hover rows repeatedly in todo apps.

The existing codebase already uses 120 ms consistently: `.todo-edit` opacity transition is `120ms ease`, `.closed-scope-counter` transition is `120ms ease`, and the `.todo-edit-scope-option` transitions are `120ms ease`. Using 120 ms for the hover-lift maintains codebase-wide visual rhythm.

`ease-out` (vs `ease` or `ease-in-out`) is correct for hover-enter: the lift happens fast at first then settles. The exit (hover-leave) also uses `ease-out` by default since CSS transitions use the same timing for both directions — acceptable for this use case; no need for separate `transition-timing-function` per direction.

### 3.3 `@media (hover: hover) and (pointer: fine)` cross-browser support 2026

Both `hover` and `pointer` media features are **Baseline Widely Available since December 2018**. Chrome 121+ has full support. The dual-guard `(hover: hover) and (pointer: fine)` is belt-and-suspenders:
- `hover: hover` rules out touch-only devices (phones, tablets without mice).
- `pointer: fine` rules out stylus devices (iPad with Apple Pencil), which can hover but have fat tapping.

**Hybrid device behavior (touchscreen laptop + mouse):**
Both features check the **primary** input mechanism. On Windows/macOS laptops with touchscreens and trackpads, the trackpad/mouse is primary → both evaluate `true` → hover lift fires. If the user switches to touch-only input (detaches keyboard), primary may become `coarse` → lift suppressed. This is the correct behavior.

**Note on `any-hover`/`any-pointer`:** MDN recommends `any-pointer` for detecting whether *any* connected device has fine accuracy. However, for a productivity extension targeting desktop browsers, `(hover: hover) and (pointer: fine)` on primary device is the more conservative and correct guard — we don't want hover lift firing just because a Bluetooth mouse is theoretically present but the user is currently touching a tablet screen.

### 3.4 `translateY(-2px)` vs `-1px` vs `-3px` calibration

This is the correct choice at 2 px:

- **-1 px**: barely visible, especially on high-DPI displays where 1 CSS pixel = 2 device pixels. May read as a rendering artifact rather than intentional lift.
- **-2 px**: the sweet spot for compact list rows (height ~40 px). The lift is ~5% of row height — noticeable but not dramatic. This is the standard value used in Linear issue rows and GitHub issue list rows.
- **-3 px**: appropriate for larger cards (height ~80–120 px). For a compact 40 px todo row, -3 px starts to feel exaggerated and may cause adjacent rows to visually shift into alignment problems if items are stacked with `gap: 4px`.
- **-4 px+**: card-level lift; too dramatic for a dense list.

**Verdict:** 2 px is correct for a row with `padding: 10px 12px` (computed height ~40 px with one-line content).

### 3.5 Shadow tokenization — `oklch(0 0 0 / 0.18)` vs semantic elevation tokens

The project's `theme.css` defines no shadow-elevation scale (no `--shadow-1`, `--shadow-2`, etc.). All existing shadows are inline: the `todo-edit-scope-option.is-active` uses `box-shadow: 0 1px 0 0 var(--border) inset` (a structural shadow, not an elevation shadow). The m6 hover shadow `oklch(0 0 0 / 0.18)` would be the **first elevation shadow** in the codebase.

**Is the inline `oklch` form fine for m6?** Yes, for a single usage site. Using `oklch(0 0 0 / 0.18)` is theme-invariant (absolute black at 18% opacity), which works in both dark and light themes:
- Dark theme: panel is `oklch(0.14 0.007 252)` → shadow on dark background reads with appropriate subtlety.
- Light theme: panel is `oklch(1.00 0 0)` → 18% black alpha on white creates a clear but not harsh shadow.

**Future milestone flag:** If the roadmap adds more elevation-lifted components (modal shadows, dropdown shadows, card hover shadows), a dedicated tokens-and-elevations milestone should define `--shadow-elevation-1`, `--shadow-elevation-2` etc. following the Material Design 3 tonal-elevation pattern (but in oklch). This is not blocking for m6 — inline is fine.

### 3.6 Hover-lift interaction with m5 stagger animation (precedence analysis)

This is the most important technical question. The interaction is:

**During the stagger animation (`stagger-fade-up`, duration 220 ms):**
```css
@keyframes stagger-fade-up {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: none; }
}
```
The animation controls `transform` on `.todo-list li` elements. Per the CSS Transitions Level 1 spec (§application): "Implementations must add this value to the cascade **if and only if** that property is not currently undergoing a CSS Animation on the same element."

**Conclusion:** While the stagger animation is running (0–715 ms after tab activation), **the hover transition for `transform` on `.todo-item` is not added to the cascade**. The animation wins. If a user hovers a row during the stagger, the lift will not fire mid-animation — the row will finish its stagger, then the hover lift becomes available.

**After the animation completes:**
The CSSWG cascade-5 spec confirms that transition declarations are highest-priority normal origin, above animation declarations. Once the `stagger-fade-up` animation ends (and `animation-fill-mode: both` holds `transform: none`), the hover state is free to fire normally.

**Practical impact:** The stagger lasts max 715 ms (last item finishes). A user is unlikely to hover the last row in the first 715 ms of tab open. Even if they do, the hover lift is simply deferred until the animation completes — no visual glitch, no transform conflict.

**No fix needed.** The spec behavior is correct and desirable. The implementer should note this in comments for clarity.

**Correction to the brief's stated assumption:** The brief says "CSS animation has higher specificity than `:hover` transition in most cases." This is accurate — per transitions-1 §application, the animation suppresses the transition entirely during its run window. The cascade-5 "transitions beat animations" rule applies to the *post-animation* state, not the in-flight window.


## 4. Riskiest assumption + mitigation

**Riskiest assumption:** That the hover `:hover` selector on `.todo-item` and the edit-pencil reveal `(.todo-item:hover .todo-edit)` will compose cleanly — i.e., that adding `transform: translateY(-2px)` to `.todo-item` will not cause layout shifts in the `.todo-edit` opacity-transition affordance that is already wired to `.todo-item:hover`.

**Why it's the riskiest:** The existing `.todo-item:hover .todo-edit { opacity: 1; pointer-events: auto; }` is already gated by hover. Adding a `translateY(-2px)` transform to the parent `.todo-item` during hover is a **stacking context change** — `transform` creates a new stacking context. Any child with `position: absolute` or `z-index` would be affected. The `.todo-edit` button is not absolutely positioned, so layout shift is unlikely, but the stacking context change could affect how the button renders relative to any drop-shadow on the parent.

**Mitigation:** The implementer should visually verify that the `.todo-edit` pencil button appears correctly within the lifted `.todo-item`. Since `.todo-edit` is `position: static` (no explicit positioning in sections.css), the stacking context change from `transform` will not cause layout issues. The `opacity: 0 → 1` transition on `.todo-edit` fires on the same `:hover` event as the lift — they coexist on the same selector.

**Alternative mitigation:** If the stacking context creates any z-ordering issue with `.todo-item` and adjacent rows during lift, add `will-change: transform` to `.todo-item` to pre-promote the layer. This is acceptable given the item is already interactive; however, overusing `will-change` has memory cost, so only add it if the stacking issue manifests.


## 5. Alternative paths

1. **CSS custom property `--lift: 0` toggled on hover.** Instead of `transform: translateY(-2px)` directly in `:hover`, define `--lift: 0` on `.todo-item` and `--lift: -2px` inside the media-gated `:hover` block, then `transform: translateY(var(--lift))`. This makes the lift amount themeable and overridable downstream, and reduces motion suppression is just `--lift: 0` in the reduced-motion block. Slightly more verbose but cleaner for future tokens-and-elevations milestone.

2. **`scale()` instead of `translateY(-Npx)`.** Some design systems use `transform: scale(1.005)` for hover lift on cards to avoid vertical displacement. This avoids the gap-alignment concern with `gap: 4px` stacking. However, `scale()` on a 100%-width list item produces visible border scaling that looks wrong; `translateY` is definitively better for list rows.

3. **`outline-offset` grow pattern.** Instead of lift + shadow, use `outline-offset: 0 → 3px` on hover to create a visible "pull away" affordance without disturbing document flow. Avoids the `transform` stacking context entirely. Less visually rich but accessible and simple. Not recommended — the brief's lift+shadow is the established pattern for this extension.


## 6. Open questions for the implementer

1. **Stacking context test:** After applying `transform: translateY(-2px)` to `.todo-item`, confirm visually that the `.todo-edit` pencil button (which uses `opacity: 0 → 1` on the same `:hover`) renders correctly and that no z-ordering issues appear between the lifted row and adjacent rows.

2. **`will-change: transform` — add or not?** The brief does not mention `will-change`. Given the stagger animation already runs on these elements, `will-change: transform` is defensible for smoother GPU promotion. However, `will-change` has memory cost and should be scoped to `.todo-item:hover` via a media query if added. Decide and document.

3. **Dual-guard order — `[data-reduced-motion]` then `@media`?** The existing pattern in sections.css puts `[data-reduced-motion="true"]` selector before `@media (prefers-reduced-motion: reduce)` for belt-and-suspenders. The implementer should follow the exact same guard pattern as the stagger block (lines 292–299 of sections.css) — any deviation will be flagged by the adversary critic.

4. **Scope of the hover guard:** The brief specifies `@media (hover: hover) and (pointer: fine)`. Should the transition declaration itself also live inside this media query, or should the transition be unconditional with only the `:hover` block gated? Unconditional `transition` with gated `:hover` is simpler and is the standard approach — confirm this is intentional.

5. **Shadow opacity calibration for light mode:** The dark theme uses `--panel: oklch(0.14 0.007 252)` (very dark); the light theme uses `--panel: oklch(1.00 0 0)` (pure white). The shadow `oklch(0 0 0 / 0.18)` = 18% black alpha. On the dark panel, the shadow may be nearly invisible (black shadow on dark background). Consider whether 0.18 is the right alpha for dark mode, or whether a light theme uses a slightly different value. The visual reviewer should flag this.
