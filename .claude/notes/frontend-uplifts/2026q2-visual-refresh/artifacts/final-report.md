# Final Report — 2026q2-visual-refresh

**Uplift ID:** 2026q2-visual-refresh
**Date:** 2026-05-20
**Author:** orchestrator (main session, Phase 4 prioritize)
**Inputs:** synthesis.md (26 candidates), challenge.md (0 BLOCKER / 5 MAJOR / 10 MINOR / 11 clean)

---

## 1. Executive summary

The three top-ranked candidates by adjusted RICE are **UPL-6 (warm-gray token shift) at 46.8**, **UPL-1 (adopt `motion` library, lazy-loaded) at 39.0**, and **UPL-2 (section-fade cross-dissolve on tab switches) at 18.0** — together a clear thematic recommendation: **land the cheap-but-transformative foundation first (warm-gray + motion library), then knock down the highest-visibility motion gap (section transitions).** The two foundational candidates (UPL-1 and UPL-6, plus UPL-8 the icon system at rank #5) collectively unlock 10 of the remaining 23 candidates and should be sequenced before any motion follow-ons. The challenger surfaced 5 MAJOR findings (UPL-2, UPL-7, UPL-11, UPL-18, UPL-25) — none are kills; all have v0 cut-lines documented inline. Honest caveat: the visual scout ran with a 15-minute budget and a tool fallback (Playwright headless instead of `mcp__Claude_Preview__*`), so single-source candidates (15 of 26) have a ±50% confidence ceiling and should be re-scrutinized at milestone-decomposition time.

---

## 2. Quick-glance ranking table

| Rank | Cand id | Title | Category | Size | R | I | C | E | Penalty | Adj-RICE | Challenger |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | UPL-6 | Warm-gray token shift | Color/theme | XS | 10 | 3 | 0.3 | 0.25 | +30% (foundational) | **46.8** | MINOR |
| 2 | UPL-1 | Adopt `motion` library (lazy) | Library/dep | S | 10 | 3 | 1.0 | 1 | +30% (foundational) | **39.0** | MINOR |
| 3 | UPL-2 | Section-fade cross-dissolve | Motion | S | 10 | 3 | 0.8 | 1 | -25% (MAJOR) | **18.0** | MAJOR (a11y) |
| 4 | UPL-16 | Mobile header layout fix | Layout | XS | 10 | 1 | 0.3 | 0.25 | — | **12.0** | NONE |
| 5 | UPL-8 | Adopt `lucide-react` icons | Library/dep | S | 10 | 1 | 0.8 | 1 | +30% (foundational) | **10.4** | NONE |
| 6 | UPL-3 | Stagger-reveal on todo lists | Motion | S | 3 | 3 | 1.0 | 1 | — | **9.0** | MINOR |
| 7 | UPL-25 | Adopt `sonner` for toasts | Library/dep | XS | 10 | 1 | 0.3 | 0.25 | -25% (MAJOR) | **9.0** | MAJOR (motion) |
| 8 | UPL-20 | Adopt `react-hotkeys-hook` | Library/dep | XS | 10 | 0.5 | 0.3 | 0.25 | — | **6.0** | NONE |
| 9 | UPL-22 | Reduced-motion guard sweep | Cross-cutting refactor | XS | 10 | 0.5 | 0.3 | 0.25 | — | **6.0** | MINOR |
| 10 | UPL-18 | Adopt `cmdk` command palette | Library/dep | M | 10 | 3 | 0.5 | 3 | -25% (MAJOR) | **3.75** | MAJOR (bundle) |
| 11 | UPL-9 | Lift-on-hover on todo rows | Interaction | XS | 3 | 1 | 0.3 | 0.25 | — | **3.6** | MINOR |
| 12 | UPL-13 | Adopt `@formkit/auto-animate` | Library/dep | XS | 3 | 1 | 0.3 | 0.25 | — | **3.6** | NONE |
| 13 | UPL-19 | Keyboard help overlay | Interaction | S | 10 | 1 | 0.3 | 1 | — | **3.0** | NONE |
| 14 | UPL-4 | Modal scale-in + backdrop blur | Motion | S | 3 | 1 | 0.8 | 1 | — | **2.4** | MINOR |
| 15 | UPL-14 | Empty-state illustrations + CTA | Layout | M | 3 | 3 | 0.8 | 3 | — | **2.4** | MINOR |
| 16 | UPL-11 | Pill-style tab indicator | Motion | S | 10 | 1 | 0.3 | 1 | -25% (MAJOR) | **2.25** | MAJOR (token) |
| 17 | UPL-21 | Token-discipline sweep | Cross-cutting refactor | S | 10 | 0.5 | 0.3 | 1 | — | **1.5** | NONE |
| 18 | UPL-5 | Skeleton loading states | Motion | M | 3 | 1 | 0.8 | 3 | — | **0.8** | MINOR |
| 19 | UPL-7 | Variable-weight font (Inter) | Typography | M | 10 | 1 | 0.3 | 3 | -25% (MAJOR) | **0.75** | MAJOR (bundle) |
| 20 | UPL-12 | Sprint progress fill animation | Motion | XS | 1 | 0.5 | 0.3 | 0.25 | — | **0.6** | NONE |
| 21 | UPL-15 | LongTerm accent variant | Color/theme | XS | 1 | 0.5 | 0.3 | 0.25 | — | **0.6** | NONE |
| 22 | UPL-17 | Settings pane fade transition | Motion | XS | 1 | 0.5 | 0.3 | 0.25 | — | **0.6** | MINOR |
| 23 | UPL-10 | Breathing-glow on reminders | Motion | S | 1 | 1 | 0.5 | 1 | — | **0.5** | MINOR |
| 24 | UPL-23 | Photos manual controls | Interaction | S | 1 | 1 | 0.3 | 1 | — | **0.3** | NONE |
| 25 | UPL-24 | datetime-local replacement | Layout | S | 1 | 0.5 | 0.3 | 1 | — | **0.15** | NONE |
| 26 | UPL-26 | Mesh bloom + ambient lighting | Library/dep | M | 1 | 1 | 0.3 | 3 | -25% (MAJOR) | **0.075** | MAJOR (version) |

**Top-3 cluster** (RICE ≥ 18): UPL-6, UPL-1, UPL-2.
**Strong tier** (RICE ≥ 6): UPL-16, UPL-8, UPL-3, UPL-25, UPL-20, UPL-22.
**Solid tier** (RICE ≥ 2): UPL-18, UPL-9, UPL-13, UPL-19, UPL-4, UPL-14, UPL-11.
**Marginal tier** (RICE < 2): UPL-21, UPL-5, UPL-7, UPL-12, UPL-15, UPL-17, UPL-10, UPL-23, UPL-24, UPL-26.

---

## 3. Foundational candidates (FIRST in detail — they unblock the rest)

These three candidates appear at the top of the rank table because they unlock 10+ downstream candidates. Phase 4 sequencing should land them before any candidate that depends on them.

### UPL-6 (Rank 1) — Warm-gray token shift (foundational, RICE 46.8)

**Why it's #1:** XS effort × foundational bonus × broad reach × transformative aesthetic impact (Linear's documented headline 2026 change). The candidate has only 1 brief source (inspiration-scout Pattern 11), which capped its Confidence at 0.3 — but the small effort and large reach drove the score regardless.

**Unlocks:** UPL-21 token-discipline sweep (compounds with the warmer palette), UPL-26 mesh aesthetic alignment (warmer bg makes bloom read natural).

**Why ship first:** ~5–8 lines in `theme.css`, no library, no bundle delta, no a11y risk. Lowest implementation risk in the entire catalog.

**Single dependency:** none. Pure CSS token change.

---

### UPL-1 (Rank 2) — Adopt `motion` library (lazy-loaded) (foundational, RICE 39.0)

**Why it's #2:** Maximum triangulation (all 4 briefs endorse), transformative impact, foundational bonus, modest S effort.

**Unlocks:** UPL-2 (section-fade), UPL-3 (stagger-reveal, alternative path), UPL-4 (modal scale-in exit animation), UPL-9 (lift-on-hover, motion variant), UPL-11 (pill indicator with layoutId), UPL-12 (progress fill animation), UPL-17 (settings pane fade), UPL-19 (help overlay scale-in). That's 8 follow-on candidates.

**Bundle math (challenger validated, needs measurement gate):** ~4.6 KB initial (LazyMotion + `m` minimal) + ~15 KB deferred (domAnimation feature pack). Phase 4 mandate: **require `vite build --report` baseline BEFORE and AFTER UPL-1 lands** to confirm the 200 KB initial-chunk ceiling holds.

**Dependency:** none. Land independently.

---

### UPL-8 (Rank 5) — Adopt `lucide-react` icon system (foundational, RICE 10.4)

**Why it's #5:** High reach (every section) but lower visual-impact rating (`I=1` "noticeably nicer" — not transformative), 3-brief triangulation.

**Unlocks:** UPL-21 token-discipline sweep (icon replacement happens in the same code paths as hex-to-token substitution), UPL-23 Photos controls (uses Lucide icons for prev/next/pause).

**Why parallel-foundational:** Doesn't block UPL-1 or UPL-6 — can ship alongside them. The icon system replacement is mechanical (~12 icon substitutions) and tree-shakes to ~6 KB gz total.

**Dependency:** none. Land in parallel with UPL-6.

---

## 4. Top-10 in detail

Each entry below: synthesis catalog → challenger inline → RICE breakdown → rank rationale → DAG dependency note.

---

### Rank 1 — UPL-6 — Warm-gray token shift (RICE 46.8)

**Category:** Color/theme · **Size:** XS · **Triangulation:** 1 brief (inspiration ✓) · **Foundational:** YES

**What it is** (from synthesis): Reduce chroma on dark-theme `--bg` from `oklch(0.10 0.012 252)` to ~`oklch(0.10 0.006 237)`. Apply the same chroma-halve / hue-warm-shift to `--panel`, `--panel-2`, `--border`, `--text-dim`. Linear's documented March 2026 palette refresh.

**Why it matters:** Linear's design blog cites this as their highest-impact 2026 change. Reduces visual tension; positions Proclivity as a calm workspace rather than a cold utility tool. Touches only neutral tokens; the user-customizable `--accent` is untouched.

**Challenger:** MINOR — no objection on substance. Phase 4 should schedule UPL-21 (token-discipline sweep) AFTER UPL-6 lands so any leftover `#0b0e14` hardcodes stand out for hex-to-token replacement.

**RICE breakdown:** R=10 × I=3 × C=0.3 / E=0.25 = 36.0 → +30% foundational bonus → **46.8**

**Dependency note:** None. Ship first. Compounds with UPL-21.

---

### Rank 2 — UPL-1 — Adopt `motion` library (LazyMotion + domAnimation) (RICE 39.0)

**Category:** Library/dependency · **Size:** S · **Triangulation:** 4 briefs (all) · **Foundational:** YES

**What it is** (from synthesis): Add `motion` to `package.json`. Import only `m` + `LazyMotion` in App shell (~4.6 KB initial). Defer `domAnimation` feature pack via `() => import('motion/react').then(r => r.domAnimation)` after first paint.

**Why it matters:** Foundational unlock for 8 motion candidates. The cleanest path to all higher-rank motion follow-ons.

**Challenger:** MINOR — no substantive objection. Cross-cutting concern #1: require a `vite build --report` baseline before AND after this lands to verify the initial-chunk impact stays under the 200 KB ceiling.

**RICE breakdown:** R=10 × I=3 × C=1.0 / E=1 = 30.0 → +30% foundational bonus → **39.0**

**Dependency note:** None. Land after UPL-6 (or in parallel — they're orthogonal).

---

### Rank 3 — UPL-2 — Section-fade cross-dissolve on tab switches (RICE 18.0)

**Category:** Motion · **Size:** S · **Triangulation:** 3 briefs (visual ✓, inspiration ✓, current-state ✓) · **Depends on:** UPL-1

**What it is** (from synthesis): Replace the `hidden=` attribute pattern on tabpanels with an opacity-driven cross-fade. 150–220 ms ease-out, scoped to `@media (prefers-reduced-motion: no-preference)`.

**Why it matters:** Most-frequent navigation event in the daily-use surface. Current instant hard-cut is the single most-noticeable gap vs Linear / Cron / Notion Calendar.

**Challenger:** MAJOR — Axis 3 (a11y regression). The synthesis's proposed `aria-hidden="true"` + opacity replacement for `hidden=` allows keyboard-focusable descendants in inactive panels to remain Tab-reachable. **v0 cut-line per challenger:** implement pure CSS path (Path a) only, keeping `hidden=` intact but adding `[data-leaving="true"]` and a short CSS animation triggered by a React state machine. v1: revisit AnimatePresence path AFTER adding `inert` attribute or `tabindex` management to all tabpanel descendants when exiting. Phase 4 also bumps the effort estimate from S to S/M (80–120 LOC realistic).

**RICE breakdown:** R=10 × I=3 × C=0.8 / E=1 = 24.0 → -25% MAJOR penalty → **18.0**

**Dependency note:** Path a (CSS-only v0) requires no UPL-1 dependency and is the recommended v0. Path b (AnimatePresence v1) requires UPL-1.

---

### Rank 4 — UPL-16 — Mobile header layout fix (RICE 12.0)

**Category:** Layout · **Size:** XS · **Triangulation:** 1 brief (visual ✓) · **Challenger:** NONE

**What it is** (from synthesis): `font-size: clamp(28px, 6vw, 56px)` on `.clock` so it scales with viewport. Add `overflow-x: auto; scrollbar-width: thin` to `.tabs` for horizontal scroll at narrow viewports.

**Why it matters:** At 390 px viewport the clock dominates and the tab row clips (visual-scout captured this in `today-mobile.png`). Proclivity is desktop-first but the mobile gap is systemic.

**Challenger:** NONE — pure CSS, no a11y regression, no bundle cost.

**RICE breakdown:** R=10 × I=1 × C=0.3 / E=0.25 = **12.0**

**Dependency note:** None. Can ship anytime.

---

### Rank 5 — UPL-8 — Adopt `lucide-react` icon system (RICE 10.4)

**Category:** Library/dependency · **Size:** S · **Triangulation:** 3 briefs (library ✓, visual ✓, current-state ✓) · **Foundational:** YES

**What it is** (from synthesis): Add `lucide-react`. Replace Unicode (`✎`, `✕`, `→`, `▾`, `▸`) and ad-hoc inline SVGs with named Lucide imports. Per-icon tree-shaking via Vite: ~6 KB gz total for ~12 icons.

**Why it matters:** Cross-platform Unicode rendering varies; SVG icons are visually consistent AND a11y-cleaner. Unlocks UPL-23 Photos manual controls + compounds with UPL-21 token-discipline sweep.

**Challenger:** NONE clean — ISC license, React 18 compatible, no token-discipline issues.

**RICE breakdown:** R=10 × I=1 × C=0.8 / E=1 = 8.0 → +30% foundational bonus → **10.4**

**Dependency note:** None. Ship in parallel with UPL-6.

---

### Rank 6 — UPL-3 — Stagger-reveal on todo list cold loads (RICE 9.0)

**Category:** Motion · **Size:** S · **Triangulation:** 4 briefs (visual ✓, library ✓, inspiration ✓, current-state ✓)

**What it is** (from synthesis): On Today/Sprint/LongTerm tab activation, each `<li>` fades-up with 50–60 ms inter-item stagger, capped at 10 items. Fires once per activation, not per re-render.

**Why it matters:** Single most-cited "feels alive vs static document" pattern across 2026 personal-planning SaaS.

**Challenger:** MINOR — recommends pure CSS path (Path a) for v0 to avoid the UPL-1 dependency, with a Motion-based stagger only for v1 if more sophistication is needed.

**RICE breakdown:** R=3 × I=3 × C=1.0 / E=1 = **9.0**

**Dependency note:** Path a (pure CSS) is independent. Path b (Framer Motion staggerChildren) depends on UPL-1. Recommend Path a for v0.

---

### Rank 7 — UPL-25 — Adopt `sonner` for in-page toast feedback (RICE 9.0)

**Category:** Library/dependency · **Size:** XS · **Triangulation:** 1 brief (library ✓)

**What it is** (from synthesis): Add `sonner` (~9 KB gz). Mount `<Toaster />` once in App.tsx. Call `toast.success(...)` from action callbacks. Non-modal confirmation feedback for reminder-created, settings-saved, etc.

**Why it matters:** Proclivity has no in-page feedback primitive. `chrome.notifications` is OS-level only; users lack confirmation that quick actions completed.

**Challenger:** MAJOR — the sketch did not document sonner's reduced-motion respect path. The library has it but the implementation must explicitly verify `useReducedMotion()` is respected before shipping. **v0 cut-line:** wrap in `useReducedMotion()` check + use `position="bottom-right"` consistently to avoid layout shifts.

**RICE breakdown:** R=10 × I=1 × C=0.3 / E=0.25 = 12.0 → -25% MAJOR penalty → **9.0**

**Dependency note:** None.

---

### Rank 8 — UPL-20 — Adopt `react-hotkeys-hook` (RICE 6.0)

**Category:** Library/dependency · **Size:** XS · **Triangulation:** 1 brief (library ✓) · **Challenger:** NONE

**What it is** (from synthesis): Add `react-hotkeys-hook` (~3 KB gz, zero deps). Replace ad-hoc `document.addEventListener('keydown')` with declarative `useHotkeys(...)` calls.

**Why it matters:** Standardizes the keyboard-shortcut layer. **Prerequisite for UPL-18 (Cmd+K palette) and UPL-19 (Cmd+/ help overlay).** Challenger cross-cutting concern #3 explicitly notes UPL-20 must land before UPL-18 + UPL-19.

**Challenger:** NONE clean.

**RICE breakdown:** R=10 × I=0.5 × C=0.3 / E=0.25 = **6.0**

**Dependency note:** None. Schedule before UPL-18 + UPL-19.

---

### Rank 9 — UPL-22 — Reduced-motion guard convention sweep (RICE 6.0)

**Category:** Cross-cutting refactor · **Size:** XS · **Triangulation:** 1 brief (current-state ✓)

**What it is** (from synthesis): Add missing `[data-reduced-motion="true"]` or `@media (prefers-reduced-motion: reduce)` guards at ~5 sites (sprint progress fill, QuickPrompt banner, MeshBackground fade-in, settings-badge-pulse) so all motion sites have the canonical dual-guard convention.

**Why it matters:** Currently silent fragility if the global theme.css fallback is ever removed. Challenger cross-cutting concern #4 explicitly notes UPL-22 should be scheduled BEFORE UPL-10 to prevent UPL-10 from inheriting the single-guard `settings-badge-pulse` pattern.

**Challenger:** MINOR — no scope cut needed.

**RICE breakdown:** R=10 × I=0.5 × C=0.3 / E=0.25 = **6.0**

**Dependency note:** Schedule BEFORE UPL-10 (and ideally combined with it).

---

### Rank 10 — UPL-18 — Adopt `cmdk` for command palette (Cmd+K) (RICE 3.75)

**Category:** Library/dependency · **Size:** M · **Triangulation:** 2 briefs (library ✓, inspiration ✓ implicit) · **Depends on:** UPL-20

**What it is** (from synthesis): Add `cmdk` (~12–14 KB gz total including required `@radix-ui/react-dialog`). Render a Cmd+K-triggered command palette. Lazy-loaded via `React.lazy()`.

**Why it matters:** Aligns Proclivity with Raycast / Linear keyboard-first interaction model.

**Challenger:** MAJOR — bundle cost is underestimated (actually 15–20 KB gz, not 12–14), pulls in 4 Radix peer-deps. **v0 cut-line:** mandatory `React.lazy()` boundary; constrain v0 to 4–6 commands (open settings, switch section, create todo, open help). v1: expand action registry.

**RICE breakdown:** R=10 × I=3 × C=0.5 / E=3 = 5.0 → -25% MAJOR penalty → **3.75**

**Dependency note:** Depends on UPL-20 (Cmd+K trigger). Schedule UPL-20 first.

---

## 5. Recommended next steps

### 5a — Three-milestone foundation sprint (recommended)

Land the three foundational candidates as separate milestones in parallel (no inter-dependencies):

1. **Milestone A: `frontend-uplift-warm-palette` (UPL-6)** — token-only refactor in `theme.css`. ~5–8 lines of CSS. XS effort.
2. **Milestone B: `frontend-uplift-motion-foundation` (UPL-1)** — add `motion` to dependencies. Wrap App shell in `<LazyMotion>`. **Hard gate: `vite build --report` baseline before AND after; abort if initial chunk exceeds 200 KB.** S effort.
3. **Milestone C: `frontend-uplift-icon-system` (UPL-8 + UPL-21 partial)** — add `lucide-react`. Replace Unicode chars and ad-hoc SVGs. Folds in the icon portion of UPL-21 token-discipline sweep (uses the same touched files). S effort.

These three foundations can ship within ~1 week of total effort and immediately unlock 10 downstream candidates.

### 5b — Two `/milestone-pipeline`-ready candidates after foundation lands

Once the foundation is in place, the next two milestones with the strongest cost/benefit:

1. **`frontend-uplift-section-transitions` (UPL-2)** — apply the challenger's v0 cut-line (CSS-only Path a, `hidden=` retained, `[data-leaving]` state). Highest-visibility single change in the catalog. S/M effort per challenger's revised estimate.
2. **`frontend-uplift-stagger-and-mobile` (UPL-3 + UPL-16)** — combine stagger-reveal (CSS Path a) with the mobile header fix. Both XS/S, mostly CSS, no library dependencies. Demonstrably improves Today/Sprint/LongTerm + every mobile view.

### 5c — Tier 2: schedule after foundation + above two milestones

In approximate RICE order:

- **UPL-25 (sonner toast)** — add the in-page feedback layer. Requires reduced-motion verification.
- **UPL-20 (react-hotkeys-hook)** + **UPL-22 (reduced-motion guard sweep)** — both XS, both prerequisites for downstream work. Schedule together.
- **UPL-9 (lift-on-hover) + UPL-13 (auto-animate) + UPL-14 (empty-state illustrations)** — visual-polish trio.

### 5d — Parking lot (defer indefinitely; revisit only if Phase 4 budget pressure forces re-rank)

The following 5 candidates are at the bottom of the rank table; defer to the next uplift run:

- **UPL-7 (Inter variable font)** — RICE 0.75, MAJOR bundle cost concern. Defer until chunk budget is measured post-UPL-1.
- **UPL-24 (datetime-local replacement)** — RICE 0.15, single-section, single-brief. Bundled visual gain too small for current scope.
- **UPL-23 (Photos manual controls)** — RICE 0.3, Photos-section-only. Defer unless Photos becomes a heavier-use surface.
- **UPL-10 (breathing-glow on armed reminders)** — RICE 0.5, single-section. Schedule after UPL-22 so the convention is fixed first.
- **UPL-26 (MeshBackground bloom)** — RICE 0.075, MAJOR (version error). Re-evaluate when React 19 upgrade is planned.

---

## 6. Visual evidence index

Screenshot evidence for each candidate (all under `.claude/notes/frontend-uplifts/2026q2-visual-refresh/screenshots/`):

| UPL-id | Title | Screenshot(s) |
|---|---|---|
| UPL-1 | Motion library | N/A (foundation; effects visible after follow-ons) |
| UPL-2 | Section-fade | `today-desktop.png` vs `sprint-desktop.png` (hard-cut visible across all 8 transitions) |
| UPL-3 | Stagger-reveal | `today-desktop.png`, `sprint-desktop.png`, `long-term-desktop.png` |
| UPL-4 | Modal scale-in | `modal-todo-edit-desktop.png`, `settings-general-desktop.png` |
| UPL-5 | Skeleton loading | `today-desktop.png` (Photos slot absent — UPL-5 signal) |
| UPL-6 | Warm-gray | every desktop screenshot (compare cool-blue to Linear's public design-blog imagery) |
| UPL-7 | Inter font | `today-desktop.png`, `today-mobile.png` (system font in greeting/clock) |
| UPL-8 | Lucide icons | `modal-todo-edit-desktop.png` (Unicode pencil) vs `today-desktop.png` (SVG gear) |
| UPL-9 | Lift-on-hover | `today-desktop.png` (flat todo rows at rest) |
| UPL-10 | Breathing-glow | `reminders-desktop.png` (flat reminder rows) |
| UPL-11 | Pill indicator | `today-desktop.png`, `sprint-desktop.png` (current underline style) |
| UPL-12 | Progress fill | `sprint-desktop.png` (flat 53% bar) |
| UPL-13 | auto-animate | N/A (mutation-only) |
| UPL-14 | Empty-state illustrations | `gantt-desktop.png` (clearest example) |
| UPL-15 | LongTerm accent | `long-term-desktop.png` vs `today-desktop.png` (pixel-identical) |
| UPL-16 | Mobile header | `today-mobile.png`, `sprint-mobile.png` (clock dominance + tab clipping) |
| UPL-17 | Settings pane fade | `settings-general-desktop.png` vs `settings-appearance-desktop.png` |
| UPL-18 | cmdk palette | N/A (net-new) |
| UPL-19 | Keyboard help | N/A (net-new) |
| UPL-20 | react-hotkeys-hook | N/A (refactor only) |
| UPL-21 | Token-discipline | not visible in screenshots (manifests only in theme toggle) |
| UPL-22 | Reduced-motion sweep | N/A (CSS hygiene) |
| UPL-23 | Photos controls | not captured (Photos cache empty at smoke-test) |
| UPL-24 | datetime-local | `reminders-desktop.png` (native picker visible) |
| UPL-25 | sonner toast | N/A (net-new) |
| UPL-26 | Mesh bloom | not captured (motion-only on canvas) |

---

## 7. Honest limitations

- **Scout budget was 15 minutes each.** Some surfaces (especially Calendar, Photos, ClosedTodosView) were only briefly explored. Single-brief candidates (15 of 26) have a ±50% confidence ceiling.
- **Visual scout used a fallback tool** (`mcp__Claude_in_Chrome__*` was the planned path; Playwright headless was the actual fallback because `mcp__Claude_Preview__*` was unavailable in the dispatch session). Screenshots are valid but the DOM-level interaction surface that Claude Preview enables was not exercised — the visual scout could not, for example, drive the QuickPrompt input or test Gemini integration.
- **Bundle-size estimates are rough.** RICE Effort tiers (XS/S/M/L) are coarse by design at this stage. The Phase 4 mandate for UPL-1 (`vite build --report` before AND after) is the genuine measurement gate.
- **The challenger evaluated against current constraints** (React 18, ≤200 KB initial chunk, strict-TS, prefers-reduced-motion). If proclivity later upgrades React 18 → 19 or relaxes the chunk budget, the MAJORs on UPL-7 / UPL-18 / UPL-26 may flip to MINOR/NONE.
- **Photos slot was empty during the visual-scout run** (no cached photos in dev environment), so UPL-23 (manual controls) wasn't observed in its lived state.
- **Cross-codebase content drift was minimal** in the discover briefs (no LaTeXML / arxiv / Pulumi leakage — confirms the May 2026 conversion's drift-fix held).

---

## 8. Cross-reference index

| UPL-id | Visual | Library | Inspiration | Current-state | Screenshots |
|---|---|---|---|---|---|
| UPL-1 | H-1, H-2, M-4 | §A1 | Pattern 6 | H1 sketch | — |
| UPL-2 | H-1 | — | Pattern 2 | H1 | today/sprint/long-term-desktop |
| UPL-3 | H-2 | §A2 | Pattern 3 | H3 | today/sprint/long-term-desktop |
| UPL-4 | M-4 | — | Pattern 7 | M1 | modal-todo-edit-desktop |
| UPL-5 | (implicit) | (implicit) | (implicit) | H2 | today-desktop |
| UPL-6 | — | — | Pattern 11 | — | (all desktop) |
| UPL-7 | — | — | — | H4 | today-desktop, today-mobile |
| UPL-8 | L-2 | §E1 | — | M4 | modal-todo-edit-desktop |
| UPL-9 | — | — | Pattern 5 | — | today-desktop |
| UPL-10 | H-3 | — | Pattern 9 | — | reminders-desktop |
| UPL-11 | — | — | Pattern 4 | — | today/sprint-desktop |
| UPL-12 | M-1 | — | — | — | sprint-desktop |
| UPL-13 | — | §A2 | — | — | — |
| UPL-14 | H-4 | — | Pattern 10 | M5 | gantt-desktop |
| UPL-15 | M-5 | — | — | — | long-term-desktop |
| UPL-16 | M-2 | — | — | — | today/sprint-mobile |
| UPL-17 | M-3 | — | — | — | settings-general/appearance-desktop |
| UPL-18 | — | §C2 | (implicit Raycast/Linear) | — | — |
| UPL-19 | — | — | Pattern 8 | — | — |
| UPL-20 | — | §C4 | — | — | — |
| UPL-21 | — | — | — | §6 (L2, M3, L3) | — |
| UPL-22 | — | — | — | M2, L4, L5, L6 | — |
| UPL-23 | — | — | — | M6 | (Photos empty at capture) |
| UPL-24 | M-6 | — | — | — | reminders-desktop |
| UPL-25 | — | §C3 | — | — | — |
| UPL-26 | — | §F1, §F2 | — | — | — |

---

## Handoff offers

The catalog has 26 candidates total, 14 candidates above RICE 2.0, and 7 candidates above RICE 6.0 — clearing both single-candidate and multi-candidate handoff thresholds.

### Multi-candidate program handoff (recommended)

Convert this report into a sequenced roadmap with milestones via:

```bash
/roadmap frontend-uplift-2026q2 --brief "$(head -300 .claude/notes/frontend-uplifts/2026q2-visual-refresh/artifacts/final-report.md)"
```

The `/roadmap` pipeline will refine → decompose → sequence → materialize from this report. Section 5 of this report (Recommended next steps) directly maps to the roadmap epics:
- **5a Three-milestone foundation sprint** = the Now-lane (`frontend-uplift-warm-palette`, `frontend-uplift-motion-foundation`, `frontend-uplift-icon-system`)
- **5b Two milestone-ready candidates** = the next Now-lane after the foundation
- **5c Tier 2** = the Next-lane
- **5d Parking lot** = explicit "Won't (this cycle)" or Later-lane

### Single-candidate handoff (alternative)

To ship the top foundational candidate directly via the milestone pipeline:

```bash
/milestone-pipeline frontend-uplift-warm-palette --brief "Land UPL-6 (warm-gray token shift) per .claude/notes/frontend-uplifts/2026q2-visual-refresh/artifacts/final-report.md §4 rank-1 entry. Touches src/styles/theme.css only. ~5-8 line CSS change. No bundle delta, no library, no a11y risk."
```

Or:

```bash
/milestone-pipeline frontend-uplift-motion-foundation --brief "Land UPL-1 (adopt motion library, lazy-loaded) per .claude/notes/frontend-uplifts/2026q2-visual-refresh/artifacts/final-report.md §4 rank-2 entry. Add motion to package.json, wrap App shell in <LazyMotion>. HARD GATE: vite build --report baseline before AND after; abort if initial chunk exceeds 200 KB."
```

**This skill never auto-invokes `/milestone-pipeline` or `/roadmap`.** You run the next command if you want to proceed.

---

*End of final report. State will advance to `complete` after this commits.*
