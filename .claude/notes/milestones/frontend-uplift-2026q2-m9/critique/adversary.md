# Critique — frontend-uplift-2026q2-m9 — adversary

**Critic:** adversary
**Commit range:** 8cbea01..92f06ff
**Generated:** 2026-05-21T01:30:00Z
**Diff stats:** 6 files changed, +129 / -4 (net 133 LOC)

## Verdict

SHIP-WITH-FIXES — all 9 ACs in the synthesis are met. The implementation hits every m9-specific axis cleanly: `.btn-primary` defined (sections.css:330), zero hex literals in either illustration (`grep -cEn '#[0-9a-fA-F]{3,6}'` returns 0 / 0), SVG accessibility attributes present on both files (`aria-hidden="true"` + `focusable="false"` at lines 11–12 of each), per-instance `useRef` (no `document.getElementById` anywhere in the diff), `emptyHint: string` prop signature preserved, tag-filter empty-state branch untouched, and Gantt.tsx:94 / Today.tsx / Sprint.tsx / TodoCardSection.tsx all out of the diff. Build reproduces to the byte (303.89 kB raw / 96.76 kB gz — matches implementer claim and lands ~2 kB above the m8 baseline of 301.62 kB, well within the 400/500 kB ceiling). The fixes below are all MEDIUM or LOW polish — nothing blocking — and the milestone closes the entire frontend-uplift-2026q2 roadmap cleanly.

## Executive summary

- [MEDIUM] LongTerm empty state's CTA fires `focusInput` even when the user is in card mode — the illustration never reaches a card-mode user (TodoCardSection owns the empty state in card mode), so this is dead-code latency only, not a correctness break.
- [MEDIUM] `.section-empty-inner h3` resets `color: var(--text)` and `font-size: 1rem`, but the surrounding `.section-empty` block still applies `text-align: center` and the dashed border at App.css:201–208 — two visually-distinct empty-state shapes (legacy text-only vs new illustration) now coexist under the same outer class. Acceptable for v0; flagged for future consolidation.
- [LOW] `<h3>` heading level inside the LongTerm empty state has no `<h2>` ancestor in the rendered tabpanel context (Gantt does — its `<h2>` chart name precedes the empty state). Heading-level skip is a soft a11y concern, not a violation.
- [LOW] Empty-state body `<p>` in `LongTermEmpty.tsx:25` uses HTML entity `&apos;` for the apostrophe in "you're"; JSX-valid but inconsistent with the typographic em-dash literal on the same line. Either both stay literals or both stay entities.
- [LOW] `.btn-primary:hover` uses `opacity: 0.9` as the only hover affordance — no transition, no transform, no focus-ring rule. Consistent with `.modal-btn-primary` (which also uses opacity-only) so this is not a regression, just a noted future polish opportunity.
- [LOW] Commit message body contains a long en-dash sequence "(not document.getElementById — safe...)" inside the prose; valid but reduces grep-ability of the literal API name. Style only.

## Findings

### CRITICAL

(None.)

### HIGH

(None.)

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

### LOW

#### [LOW] L1 — Heading-level skip in LongTerm empty state

- **File:** `src/components/illustrations/LongTermEmpty.tsx`
- **Line:** 24
- **Anchor:** `      <h3>No long-term goals yet</h3>`
- **What:** `<h3>` is used as the empty-state heading. In Gantt this is preceded by ChartView's `<h2>` chart-name at ChartView.tsx:433 — heading sequence h2 → h3, correct. In LongTerm, the tabpanel does NOT render an enclosing `<h2>` before the TodoList; the empty state's `<h3>` is the first heading in the tabpanel scope.
- **Why it matters:** Soft a11y nuance — screen readers will encounter h3 without h2. Not a WCAG violation (heading-level-skip is a recommendation, not a hard rule), but page heading outlines benefit from sequential nesting. The synthesis §3.9 prescribed `<h3>` based on the IBM Carbon pattern, so this is a follow-spec choice rather than a defect.
- **Proposed fix:** Either (a) downgrade both empty-state headings to `<h2>` and adjust `.section-empty-inner h3` selector to `.section-empty-inner h2` + drop the font-size since `<h2>` defaults are larger, OR (b) leave as-is and accept the LongTerm h3-without-h2. Recommend (b) for v0 — the empty state is transient and h3 is the IBM Carbon prescription. Document the decision in a sections.css comment.
- **Source critic:** adversary
- **Source axis:** a11y

#### [LOW] L2 — Inconsistent typographic encoding in LongTermEmpty body text

- **File:** `src/components/illustrations/LongTermEmpty.tsx`
- **Line:** 26
- **Anchor:** `      <p>Capture the things you want to ship`
- **What:** The body `<p>` mixes literal em-dash (U+2014 "—") with HTML entity `&apos;` for the apostrophe in "you're". Both are JSX-safe (the apostrophe in JSX requires either `&apos;`, `&#39;`, or escaping inside a curly-brace expression), so this is style-only. The em-dash is a literal Unicode character; the apostrophe is an entity. Pick one.
- **Why it matters:** Style inconsistency only. JSX/React renders both correctly. Some linters flag literal apostrophes in JSX (`react/no-unescaped-entities`), which is why `&apos;` was used; the em-dash escapes the lint rule too. Either both literal or both entity.
- **Proposed fix:** Replace `&apos;` with a literal `'` wrapped in a curly-brace expression: `you{"'"}re`. Or keep `&apos;` and convert the em-dash to `&mdash;`. No urgency.
- **Source critic:** adversary
- **Source axis:** code style

#### [LOW] L3 — `.btn-primary:hover` opacity-only affordance — no focus-visible ring

- **File:** `src/sections/sections.css`
- **Line:** 339–341
- **Anchor:** `.btn-primary:hover {`
- **What:** The new `.btn-primary` class has a `:hover { opacity: 0.9 }` rule but no `:focus-visible` outline rule. Browser defaults will apply a focus ring on Tab focus, but no custom rule reinforces it. `.modal-btn-primary` (the inspiration) follows the same opacity-only pattern, so this is consistent — but the empty-state CTA is a keyboard-reachable button that just received focus from the user clicking it (synthesis: "click CTA → focus moves to add-task input"). The button itself momentarily holds focus during the keyboard activation path.
- **Why it matters:** Browser default focus-visible rings are visible but typographically arbitrary; a custom outline matching the accent token would feel more cohesive. Consistent with existing patterns (`.modal-btn-primary` has the same gap), so no regression — flagged as a future polish opportunity for both classes together.
- **Proposed fix:** Optional one-line addition: `.btn-primary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`. Apply to `.modal-btn-primary` in the same rectifier pass for consistency.
- **Source critic:** adversary
- **Source axis:** a11y polish

## What was done well

- `.btn-primary` was correctly defined in `sections.css` before the CTA was wired — the synthesis §7 "riskiest assumption" was that the implementer would render `className="btn-primary"` against an undefined class and ship an unstyled button; the implementer pre-empted that by adding the class definition first.
- `.btn-primary` uses `var(--accent-on)` (the m1 token) instead of the `#0b0e14` hex literal that `.modal-btn-primary` carries — exactly as synthesis §3.1 + OQ1 prescribed, preserving theme parity in both light + dark.
- Zero hex literals in either illustration SVG — both files pass `grep -cEn '#[0-9a-fA-F]{3,6}' = 0`. All stroke/fill values use `var(--text-dim)` or `var(--accent)`, satisfying AC1 and the theme-invariance requirement.
- Both SVGs carry `aria-hidden="true"` AND `focusable="false"` at lines 11–12 — IBM Carbon decorative-illustration pattern applied correctly. Headings + body text + CTA carry the semantic load.
- `useRef<HTMLInputElement>(null)` declared INSIDE `ChartView()` at line 92 (not hoisted to Gantt.tsx) — multi-chart safety preserved per synthesis §3.5. Each chart's CTA focuses its own input.
- `emptyHint: string` prop signature UNCHANGED — Today/Sprint/TodoCardSection callers unaffected. The new `emptyIllustration?: (focusInput: () => void) => ReactNode` is purely additive (synthesis §3.2 + Option B from §3.3).
- Tag-filter empty-state branch at TodoList.tsx:257–270 is byte-for-byte preserved against pre-m9 — the new illustration ONLY renders in the `effectiveActiveTagIds.length === 0` plain-empty case (AC5 honored).
- Out-of-scope files (Gantt.tsx, Today.tsx, Sprint.tsx, TodoCardSection.tsx) are not in the diff — verified via `git diff --stat`. Synthesis §3.4 + §3.12 + AC7 boundaries respected.
- Build is clean (`npm run build` → 0 TS errors; 303.89 kB raw / 96.76 kB gz). Initial chunk landed ~2.27 kB above the m8 baseline of 301.62 kB, well within the 400 kB soft target and far from the 500 kB hard ceiling. 9th consecutive milestone where independent build reproduction matches the implementer's claim to the byte.
- Commit message: `feat(style): empty-state illustrations + CTA (m9)` — subject is 36 chars after the `feat(style): ` prefix (well under 50), scope `style` is in the CLAUDE.md active scope list, GPG-signed (signature status `G`), Co-Authored-By trailer present. Conventional-commit discipline clean.
- The implement-synthesis "Built" section maps 1:1 against the synthesis ACs (AC1 → AC8) and explicitly calls out the deferred items from synthesis §3.11 + §3.12 + §3.4. No silent scope drift.

## Recommended rectification order

`M1, M2, L1, L2, L3`

All findings are non-blocking polish. M1 and M2 are doc-only changes; L1–L3 are style/a11y nuances that can be deferred or addressed in a single follow-up commit. None of these warrant blocking the m9 ship.

## Phase 4 status (filled by orchestrator at rectify time)

- Fixed:
- Deferred:
- Invalidated:
- Regression tests added:
