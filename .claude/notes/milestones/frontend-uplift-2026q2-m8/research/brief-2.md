---
milestone_id: "frontend-uplift-2026q2-m8"
researcher: "general-purpose"
agent_type: "external-and-writes"
external_writes_required:
  - "git push origin main"
sources:
  - url: "https://bundlephobia.com/api/size?package=sonner"
    sha256: "eedd8be507dc8fc3fa869d5a5e458c230323fc86ab5099c5f0846d83dc472409"
    takeaway: "sonner v2.0.7: 9,329 bytes gz, 0 transitive deps, hasSideEffects reported true by bundlephobia"
  - url: "https://bundlephobia.com/api/size?package=@formkit/auto-animate"
    sha256: "0a91290a7796f7bcaa2cc4588d9c8dac9c58819df3acb07cc33baf6b830f8bad"
    takeaway: "@formkit/auto-animate v0.9.0: 3,257 bytes gz, 0 transitive deps"
  - url: "https://registry.npmjs.org/sonner/latest"
    sha256: "4c7324bb55c7b86b24105bb981ce1237fae1a9b1877d4e097d83cd4dc3f0a765"
    takeaway: "sonner 2.0.7 MIT, peerDeps react/react-dom ^18 || ^19, published 2025-08-02"
  - url: "https://registry.npmjs.org/@formkit/auto-animate/latest"
    sha256: "2d075cdf2c5ca0b05d885854709bba212b4eaf1be3f146ddb25756e8d6c6126a"
    takeaway: "@formkit/auto-animate 0.9.0 MIT, zero deps, zero peerDeps, published 2025-09-05"
  - url: "https://raw.githubusercontent.com/emilkowalski/sonner/main/src/styles.css"
    sha256: "367f0324ade87c43d9e2257c28643d9459ece24f74223e01ccbd10467158a6ee"
    takeaway: "Sonner CSS includes @media (prefers-reduced-motion) block that sets transition:none !important + animation:none !important on all toast elements — native OS-level reduced-motion is handled by CSS, not JS"
  - url: "https://raw.githubusercontent.com/formkit/auto-animate/master/src/index.ts"
    sha256: "ba449bb63de2a1f31b190d801246b98fef445f3b9ddb188c787a5be4547aedff"
    takeaway: "auto-animate checks window.matchMedia('prefers-reduced-motion: reduce') at enable() time and skips all WAAPI animations if matched (and disrespectUserMotionPreference is falsy, which is the default)"
  - url: "https://raw.githubusercontent.com/formkit/auto-animate/master/src/react/index.ts"
    sha256: "ff4d3bab97cd95b5b92b66978e75a886dec02a3d12200667266ea94b5ffe80c9"
    takeaway: "useAutoAnimate returns [RefCallback<T>, (enabled: boolean) => void] — the first value is a ref callback (not a RefObject), assigned directly to the JSX ref prop of the ul element"
injection_attempts: 0
---

# External Research Brief — frontend-uplift-2026q2-m8

## 1. TL;DR

- **sonner v2.0.7** (MIT, 9.1 kB gz, zero transitive deps): confirmed React 18 + 19 compat, `aria-live="polite"` is the default, native prefers-reduced-motion handled via CSS `@media` block (kills all transitions + animations), zero CSP-unsafe code (no eval, Function constructor, or innerHTML). Published 2025-08-02 — actively maintained.
- **@formkit/auto-animate v0.9.0** (MIT, 3.2 kB gz, zero deps, zero peerDeps): confirmed React hook is `useAutoAnimate` returning `[RefCallback<T>, (enabled: boolean) => void]`. `disrespectUserMotionPreference` defaults to `false` — reduced-motion is checked natively at `autoAnimate()` call time via `matchMedia`. WAAPI targets `transform` + `opacity`. Published 2025-09-05 — actively maintained.
- **Bundle impact**: current main chunk is 81.9 kB gz. Adding both libraries brings the projected total to ~94.2 kB — well under the 270 kB m8 target and the 400 kB hard ceiling.
- **Riskiest assumption**: the brief's instruction to use `useReducedMotion()` to collapse sonner's `duration` to `0` ms would cause toasts to disappear instantly (unreadable). Sonner's CSS `@media` block already kills all animations natively; the JS duration should remain at 3500 ms regardless of motion preference, or at most collapse to `Infinity` (user dismisses manually). See Section 4.
- **WAAPI vs CSS stagger**: auto-animate uses WAAPI (`element.animate()`), m5 stagger uses CSS `@keyframes`. Per the Web Animations API spec, WAAPI and CSS animations are peers in the cascade — WAAPI effects have equal or higher priority. If a user adds a todo WHILE stagger is mid-run, auto-animate's WAAPI `translate(0,0)` call fires on the new element (not the staggering ones) — distinct element targets mean no conflict in practice.

---

## 2. External writes required

```yaml
external_writes_required:
  - "git push origin main"
```

`npm install sonner` and `npm install @formkit/auto-animate` are local filesystem mutations (package.json + node_modules), not external writes. No CWS publish is required for this milestone.

---

## 3. Best-practice findings

### s14 — sonner

**Version + license**
- Latest version: **2.0.7** (published 2025-08-02).
- License: **MIT** — confirmed via npm registry.
- Bundle: **9,329 bytes gz** / 34,217 bytes min. Zero transitive deps.
- Peer deps: `react ^18 || ^19 || ^19-rc`, `react-dom` same range — React 18.3.1 is fully in range.

**Toaster API (confirmed from source)**

| Prop | Type | Default | Notes |
|---|---|---|---|
| `position` | string | `"bottom-right"` | Default matches brief; no change needed |
| `theme` | `"light"` \| `"dark"` \| `"system"` | `"light"` | `"system"` enables `window.matchMedia(prefers-color-scheme)` auto-detection — appropriate for proclivity's theme tokens |
| `richColors` | boolean | `false` | Enables colored success/error states |
| `closeButton` | boolean | `false` | Shows an explicit dismiss button per toast |
| `duration` | number (ms) | `4000` (TOAST_LIFETIME const) | Brief specifies 3500 — override at Toaster level |

**prefers-reduced-motion handling**

Sonner ships native CSS-only reduced-motion support in `styles.css` (line 704):
```css
@media (prefers-reduced-motion) {
  [data-sonner-toast],
  [data-sonner-toast] > *,
  .sonner-loading-bar {
    transition: none !important;
    animation: none !important;
  }
}
```
This silences all CSS transitions and animations when the OS-level setting is active. There is **no JS-level duration manipulation** in sonner itself — the auto-dismiss timer still fires at `duration` ms regardless of motion preference. This is the correct behavior: the toast remains visible for 3500 ms but appears/disappears without animation.

**Implication for `useReducedMotion()` wiring**: the brief says "under reduced-motion the toast animates with a 0 ms duration and shows / hides instantly." Setting `duration={0}` would cause the toast to be dismissed before it can be read. The CSS-only approach (keep `duration={3500}`, rely on the `@media` block) is the correct v0 implementation. If the in-app `rs.reducedMotion` toggle (separate from OS signal) also needs to be respected, pass `duration={shouldReduceMotion ? Infinity : 3500}` and `closeButton={true}` — this gives the user a manual dismiss button without flashing a 0 ms toast. See Section 4 for full risk analysis.

**MV3 CSP compatibility**

Grep over `src/index.tsx`, `src/hooks.tsx`, `src/state.ts`: zero occurrences of `eval`, `Function(`, or `innerHTML`. Sonner renders React elements; any SVG icons are inlined as JSX. No runtime code generation. **CSP-safe for MV3.**

**a11y**

`src/index.tsx` line 779: `aria-live="polite"` is hardcoded on the toast list region. `aria-atomic="false"` allows individual toast announcements without re-reading the entire region. Both are the a11y-correct defaults for non-urgent feedback. Confirmed by source inspection — no configuration needed.

---

### s15 — @formkit/auto-animate

**Version + license**
- Latest version: **0.9.0** (published 2025-09-05).
- License: **MIT** — confirmed.
- Bundle: **3,257 bytes gz** / 8,327 bytes min. Zero deps, zero peerDeps.
- `sideEffects` field: absent from published package.json. Bundlephobia flags `hasSideEffects: true` because the library directly mutates element styles at enable-time (setting `position: relative`). This means Vite/rollup cannot fully tree-shake it, but the full package is 3.2 kB gz — acceptable.

**`useAutoAnimate` hook signature (confirmed from source)**

```typescript
// From @formkit/auto-animate/react/index.ts
export function useAutoAnimate<T extends Element>(
  options?: Partial<AutoAnimateOptions> | AutoAnimationPlugin
): [RefCallback<T>, (enabled: boolean) => void]
```

- Returns `[refCallback, setEnabled]` — not `[ref, enable]` as the brief states. The first element is a `RefCallback<T>`, not a `RefObject`. This means: `const [parent] = useAutoAnimate()` then `<ul ref={parent}>` — correct.
- `options.duration`: defaults to `250` ms (confirmed from source: `{ duration: 250, easing: "ease-in-out", ...config }`).
- `options.easing`: defaults to `"ease-in-out"`.
- `options.disrespectUserMotionPreference`: defaults to `false` — reduced-motion is respected by default.

**Reduced-motion handling (confirmed from source, line 888)**

```typescript
const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
const isDisabledDueToReduceMotion =
  mediaQuery.matches &&
  !isPlugin(config) &&
  !(config as Partial<AutoAnimateOptions>).disrespectUserMotionPreference
if (!isDisabledDueToReduceMotion) {
  enabled.add(el)
  // ... sets up MutationObserver
}
```

When `prefers-reduced-motion: reduce` matches, `autoAnimate()` simply does not add the element to the `enabled` set — list mutations still happen (DOM changes), but no WAAPI calls fire. The result is instant (no animation) add/remove behavior. **No JS guard needed from the implementer — native handling is sufficient.**

**`@formkit/auto-animate/react` entry point (confirmed from package exports map)**

The published package exports map explicitly includes:
```json
"./react": {
  "types": "./react/index.d.ts",
  "import": "./react/index.mjs",
  "default": "./react/index.mjs"
}
```

The `/react` entry is ESM-only (`*.mjs`), which Vite will tree-shake correctly. The root `.` entry is also ESM (`index.mjs`). Using `import { useAutoAnimate } from "@formkit/auto-animate/react"` is correct and preferred.

**FLIP cost with 5–20 rows**

auto-animate uses FLIP: on each MutationObserver callback, it reads current element positions (layout read), stores them, lets the DOM mutation happen, then reads new positions (second layout read), then calls `element.animate([{transform: delta}, {transform: "translate(0,0)"}], {duration: 250})` via WAAPI. This triggers one pair of forced layout reads + one WAAPI call per affected element per mutation. With 5–20 rows and single-item mutations (add one todo, complete one todo), this is 1–2 elements per mutation = trivially cheap. No perf concern for v0.

**WAAPI vs CSS stagger (m5-s9 interaction)**

auto-animate uses `element.animate()` (WAAPI) targeting `transform` and `opacity` on the **newly added element**. The m5 stagger uses CSS `@keyframes stagger-fade-up` targeting `transform: translateY(8px → 0)` on **existing list items** (those already in the DOM that get re-indexed).

These target **different elements** at mutation time: auto-animate fires on the new element being added; stagger fires on existing `li` elements when `data-staggered="true"` is set on the parent (tab activation). A user adding a todo mid-stagger is a rare race, but even if it occurs: the new `li` gets auto-animate's WAAPI transform-from-scale animation; the existing `li` items continue their `@keyframes` stagger animation. WAAPI and CSS `@keyframes` can run simultaneously on the same element targeting the same property — WAAPI wins per Web Animations API cascade rules. But since the new element has no CSS `@keyframes` stagger running on it (it was just added, so `--stagger-idx` is not set yet), there is no actual conflict. **v0 acceptable behavior — no code guard needed.**

**WAAPI vs m6 lift-on-hover interaction**

auto-animate fires on `MutationObserver` callbacks (DOM mutations). Hover-lift fires on `:hover` (CSS transition). These trigger on completely different user actions — mutation (add/complete) vs pointer hover. The window where a user hovers a list item WHILE auto-animate is in the 250 ms WAAPI transition window is real but benign: WAAPI `transform` overrides CSS `transition: transform` during the 250 ms window; once the WAAPI animation completes, the CSS transition reasserts. This is a cosmetic flicker (hover lift briefly suppressed then restored) lasting 250 ms — acceptable for v0. No code guard warranted.

---

### Bundle delta verification

| Source | Raw | Gz |
|---|---|---|
| Current main chunk (post-m10) | 259,241 bytes | 81,879 bytes (81.9 kB) |
| sonner addition | +34,217 bytes | +9,329 bytes |
| auto-animate addition (TodoList + SprintManager both eager) | +8,327 bytes | +3,257 bytes |
| **Projected total** | **301,785 bytes** | **96,465 bytes (94.2 kB)** |

Both libraries are imported by components that are **eagerly loaded** in the initial chunk (TodoList, SprintManager are not lazy-loaded). ClosedTodosView imports auto-animate too but that chunk is lazy — its chunk grows independently. Sonner is mounted at App root = always in initial chunk. The 270 kB gz m8 target is met with 175 kB headroom.

---

## 4. Riskiest assumption + mitigation

**Riskiest assumption**: the brief instructs "wraps the Toaster mount in a `useReducedMotion()` short-circuit that sets `theme="system"` + `closeButton` + `duration={3500}`" and then says "under reduced-motion the toast animates with a 0 ms duration and shows / hides instantly."

If the implementer interprets "0 ms duration" as `duration={0}`, toasts will be immediately dismissed on mount — users in reduced-motion mode will never see the feedback message. This contradicts the feature's purpose (confirmation feedback).

The correct implementation: **sonner's CSS `@media (prefers-reduced-motion)` block already collapses all animations to instant — the implementer does not need to manipulate `duration` at all.** The JS `duration` prop controls the auto-dismiss timer (how long before the toast is removed from the DOM), not the animation duration. These are orthogonal.

Recommended approach for the implementer:
1. Mount `<Toaster position="bottom-right" theme="system" richColors closeButton duration={3500} />` unconditionally — no `useReducedMotion()` wrapper needed.
2. If the in-app `rs.reducedMotion` toggle (from `resolvedSettings()`) should also be respected, derive `shouldReduceMotion = osReduced || rs.reducedMotion` and pass `duration={shouldReduceMotion ? Infinity : 3500}` so the toast stays visible until the user explicitly dismisses it (the `closeButton` prop handles this). Do NOT use `duration={0}`.

---

## 5. Alternative paths

1. **Skip `useReducedMotion()` entirely for sonner** — Sonner's native CSS `@media` block covers OS-level reduced-motion. Proclivity already has an in-app toggle (`rs.reducedMotion`), but for a toast library this level of integration is optional for v0. Mount with a fixed `duration={3500}` and rely on sonner's CSS. Simpler, less code, same a11y outcome.

2. **Use `react-hot-toast` instead of sonner** — `react-hot-toast` is 5.0 kB gz, also MIT. However, it lacks the `richColors` / `closeButton` / `theme="system"` props that the brief specifies. Sonner is the better fit for this codebase's requirements.

3. **Scope auto-animate to TodoList only (not SprintManager/ClosedTodosView) for v0** — reduces the integration surface and limits the WAAPI/stagger interaction surface. Can be expanded incrementally. Risk is that the brief explicitly calls out SprintManager's active sprint `<ul>` and `ArchivedSprintRow` `<ul>` — deferring these would be a partial-ship.

---

## 6. Open questions for the implementer

1. **`duration={0}` vs `duration={Infinity}` under reduced-motion**: the brief says "shows / hides instantly" but this makes the toast unreadable. Clarify: should reduced-motion users get (a) no animation but normal 3500 ms display time, (b) no animation + manual-dismiss-only (`Infinity` + `closeButton`), or (c) no sonner at all? Recommendation: option (a) — rely on CSS `@media` only, no JS duration adjustment.

2. **`theme="system"` vs explicit theme from proclivity's theme tokens**: sonner's `theme="system"` reads `prefers-color-scheme`. Proclivity may already track dark/light theme explicitly in `state.settings` — if so, derive the sonner `theme` prop from the settings state rather than re-reading the media query independently. Check `resolvedSettings()` for a theme field before mounting with `theme="system"`.

3. **ClosedTodosView is lazy-loaded**: auto-animate is used in `ClosedTodosView.tsx`. Since that chunk is lazy, auto-animate code will be present in both the initial chunk (via TodoList/SprintManager) AND in the ClosedTodosView chunk (duplicated by Vite if not properly deduped). The implementer should verify via `vite build --report` that auto-animate is not duplicated across chunks. If it is, move it to a shared chunk or accept the duplication (3.2 kB gz is trivially small).

4. **`ArchivedSprintRow` `<ul>` target**: the brief mentions applying `useAutoAnimate` to `ArchivedSprintRow`'s `<ul>`. Confirm this component exists and renders a `<ul>` directly (not a mapped child) — if the `<ul>` is in a different component, `useAutoAnimate` must be applied at the component that owns the `<ul>` ref, not a parent.

5. **`hasSideEffects` absent from auto-animate's package.json**: Vite/rollup may not fully tree-shake auto-animate. This is immaterial at 3.2 kB gz, but the implementer should NOT pass `sideEffects: false` to vite config for this package — the library writes to element styles at enable-time and has genuine side effects.
