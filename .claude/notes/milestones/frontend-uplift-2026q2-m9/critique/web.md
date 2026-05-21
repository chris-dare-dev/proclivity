# Critique — frontend-uplift-2026q2-m9 — milestone-web-perf-critic

**Critic:** milestone-web-perf-critic
**Commit range:** 8cbea01..92f06ff
**Generated:** 2026-05-20T05:00:00Z
**Diff stats:** 6 files changed, +129 / -4 LOC

---

## Verdict

SHIP-WITH-FIXES

One HIGH finding must be addressed before shipping: the `.btn-primary` CTA button fails WCAG AA color contrast in both dark mode (2.61:1) and light mode (3.24:1) against the 4.5:1 threshold for normal-weight 15px text. The `--accent`/`--accent-on` token pair has a documented systemic contrast gap (confirmed across m11, calendar, sprint). Everything else in the milestone is clean — bundle is within budget, SVG accessibility attributes are correct, storage discipline and MV3 architecture are unaffected.

---

## Executive summary

- [HIGH] `.btn-primary` CTA text fails WCAG AA in both themes: dark 2.61:1, light 3.24:1 (threshold: 4.5:1 for `font-weight: 500` at 15px). Systemic `--accent`/`--accent-on` gap, documented from m11.
- [LOW] `LongTermEmpty`'s `<h3>` has no `<h2>` ancestor in the LongTerm tabpanel — heading level skips from none to h3. Contrast: `GanttEmpty`'s `<h3>` is correctly nested under ChartView's `<h2>`.
- [CLEAN] Initial chunk: 303,885 bytes raw / 96,778 bytes gz — verified from dist artifact. Within 400 kB soft / 500 kB hard ceilings. Delta from m8 baseline: +2,220 bytes raw / +718 bytes gz — reasonable for two inline SVGs and new CSS classes.
- [CLEAN] SVG illustrations correctly marked `aria-hidden="true" focusable="false"` — decorative intent properly expressed.
- [CLEAN] All SVG strokes/fills use `var(--text-dim)` or `var(--accent)` exclusively — no hex literals, recolors correctly on theme toggle.
- [CLEAN] `useRef` per `ChartView` instance and per `TodoList` instance — multi-chart focus safety guaranteed; no `document.getElementById` collision risk.
- [CLEAN] `focusInput` correctly wrapped in `useCallback([])` — stable identity, no unnecessary re-renders.
- [CLEAN] Tag-filter empty state branch unchanged; `TodoCardSection.tsx`, `Today.tsx`, `Sprint.tsx` untouched as required.

---

## Findings

### CRITICAL

_(none)_

### HIGH

#### [HIGH] H1 — `.btn-primary` CTA text fails WCAG AA in both themes

- **File:** `src/sections/sections.css`
- **Line:** 330–341
- **Anchor:** `.btn-primary {`
- **What:** The CTA button uses `color: var(--accent-on)` on `background: var(--accent)`. Computed contrast ratios are 2.61:1 (dark: white `#ffffff` on `#7c9cff`) and 3.24:1 (light: near-black `oklch(0.18 0.012 252)` on `#4859d0`). The WCAG AA threshold for `font-weight: 500` text at 15px (not bold, not large text) is 4.5:1. Both modes fail.
- **Why it matters:** The CTA button is the primary interaction target for an empty-state illustration — it is the first focusable element visible to a user with low contrast sensitivity, and is also the design's primary call to action. A button that cannot be read reliably fails at precisely the moment UX friction is highest (zero-content state).
- **Proposed fix:** Option A (recommended) — add `font-weight: 600` to `.btn-primary`, which qualifies the text as "bold" and shifts the applicable threshold to 3:1 (large text / bold ≥ 14px). Dark mode 2.61:1 still fails 3:1; therefore also declare a per-mode override that raises contrast: e.g. add a dedicated `.btn-primary` rule inside `[data-theme="light"]` that sets `color: oklch(0 0 0)` (pure black on `#4859d0` = 7.01:1). For dark mode, a concrete fix is to treat `--accent-on` as "always white" when used on the accent background, which it already is in dark mode — the problem is the accent itself (`#7c9cff`) is too light to yield 4.5:1 against white. The correct fix for dark mode is either (a) bolding to meet 3:1 (2.61:1 → still fails) or (b) using a darker variant of the accent as the background: `color-mix(in srgb, var(--accent) 80%, var(--bg) 20%)` ≈ #6385e0, yields ~3.4:1 with white — approaches but doesn't clear 4.5:1. The cleanest path is `font-weight: 600` to drop threshold to 3:1 PLUS ensuring dark-mode contrast ≥ 3:1: `#7c9cff` on white = 2.61:1 → still fails 3:1. Therefore the minimal fix that clears both modes is: (c) a dedicated higher-contrast `--btn-accent` token for button surfaces, set darker than `--accent` in both modes. This is the same recommendation as m11 M3. As a shorter-term fix: use `font-weight: 700` (bold) at 16px which qualifies as "large text" (≥ 14px bold = 3:1 threshold), and slightly darken the dark-mode accent surface: `background: color-mix(in srgb, var(--accent) 70%, oklch(0 0 0) 30%)` ≈ 3.3:1 — just clearing 3:1.
- **Regression-guard:** Add a CSS token contrast unit-test or a playwright test that measures the computed `color` and `background-color` of `.btn-primary` in both themes and asserts ≥ 3:1 (if bold/large) or ≥ 4.5:1 (if normal weight). Alternatively, add a storybook / axe-core CI scan target.
- **Source critic:** milestone-web-perf-critic
- **Source axis:** Web Axis 6 — Accessibility (WCAG AA)

---

### MEDIUM

_(none)_

---

### LOW

#### [LOW] L1 — `LongTermEmpty` `<h3>` skips heading levels (no h2 ancestor in tabpanel)

- **File:** `src/components/illustrations/LongTermEmpty.tsx`
- **Line:** 26
- **Anchor:** `      <h3>No long-term goals yet</h3>`
- **What:** The LongTerm tabpanel contains no `<h1>` or `<h2>` element, so the `<h3>` in the empty-state illustration is the first heading in the tabpanel, skipping heading levels 1 and 2. By contrast, `GanttEmpty`'s `<h3>` is correctly nested under ChartView's `<h2>` chart-name heading.
- **Why it matters:** Screen readers navigate by heading levels; a jump from "no heading" to `<h3>` can confuse the heading outline for SR users (WCAG 1.3.1 / WCAG 2.4.6 advisory). The practical impact is low — tabpanel is labeled by the tab button, and the empty state is transient — but the heading level is semantically inaccurate.
- **Proposed fix:** Use `<p className="section-empty-heading">` styled to match the `<h3>` appearance, or change to `<h2>` (the first heading in the tabpanel context should be h2, matching the ChartView pattern). If changing to `<h2>`, verify no CSS rule targets `.section-empty-inner h2` is missing.
- **Source critic:** milestone-web-perf-critic
- **Source axis:** Web Axis 6 — Accessibility (WCAG AA)

---

## What was done well

1. **Bundle discipline maintained.** The initial chunk grew by only +2,220 bytes raw (+718 bytes gz) for two complete SVG illustration components plus three new CSS classes. This is among the most efficient expansions in the roadmap.
2. **Correct aria attributes on SVGs.** Both illustrations use `aria-hidden="true" focusable="false"` in combination — `focusable="false"` prevents the legacy SVG focusability bug in IE/Edge/Firefox <56 without relying on CSS.
3. **No new npm dependencies.** Inline SVG with CSS custom property tokens is the correct zero-dependency approach for decorative illustrations in an extension context where every kB counts.
4. **Multi-chart focus safety via `useRef`.** Each `ChartView` instance owns its own `addInputRef`, and `TodoList` owns its own. No `document.getElementById` or global state — the implementation correctly prevents the multi-chart focus collision the synthesis flagged as the primary risk.
5. **`useCallback` stable identity.** The `focusInput` callback is memoized with an empty deps array — it will not cause re-renders in child components that receive it as a prop, and the `useRef` body is always stable.
6. **Token discipline is complete.** All SVG `stroke` and `fill` attributes reference `var(--text-dim)` or `var(--accent)` exclusively. No hex literals in illustration components — theme toggle will recolor correctly without any JavaScript.
7. **Tag-filter empty state preserved.** The ternary in `TodoList.tsx` correctly gates `emptyIllustration` on `effectiveActiveTagIds.length === 0`, ensuring the "No tasks match..." filter-empty state is unaffected.
8. **`TodoCardSection.tsx`, `Today.tsx`, `Sprint.tsx` untouched.** The diff confirms the mandate from synthesis §3.12 and §AC8 was followed exactly — no unintended API surface changes to existing consumers.
9. **`.section-empty-inner` wrapper avoids layout impact on unrelated usages.** Introducing the flex wrapper as an inner element (rather than modifying `.section-empty` directly) ensures the 8+ other `.section-empty` instances across the codebase are unaffected.
10. **Responsive illustration sizing.** `max-width: 200px; width: 100%; height: auto` on `.section-empty-illustration` correctly caps the SVG at 200px at the 390px viewport breakpoint and preserves the 240×160 viewBox aspect ratio without fixed-height constraints.

---

## Recommended rectification order

H1, L1

---

## Phase 4 status (filled by orchestrator at rectify time)

- Fixed:
- Deferred:
- Invalidated:
- Regression tests added:
