---
milestone_id: "frontend-uplift-2026q2-m4"
researcher: "general-purpose"
agent_type: "external-and-writes"
external_writes_required:
  - "git push origin main"
sources:
  - url: "https://developer.chrome.com/docs/web-platform/view-transitions/"
    sha256: "236f3426bd5e55f12c071238dca2ea8de76c17ae5dc783ceceb5b86c5b6ab04b"
    takeaway: "View Transitions API supported Chrome 111+/Firefox 144+/Safari 18+ for same-document; cross-document still absent from Firefox — not universally safe without a fallback wrapper."
  - url: "https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/inert"
    sha256: "0badfd12b36b5ef6ac8a03375b85bf7a693640d33192c2f7c3aad8e5cd8d2e71"
    takeaway: "inert removes elements from focus order and a11y tree while keeping them visually present — needed when content is visible-but-transitioning-out and hidden= is temporarily false."
  - url: "https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/hidden"
    sha256: "f0c5f5b6b3af0752aa558b2794249b35793d838270a5b59be28fe72348d120db"
    takeaway: "hidden= (no value / any value except 'until-found') maps to display:none — removes from layout AND from Tab order; hidden=false reasserts display:block and re-exposes descendants to Tab."
  - url: "https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API"
    sha256: "655a5eec0abdd1066cef529426d3221abcb802b095d564446abf4eb67a326049"
    takeaway: "document.startViewTransition() suppresses rendering during DOM update and auto-snapshots old/new states — eliminates manual position:absolute overlap coordination, but requires feature-detection for Firefox <144."
injection_attempts: 0
---

# External Research Brief — frontend-uplift-2026q2-m4

## 1. TL;DR

- The `position: absolute; inset: 0` overlap pattern is still the canonical CSS-only cross-dissolve in 2026. The View Transitions API is now the SOTA alternative (Chrome 111+, Firefox 144+, Safari 18+), but requires a `document.startViewTransition` wrapper + feature-detection, adding React integration complexity outside the CSS-only v0 scope.
- During the 220 ms `data-leaving` window, `hidden=false` means the leaving panel IS in the Tab order. `pointer-events: none` does not block Tab. `inert` is the correct defense-in-depth attribute to apply on `[data-leaving="true"]` elements — it removes them from focus AND the a11y tree while still visually present.
- `useLayoutEffect` is required (not `useEffect`) to commit `data-leaving` before paint, exactly as was done for `data-staggered` in m5 (same pattern, same lesson).
- The `.content` div already has `min-height: 400px` but does NOT have `position: relative` — the implementation must add that. The absolute-positioned leaving panel will collapse the content height to the incoming panel's intrinsic height, causing a potential height-jump. The existing `min-height: 400px` partially mitigates this.
- Rapid-tab-switching via the `useRef<number>` timeout pattern (already in App.tsx for `staggeredTab`) is the canonical React approach. The critical correctness guarantee: each new click MUST cancel the previous `leavingTab` timeout before setting a new one.

## 2. External writes required

```yaml
external_writes_required:
  - "git push origin main"
```

No Chrome Web Store publish, no service endpoints, no infra changes. This is a pure local-state + CSS delta.

## 3. Best-practice findings

### 3.1 Tab cross-dissolve: `position: absolute` overlap vs View Transitions API

**Source:** Chrome Developers — [View Transitions](https://developer.chrome.com/docs/web-platform/view-transitions/) · SHA256: `236f3426bd5e55f12c071238dca2ea8de76c17ae5dc783ceceb5b86c5b6ab04b`

**Source:** MDN — [View Transitions API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API) · SHA256: `655a5eec0abdd1066cef529426d3221abcb802b095d564446abf4eb67a326049`

The `position: absolute; inset: 0; opacity: 0; transition: opacity 220ms ease-out` pattern for cross-dissolve is still valid CSS-only practice in 2026. It requires:

1. The parent container (`<main class="content">`) to have `position: relative` (currently missing — must be added).
2. The leaving panel to be kept in the DOM with `hidden=false` for the animation duration.
3. The incoming panel to be the natural-flow (non-absolute) element that sets the container height.

The **View Transitions API** (`document.startViewTransition(() => domMutation)`) is the SOTA approach in 2026 for same-document transitions in SPAs. It:
- Suppresses rendering during the DOM update (eliminates paint-frame flash-of-content risk).
- Auto-manages snapshots of old/new states, removing the need for manual `position: absolute` overlap.
- Uses `::view-transition-old(root)` / `::view-transition-new(root)` pseudo-elements for CSS customization.
- Is supported in Chrome 111+, Firefox 144+, Safari 18+ for same-document transitions.

However, Firefox < 144 has no support at all. A `document.startViewTransition` call requires a feature-detection wrapper and a plain-DOM fallback, adding ~20–40 lines of React integration logic. The milestone explicitly scopes to CSS-only Path a — View Transitions is the appropriate **v1 alternative**, not the v0 path.

**Verdict for v0:** `position: absolute` overlap is the correct approach. Document VTA as Path c in the alternative paths section below.

### 3.2 `hidden=` vs `inert` during 220 ms fade-out window

**Source:** MDN — [inert](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/inert) · SHA256: `0badfd12b36b5ef6ac8a03375b85bf7a693640d33192c2f7c3aad8e5cd8d2e71`

**Source:** MDN — [hidden](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/hidden) · SHA256: `f0c5f5b6b3af0752aa558b2794249b35793d838270a5b59be28fe72348d120db`

The spec widens the `hidden` predicate: `hidden={tab !== id && leavingTab !== id}`. During the 220 ms window, the leaving panel has `hidden=false` AND `data-leaving="true"`. At that moment:

- `pointer-events: none` blocks mouse/touch but NOT Tab key focus.
- Screen reader users with `hidden=false` CAN navigate into the leaving panel via virtual cursor.
- The a11y tree includes the leaving panel's descendants while `hidden=false`.

**MDN is explicit:** `inert` removes elements from focus order, click events, AND the a11y tree while keeping them visually present. This is exactly the leaving-panel scenario.

**Recommendation:** the implementation SHOULD add `inert={leavingTab === id}` to each tabpanel `<div>` (alongside `data-leaving`). This is not strictly required by the brief's AC (which says `hidden=` reasserts after 220 ms is "sufficient"), but it closes the Tab-escape window that the brief itself flags as a risk. The adversary critic will almost certainly flag this as a HIGH finding if omitted. Document as an open question for the implementer.

**Note on `hidden` states:** `hidden=` (without `="until-found"`) maps to `display: none` and removes elements from layout AND Tab order. Once `hidden=false` is asserted, descendants are immediately Tab-reachable. There is no middle-ground in the `hidden` attribute itself — only `inert` provides "visible but non-interactive" semantics.

### 3.3 Flash-of-content risk and `useLayoutEffect`

The m5 codebase already demonstrates the canonical pattern: `useLayoutEffect` is used for `setStaggeredTab` (not `useEffect`) specifically to commit the `data-staggered` attribute before paint. The m5 web-perf critique identified this as a required fix (rect M6). The same logic applies to `leavingTab`:

- If `setLeavingTab` runs inside `useEffect`, React defers it to after the browser has painted the new DOM. This means there is a paint frame where:
  - The new tab's panel is visible (no longer `hidden`).
  - The old tab's panel is also not-`hidden` (predicate widened).
  - Neither has `data-leaving` set yet.
  - Both render at full opacity.

This is a visible flash-of-content on every tab switch.

- If `setLeavingTab` runs inside `useLayoutEffect`, the state update and DOM attribute commit happen synchronously before the browser paint. No flash frame.

**The implementation MUST use `useLayoutEffect` for the `leavingTab` state setup, mirroring the `staggeredTab` pattern exactly.**

Interaction concern: `useLayoutEffect` for both `staggeredTab` and `leavingTab` in the same component means two synchronous effects run on each tab click. Both are cheap (state set + `setTimeout` schedule), so layout-blocking cost is negligible.

### 3.4 Height-jump during cross-dissolve

When the leaving panel becomes `position: absolute`, it exits normal flow. The `.content` container collapses to the incoming panel's intrinsic height. If the incoming panel is shorter (e.g. Calendar with no events vs a full Gantt), the container shrinks instantly, causing a visible layout shift (CLS).

The existing `.content { min-height: 400px }` provides a partial floor. However, if the incoming panel is taller than 400px (e.g. a long sprint list), then navigating TO a shorter panel (e.g. Calendar) will still produce a height collapse.

**Known CSS patterns for stable-height cross-dissolve:**

1. **`min-height` on `.content`** — already present (400px). Mitigates most real cases in this app since all panels have substantial content. Not a complete fix but good enough for v0.
2. **`grid` stacking trick** — `display: grid` on `.content` with all children in `grid-area: 1 / 1` (same cell). Both panels stack; the grid row height follows the tallest. Avoids `position: absolute` entirely but changes the CSS model significantly.
3. **Explicitly set `min-height` on `.content` to `max(leaving.height, incoming.height)` via JS** — brittle, requires a ResizeObserver and JS involvement, contradicts CSS-only scope.

**For v0:** the existing `min-height: 400px` is the pragmatic mitigation. The implementer should document that the grid stacking alternative is a cleaner future path. No additional work required for AC satisfaction.

### 3.5 Rapid-switching robustness

The `useRef<number>` timeout cancel pattern is already implemented in App.tsx for `staggeredTab`:

```typescript
if (staggerTimeoutRef.current !== undefined) {
  window.clearTimeout(staggerTimeoutRef.current);
}
staggerTimeoutRef.current = window.setTimeout(..., 250);
```

The same pattern MUST be applied to the `leavingTab` timeout. The critical invariant: on each new tab click, the previous `leavingTab` timeout must be cancelled BEFORE setting a new `leavingTab`. Otherwise, a stale timeout fires and sets `leavingTab` to `null` prematurely, un-hiding the panel mid-fade.

**Rapid-click edge case (5 clicks in 50 ms):** with the cancel-and-reschedule pattern, each click:
1. Cancels the previous timeout (leavingTab stays at whatever value it was set to by the previous `useLayoutEffect` run).
2. Sets `leavingTab` to the newly-outgoing tab (via `useLayoutEffect`, synchronously before paint).
3. Schedules a new 220 ms timeout.

In a 50 ms burst, the `leavingTab` value will track the second-to-last tab clicked. The final click stabilizes and its 220 ms timeout clears. No stacking, no ghost panels. The CSS `position: absolute; inset: 0` means only one leaving panel occupies the absolute layer at a time — there is no mechanism for accumulation since `leavingTab` is a single `Tab | null` value.

**The one known footgun:** if the implementer uses `useEffect` instead of `useLayoutEffect`, on rapid clicks the timeout from a previous `useEffect` may fire and set `leavingTab` to `null` AFTER the new `useLayoutEffect` has already set it to the new leaving tab. This creates a 1-frame flash. `useLayoutEffect` avoids this by synchronously committing before the next paint.

## 4. Riskiest assumption + mitigation

**Riskiest assumption:** The spec assumes `useLayoutEffect` committing `data-leaving="true"` before the first post-click paint is sufficient to prevent flash-of-content. This is correct in React 18 Concurrent Mode with the default scheduler, but Chrome's compositor may still produce a frame where both panels appear at full opacity if the CSS transition `from` state (opacity: 0) has not yet been applied at the time of the first composite.

Concretely: `useLayoutEffect` commits the DOM attribute synchronously before the browser layout pass, but the CSS transition begins from the *committed* style value at the start of the next style recalculation. If `.content > [data-leaving="true"] { opacity: 0; transition: opacity 220ms ease-out }` is not in a stylesheet that has already been parsed, the transition start value defaults to 1 (current opacity), not 0. The `opacity: 0` in the rule body is the transition *target*, not the initial value — the *initial* value before the transition is the element's current rendered opacity, which is 1 at the moment `data-leaving` is set.

**This is a fundamental design issue in the spec:** the leaving panel fades FROM 1 TO 0 (it is currently at opacity 1 and transitions to opacity 0). That is intentional and correct. The flash-of-content risk is actually the incoming panel: if `@keyframes tabpanel-fade-in` doesn't execute with `animation-fill-mode: both` and `from { opacity: 0 }`, the incoming panel will flash at opacity 1 for one frame before the animation takes hold.

**Mitigation:** The incoming fade-in animation MUST use `animation-fill-mode: both` (which holds the `from` state before the animation starts) AND be triggered via `@keyframes` (not a CSS transition), since CSS animations with `fill-mode: both` hold the `from` value at t=0 before the first frame, while CSS transitions do not. This is the correct formulation in the brief and should be the top acceptance criterion.

**Alternative mitigation path (defensive):** Use `opacity: 0` as the default style on `div:not([hidden]):not([data-leaving])` tabpanels with `animation: tabpanel-fade-in 220ms ease-out both`. This ensures the initial paint of any incoming panel starts at opacity 0 even before the `@keyframes` begins.

## 5. Alternative paths

### Path A (spec — v0): CSS `[data-leaving]` with `position: absolute` + `@keyframes`
As specified. Zero new dependencies. Bundle delta < 1 KB. Compatible with Chrome MV3 extension environment without any `document.startViewTransition` availability concerns. Ships today.

### Path B: Reveal-only fallback (no fade-out)
Drop the `[data-leaving]` predicate widening and the `position: absolute` leaving rule entirely. Keep only the incoming `@keyframes tabpanel-fade-in` for 0→1. The outgoing panel hard-cuts (instant `hidden=true`), but the incoming panel fades in. Eliminates all flash-of-content, height-jump, and `inert`/Tab-escape concerns. Less polished but 100% safe. This is the spec's documented fallback if the adversary critique trips.

### Path C: View Transitions API (future v1)
`document.startViewTransition(() => { setTab(newTab); })` with `::view-transition-old(root)` / `::view-transition-new(root)` pseudo-elements for the cross-dissolve. Requires:
- Feature detection: `if (!document.startViewTransition) { setTab(newTab); return; }`
- React 18 flush: use `flushSync(() => setTab(newTab))` inside the `startViewTransition` callback to ensure React flushes synchronously.
- No `hidden=` predicate widening — VTA manages the old-state snapshot internally.
- Eliminates flash-of-content risk at the browser level (rendering suppressed during DOM update).
- Full browser support: Chrome 111+, Firefox 144+, Safari 18+. No support in Firefox < 144 (falls through to the feature-detection no-op).
- Bundle delta: ~0 KB (native API, no npm dependency).

This is the correct long-term path but requires additional React integration research to get the `flushSync` + React 18 concurrent renderer interaction right. Defer to v1.

## 6. Open questions for the implementer

1. **`inert` on leaving panel:** The spec does not include `inert={leavingTab === id}` but the brief acknowledges the Tab-escape window during 220 ms. Should `inert` be added as defense-in-depth at v0? The adversary critic will flag its absence as a HIGH a11y finding. Recommend YES — it is a one-word addition per tabpanel div.

2. **Two `useLayoutEffect` blocks:** The existing `staggeredTab` useLayoutEffect will coexist with the new `leavingTab` useLayoutEffect. Both run synchronously on each tab click. Confirm they can safely share a single `useLayoutEffect` body or must remain separate (recommend: separate, since `staggeredTab` clears at 250 ms and `leavingTab` clears at 220 ms).

3. **`position: relative` on `.content`:** The App.css `.content { min-height: 400px }` rule does NOT have `position: relative`. This MUST be added for `position: absolute` child panels to size correctly. Confirm no other children of `.content` are currently absolutely positioned (check `.section-empty` — it is not, so the addition is safe).

4. **`animation-fill-mode: both` on `tabpanel-fade-in`:** Confirm the incoming-panel `@keyframes` uses `animation-fill-mode: both` and `from { opacity: 0 }` to hold the initial state before the first paint frame. This is the primary flash-of-content defense.

5. **Gantt and Calendar panels lack `data-staggered`:** The App.tsx code shows Gantt and Calendar tabpanel `<div>`s have `hidden=` but no `data-staggered` attribute. Confirm whether the `[data-leaving]` implementation should be symmetric across ALL tabpanels (including Gantt, Calendar, Reminders, Closed) or only the panels that already have `data-staggered`. The brief implies all panels — implement consistently.
