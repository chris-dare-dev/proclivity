# Current-State Critic Brief — 2026q2-visual-refresh

**Uplift ID:** 2026q2-visual-refresh
**Date:** 2026-05-20
**Codebase read depth:** Full pass — all section components, shared components, CSS, theme, App scaffolding, design-system reference, motion-vocabulary reference.

---

## 1. Executive summary

Proclivity's visual baseline is clean and token-disciplined, but it falls short of 2026 SOTA on five axes that matter most to a daily-use personal planning surface. The highest-severity gaps are: (1) **zero section-switch animation** — tab changes are instantaneous hard-cuts, which is the first thing a 2026 designer or user notices compared to Notion/Linear/Sunsama; (2) **no skeleton loading states** — all async-suspended surfaces (Photos, Gemini, Calendar, Chat) fall back to `null`, leaving blank holes with no progress signal; (3) **no stagger-reveal on cold-load todo lists** — Today/Sprint/LongTerm land as static blocks with no perceptual animation, a contrast to every major 2026 productivity app; (4) **modal entry uses only a fade-up** — the 2026 expectation is `[MOT-4 scale-in]` paired with a heavier-but-refined backdrop blur; and (5) **system font stack with no variable-weight heading** — the greeting / clock headline area has the visual weight of a default OS font rather than a purposeful brand surface. There are no CRITICAL gaps (no light-theme hard crashes, no viewport overflow at 1100 px), but the four HIGHs are confirmed by the design-system reference's §7 "underdeveloped" list.

---

## 2. Critical gaps

None found. The design system is coherent under both themes; no layout overflow at the `max-width: 1100px` constraint was observed in code; the mesh background uses `opacity: var(--mesh-intensity)` rather than hardcoded color, so the light-theme transition is safe.

---

## 3. High gaps

### H1 — Section-switch animation absent

**Severity:** HIGH
**Affected:** `src/newtab/App.tsx:418–509` (all tabpanel `hidden=` toggles), `src/newtab/App.css:81–104`

The tab system uses the HTML `hidden` attribute to show/hide panels. There is no CSS `transition`, `animation`, or `@keyframes` on `.content` or the tabpanel `div`s for section switches. Switching from Today to Sprint, for instance, produces an instantaneous content swap with zero visual continuity.

**Token/motion conflict:** None today, but any added animation MUST be scoped to `@media (prefers-reduced-motion: no-preference)` per the `index.css` baseline and the `[data-reduced-motion="true"]` attribute gate in `theme.css`.

**2026 SOTA expects:** Notion, Linear, and Sunsama all cross-fade or slide-in their panel content on view switches. The motion vocabulary defines `[MOT-50 section-fade]` (cross-fade between tabs) as the appropriate primitive. Framer Motion `AnimatePresence` + `motion.div` `initial/animate/exit` is the standard implementation; with `React.lazy`, the motion library stays out of the initial chunk.

**Credible v1:** Replace `hidden={tab !== id}` with CSS-class-driven fade (`opacity 0 → 1`, `translateY 6px → 0`, 220 ms ease-out), scoped inside `@media (prefers-reduced-motion: no-preference)`. No library needed for this surface — a single CSS `@keyframes tab-panel-in` on `.tabpanel-visible` keeps the initial chunk clean. A Framer Motion upgrade (for `AnimatePresence` + `exit` animations) is a follow-up candidate.

**Why not fixed:** The "keep all sections mounted" decision (`App.tsx` comment at line 414) pre-empts React unmount/remount animation patterns, and no post-commit motion pass has been scoped. The team chose stability over polish when making the mount decision.

---

### H2 — No skeleton loading states on async-suspended surfaces

**Severity:** HIGH
**Affected:** `src/newtab/App.tsx:239` (SettingsModal `fallback={null}`), `src/newtab/App.tsx:371–393` (Photos `fallback={null}`), `src/newtab/App.tsx:380–383` (QuickPrompt `fallback={null}`), all `<Suspense fallback={null}>` sites

Every lazy-loaded chunk and every async-data surface (`Photos`, `QuickPrompt`, `Calendar`, `ChatPanel`, `SettingsModal`) uses `fallback={null}`. On a cold load or slow device, these surfaces produce blank holes — the Photos banner slot collapses, the QuickPrompt area is absent, the Calendar tab renders nothing. The user has no signal that content is loading vs. unavailable.

**Token/motion conflict:** The `[MOT-13 skeleton-shimmer]` primitive requires `@keyframes` scoped to `@media (prefers-reduced-motion: no-preference)` — without that guard the shimmer degrades to a static tinted background, which is still better than `null`. The shimmer keyframe must be absent from the reduced-motion block.

**2026 SOTA expects:** Every major 2026 productivity SaaS (Notion, Linear, Todoist) uses pulsing skeleton rectangles for known-shape content (Photos banner = one rectangular skeleton of fixed `clamp(140px, 22vh, 220px)` height; QuickPrompt = a single input-shaped skeleton; Calendar = a grid skeleton). The skeleton primitive is already named in the design-system reference §7.

**Credible v1:** A `<SkeletonBlock>` component (`width: 100%, height: var`, `background: var(--panel-2)`, shimmer via `@keyframes skeleton-shimmer` scoped to `no-preference`) costs ~40 lines of CSS and one shared component. The Photos `<Suspense>` gets a fixed-height skeleton that matches the banner's `clamp(140px, 22vh, 220px)` shape so no layout shift occurs when real content arrives. QuickPrompt gets a 44 px input-shaped skeleton.

**Why not fixed:** The `fallback={null}` decision was explicitly pragmatic — "avoid layout shift while the lazy chunk loads" — and is documented in `App.tsx:380–383`. A skeleton requires knowing the committed height of the eventual content, which was deferred as non-trivial.

---

### H3 — No stagger-reveal on todo list cold loads

**Severity:** HIGH
**Affected:** `src/sections/TodoList.tsx:251–263` (list mode `<ul>` render), `src/sections/sections.css:14–17` (`.todo-list`)

The `TodoList` renders all items in a single `ul.todo-list` with no entry animation. Each `TodoItem` appears simultaneously at the same opacity. On a cold load with 10–20 items, the list appears to "pop in" as a block — there is no perceptual flow that guides the eye down the list.

**Token/motion conflict:** `[MOT-3 stagger-reveal]` must be gated by `@media (prefers-reduced-motion: no-preference)`. The global `prefers-reduced-motion: reduce` block in `theme.css:134–143` already collapses all `animation-duration` values to `0.01ms` — any keyframes not scoped to `no-preference` will be neutralized automatically, making this a safe addition that degrades to no-animation for reduced-motion users without explicit guards per-item.

**2026 SOTA expects:** Linear, Sunsama, and Notion all stagger-reveal list content. The design-system reference §7 names this explicitly: "no animated transitions between section tabs — abrupt content swaps". Framer Motion `staggerChildren` (lazy-loaded) or CSS `animation-delay: calc(N * 40ms)` on `:nth-child()` selectors are both viable.

**Credible v1:** Pure CSS: add `@keyframes fade-up-item { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }` scoped inside `@media (prefers-reduced-motion: no-preference)` in `sections.css`. Apply with `animation-delay: calc(var(--item-index, 0) * 50ms)` on `.todo-item`, set via `style={{ "--item-index": index }}` in `TodoItem.tsx`. Cap at ~10 items (beyond that, the last item waits 500 ms, which is annoying) by clamping the delay at `min(var(--item-index), 10) * 50ms`.

**Why not fixed:** No motion pass has been scoped. The list was built for correctness (filter, tags, closed-counter) not for visual polish. The CSS custom property injection into a shared component is a non-trivial decision.

---

### H4 — System font stack; no variable-weight for hero headline

**Severity:** HIGH
**Affected:** `src/newtab/index.css:10–14` (font-family stack), `src/newtab/App.css:16–20` (`.greeting`, `.clock` font sizes)

The `.greeting` (32 px, `font-weight: 600`) and `.clock` (56 px, `font-weight: 300`) use the browser's default system stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, …`). Both are prominent hero elements — the greeting is the first thing a user reads on every new tab. There is no variable-font weight ramp, no tracked or optical-sized heading, and no purposeful brand typographic identity.

**Token/motion conflict:** None. Font changes do not interact with motion or tokens.

**2026 SOTA expects:** Todoist, Sunsama, Notion, and every 2026 personal-productivity dashboard pick a variable-weight sans-serif (Inter, Geist, Plus Jakarta Sans) for the heading cluster and vary `font-weight` across the `100–800` range for visual hierarchy. The design-system reference §7 cites "no theme variants beyond light/dark" but typography upgrade is a distinct candidate.

**Credible v1:** Use `@font-face` with a self-hosted variable woff2 (e.g., Inter from `fontsource` at ~36 KB gzip for the latin subset), or reference it via a `<link>` in `index.html`. Apply `font-family: 'Inter var', …fallbacks` on `:root` in `index.css`. Set `.clock { font-variation-settings: 'wght' 200; }` and `.greeting { font-variation-settings: 'wght' 640; }` for a distinctive weight ramp. The design-system reference notes this as a "non-trivial bundle commitment" — keep gzip cost under ~50 KB by restricting to latin subset and removing unused axes.

**Why not fixed:** The design-system reference explicitly calls out "Proclivity does not bundle a custom font today — proposing one is a non-trivial bundle commitment" (§3). The upgrade has been deferred in favor of staying under the 200 KB initial chunk budget.

---

## 4. Medium gaps

### M1 — Modal entry lacks scale-in; backdrop uses flat rgba(0,0,0,0.6) without blur

**Severity:** MEDIUM
**Affected:** `src/components/Modal.css:1–16` (backdrop), `src/components/Modal.css:18–32` (modal panel), `@keyframes modal-slide-in` (translateY -8px → 0)

The modal opens with a `modal-fade-in` on the backdrop (opacity 0 → 1, 120 ms) and a `modal-slide-in` on the panel (translateY -8px → 0, 150 ms). The backdrop is a flat `rgba(0,0,0,0.6)` with no `backdrop-filter: blur()`. The 2026 standard for modals in productivity apps is `[MOT-4 scale-in]` on the panel (scale 0.97 → 1, opacity 0 → 1) plus a `backdrop-filter: blur(12px)` frosted-glass backdrop.

**Token/motion conflict:** `backdrop-filter: blur()` must be gated behind `@supports (backdrop-filter: blur(1px))` for older browsers, but Chrome 120+ (the only browser for a Chrome extension) supports it unconditionally. The `modal-slide-in` and `modal-fade-in` animations are already guarded by the two reduced-motion blocks at `Modal.css:99–109`.

**2026 SOTA expects:** Frosted backdrop + scale-in panel is the universal 2026 modal language in Linear, Craft, Notion, and Arc browser panels.

**Credible v1:** In `Modal.css`: change `.modal-backdrop { background: rgba(0,0,0,0.35); backdrop-filter: blur(12px); }`. Change `@keyframes modal-slide-in` to include `scale(0.97) → scale(1)` alongside the translateY. Both are ~4 line changes.

**Why not fixed:** The modal pattern was built to correctness first (focus trap, aria-modal, escape handling); visual polish was deferred.

---

### M2 — Sprint progress bar `transition: width 0.3s ease` has no reduced-motion guard

**Severity:** MEDIUM
**Affected:** `src/sections/sprint/sprint.css:185` (`.sprint-progress-bar-fill { transition: width 0.3s ease; }`)

The sprint progress bar animates its width with a raw `transition: width 0.3s ease` that has no `@media (prefers-reduced-motion: reduce)` guard or `[data-reduced-motion="true"]` rule. The global `theme.css:134–143` block sets `transition-duration: 0.01ms !important` which technically suppresses it, but the pattern breaks the self-documenting convention used everywhere else (explicit `[data-reduced-motion]` guard + `@media` guard on every animated element).

**Token/motion conflict:** This IS a token-discipline gap — the sprint progress fill is the only animated element in the codebase that relies solely on the global override rather than declaring its own reduced-motion rule. It creates a silent dependency on the global fallback.

**2026 SOTA expects:** Every motion point has explicit, self-contained reduced-motion fallbacks. The `card.css` and `sections.css` both set `[data-reduced-motion="true"] .X { transition: none }` explicitly — `.sprint-progress-bar-fill` should match that pattern.

**Credible v1:** Add to `sprint.css`: `[data-reduced-motion="true"] .sprint-progress-bar-fill { transition: none; }` and `@media (prefers-reduced-motion: reduce) { .sprint-progress-bar-fill { transition: none; } }`.

**Why not fixed:** Oversight during the `sprint-backlog-redesign-m1/m2/m3` milestones. The global fallback masks the omission.

---

### M3 — Gantt date input hardcodes `color-scheme: dark`, breaks light theme

**Severity:** MEDIUM
**Affected:** `src/sections/gantt/gantt.css:143` (`.gantt-task-date { color-scheme: dark; }`)

The Gantt task date `<input type="date">` has `color-scheme: dark` hardcoded. In light mode (`[data-theme="light"]`), native date picker chrome continues to render in dark (dark popup calendar, dark text) because the `color-scheme` property on the input overrides the root-level `color-scheme: light` set in `theme.css:67`. This produces a visual regression: a light-theme user sees dark date inputs against a light background.

**Token/motion conflict:** `color-scheme` is a token-discipline issue — the value should read from the resolved theme, not be hardcoded. The correct pattern is to NOT set `color-scheme` on individual inputs and let `[data-theme="light"] { color-scheme: light }` from `theme.css` cascade to all descendants.

**2026 SOTA expects:** Native form elements follow the page's `color-scheme` token; nothing overrides it at the component level unless there's a specific reason (e.g., a dark-only widget inside a light layout).

**Credible v1:** Remove `color-scheme: dark` from `.gantt-task-date`. The root-level `color-scheme` token in `theme.css` correctly flips light/dark per `data-theme` attribute and will cascade. This is a 1-line removal.

**Why not fixed:** The Gantt section was originally built against a dark-only baseline, and `color-scheme` was added as a quick fix to make the native date input usable. The light theme was introduced later and the Gantt component was not audited.

---

### M4 — Unicode character icons lack consistent visual weight and are screen-reader fragile

**Severity:** MEDIUM
**Affected:** `src/components/TodoItem.tsx:68` (`✎` pencil), `src/components/TodoItem.tsx:80` (`✕` delete), `src/components/QuickPrompt.tsx:133,150,166` (`✕`), `src/components/ClosedScopeCounter.tsx:35` (`→`), `src/components/settings/LogViewer.tsx:267` (`▾` / `▸`)

These six UI affordance points use plain Unicode characters as visible icon content. The characters have `aria-label` on the wrapping buttons (good) but no `aria-hidden` on the character itself — a screen reader may announce both the label AND attempt to vocalize the Unicode glyph description depending on the AT. More visually: `✎` (U+270E) renders at variable weights across OS/browser combinations; `✕` (U+2715) renders thinner than `✎` creating an inconsistent visual weight pair on every `TodoItem` row.

**Token/motion conflict:** None. This is an a11y and visual consistency gap.

**2026 SOTA expects:** Inline SVG icons (16×16 or 20×20 `viewBox`) with consistent `stroke-width`, `aria-hidden="true"` on the SVG itself, and `aria-label` on the button. The design-system reference §7 names standardizing an icon set as a candidate. The existing `GearIcon` and `ChatBubbleIcon` in `App.tsx:268–302` already follow the correct inline-SVG pattern — those two buttons are fine.

**Credible v1:** Replace `✎`, `✕`, `→`, `▾`, `▸` with small inline SVG components matching the `strokeWidth="1.7"` convention from `GearIcon`. Centralize them in `src/components/icons.tsx`. Add `aria-hidden="true"` to each SVG. No icon library needed.

**Why not fixed:** The Unicode characters are legacy from the earliest implementation and have not been revisited during later refactors. They are technically functional; no a11y bug was filed.

---

### M5 — Empty states use only a text hint; no illustration or action affordance

**Severity:** MEDIUM
**Affected:** `src/newtab/App.css:116–123` (`.section-empty`), `src/sections/sections.css:232–237` (reuse), `src/sections/Gantt.tsx:93–96` (no Gantt charts), `src/sections/sprint/SprintManager.tsx:1083–1087` (no sprints)

Empty states across all sections render as a dashed-border panel with one line of gray text (e.g., "No tasks for today yet. Add one above.", "No Gantt charts yet."). There is no illustration, no visual hierarchy, and no primary CTA button to guide first-time or cleared-state users. The Gantt empty state provides a `<button>Create your first chart</button>` but it uses the default `.panel-2` button style — not a primary CTA.

**Token/motion conflict:** None.

**2026 SOTA expects:** Todoist, Linear, and Notion all use illustrated empty states (SVG spot illustration, a bold headline, a short subtitle, and a primary CTA button) for first-run and cleared-state surfaces. The design-system reference §7 names "no empty-state illustrations / first-run onboarding" as underdeveloped.

**Credible v1:** Design an SVG spot illustration per section type (a calendar, a sprint bar chart, a timeline) at 64×64 px. Replace `.section-empty` with a two-layer layout: illustration + headline + subtitle + optional CTA button with `background: var(--accent); color: var(--accent-on)` styling. Keep the 1-line hint as the subtitle.

**Why not fixed:** Illustrative empty states require design work (SVG authoring) beyond the code changes, and the team has been focused on functional features.

---

### M6 — Photos banner has no navigation controls or manual advance

**Severity:** MEDIUM
**Affected:** `src/sections/Photos.tsx:120–171`, `src/sections/photos.css:79–107`

The Photos slideshow cycles automatically via a `setInterval` tick. There is no "previous" / "next" button, no pause control, no swipe gesture, and no dot-indicator for position in the set. The only affordance is a `photos-counter` (e.g., "3 / 12") and a filename caption. Users cannot manually advance, go back, or pause the slideshow without going into Settings and reducing the interval.

**Token/motion conflict:** Any added "next" / "prev" button must be pointer-event visible (currently `.photos-stage` has no pointer-events structure for overlay controls) and accessible with keyboard. The `role="status" aria-live="polite"` on the caption is correct but a pause button must have `aria-pressed`.

**2026 SOTA expects:** Every photo-slideshow widget (Apple Photos widget, Google Photos, Arc Photos) exposes prev/next affordances on hover and a pause/play toggle. The photos banner is a unique differentiator for Proclivity; not giving the user control over it is below the 2026 standard for any media widget.

**Credible v1:** Add an absolutely-positioned control row at the bottom of `.photos-stage` (above `.photos-caption`): left-arrow, pause/play, right-arrow — opacity 0 at rest, opacity 1 on `:hover` / `:focus-within`. Add `aria-pressed` to pause/play. The arrows and pause icon use the same inline-SVG convention as `GearIcon`.

**Why not fixed:** The Photos section was built as a passive ambient display; interactive controls were deferred as a "nice to have" feature.

---

## 5. Low gaps

### L1 — `.sprint-archived-caret` uses `▾` Unicode with no reduced-motion guard on rotation

**Severity:** LOW
**Affected:** `src/sections/sprint/sprint.css:298–305`

The archived sprint row uses `▾` (U+25BE) as the caret character, rotated 180° via `transition: transform 0.2s` when open. The icon inconsistency (Unicode vs. the SVG convention used for gear/chat) is LOW severity. The `transition: transform 0.2s` has no `[data-reduced-motion="true"]` guard — it relies on the global theme block. This is the same pattern as M2 but at lower severity since there is no equivalent self-documenting guard nearby to break the convention.

**Credible v1:** Replace `▾` with an inline SVG chevron matching `GearIcon` stroke weight. Add `[data-reduced-motion="true"] .sprint-archived-caret { transition: none }`.

---

### L2 — Hardcoded `#0b0e14` and `#fff` in multiple CSS files breaks light-theme `--accent-on` contract

**Severity:** LOW
**Affected:** `src/sections/gantt/gantt.css:235` (`color: #0b0e14` on `.gantt-bar`), `src/components/Modal.css:84,91` (`color: #0b0e14` on `.modal-btn-primary`, `.modal-btn-danger:hover`), `src/sections/sprint/sprint.css:28,329,439` (`color: #fff` on sprint tab/button active states)

These hardcoded colors appear as text-on-accent or text-on-danger surfaces. `#0b0e14` is effectively the darkest Proclivity surface color (close to `--bg` in dark mode) but hardcoded instead of using `var(--accent-on)`. In light mode, `--accent-on` is `oklch(0.18 0.012 252)` (dark text) while `--bg` is `oklch(0.97 0.004 252)` (near-white) — using `#0b0e14` directly would appear near-black on a light background regardless of theme, which is actually correct for dark-text-on-light-accent but is a magic-number rather than a semantic token. The sprint active tab uses `color: #fff` hardcoded; in light mode with a light `--accent`, `#fff` text on a light-accent background would fail contrast.

**Credible v1:** Replace all `#0b0e14` occurrences with `var(--accent-on)`. Replace `#fff` occurrences (buttons with `background: var(--accent)`) with `var(--accent-on)`. This is a ~6-line token substitution.

---

### L3 — `photos.css` uses `rgba(255,255,255,0.85)` for caption text, breaks dark themes

**Severity:** LOW
**Affected:** `src/sections/photos.css:88` (`color: rgba(255,255,255,0.85)` on `.photos-caption`)

The caption text is hardcoded `rgba(255,255,255,0.85)`, which renders white regardless of theme. Against a dark photo this is fine; against a light-colored photo in a light-theme session, it produces near-invisible text. The correct token would be `color: rgba(255,255,255,0.9)` gated on the overlay gradient always being present (which it is — the scrim `linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0))` ensures sufficient contrast in both themes). This is LOW because the scrim makes the hardcoded white work in practice, but the dependency on the scrim is fragile.

**Credible v1:** No change needed while the scrim is present. Document the dependency in a CSS comment. If the scrim is ever removed, switch to `var(--text)`.

---

### L4 — `QuickPrompt.css:77` — `@keyframes quick-prompt-banner-in` not scoped to `no-preference`

**Severity:** LOW
**Affected:** `src/components/QuickPrompt.css:77–91`

The QuickPrompt result banner uses `animation: quick-prompt-banner-in 200ms ease-out` (opacity 0→1, translateY -4px→0). The CSS file correctly guards it with `@media (prefers-reduced-motion: reduce) { .quick-prompt-banner { animation: none } }` at line 150 — so the OS-level preference is honored. However, there is no `[data-reduced-motion="true"]` guard for the in-app toggle, unlike the pattern used in `Modal.css:106–109` and `App.css:77–79`. If a user sets reduced-motion via the in-app toggle (not the OS), the banner continues to animate.

**Credible v1:** Add `[data-reduced-motion="true"] .quick-prompt-banner { animation: none; }` to `QuickPrompt.css`.

---

### L5 — `MeshBackground.css:10–21` — `@keyframes mesh-fade-in` scoped only to OS preference, not in-app toggle

**Severity:** LOW
**Affected:** `src/components/MeshBackground.css:10,16–22`

`mesh-fade-in` is guarded by `@media (prefers-reduced-motion: reduce) { .mesh-background { animation: none } }` at line 18. It is NOT guarded by `[data-reduced-motion="true"]`. The MeshBackground component itself respects `reducedMotion` by setting `frameloop="demand"` (pausing WebGL rendering), but the CSS fade-in animation will still fire on mount if `data-reduced-motion="true"` is set via the in-app toggle without the OS preference also set. This is a minor inconsistency.

**Credible v1:** Add `[data-reduced-motion="true"] .mesh-background { animation: none; }` to `MeshBackground.css`.

---

### L6 — `settings-badge-pulse` animation missing `@media (prefers-reduced-motion: reduce)` guard

**Severity:** LOW
**Affected:** `src/newtab/App.css:71–76` (`@keyframes settings-badge-pulse`), `App.css:73–80`

The settings badge pulse animation for the "new feature" dot is guarded only by `[data-reduced-motion="true"]` at line 77, but NOT by `@media (prefers-reduced-motion: reduce)`. The global `theme.css:134–143` OS-level block covers it, but the self-documenting convention uses both guards side by side (see `Modal.css:100–109` and `sprint.css:322–336` for the full pattern).

**Credible v1:** Add `@media (prefers-reduced-motion: reduce) { .settings-button[data-new="true"]::after { animation: none; } }` to `App.css`.

---

## 6. Token-discipline + reduced-motion + a11y conflicts found in code

- `src/sections/gantt/gantt.css:143` — `color-scheme: dark` hardcoded on `.gantt-task-date`; breaks light-theme native date input chrome. **Remove** and rely on `theme.css` cascade.
- `src/sections/gantt/gantt.css:235` — `color: #0b0e14` on `.gantt-bar`; should be `var(--accent-on)`.
- `src/components/Modal.css:84` — `color: #0b0e14` on `.modal-btn-primary`; should be `var(--accent-on)`.
- `src/components/Modal.css:91` — `color: #0b0e14` on `.modal-btn-danger:hover`; should be `var(--bg)` or `var(--accent-on)`.
- `src/sections/sprint/sprint.css:28,329,439` — `color: #fff` on accent-background buttons; should be `var(--accent-on)`.
- `src/components/settings/SettingsModal.css:396` — `background: #fff` on `.settings-toggle-thumb` checked state; should be `var(--accent-on)`.
- `src/newtab/index.css:56` — `color: #fff` on `.btn-danger:hover`; should be `var(--accent-on)` or a named token.
- `src/sections/sprint/sprint.css:185` — `.sprint-progress-bar-fill { transition: width 0.3s ease }` has **no** `[data-reduced-motion="true"]` or `@media (prefers-reduced-motion: reduce)` guard. Global fallback covers it silently but breaks the self-documenting convention.
- `src/components/QuickPrompt.css:77` — `quick-prompt-banner-in` animation has `@media (prefers-reduced-motion: reduce)` guard but **missing** `[data-reduced-motion="true"]` guard. In-app toggle will not suppress it.
- `src/components/MeshBackground.css:10` — `mesh-fade-in` has `@media (prefers-reduced-motion: reduce)` guard but **missing** `[data-reduced-motion="true"]` guard.
- `src/newtab/App.css:71` — `settings-badge-pulse` has `[data-reduced-motion="true"]` guard but **missing** `@media (prefers-reduced-motion: reduce)` guard.
- `src/components/TodoItem.tsx:68` — `✎` Unicode character rendered as button content without `aria-hidden="true"` on the character; `aria-label` on the button is correct, but the glyph may be double-announced by some AT stacks.
- `src/components/TodoItem.tsx:80` — `✕` same as above.
- `src/components/QuickPrompt.tsx:133,150,166` — `✕` dismiss button text, same a11y concern.
- `src/sections/photos.css:88` — `color: rgba(255,255,255,0.85)` hardcoded for caption text; functionally correct given the scrim, but creates fragile implicit dependency on scrim being present.
- `src/sections/gantt/gantt.css:194,216` — `rgba(255, 255, 255, 0.02)` for weekend column backgrounds; will be invisible in light mode (should use `color-mix(in srgb, var(--border) 20%, transparent)` or `oklch(0 0 0 / 0.02)` which adapts to both themes).
- `src/sections/calendar/calendar.css:141,348` — `var(--warn)` used for reminder legend dots and calendar chips. This is **legitimate semantic state** usage (a reminder is a time-sensitive warning signal), not a misuse. Flagged only to note the audit was performed; usage is correct.
- `src/components/settings/SettingsModal.css:558` — `color: var(--ok)` on `.settings-action-flash` (the "Exported!" flash message). This IS a semantic state communication (success). Not a misuse.

---

## 7. What Proclivity does well visually

- **User-customizable `--accent` token** with a 9-swatch preset grid in Settings → Appearance plus custom hex input. The `accent-color: var(--accent)` root rule propagates accent into all native form elements automatically. This is a differentiator — most personal extensions hardcode accent.
- **Dual light / dark theme support** with `oklch`-space tokens across both themes, ensuring perceptual uniformity. The `color-scheme` declaration at `:root` and `[data-theme="light"]` makes native form elements (checkboxes, date inputs, selects) adapt correctly — except for the Gantt regression noted in M3.
- **Reduced-motion baseline is belt-and-suspenders** — the OS-level `@media (prefers-reduced-motion: reduce)` block in `theme.css:134–143` provides a universal fallback, AND the `data-reduced-motion="true"` attribute provides an in-app override that doesn't require the OS to be set. The dual-layer design is ahead of most competitor extensions.
- **Density scaling** (`data-density="compact"` / `"spacious"`) across the full spacing scale is a genuine accessibility differentiator for users with vision or motor preferences. No competitor Chrome extension in the planning category has this feature.
- **Font-size scaling** (`data-font-size="sm"` / `"lg"`) via a single root `font-size` token means all `em`/`rem`-relative layouts adapt without component-level overrides. The `--font-size-base` token is the correct architecture for this.
- **Card mode with drag-to-reorder** (`src/components/card/`) is a premium visual mode. The `[MOT-30 lift-on-hover]` shadow elevation is correctly implemented on `.task-card:hover` and `.draggable-card.is-dragging .task-card`. Reduced-motion guard is explicit (`[data-reduced-motion="true"] .task-card { transition: none }`).

---

## 8. Themes

The dominant theme is **motion zero-point**: Proclivity was built with a correctness-first philosophy (strict TypeScript, a11y, token discipline) and is at the 0-point for any motion/animation investment beyond the MeshBackground and modal fade-in. Every HIGH gap and most MEDIUMs are motion gaps. The second theme is **"null fallback everywhere"** — the consistent use of `<Suspense fallback={null}>` and `loading ? return null` reflects a deliberate decision to avoid layout shift, but it leaves blank holes where 2026 users expect skeleton loading states. The third theme is **hardcoded color escape hatches** — `#0b0e14`, `#fff`, `rgba(0,0,0,N)` appear at about a dozen sites where the correct semantic token (`--accent-on`, `--bg`, color-mix equivalents) exists; these are LOW/MEDIUM individually but compound across surfaces in a way that will matter during a light-theme push. Reduced-motion guard inconsistency (some elements self-documenting, others relying on global fallback) is a cross-cutting pattern worth addressing in a single pass rather than piecemeal.
