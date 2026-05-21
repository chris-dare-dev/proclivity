# Critique — frontend-uplift-2026q2-m9 — DEDUPED MERGE

**Sources:** adversary, web
**Counts:** C=0 H=1 M=3 L=1

## Verdict

**SHIP-WITH-FIXES** (aggregated from: SHIP-WITH-FIXES)

## Executive summary

- [HIGH] `.btn-primary` CTA text fails WCAG AA in both themes
- [MEDIUM] LongTerm CTA wiring exposes focusInput in card mode (dead reach)
- [MEDIUM] `.section-empty` legacy + new shape coexist with divergent visual contract
- [MEDIUM] Heading-level skip in LongTerm empty state
- [LOW] `.btn-primary:hover` opacity-only affordance — no focus-visible ring

## Findings

### CRITICAL

### HIGH

#### [HIGH] H1 — `.btn-primary` CTA text fails WCAG AA in both themes

- **File:** `src/sections/sections.css`
- **Line:** 330–341
- **Anchor:** `.btn-primary {`
- **What:** The CTA button uses `color: var(--accent-on)` on `background: var(--accent)`. Computed contrast ratios are 2.61:1 (dark: white `#ffffff` on `#7c9cff`) and 3.24:1 (light: near-black `oklch(0.18 0.012 252)` on `#4859d0`). The WCAG AA threshold for `font-weight: 500` text at 15px (not bold, not large text) is 4.5:1. Both modes fail.
- **Why it matters:** The CTA button is the primary interaction target for an empty-state illustration — it is the first focusable element visible to a user with low contrast sensitivity, and is also the design's primary call to action. A button that cannot be read reliably fails at precisely the moment UX friction is highest (zero-content state).
- **Proposed fix:** Option A (recommended) — add `font-weight: 600` to `.btn-primary`, which qualifies the text as "bold" and shifts the applicable threshold to 3:1 (large text / bold ≥ 14px). Dark mode 2.61:1 still fails 3:1; therefore also declare a per-mode override that raises contrast: e.g. add a dedicated `.btn-primary` rule inside `[data-theme="light"]` that sets `color: oklch(0 0 0)` (pure black on `#4859d0` = 7.01:1). For dark mode, a concrete fix is to treat `--accent-on` as "always white" when used on the accent background, which it already is in dark mode — the problem is the accent itself (`#7c9cff`) is too light to yield 4.5:1 against white. The correct fix for dark mode is either (a) bolding to meet 3:1 (2.61:1 → still fails) or (b) using a darker variant of the accent as the background: `color-mix(in srgb, var(--accent) 80%, var(--bg) 20%)` ≈ #6385e0, yields ~3.4:1 with white — approaches but doesn't clear 4.5:1. The cleanest path is `font-weight: 600` to drop threshold to 3:1 PLUS ensuring dark-mode contrast ≥ 3:1: `#7c9cff` on white = 2.61:1 → still fails 3:1. Therefore the minimal fix that clears both modes is: (c) a dedicated higher-contrast `--btn-accent` token for button surfaces, set darker than `--accent` in both modes. This is the same recommendation as m11 M3. As a shorter-term fix: use `font-weight: 700` (bold) at 16px which qualifies as "large text" (≥ 14px bold = 3:1 threshold), and slightly darken the dark-mode accent surface: `background: color-mix(in srgb, var(--accent) 70%, oklch(0 0 0) 30%)` ≈ 3.3:1 — just clearing 3:1.
- **Regression-guard:** Add a CSS token contrast unit-test or a playwright test that measures the computed `color` and `background-color` of `.btn-primary` in both themes and asserts ≥ 3:1 (if bold/large) or ≥ 4.5:1 (if normal weight). Alternatively, add a storybook / axe-core CI scan target.
- **Source critic:** web
- **Source axis:** Web Axis 6 — Accessibility (WCAG AA)
- **Original id:** H1

### MEDIUM

#### [MEDIUM] M1 — LongTerm CTA wiring exposes focusInput in card mode (dead reach)

- **File:** `src/sections/TodoList.tsx`
- **Line:** 119–120
- **Anchor:** `  const addInputRef = useRef<HTMLInputElement>`
- **What:** `addInputRef` is attached to the main `<input>` at line 199 which renders in BOTH list mode and card mode (the input lives ABOVE the `layoutMode === "card"` branch at line 216). Synthesis §3.12 explicitly carves out card mode from the illustration path, but the ref is created and attached on every render regardless of layoutMode, and `focusInput` is built unconditionally via `useCallback`. In card mode the LongTerm illustration is never rendered (TodoCardSection owns the empty state), so this is dead-code latency rather than a behavioral bug — but the synthesis prescribed "TodoList owns the ref; LongTerm owns the illustration" with the implicit assumption that the ref only matters in list mode.
- **Why it matters:** No observable user-facing regression today (the ref simply stays attached to a live input that the user can already focus via Tab). The concern is correctness-by-construction: if a future milestone enables an illustration in card mode (synthesis §8 OQ5 explicitly defers this), the focusInput closure will point at a list-mode input element that the card-mode user cannot see, silently producing a focus-trap-into-hidden-element bug. Surface it now as a maintenance note.
- **Proposed fix:** No code change required for m9. Add a one-line comment near line 119: `// addInputRef intentionally attaches in both list + card mode; the input above is the always-rendered add affordance. The illustration consumer (LongTerm) only fires in list mode (card mode uses TodoCardSection's emptyHint), so focusInput's reach matches the consumer's reach.` This documents the boundary so a future card-mode-illustration milestone knows to re-evaluate.
- **Regression-guard:** Optional — a manual smoke would assert that opening LongTerm in card mode with zero items shows the legacy `emptyHint` text (via TodoCardSection), not the LongTermEmpty illustration.
- **Source critic:** adversary
- **Source axis:** correctness-by-construction (synthesis §3.12 boundary)
- **Original id:** M1

#### [MEDIUM] M2 — `.section-empty` legacy + new shape coexist with divergent visual contract

- **File:** `src/sections/sections.css`
- **Line:** 342–351
- **Anchor:** `.section-empty-inner {`
- **What:** Two visually distinct empty-state shapes now share the `.section-empty` outer class. The legacy shape (used by `TodoList`'s tag-filter branch and several other pre-m9 callers per `grep -rn '.section-empty' src/`) renders inline text inside the dashed-border + 32px-padding container with `color: var(--text-dim)` and `text-align: center`. The new shape (GanttEmpty + LongTermEmpty) renders the SAME outer container but injects a flex-column `.section-empty-inner` child with its own `h3` `color: var(--text)` + sized `<p>`. The dashed border + 32px padding wrap both shapes; the inner layout diverges.
- **Why it matters:** Future contributors reading `.section-empty` rules in App.css:201 may not realize there are two shapes. Refactoring `.section-empty` padding/border would affect both shapes simultaneously — a desirable property — but adjusting `text-align` on `.section-empty` to anything non-center would break the legacy callers while the new flex children would be unaffected. A short doc anchor would prevent this trap.
- **Proposed fix:** Add a 2-line comment above sections.css:346 documenting the two-shape coexistence: `/* .section-empty-inner is the m9 vertical layout for illustration empty states. Legacy text-only empty states (tag-filter branch, etc.) render inline text directly inside .section-empty without this wrapper. Both shapes share .section-empty's dashed border + 32px padding intentionally; keep changes to .section-empty (App.css:201) shape-neutral. */`
- **Regression-guard:** Optional — a CSS comment + a grep'able marker.
- **Source critic:** adversary
- **Source axis:** doc-drift (CLAUDE.md "load-bearing" pattern)
- **Original id:** M2

#### [MEDIUM] M3 — Heading-level skip in LongTerm empty state [AGREEMENT]

- **File:** `src/components/illustrations/LongTermEmpty.tsx`
- **Line:** 24
- **Anchor:** `      <h3>No long-term goals yet</h3>`
- **What:** `<h3>` is used as the empty-state heading. In Gantt this is preceded by ChartView's `<h2>` chart-name at ChartView.tsx:433 — heading sequence h2 → h3, correct. In LongTerm, the tabpanel does NOT render an enclosing `<h2>` before the TodoList; the empty state's `<h3>` is the first heading in the tabpanel scope.
- **Why it matters:** Soft a11y nuance — screen readers will encounter h3 without h2. Not a WCAG violation (heading-level-skip is a recommendation, not a hard rule), but page heading outlines benefit from sequential nesting. The synthesis §3.9 prescribed `<h3>` based on the IBM Carbon pattern, so this is a follow-spec choice rather than a defect.
- **Proposed fix:** Either (a) downgrade both empty-state headings to `<h2>` and adjust `.section-empty-inner h3` selector to `.section-empty-inner h2` + drop the font-size since `<h2>` defaults are larger, OR (b) leave as-is and accept the LongTerm h3-without-h2. Recommend (b) for v0 — the empty state is transient and h3 is the IBM Carbon prescription. Document the decision in a sections.css comment.
- **Source critic:** adversary, flagged by: adversary, web
- **Source axis:** a11y
- **Original id:** L1

### LOW

#### [LOW] L1 — `.btn-primary:hover` opacity-only affordance — no focus-visible ring

- **File:** `src/sections/sections.css`
- **Line:** 339–341
- **Anchor:** `.btn-primary:hover {`
- **What:** The new `.btn-primary` class has a `:hover { opacity: 0.9 }` rule but no `:focus-visible` outline rule. Browser defaults will apply a focus ring on Tab focus, but no custom rule reinforces it. `.modal-btn-primary` (the inspiration) follows the same opacity-only pattern, so this is consistent — but the empty-state CTA is a keyboard-reachable button that just received focus from the user clicking it (synthesis: "click CTA → focus moves to add-task input"). The button itself momentarily holds focus during the keyboard activation path.
- **Why it matters:** Browser default focus-visible rings are visible but typographically arbitrary; a custom outline matching the accent token would feel more cohesive. Consistent with existing patterns (`.modal-btn-primary` has the same gap), so no regression — flagged as a future polish opportunity for both classes together.
- **Proposed fix:** Optional one-line addition: `.btn-primary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`. Apply to `.modal-btn-primary` in the same rectifier pass for consistency.
- **Source critic:** adversary
- **Source axis:** a11y polish
- **Original id:** L3

## What was done well

  - `.btn-primary` was correctly defined in `sections.css` before the CTA was wired — the synthesis §7 "riskiest assumption" was that the implementer would render `className="btn-primary"` against an undefined class and ship an unstyled button; the implementer pre-empted that by adding the class definition first.  _(adversary)_
  - `.btn-primary` uses `var(--accent-on)` (the m1 token) instead of the `#0b0e14` hex literal that `.modal-btn-primary` carries — exactly as synthesis §3.1 + OQ1 prescribed, preserving theme parity in both light + dark.  _(adversary)_
  - Zero hex literals in either illustration SVG — both files pass `grep -cEn '#[0-9a-fA-F]{3,6}' = 0`. All stroke/fill values use `var(--text-dim)` or `var(--accent)`, satisfying AC1 and the theme-invariance requirement.  _(adversary)_
  - Both SVGs carry `aria-hidden="true"` AND `focusable="false"` at lines 11–12 — IBM Carbon decorative-illustration pattern applied correctly. Headings + body text + CTA carry the semantic load.  _(adversary)_
  - `useRef<HTMLInputElement>(null)` declared INSIDE `ChartView()` at line 92 (not hoisted to Gantt.tsx) — multi-chart safety preserved per synthesis §3.5. Each chart's CTA focuses its own input.  _(adversary)_
  - `emptyHint: string` prop signature UNCHANGED — Today/Sprint/TodoCardSection callers unaffected. The new `emptyIllustration?: (focusInput: () => void) => ReactNode` is purely additive (synthesis §3.2 + Option B from §3.3).  _(adversary)_
  - Tag-filter empty-state branch at TodoList.tsx:257–270 is byte-for-byte preserved against pre-m9 — the new illustration ONLY renders in the `effectiveActiveTagIds.length === 0` plain-empty case (AC5 honored).  _(adversary)_
  - Out-of-scope files (Gantt.tsx, Today.tsx, Sprint.tsx, TodoCardSection.tsx) are not in the diff — verified via `git diff --stat`. Synthesis §3.4 + §3.12 + AC7 boundaries respected.  _(adversary)_
  - Build is clean (`npm run build` → 0 TS errors; 303.89 kB raw / 96.76 kB gz). Initial chunk landed ~2.27 kB above the m8 baseline of 301.62 kB, well within the 400 kB soft target and far from the 500 kB hard ceiling. 9th consecutive milestone where independent build reproduction matches the implementer's claim to the byte.  _(adversary)_
  - Commit message: `feat(style): empty-state illustrations + CTA (m9)` — subject is 36 chars after the `feat(style): ` prefix (well under 50), scope `style` is in the CLAUDE.md active scope list, GPG-signed (signature status `G`), Co-Authored-By trailer present. Conventional-commit discipline clean.  _(adversary)_

## Recommended rectification order

H1, M1, M2, M3, L1
