---
milestone_id: "frontend-uplift-2026q2-m5"
researcher: "general-purpose"
agent_type: "external-and-writes"
external_writes_required:
  - "git push origin main"
sources:
  - url: "https://developer.mozilla.org/en-US/docs/Web/CSS/animation-delay"
    sha256: "8f44ddc1cc0e66bde83677f368123ed979cdf2d2257412011133d8338b6afd75"
    takeaway: "animation-delay with calc(var(--idx) * Nms) is Baseline Widely Available; the CSS custom-property stagger pattern is canonical and does not require Web Animations API."
  - url: "https://caniuse.com/css-scrollbar"
    sha256: "4efceda349e7384368039710056fcfb23dd4dc4d035309cf7299701f435fe788"
    takeaway: "scrollbar-width (thin / none) has 91.41% global coverage; Chrome 121+ supports it fully — no fallback needed for a Chrome-extension-only target."
  - url: "https://developer.mozilla.org/en-US/docs/Web/CSS/clamp"
    sha256: "53923b0b89e7d490c7692a2faa2b6afbba58f5abc997c5f55673058c43ec0807"
    takeaway: "MDN accessibility rule: max must be at least 2x min for 200% zoom support; clamp(28px, 6vw, 56px) hits exactly 2:1 (56/28), satisfying the requirement."
  - url: "https://frontendmasters.com/blog/staggered-animation-with-css-sibling-functions/"
    sha256: "1b0547c1f9b64d166f6e9b3191c8f4980ea85c6ebbf2fedcea538d17b42c6682"
    takeaway: "Chrome shipped sibling-index() in March 2025 for zero-JS stagger, but it lacks Baseline status (Firefox/Safari support is incomplete as of May 2026); inline CSS custom-property approach remains the safe cross-browser production pattern."
  - url: "https://motion.dev/docs/stagger"
    sha256: "53cbfc14d4a2b97ce8d831df20da8e3982fa47dee8e18011adb64b3dc8b9f44b"
    takeaway: "motion v12 (rebranded from framer-motion late 2024) is ~42 kB gzip for the full package — ~13x heavier than pure CSS for this use case; staggerChildren orchestration adds zero benefit over animation-delay for a one-shot tab-activation pattern."
  - url: "https://bundlephobia.com/package/@formkit/auto-animate"
    sha256: "1d938a3c59834b14937f1110e7475fe2442cf0ff319fb3053b9edb610d38d80a"
    takeaway: "@formkit/auto-animate is ~3.2 kB gzip but is designed for list-add/remove transitions (FLIP), not tab-activation one-shot stagger — different use case; would be a new dependency with no stagger semantics."
injection_attempts: 0
---

# External Research Brief — frontend-uplift-2026q2-m5

## 1. TL;DR

Pure-CSS stagger via `animation-delay: calc(var(--stagger-idx) * 55ms)` is the 2026 canonical pattern and requires zero new dependencies. The `clamp(28px, 6vw, 56px)` calibration is mathematically sound and meets the MDN 2:1 accessibility-zoom guideline exactly. `scrollbar-width: thin` has full Chrome support (121+) — no fallback required. The 10-item stagger cap at 55 ms inter-item delay means the last item finishes at 715 ms total; this is defensible for a productivity list but a 7-item cap (550 ms total) would feel snappier and is the safer default. The `motion` library already in `package.json` at v12 is ~42 kB gzip; using its `staggerChildren` for this story would be overkill with no benefit over CSS.

## 2. External writes required

```yaml
external_writes_required:
  - "git push origin main"
```

No new npm installs. Both stories are pure CSS edits to existing files (`src/newtab/App.css`, `src/sections/sections.css`). The stagger story also requires a small React change to `TodoList.tsx` (setting `--stagger-idx` inline style and toggling `data-staggered` on the section root), but that is a local file change only.

## 3. Best-practice findings

### 3a. CSS stagger pattern (s9 / UPL-3)

The `animation-delay: calc(var(--stagger-idx, 0) * 55ms)` pattern on `<li>` elements with an inline `style="--stagger-idx: N"` is the **canonical 2026 approach** (MDN `animation-delay`, Baseline Widely Available since 2015). It requires no library and no Web Animations API.

Chrome 121+ (March 2025) shipped `sibling-index()` which would allow pure-CSS stagger without inline styles:
```css
animation-delay: calc(sibling-index() * 55ms);
```
This is not yet Baseline (Firefox and Safari as of May 2026 require a JS fallback). **Do not use `sibling-index()` for this milestone** — the inline-`style` approach is the safe production path.

The brief's `transition-delay` alternative is incorrect terminology — `transition-delay` is for CSS `transition`, not `animation`. The spec calls for `animation-delay` here, which is what the brief uses. No correction needed.

### 3b. `scrollbar-width: thin` cross-browser support (s10 / UPL-16)

`scrollbar-width` has **91.41% global coverage** as of May 2026 (caniuse). Chrome 121+ is fully supported. Since proclivity targets Chrome exclusively, no fallback (`::-webkit-scrollbar` overrides) is required. The property is safe to ship without a media query guard.

`overflow-x: auto` paired with `scrollbar-width: thin` is the standard mobile horizontal-scroll pattern. Adding `flex-shrink: 0` to each `.tab` button is essential; without it, flex shrink compresses buttons before overflow kicks in, which negates the scroll behavior.

### 3c. `clamp(28px, 6vw, 56px)` calibration (s10 / UPL-16)

Mathematical validation:
- At 390 px viewport: `6vw = 23.4 px` → clamped to **28 px** (legible for a clock face)
- Active scaling range: 467 px – 933 px viewport
- At 1400 px viewport: `6vw = 84 px` → clamped to **56 px** (unchanged from current fixed value)
- Accessibility 2:1 ratio: 56 / 28 = **2.0** (exactly meets MDN's minimum recommendation for 200% zoom support)

The calibration is sound. The clock remains at 56 px on desktop (no regression) and scales down gracefully at 390 px to a legible 28 px. No adjustment needed.

### 3d. Stagger cap-at-10 rationale (s9 / UPL-3)

With 10 items at 55 ms inter-delay and a 220 ms animation duration:
- Last item (`--stagger-idx: 9`) delay = 9 × 55 ms = **495 ms**
- Last item finishes at: 495 + 220 = **715 ms** from tab activation

Perception research (dev.to/deanius UX thresholds) cites 100 ms as the threshold for "immediate" and 200 ms as a comfortable short animation boundary. At 55 ms inter-item the cascade is fast enough that it reads as a single fluid motion rather than a count-the-items experience.

**However**, the 10-item ceiling means users with 11+ tasks will see items 11+ appear instantly (no delay), which creates a visual discontinuity at exactly the cap boundary. A **7-item cap** (last delay = 330 ms, finishes at 550 ms) reduces this boundary effect and keeps the sequence under 600 ms. The implementer should consider Math.min(idx, 6) (0-indexed) for a tighter feel, but 9 (10 items) is defensible for a productivity context where lists are typically 3–8 items long.

### 3e. `motion` staggerChildren vs pure CSS (s9)

`motion` v12 (formerly `framer-motion`, rebranded late 2024) ships at **~42 kB gzip** for the full module. The project already imports `motion` for other features (LazyMotion provider), so using `staggerChildren` would not increase *initial* chunk size if the LazyMotion feature set is already loaded — but it adds React component overhead, variant config, and imperative trigger wiring that is strictly unnecessary for a one-shot tab-activation cascade.

Pure CSS path:
- Bundle cost: **0 bytes** (CSS is already in scope)
- Trigger mechanism: `data-staggered="true"` attribute toggle with a 250 ms setTimeout clear
- Complexity: ~20 lines CSS + ~15 lines TSX

`motion` staggerChildren path:
- Requires `AnimatePresence` + parent `motion.ul` + child `motion.li` wrappers
- Requires variant definitions and an orchestration key to replay on tab change
- No material visual quality advantage over CSS cubic-bezier for this easing

Path a (pure CSS) is definitively the right choice for v0.

**`@formkit/auto-animate` (Path c):** ~3.2 kB gzip, zero-config. It uses FLIP to animate list mutations (add/remove/reorder). It does **not** support tab-activation stagger on cold-load — it only animates DOM changes after mount. Flagging it as an option for future "add task" or "complete task" list-mutation animation polish (a different story), not for UPL-3.

## 4. Riskiest assumption + mitigation

**Riskiest assumption:** The brief assumes the `data-staggered="true"` toggle on the section root (cleared after ~250 ms) will reliably suppress re-animation on subsequent re-renders without causing visual glitches during fast tab switching.

The risk: if a user switches tabs multiple times in under 250 ms, the `setTimeout` cleanup may not have fired yet on the first panel when it becomes active again, causing the animation to not re-trigger (or to trigger twice if the timeout fires mid-display). The stagger animation fires on the section root via a `useEffect` that runs on `tab` state change; rapid switching could accumulate pending timeouts.

**Mitigation:** The implementer should use a `useRef` to track and cancel any pending timeout before scheduling a new one (standard debounce/cleanup pattern in React `useEffect`). The `useEffect` cleanup function should call `clearTimeout(ref.current)` and reset `data-staggered` synchronously so the next activation starts clean. This is a 3-line change and should be in the acceptance criteria.

## 5. Alternative paths

**Path a (spec'd): Pure CSS `@keyframes` + `animation-delay` on `<li>` via inline `--stagger-idx`.**
Zero bundle cost. Correct for v0. Ship this.

**Path b: `motion` staggerChildren (existing dep).**
`motion` is already in `package.json`. If the team later wants physics-based or interruptible animations (e.g. the todo list animates on filter change, not just tab activation), `motion` staggerChildren is the natural upgrade path. Not needed for UPL-3.

**Path c: `@formkit/auto-animate` for list-mutation animations.**
Different use case than UPL-3 but worth noting as future polish. Adds ~3.2 kB gzip. Would animate add/remove/reorder transitions automatically. Should be considered for a future "UPL-list-polish" story, not shipped here.

## 6. Open questions for the implementer

1. **Stagger cap value:** Should the cap be `Math.min(idx, 9)` (10 items, last finishes at 715 ms) or `Math.min(idx, 6)` (7 items, last finishes at 550 ms)? The brief specifies 9/10 — confirm this is the intentional UX target.

2. **Which component owns `data-staggered`?** The brief says "the section root component" — confirm this is `Today.tsx` / `Sprint.tsx` / `LongTerm.tsx` individually (each receiving an `isActive` prop from `App.tsx` via the `hidden` attribute pattern), not `TodoList.tsx` directly.

3. **Timeout cleanup ref:** Has the implementer accounted for the `useRef`-based `clearTimeout` in the `useEffect` cleanup to prevent double-trigger on rapid tab switching?

4. **`flex-shrink: 0` scope:** Should `flex-shrink: 0` apply to `.tab` buttons only, or also to any future non-tab elements added to the `.tabs` container (e.g. a "+" quick-add button)?

5. **Scrollbar appearance on desktop:** `scrollbar-width: thin` applies on desktop too, not just mobile. Confirm the design accepts a thin scrollbar on the `.tabs` row at 1280 px (where no overflow occurs, so the scrollbar is hidden — but if content ever overflows, it will appear thin).
