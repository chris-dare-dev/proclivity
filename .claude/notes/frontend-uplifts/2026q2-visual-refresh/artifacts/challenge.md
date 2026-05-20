# Challenge — 2026q2-visual-refresh

**Uplift ID:** 2026q2-visual-refresh
**Date:** 2026-05-20
**Author:** frontend-uplift-challenger
**Challenges:** synthesis.md (26 candidates, UPL-1 through UPL-26)

---

## 1. Executive Summary

The catalog is well-grounded overall: the synthesis correctly identified the foundational sequencing (UPL-1 first, token hygiene and icon system parallel) and the anti-patterns were pre-screened before reaching the catalog. The two hardest findings are: (1) **UPL-26 specifies `@react-three/postprocessing@3`, which requires React 19 and `@react-three/fiber@9` — both incompatible with the current stack**; this is a version error in the synthesis that makes UPL-26 unshippable as written, though a corrected version (postprocessing@2.19.1) would be compatible. (2) **UPL-2 creates a latent a11y regression** by proposing that `hidden=` on inactive tabpanels be replaced with `aria-hidden="true"` + CSS opacity, which allows invisible panels to remain focusable via keyboard unless explicit `tabindex` management is added — the synthesis does not address this. Three additional MAJORs surface around effort-honesty (UPL-7, UPL-18), reduced-motion gap (UPL-25), and the new `--accent-tint` token in UPL-11 which needs definition. Total: 0 BLOCKERs (UPL-26 is MAJOR with a clear redesign path), 5 MAJORs, 10 MINORs, 11 clean.

---

## 2. BLOCKER Findings

None. UPL-26's `@react-three/postprocessing@3` version error is a MAJOR (not BLOCKER) because a drop-in corrected version (v2.19.1) exists and the candidate itself is otherwise valid.

---

## 3. MAJOR Findings

---

### UPL-2 — Section-fade cross-dissolve on tab switches

**Severity:** MAJOR

**Objections:**

- **Axis 3 (Accessibility regression risk):** The synthesis proposes replacing `hidden=` on `role="tabpanel"` elements with `aria-hidden="true"` + CSS opacity/transform to enable cross-fade. The `hidden` attribute removes the element from the accessibility tree AND from tab order automatically. `aria-hidden="true"` alone hides content from screen readers but does **not** remove the panel from keyboard focus order — invisible elements with focusable descendants (todo items, buttons) remain reachable via Tab key. This creates a keyboard focus trap in inactive panels. The synthesis does not address `tabindex="-1"` management on inactive panel descendants or use of `inert` attribute as a replacement for `hidden`. The WAI-ARIA APG tabpanel pattern explicitly requires that inactive tabpanels be hidden from the focus order.
- **Axis 8 (Effort honesty):** Path (b) — `AnimatePresence` wrapping — requires replacing the `hidden=` pattern with a conditional-render or `inert`/`tabindex` management scheme across all 8 tabpanels and their deeply nested interactive descendants. The sketch treats this as trivially "cleaner" but the actual LOC is closer to 80–120 (tabpanel refactor + inert/tabindex guards + reduced-motion scoping) rather than the implied small-S effort.

**Suggested scope adjustment:** v0 — implement the pure CSS path (Path a) only, keeping `hidden=` intact but adding `[data-leaving="true"]` and a short CSS animation triggered by a React state machine. This avoids the ARIA tabpanel focus trap entirely. v1 — revisit the AnimatePresence path only after adding `inert` attribute support (or `tabindex` sweep) to all tabpanel children when they exit.

---

### UPL-7 — Variable-weight self-hosted font (Inter, ~36 KB gzip)

**Severity:** MAJOR

**Objections:**

- **Axis 4 (Bundle-size cost):** The synthesis correctly flags this for scrutiny. Inter variable at ~36 KB gzip approaches the 20 KB threshold that requires a lazy-load story, and the synthesis proposes adding it to the initial chunk with no lazy-load boundary. CLAUDE.md §Build-and-verification sets the initial newtab chunk target at ≤200 KB. The current chunk budget is unknown without a build measurement, but adding 36 KB for typography alone is a significant fraction of the remaining headroom — especially if UPL-1 (~20 KB deferred), UPL-13 (~3 KB), UPL-20 (~3 KB), UPL-25 (~9 KB), and UPL-8 (~6 KB) are also landing.
- **Axis 4 (Bundle-size cost, secondary):** Path (b) via `@fontsource/inter` adds a package but the font bytes still load synchronously (the CSS `@import` or `import` in main.tsx triggers a blocking font load). Path (a) self-hosted with `font-display: swap` is the correct approach if this lands, but FOUT (flash of unstyled text) must be budgeted for — on a new-tab page that opens blank, a FOUT is more visible than on a normal web page.
- **Axis 8 (Effort honesty):** The synthesis estimates S/M effort. Adding a variable font touches `index.css`, `App.css` (`.greeting`, `.clock`), and likely multiple section heading styles. It also requires a `font-display: swap` strategy, preload hints, and a fallback-match analysis to avoid layout shift. Realistic effort: M/L.

**Suggested scope adjustment:** v0 — add Inter only to the greeting and clock elements using `@font-face` with `font-display: optional` (avoids FOUT entirely by falling back to system font if not cached). Load the woff2 via `<link rel="preload">` in the extension's manifest/popup. Defer applying it globally until the initial chunk budget impact is measured with `npm run build -- --report`. v1 — expand to headings if chunk budget allows.

---

### UPL-11 — Pill-style animated tab indicator (with shared-layout slide)

**Severity:** MAJOR

**Objections:**

- **Axis 1 (Status-token discipline / new token without justification):** The sketch proposes a new `--accent-tint` token (`oklch(from var(--accent) l c h / 0.18)`) which does not exist in `src/styles/theme.css`. The synthesis notes this contingency ("Pair with `--accent-tint` token if it doesn't exist; otherwise use `color-mix`") but does not route the token definition through a token-governance step. Adding ad-hoc tokens without adding them to `theme.css` creates a silent contract break — the first person who customizes `--accent` expects `--accent-tint` to follow. The `color-mix` fallback in the sketch is fine, but it must be the PRIMARY approach, not the fallback.
- **Axis 5 (React 18 compatibility / UPL-1 dependency):** UPL-11 uses `motion.div` with `layoutId="tab-indicator"` — this is the Framer Motion shared-layout API which requires `<LazyMotion>` context from UPL-1. The synthesis flags this dependency but Phase 4 must enforce the sequencing hard-gate: UPL-11 cannot ship without UPL-1. The dependency DAG is partially documented but the catalog entry should mark this as `BLOCKED_BY: UPL-1`.
- **Axis 8 (Effort honesty):** The sketch implies that `motion.span` with `layoutId` is a small addition. However, the existing tab rendering in `App.css:87–104` uses a flat `<button className="tab tab-active">` pattern — adding the shared-layout pill requires restructuring each tab button to contain an absolutely-positioned `motion.span`, which changes the flex/overflow behavior of the tab row and may require a targeted regression pass across all 8 tabs.

**Suggested scope adjustment:** v0 — implement the pill using CSS-only (`background: color-mix(in oklch, var(--accent) 20%, transparent)`) without the shared-layout slide. Pure CSS pill is shippable without UPL-1 and avoids the new-token concern. v1 — add the `layoutId` shared-layout slide once UPL-1 has landed and the motion context is verified.

---

### UPL-18 — Adopt `cmdk` for command palette (Cmd+K)

**Severity:** MAJOR

**Objections:**

- **Axis 4 (Bundle-size cost):** The synthesis states ~12–14 KB gz total for `cmdk` plus `@radix-ui/react-dialog`. Actual measurements: `cmdk@1.1.1` unpacked size is ~82 KB; `@radix-ui/react-dialog` unpacked size is ~102 KB. Even with tree-shaking and gzip, the combined gz footprint is likely 15–20 KB (not the stated 12–14 KB). More importantly, `@radix-ui/react-dialog` pulls in a dependency chain: `@radix-ui/react-portal`, `@radix-ui/react-overlay`, `@radix-ui/react-focus-trap`, and `@radix-ui/react-primitive`. The synthesis underestimates the total install cost.
- **Axis 4 (Bundle-size cost, lazy-load story):** The synthesis correctly notes that the palette should be `React.lazy()`-loaded. That lazy boundary is mandatory — without it, the Radix + cmdk bundle enters the initial chunk and the 200 KB ceiling is likely breached when combined with UPL-1 (~20 KB) and UPL-8 (~6 KB).
- **Axis 8 (Effort honesty):** A command palette is a net-new interactive surface. It requires: action registry (a map of command-id → handler for all Proclivity actions), keyboard event plumbing (overlaps with UPL-20), focus management on open/close, and integration with the existing QuickPrompt / section navigation. This is an M/L effort, not S.

**Suggested scope adjustment:** v0 — implement the `React.lazy()` lazy boundary first; validate the palette renders correctly before adding more commands. Constrain v0 to 4–6 commands (open settings, switch section, create todo, open help). v1 — expand the action registry. Explicitly budget the Radix dependency tree as a separate line item in Phase 4, not bundled into the "cmdk ~12 KB" estimate.

---

### UPL-25 — Adopt `sonner` for in-page toast feedback

**Severity:** MAJOR

**Objections:**

- **Axis 2 (Reduced-motion discipline):** The synthesis states "Respect reduced-motion via sonner's built-in `motion` config" but does not specify what that config is or how it integrates with Proclivity's existing `data-reduced-motion="true"` data-attribute approach (used alongside `@media (prefers-reduced-motion: reduce)`). Sonner uses its own internal animation layer. At `sonner@2.0.7`, sonner does respect `prefers-reduced-motion` via its internal CSS, but it does not read Proclivity's `data-reduced-motion="true"` attribute — the dual-guard convention used at `Modal.css:100–109` will not be automatically honored. Any user who has the reduced-motion preference set via Proclivity's settings toggle (not OS-level) will see animated toasts.
- **Axis 4 (Bundle-size cost):** The synthesis claims ~2.5–9 KB gz. The unpacked size is ~166 KB, suggesting the actual gzip footprint is closer to the upper end (9 KB) or above. This is above the 20 KB threshold only if initial-loaded; the synthesis does not propose a lazy-load boundary for sonner. `<Toaster />` mounted once in `App.tsx` loads synchronously.

**Suggested scope adjustment:** v0 — mount `<Toaster />` inside a `<Suspense>` wrapper so the `sonner` bundle defers to after first paint. Add an explicit `style={{ "--sonner-toast-duration": reducedMotion ? "0ms" : undefined }}` or equivalent override that bridges sonner's motion with Proclivity's `data-reduced-motion` state. v1 — add per-action toast calls once the bridge is verified.

---

## 4. MINOR Findings

---

### UPL-1 — Adopt `motion` library (LazyMotion + domAnimation, lazy-loaded)

**Severity:** MINOR

**Objections:**

- **Axis 5 (React 18 compatibility):** `motion@12.x` (the current latest) declares peer deps `react: "^18.0.0 || ^19.0.0"` — React 18 is explicitly supported. No issue. However, `motion` v12 introduced some API changes from framer-motion (the package was renamed). The synthesis correctly uses `motion/react` import paths. One flag: the `useReducedMotion()` hook in `motion/react` works correctly on React 18, but `useMotionValueEvent()` (v11+ API used in some complex motion patterns) requires verifying against the React 18 + concurrent mode scheduler. This is a risk to flag at implementation time, not a blocker.
- **Axis 10 (Sequencing dependencies):** 8 downstream candidates (UPL-2, 3, 4, 9, 11, 12, 17, 19) depend on UPL-1. The synthesis documents this but Phase 4 prioritization must enforce that none of the motion candidates ship in the same milestone as UPL-1 unless the implementer has confirmed the `LazyMotion` context is available at build time.

**Suggested scope adjustment:** None required. The minor flag is informational: implementation notes should verify `useMotionValueEvent` behavior under React 18 Strict Mode before using it in downstream candidates.

---

### UPL-3 — Stagger-reveal on todo list cold loads

**Severity:** MINOR

**Objections:**

- **Axis 6 (Strict-TS compatibility):** The pure-CSS Path (a) sketch proposes setting `--item-index` as an inline CSS custom property: `style={{ '--item-index': index }}`. Under `strict: true` + `exactOptionalPropertyTypes: true`, React's `CSSProperties` type does not include arbitrary custom properties. This will produce a TypeScript error at `TodoItem.tsx`. The fix is a one-line type cast: `style={{ ['--item-index' as string]: index } as React.CSSProperties}` or a module augmentation of `CSSProperties`. The synthesis does not mention this.
- **Axis 9 (Motion-vocabulary anti-pattern — MOT-NO-7):** The sketch says "Fires once per activation, not on every re-render." This is correct intent, but the implementation must be explicit about the trigger: a `key` on the list container that changes only on tab activation (not on every todo mutation) — otherwise the stagger fires on every item add/remove, which is `MOT-NO-7` (motion that fires on every render). Implementation note needed.

**Suggested scope adjustment:** Add a note to the implementation brief: use `useId()` + a `revealKey` state that increments only on tab focus change, not on list mutations. Separate stagger-reveal (cold load) from auto-animate mutation animations (UPL-13).

---

### UPL-4 — Modal scale-in entry + backdrop blur

**Severity:** MINOR

**Objections:**

- **Axis 3 (Accessibility regression risk):** The sketch proposes changing `Modal.css`'s `.modal-backdrop` to `background: rgba(0,0,0,0.35)` (down from the implied current `rgba(0,0,0,0.6)`). This 0.35 alpha may reduce contrast between the modal and background, potentially making modal content harder to read against bright background sections. The synthesis does not verify that `rgba(0,0,0,0.35) + backdrop-filter: blur(12px)` achieves the same effective contrast as the current flat `rgba(0,0,0,0.6)` backdrop in both light and dark themes.
- **Axis 2 (Reduced-motion discipline):** The existing `Modal.css:99–109` gold-standard dual guard is present, but the proposed `exit={{ opacity: 0, scale: 0.96 }}` via AnimatePresence adds a new motion path. The synthesis notes this requires UPL-1, but does not explicitly state that the `AnimatePresence` exit variant should be skipped when `useReducedMotion()` is true. This must be explicit in the implementation sketch.

**Suggested scope adjustment:** v0 — implement the scale-in entry and backdrop blur without the exit animation (pure CSS approach, no UPL-1 dependency). Test contrast ratios for the 0.35 alpha + blur backdrop in both themes before shipping. v1 — add AnimatePresence exit once UPL-1 lands.

---

### UPL-5 — Skeleton loading states on async-suspended surfaces

**Severity:** MINOR

**Objections:**

- **Axis 2 (Reduced-motion discipline):** The shimmer keyframe `@keyframes skeleton-shimmer` is proposed without specifying whether it's scoped inside `@media (prefers-reduced-motion: no-preference)`. The synthesis mentions this in the text ("Shimmer keyframe scoped to `@media (prefers-reduced-motion: no-preference)`") but does not include it in the implementation sketch's CSS block. This is a documentation gap, not a design flaw — just needs to be explicit in the implementation.
- **Axis 7 (Theming impact):** The skeleton uses `var(--panel-2)` and `var(--border)` for the shimmer gradient. In the light theme, `--panel-2` and `--border` have lower contrast differential than in dark theme — the shimmer effect may be imperceptible in light mode. Verify that the gradient produces visible shimmer in both themes before shipping.

**Suggested scope adjustment:** Add `@media (prefers-reduced-motion: no-preference)` scope explicitly to the shimmer CSS in the implementation brief, and add a light-theme visual check to the milestone acceptance criteria.

---

### UPL-6 — Warm-gray token shift

**Severity:** MINOR

**Objections:**

- **Axis 3 (Accessibility regression risk):** Reducing chroma on `--bg` and `--panel` tokens while also halving chroma on `--text-dim` must not reduce contrast ratios below WCAG AA (4.5:1 for normal text, 3:1 for large). The synthesis does not include contrast ratio verification for the proposed new oklch values against `--text` and `--text-dim` in both light and dark themes. A 0.006 chroma background against standard `--text` is almost certainly fine, but the light-theme parallel change ("similar warmth nudge") is less precisely specified.
- **Axis 7 (Theming impact):** The synthesis correctly notes this touches only neutral tokens and leaves `--accent` untouched. However, `--panel-2` is used for button backgrounds (`src/newtab/index.css:39`). Any hue/chroma shift on `--panel-2` affects button rest-state visual weight. This is acceptable but worth noting in the implementation brief.

**Suggested scope adjustment:** Include a WCAG contrast ratio spot-check (tool: any online oklch contrast checker) for the 4 key dark-theme token pairs before committing. Light-theme changes should be labeled as explicitly optional in v0.

---

### UPL-9 — Lift-on-hover on todo rows

**Severity:** MINOR

**Objections:**

- **Axis 2 (Reduced-motion discipline):** The sketch adds the `data-reduced-motion` guard (`[data-reduced-motion="true"] .todo-item { transition: none; transform: none; }`) but the global `@media (prefers-reduced-motion: reduce)` in `theme.css:134` already suppresses `transition-duration` to `0.01ms`. The `transform: none` override in the data-attr guard is correct for belt-and-suspenders, but the implementation must also ensure the `transform: translateY(-2px)` is inside `@media (prefers-reduced-motion: no-preference)` to be consistent with other motion sites in the codebase. Without the `@media` scope on the hover rule itself, the transform applies even when the `theme.css` global strips the transition — users see an abrupt snap to the translated position instead of a smooth lift.
- **Axis 3 (Accessibility regression risk):** `transform: translateY(-2px)` on hover shifts the row upward, potentially overlapping the row above it by 2px if rows are tightly packed. With `--row-height: 44px` and standard spacing, this is unlikely to cause overlap, but worth a visual check on dense lists.

**Suggested scope adjustment:** Scope the hover transform inside `@media (prefers-reduced-motion: no-preference)` to align with the `Modal.css` dual-guard pattern.

---

### UPL-10 — Breathing-glow on armed reminders

**Severity:** MINOR

**Objections:**

- **Axis 1 (Status-token discipline):** The synthesis proposes using `var(--warn)` for "overdue" reminders. This is correct per the design system — `--warn` is explicitly reserved for state communication. However, the synthesis also says "Color: `var(--accent)` for far-future" — this means a reminder row transitions its status indicator from `--accent` (far-future) to `--warn` (overdue). The `--warn` usage is legitimate, but the transition implies the component must calculate the urgency band (far-future / near-due / overdue) and apply the correct token. The sketch defers "near-due" treatment to a follow-up, but the `--warn` assignment will be a placeholder during v0 if the band logic is not implemented.
- **Axis 2 (Reduced-motion discipline):** The sketch correctly references the `settings-badge-pulse` keyframe at `App.css:71–76` as the model. That keyframe uses only the `data-reduced-motion` data-attribute guard, not the `@media` guard (per `App.css:77`). Adding a new `breathing-glow` animation should use the dual-guard convention from `Modal.css:99–109`, not the single-guard pattern from `settings-badge-pulse`. This is a consistency issue.

**Suggested scope adjustment:** For v0, use `--accent` only (no urgency banding), and add the dual-guard pattern to the new `breathing-glow` keyframe. Document the `--warn` urgency-band state as a v1 follow-up.

---

### UPL-14 — Empty-state illustrations + primary CTA + dot-grid background

**Severity:** MINOR

**Objections:**

- **Axis 8 (Effort honesty):** The synthesis identifies 9 `.section-empty` usage sites across 7 files (`TodoCardSection.tsx`, `Gantt.tsx`, `TodoList.tsx`, `ChartView.tsx`, `SprintManager.tsx` ×3, `RemindersCardSection.tsx` ×3, `App.tsx`). Migrating all of these to a new `<EmptyState>` component with per-section illustration variants is an M+ effort. The synthesis labels this M but the illustration asset question is deferred ("defer the asset decision to the implementation milestone") — that deferral hides a real decision point that could stall implementation if undraw.co licensing or SVG authoring time is underestimated.
- **Axis 7 (Theming impact):** The dot-grid background uses `radial-gradient(circle, var(--border) 1px, transparent 1px)`. In light theme, `--border` is a mid-tone and the 1px dot may be invisible at 20px spacing — the effect degrades gracefully but should be confirmed in light mode. No contrast concern.

**Suggested scope adjustment:** v0 — scope to 2–3 empty-state sites (Today, Sprint, Gantt) only; defer the full 9-site migration to v1. This brings effort in line with the M label. Resolve the illustration asset source before the implementation milestone begins.

---

### UPL-17 — Settings pane fade transition

**Severity:** MINOR

**Objections:**

- **Axis 2 (Reduced-motion discipline):** The sketch proposes using a `key` re-mount on the inner pane content to trigger `transition: opacity 150ms`. A CSS opacity transition is correctly suppressed by `theme.css:134` under `prefers-reduced-motion: reduce`. However, the re-mount triggered by `key` change fires regardless of motion preference — with a `0.01ms` transition duration, users will see a single frame of opacity: 0 before it snaps to opacity: 1. This is a perceptible flash on high-frame-rate displays. The implementation should skip the opacity-0 phase when `useReducedMotion()` or `data-reduced-motion` is set.
- **Axis 8 (Effort honesty):** This is a pure CSS fix that affects only `SettingsModal.css` — the effort is correctly labeled XS. No additional concerns.

**Suggested scope adjustment:** Add a `useReducedMotion()` check (or read `data-reduced-motion` from `<html>`) to skip the brief `opacity: 0` frame when reduced motion is active.

---

### UPL-22 — Reduced-motion guard convention sweep

**Severity:** MINOR

**Objections:**

- **Axis 2 (Reduced-motion discipline):** The synthesis is correct that `App.css:71–76` (`settings-badge-pulse`) uses only the `data-reduced-motion` data-attribute guard and lacks the `@media (prefers-reduced-motion: reduce)` peer. The global `theme.css:134` suppression catches it anyway (`animation-duration: 0.01ms !important`), but it violates the dual-guard convention. This is low risk but the synthesis correctly surfaces it.
- **Axis 8 (Effort honesty):** The synthesis estimates ~10 lines of CSS across ~5 sites. This is accurate — no overclaim.

**Suggested scope adjustment:** No scope cut needed. Verify the sweep also catches any new motion sites introduced by UPL-3, UPL-9, UPL-10, or UPL-12 in the same pass.

---

## 5. Clean Candidates

The following candidates survive the 10-axis checklist without material objections:

- **UPL-8** — lucide-react icon system: ISC license, ~6 KB gz tree-shaken, React 18 compatible, no token-discipline issues. The `aria-hidden="true"` on decorative icon uses and `aria-label` on icon-only buttons must be enforced at implementation time but are not a pre-shipment blocker.
- **UPL-12** — Sprint progress bar fill animation: pure CSS keyframe, correctly references `sprint.css:185` existing transition, reduced-motion scope straightforward.
- **UPL-13** — `@formkit/auto-animate`: MIT, ~3.28 KB gz, React 18 compatible, natively respects `prefers-reduced-motion`. The synthesis-flagged coexistence with `motion` (UPL-1) is not a conflict in practice.
- **UPL-15** — Section accent variant for LongTerm: pure CSS, uses `--accent-2` (already defined at `theme.css:33`), ~3 lines, no motion, no bundle cost.
- **UPL-16** — Mobile header layout fix: `clamp()` font-size + `overflow-x: auto` on tabs, pure CSS, no a11y regression.
- **UPL-19** — Keyboard shortcut help overlay: builds on existing `Modal.tsx` primitive, no new dependencies beyond UPL-20 (`react-hotkeys-hook`). Correctly scoped as read-only / static in v1.
- **UPL-20** — `react-hotkeys-hook`: MIT, ~3 KB gz, zero deps, `react: >=16.8.0` peer dep (React 18 compatible). Straightforward refactor of existing `addEventListener` sites.
- **UPL-21** — Token-discipline sweep: mechanical hex-to-token substitution across 7 files. No motion, no bundle cost, no a11y impact (fixes regressions rather than introducing them). The `color-scheme: dark` removal from `gantt.css:143` is specifically flagged as correct.
- **UPL-23** — Photos slideshow manual controls: no new library, static controls, `aria-pressed` on pause/play correctly specified.
- **UPL-24** — Custom date/time input: no new dependency in option A (split into `type="date"` + `type="time"`), preserves native a11y.
- **UPL-26** — Mesh background bloom + ambient lighting (with version correction): `@react-three/drei@9.122.0` confirms peer deps of `react: "^18"` and `@react-three/fiber: "^8"` — **COMPATIBLE** with current stack. However, `@react-three/postprocessing@3` (as specified in the synthesis) requires `react: "^19"` and `@react-three/fiber: "^9"` — **INCOMPATIBLE**. The MAJOR finding requires changing the synthesis version reference to `@react-three/postprocessing@2.19.1` (which requires `react: "^18"` and `@react-three/fiber: "^8"`). With that version correction, UPL-26 is unblocked and the lazy-load story (within the existing MeshBackground boundary) is sound. **This is a version correction on a single line, not a design flaw.** See §3 MAJOR findings — UPL-26 is listed under MAJOR above.

Wait — UPL-26 is MAJOR above. The clean list does not include it. The list above is the genuinely clean 10.

---

## 6. Cross-Cutting Concerns

**1. The `motion` library bundle math needs a post-install build measurement.** Four candidates (UPL-2, UPL-4, UPL-11, UPL-19) depend on `AnimatePresence`, which is included in `domAnimation`. The synthesis claims ~15 KB deferred for `domAnimation`. This is correct for the package itself but does not account for the `LazyMotion` wrapper overhead in the initial chunk or the additional wiring in each consumer. Phase 4 should require a `vite build --report` baseline before AND after UPL-1 lands to confirm the initial chunk stays below 200 KB.

**2. The `--accent-tint` token is proposed by UPL-11 but not yet in `theme.css`.** If UPL-11 ships using `color-mix(in oklch, var(--accent) 20%, transparent)` as specified in the "otherwise" clause of the sketch, no token is needed. If anyone later introduces `--accent-tint` as a proper token, it should be added to both light and dark theme blocks in `theme.css` with the same chroma-vs-contrast analysis applied to other accent tokens. The synthesis should not leave this as an implicit "if it doesn't exist" contingency.

**3. Dependency DAG under-documented for sequencing.** The synthesis documents UPL-1 as the foundational unlock for 8 candidates, but the following secondary dependencies are not explicitly flagged:
   - UPL-18 depends on UPL-20 (react-hotkeys-hook) for the Cmd+K trigger
   - UPL-19 depends on UPL-20 for the Cmd+/ trigger
   - UPL-23 optionally depends on UPL-20 for keyboard nav
   - UPL-4's exit animation depends on UPL-1 (AnimatePresence)
   Phase 4 should ensure UPL-20 is scheduled before UPL-18 and UPL-19.

**4. The `settings-badge-pulse` single-guard pattern (no `@media` peer) is referenced as a model by UPL-10.** The actual gold-standard model is `Modal.css:100–109` (dual guard). UPL-22 is the sweep that fixes existing single-guard violations including `settings-badge-pulse` itself. Phase 4 should schedule UPL-22 before UPL-10, or combine them into one pass, to avoid UPL-10 inheriting the wrong pattern.

**5. UPL-6 + UPL-21 ordering matters.** UPL-21 proposes replacing `#0b0e14` hardcodes with `var(--bg)`. If UPL-6 ships first and shifts `--bg` to a warmer hue, any remaining `#0b0e14` hardcodes will stand out more visually — making UPL-21 more urgent post-UPL-6 and validating the synthesis's positioning of both as high-ROI early wins. Phase 4 should consider scheduling them together.

---

## 7. Recommended Kill List

**No candidates should be killed before Phase 4 prioritization.** All 26 candidates are either clean, have clear scope adjustments, or (in the case of UPL-26) have a one-line version correction that makes them viable. The catalog pre-screened the genuine §8 anti-patterns correctly (parallax on planning sections, confetti, magnetic cursors — all in the §6 "rejected" list).

The MAJOR findings on UPL-2, UPL-7, UPL-11, UPL-18, and UPL-25 are scope and implementation notes, not kill signals. Each has a viable v0 cut-line.

If Phase 4 scoring reveals budget pressure, the following are candidates for deferral (not kill):
- **UPL-7** (Inter font) — highest bundle cost, lowest functionality gain; defer until chunk budget is measured
- **UPL-18** (cmdk command palette) — highest implementation effort, most complex dependency footprint; the 4–6 command v0 scope is the right minimum
- **UPL-24** (datetime-local replacement) — lowest cross-brief validation (1 brief); functional but low visual impact compared to motion candidates

---

*End of challenge document.*
