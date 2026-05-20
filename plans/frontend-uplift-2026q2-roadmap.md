# Frontend Uplift 2026Q2 — Roadmap

> **Slug:** `frontend-uplift-2026q2` · **Created:** 2026-05-20 · **Status:** scaffold (Phase 0)

<!-- ROADMAP:section:meta -->
## 0. Meta

- **Author:** chris.dare@nalej.com
- **Brief source:** --brief flag  *(one of: `--brief` arg | conversation summary | unspecified)*
- **Execution skill:** `/milestone-pipeline`
- **Issue tracker:** GitHub Issues — `chris-dare-dev/proclivity` *(populated only if `--gh-issues` was passed)*

<!-- ROADMAP:section:refine -->
## 1. Brief

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

## 2. How-Might-We

How might we **ship a prioritized sequence of 26 visual-modernization candidates** so that **Proclivity's solo developer** can **deliver a perceivably fresher, more polished newtab experience — matching 2026 calm-workspace SaaS standards — without violating the local-only MV3 constraints, the 200 KB initial-chunk ceiling, or the prefers-reduced-motion baseline**?

## 3. Sharpening answers

- **Who:** The solo developer (Chris Dare) who daily-drives Proclivity as a newtab Chrome extension and personally experiences the visual staleness gap vs Linear / Cron / Notion Calendar. Secondary beneficiary: any user who opens Proclivity on a new tab and perceives whether it feels polished or dated. No external users yet (unpublished extension — CLAUDE.md §What agents must not do).

- **Success looks like:** After the three-milestone foundation sprint (UPL-6 warm-palette + UPL-1 motion library + UPL-8 icon system) ships, the newtab has a visually warmer palette, consistent SVG icons in place of Unicode characters, and a motion library seated — with 10 downstream candidates immediately unblocked and the initial chunk still under 200 KB per `vite build --report`.

- **Constraints:**
  - Chrome MV3 extension, local-only — no server-side components, no hosted endpoints (CLAUDE.md §What agents must not do)
  - Initial newtab chunk ≤ 500 KB (hard ceiling; 400 KB soft warn) (CLAUDE.md §Build and verification)
  - TypeScript strict flags: `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess` (CLAUDE.md §Build and verification)
  - React 18 — NOT React 19 (final report §5d: UPL-26 deferred because it needs React 19)
  - `prefers-reduced-motion` baseline must be preserved at every motion site (final report §4, UPL-22; CLAUDE.md §Stack reminder via service worker reference)
  - `chrome.storage.local` cap ~10 MB (CLAUDE.md §Stack reminder) — not directly at risk from visual changes, but relevant if any new library persists state
  - `motion` library bundle math: ~4.6 KB initial + ~15 KB deferred — the delta is affordable but requires a `vite build --report` gate before AND after UPL-1 (final report §3, UPL-1 dependency note)
  - 15 of 26 candidates are single-source (±50% confidence ceiling) — re-scrutinize at milestone-decomposition time (final report §1)

- **Prior art:**
  - `plans/sprint-backlog-redesign-roadmap.md` — prior UI-facing roadmap (slug `sprint-backlog-redesign`); touches Sprint and LongTerm sections but not visual tokens or motion libraries
  - `.claude/notes/milestones/sprint-backlog-redesign-m1` through `m3` — prior milestone artifacts on the same UI surface; no motion or theme work
  - No prior `theme.css` token roadmap found in `plans/`
  - No prior `motion` library or `lucide-react` adoption in `plans/` or milestones

- **Why now:** The `/frontend-uplift 2026q2-visual-refresh` research run just completed (2026-05-20) with a ranked 26-candidate synthesis and adversarial challenge pass. The challenger surfaced 0 BLOCKERs, meaning no candidate is a hard stop. Three foundational candidates (UPL-6, UPL-1, UPL-8) have no inter-dependencies and can ship in parallel — the sequencing is unambiguous. Delaying further means downstream candidates (8 motion candidates depend on UPL-1) cannot start.

## 4. Assumptions

- `[MUST]` The `motion` library (UPL-1) adds no more than ~4.6 KB to the initial newtab chunk, keeping it under 200 KB when combined with current bundle weight — *spike: run `vite build --report` baseline before UPL-1 lands; abort and remove dependency if initial chunk exceeds 200 KB*

- `[MUST]` The `lucide-react` icon tree-shakes correctly under Vite for the ~12 icons used, landing at ≤6 KB gz total — *spike: verify in the UPL-8 milestone with `vite build --report`; if tree-shaking is broken (e.g. default import used instead of named), switch to hand-rolled SVG components*

- `[SHOULD]` UPL-2 section-fade Path a (CSS-only `[data-leaving]` state machine) is implementable without touching the `hidden=` attribute on tabpanels, preserving keyboard focus containment — *fallback: if the `[data-leaving]` approach causes visible flash-of-content or breaks ARIA panel semantics, defer UPL-2 v0 and ship UPL-3 stagger-reveal instead as the next post-foundation milestone*

- `[SHOULD]` UPL-6 warm-gray token values (`oklch(0.10 0.006 237)` for `--bg`, chroma-halve + hue-warm-shift for `--panel`/`--panel-2`/`--border`/`--text-dim`) read as perceptibly warmer than the current cool-blue at full opacity on the actual Proclivity screenshot palette — *fallback: if contrast ratios fall below WCAG AA for any text-on-background pairing after the shift, restore chroma on the affected token only and adjust hue toward neutral*

- `[SHOULD]` `sonner` (UPL-25) respects `prefers-reduced-motion` via its built-in `useReducedMotion()` path when explicitly wired — *fallback: if the library's motion guard is undocumented or broken in the installed version, replace animated toasts with a static `position: fixed` banner component*

- `[MIGHT]` The 15 single-source candidates (±50% confidence) will re-rank after milestone-decomposition re-scrutiny, potentially demoting 2–4 items from "Solid" to "Marginal" tier — *defer: re-score at decomposition time; does not affect the foundation sprint*

- `[MIGHT]` Inter variable font (UPL-7, RICE 0.75) will become viable after the UPL-1 chunk-budget measurement reveals sufficient headroom — *defer to post-foundation; parking lot per final report §5d*

- `[MIGHT]` The `cmdk` command palette (UPL-18) actual gz footprint is 15–20 KB (challenger's higher estimate), consuming meaningful chunk budget even behind `React.lazy()` — *defer: verify at UPL-20 milestone time when hotkeys layer is seated*

## 5. Objective and Key Results

**Objective:** By 2026-06-20, the Proclivity newtab presents a visually modern foundation — warmer palette, consistent SVG icons, a seated motion library — with the initial chunk confirmed under 200 KB and 10 downstream visual candidates unblocked for the next sprint.

**Key Results:**
1. `npm run build` passes clean with the initial newtab chunk ≤ 500 KB (hard ceiling; 400 KB soft warn) after UPL-1 (motion library) lands — confirmed by `vite build --report` before/after diff
2. Every Unicode icon in the current UI (`✎`, `✕`, `→`, `▾`, `▸` and ad-hoc inline SVGs) is replaced by a named `lucide-react` import, with zero regressions in the build's TypeScript strict pass
3. The warm-gray token shift (UPL-6) is applied and the current screenshot set shows visibly reduced chroma on dark neutral tokens — WCAG AA contrast preserved on all text-on-background pairings
4. At least 2 of the 5 post-foundation milestones (UPL-2 section-fade, UPL-3 stagger-reveal + UPL-16 mobile header, UPL-25 toast layer, UPL-20 + UPL-22 reduced-motion sweep) are shipped within 4 weeks of the foundation sprint completing

**Won't:**
- Publish to the Chrome Web Store — this roadmap is a local-only development sprint; no CWS submission workflow (CLAUDE.md §What agents must not do)
- Add server-side components, hosted endpoints, or cross-device sync — local-only MV3 constraint is absolute (CLAUDE.md §What agents must not do)
- Ship UPL-26 (MeshBackground bloom) or plan React 19 upgrade — UPL-26 has a confirmed MAJOR blocker on the current React version; React 19 migration is a separate roadmap decision
- Implement the Inter variable font (UPL-7) — RICE 0.75, MAJOR bundle concern; deferred to parking lot until post-UPL-1 chunk measurement proves headroom (final report §5d)
- Build a custom design-token system or Storybook / design-system scaffolding — the token changes in this roadmap are targeted CSS custom-property edits, not a design-system buildout

<!-- ROADMAP:section:decompose -->
## 6. Epics

### 6.1 Decomposition technique

Vertical slicing + enabler stories (Holub / Patton default). Each epic cuts through the CSS token layer, component layer, and optional library-installation layer in a single pass, delivering a shippable state after each epic completes. The catalog's natural cluster shape (foundation → transitions → polish → interaction) maps cleanly onto this technique with no need for User Story Mapping or Event Storming.

### 6.2 Dependency graph

| Epic | Depends on |
|---|---|
| `frontend-uplift-2026q2-e1` | — |
| `frontend-uplift-2026q2-e2` | e1 |
| `frontend-uplift-2026q2-e3` | e1 |
| `frontend-uplift-2026q2-e4` | e1 |

### 6.3 Epics

#### `frontend-uplift-2026q2-e1` — Visual Foundation `[ENABLER]`

**Goal:** Install the three foundational candidates (UPL-6 warm-gray palette, UPL-1 motion library, UPL-8 Lucide icon system) plus cross-cutting hygiene sweeps (UPL-21 token discipline, UPL-22 reduced-motion guards), leaving the newtab visibly warmer, icon-consistent, motion-ready, and with the initial chunk confirmed under 200 KB.

**Candidates:** UPL-6, UPL-1, UPL-8, UPL-21 (partial — icon-path overlap with UPL-8), UPL-22

**Slice:** `theme.css` token edit (UPL-6) → `package.json` + `App.tsx` LazyMotion wrapper (UPL-1) → named `lucide-react` imports replacing Unicode chars and inline SVGs across all sections (UPL-8) → hex-to-token substitutions in touched files (UPL-21 partial) → `@media prefers-reduced-motion` guards at ~5 unguarded motion sites (UPL-22). No service-worker changes required.

**INVEST:** 6/6. Independent (no upstream epics). Negotiable (UPL-21 scope can trim to only icon-touched files). Valuable (observable: warmer palette, SVG icons, motion-ready shell — all visible on first load). Estimable (three XS + two S candidates, well-characterized). Small (≤3 weeks combined for a solo engineer). Testable (vite build --report delta, TypeScript strict pass, WCAG AA contrast check on affected token pairs).

**Specialist hints:**
- Bundle-budget reviewer: run `vite build --report` baseline before UPL-1 lands and again after; abort if the initial newtab chunk exceeds 200 KB. The ~4.6 KB initial (LazyMotion + `m` minimal) is the expected delta — verify it empirically.
- Manifest-permissions reviewer: `motion` library adds a new npm dependency; confirm ISC/MIT license compatibility and that no new `manifest.config.ts` permissions are required. `lucide-react` is ISC-licensed and tree-shakes per named import — verify named-import pattern (`import { Pencil } from 'lucide-react'`) is used throughout, not the default barrel.

**T-shirt:** M (≤3 weeks)

**Predecessors:** —

**Acceptance signals:**
- `npm run build` passes clean; `vite build --report` shows the initial newtab chunk ≤ 500 KB (hard ceiling; 400 KB soft warn) after UPL-1 lands
- Every Unicode icon (`✎`, `✕`, `→`, `▾`, `▸`) and ad-hoc inline SVG replaced with a named `lucide-react` import; zero TypeScript strict-mode errors
- Warm-gray token shift applied (`--bg`, `--panel`, `--panel-2`, `--border`, `--text-dim`); WCAG AA contrast preserved on all text-on-background pairings; all ~5 previously unguarded motion sites carry `@media (prefers-reduced-motion: reduce)` guards

---

#### `frontend-uplift-2026q2-e2` — Section Transitions `[VALUE]`

**Goal:** Deliver the two highest-visibility motion improvements (UPL-2 section-fade cross-dissolve on tab switches, UPL-3 stagger-reveal on todo list cold loads) and the mobile layout fix (UPL-16), making every tab navigation and list load feel alive and fixing the clock-overflow / tab-clip at narrow viewports.

**Candidates:** UPL-2, UPL-3, UPL-16

**Slice:** React tabpanel state machine + CSS `[data-leaving]` animation (UPL-2 Path a, CSS-only v0, `hidden=` retained) → CSS `@keyframes` stagger on `<li>` elements with a 50–60 ms inter-item delay capped at 10 items (UPL-3 Path a) → `clamp(28px, 6vw, 56px)` on `.clock` and `overflow-x: auto` on `.tabs` (UPL-16). No new libraries required for v0; all changes are CSS + minimal React state.

**INVEST:** 6/6. Independent of e3 and e4 (parallel to them post-e1). Negotiable (UPL-2 can drop to CSS-only Path a if `[data-leaving]` causes flash-of-content; UPL-3 Path b with Motion can be deferred to v1). Valuable (tab navigation is the most-frequent daily interaction; stagger-reveal is the most-cited "feels alive" pattern). Estimable (UPL-2 is S/M per challenger revised estimate; UPL-3 + UPL-16 are both XS/S). Small (all three candidates are CSS-dominant, ≤2 weeks). Testable (visual regression on all 8 tab transitions; stagger fires once per activation; mobile viewport at 390 px shows no clock overflow or tab clip).

**Specialist hints:**
- A11y reviewer: UPL-2's `[data-leaving]` approach must keep `hidden=` on inactive tabpanels so keyboard-focusable descendants are not Tab-reachable while off-screen. Verify with axe-core or equivalent after implementation. If the CSS animation causes a flash-of-content or ARIA panel semantics break, fall back to the pure-CSS Path a with no state machine (retain `hidden=` fully, add a `transition: opacity` on reveal only).
- Bundle-budget reviewer: UPL-2 and UPL-3 Path a are zero-bundle-cost (pure CSS). If upgrading to Motion-based Path b in a future v1, re-run `vite build --report` to confirm deferred chunk budget holds.

**T-shirt:** M (≤2 weeks)

**Predecessors:** `frontend-uplift-2026q2-e1`

**Acceptance signals:**
- All 8 section tab transitions show a 150–220 ms opacity cross-fade under `@media (prefers-reduced-motion: no-preference)`; instant hard-cut under `prefers-reduced-motion: reduce`
- Today/Sprint/LongTerm list items stagger-fade-up on tab activation (50–60 ms delay, capped at 10 items); animation fires once per activation, not per re-render
- At 390 px viewport: clock scales via `clamp`, tab row scrolls horizontally without clipping; no TypeScript strict errors introduced

---

#### `frontend-uplift-2026q2-e3` — UX Polish `[VALUE]`

**Goal:** Layer in the post-foundation UX polish candidates — modal scale-in exit animations (UPL-4), lift-on-hover microinteraction on todo rows (UPL-9), `sonner` in-page toast feedback (UPL-25), `@formkit/auto-animate` for list mutations (UPL-13), and empty-state illustrations with CTA (UPL-14) — making Proclivity feel intentionally crafted at every interaction point.

**Candidates:** UPL-4, UPL-9, UPL-25, UPL-13, UPL-14

**Slice:** `motion` `<AnimatePresence>` scale-in/out on modal open/close (UPL-4, depends on UPL-1 seated from e1) → CSS `transform: translateY(-2px) / box-shadow` on `.todo-row:hover` (UPL-9) → `sonner` (`~9 KB gz`) mounted once in `App.tsx`, wired to action callbacks with `useReducedMotion()` guard (UPL-25) → `@formkit/auto-animate` (`~3 KB gz`) applied to todo list containers for add/remove transitions (UPL-13) → illustrated empty-state components with CTA in Gantt and LongTerm sections (UPL-14, SVG or inline illustration, no new dependency).

**INVEST:** 6/6. Independent of e2 and e4 (all three run in parallel post-e1). Negotiable (UPL-14 illustrations can be scoped to Gantt-only for v0; UPL-13 can be deferred if bundle pressure arises). Valuable (each candidate delivers a directly observable UI improvement). Estimable (3× XS + 2× S candidates; all well-characterized by final-report). Small (≤3 weeks for all five). Testable (sonner shows toast on reminder-created/settings-saved; hover transition measurable at 60 fps; empty-state renders in Gantt with no tasks).

**Specialist hints:**
- A11y reviewer: UPL-25 (sonner) must verify `useReducedMotion()` is explicitly wired and `position="bottom-right"` is set to prevent layout shifts. UPL-9 hover transition must degrade gracefully on touch (no hover state on mobile).
- Bundle-budget reviewer: `sonner` (~9 KB gz) and `@formkit/auto-animate` (~3 KB gz) both add to the deferred chunk. Verify total deferred bundle stays under a reasonable ceiling after e1's `vite build --report` baseline. `cmdk` from e4 is the heavier peer — e3 should land before e4 to isolate each bundle delta.

**T-shirt:** M (≤3 weeks)

**Predecessors:** `frontend-uplift-2026q2-e1`

**Acceptance signals:**
- Modals (todo-edit, settings) animate scale-in on open and scale-out on close via `<AnimatePresence>`; no animation under `prefers-reduced-motion: reduce`
- Todo rows on Today/Sprint/LongTerm lift 2 px with box-shadow on hover; transition is CSS-only and absent on touch devices
- `toast.success(...)` fires on reminder-created and settings-saved; toast is position bottom-right, respects reduced-motion, does not cause layout shift; `npm run build` passes with `sonner` and `@formkit/auto-animate` added; initial chunk still ≤ 500 KB (hard ceiling; 400 KB soft warn) per `vite build --report`

---

#### `frontend-uplift-2026q2-e4` — Interaction Shell `[VALUE]`

**Goal:** Install the keyboard-first interaction layer — `react-hotkeys-hook` as the declarative shortcut foundation (UPL-20), a Cmd+/ keyboard help overlay (UPL-19), and a `cmdk` Cmd+K command palette lazy-loaded behind a `React.lazy()` boundary (UPL-18) — aligning Proclivity's keyboard ergonomics with Raycast / Linear.

**Candidates:** UPL-20, UPL-19, UPL-18

**Slice:** `react-hotkeys-hook` (`~3 KB gz`, zero deps) replacing ad-hoc `document.addEventListener('keydown')` calls (UPL-20) → `useHotkeys('?', ...)` driving a keyboard help overlay component (UPL-19) → `cmdk` command palette (`~15–20 KB gz` per challenger revised estimate) lazy-loaded via `React.lazy()` + `Suspense`, triggered by `useHotkeys('meta+k', ...)`, v0 constrained to 4–6 commands (UPL-18). No service-worker changes; all keyboard handling is newtab-page scope only.

**INVEST:** 5/6 — N (Negotiable) is partially constrained because UPL-18 hard-depends on UPL-20 (Cmd+K trigger); however, UPL-20 and UPL-19 can ship before UPL-18 is complete, so the epic is split-safe via SPIDR if needed. All other letters pass cleanly.

**Specialist hints:**
- Bundle-budget reviewer: `cmdk` pulls in 4 Radix peer-deps and the challenger's revised estimate is 15–20 KB gz (not the synthesis's 12–14 KB). The `React.lazy()` boundary is mandatory — verify the command palette never appears in the initial chunk. Run `vite build --report` after e4 lands; if the deferred chunk exceeds a comfortable ceiling, scope-cut UPL-18 v0 to 4 commands and defer the full action registry.
- A11y reviewer: `cmdk` uses `@radix-ui/react-dialog` for the overlay — verify focus trap is active when the palette is open and that `Escape` dismisses it and returns focus to the previously focused element. UPL-19 help overlay must also trap focus and dismiss cleanly.

**T-shirt:** M (≤3 weeks)

**Predecessors:** `frontend-uplift-2026q2-e1`

**Acceptance signals:**
- `react-hotkeys-hook` replaces all ad-hoc `document.addEventListener('keydown')` calls; TypeScript strict pass clean; `npm run build` passes
- Cmd+/ opens a keyboard help overlay listing available shortcuts; Escape dismisses; focus returns to prior element; overlay absent under `prefers-reduced-motion: reduce` animation
- Cmd+K opens the command palette lazy-loaded (not in initial chunk per `vite build --report`); v0 surfaces at minimum: open settings, switch section, create todo, open help; `@radix-ui/react-dialog` focus trap active; Escape dismisses

<!-- ROADMAP:section:sequence -->
## 7. Prioritization

### 7.1 MoSCoW

| Epic | Tag | Rationale |
|---|---|---|
| `frontend-uplift-2026q2-e1` | Must | Foundational enabler — e2, e3, e4 all depend on it; without it, no downstream epic can start and the OKR is not met. |
| `frontend-uplift-2026q2-e2` | Should | Highest post-foundation value (section-fade + stagger + mobile fix); fallback is shipping e1 alone and batching e2 into the next cycle. |
| `frontend-uplift-2026q2-e3` | Could | UX polish layer; genuinely valuable but each candidate (UPL-4, UPL-9, UPL-25, UPL-13, UPL-14) can slip independently without breaking the OKR. |
| `frontend-uplift-2026q2-e4` | Could | Interaction-shell layer; keyboard ergonomics improve Proclivity but are not load-bearing for the 2026Q2 visual-modernization objective. |

**Must cap:** 1/4 = 25.0% (cap: 60%) — *script-validated (exit 0)*

### 7.2 RICE rank (Musts only)

| Rank | Epic | R | I | C | E | RICE |
|---|---|---|---|---|---|---|
| 1 | `frontend-uplift-2026q2-e1` | 10 | 3 | 50%* | 3.0 | **5.0** |

*`*` = Confidence=50% default applied (no direct per-epic measurement; the 26-candidate pipeline provides candidate-level evidence but the epic-level rollup remains an estimate). 1 Must has Confidence=50% default: e1.*

<!-- ROADMAP:section:lanes -->
## 8. Now / Next / Later

### Now (fully spec'd)

#### `frontend-uplift-2026q2-e1` — Visual Foundation `[ENABLER]`

**Goal:** Install the three foundational candidates (UPL-6 warm-gray palette, UPL-1 motion library, UPL-8 Lucide icon system) plus cross-cutting hygiene (UPL-21 partial, UPL-22 reduced-motion guards), leaving the newtab visibly warmer, icon-consistent, motion-ready, and with the initial chunk confirmed under 200 KB.

**Decomposes into three milestones:**

---

### `frontend-uplift-2026q2-m1` — Warm-palette token shift (UPL-6)

**Stories:**

**`frontend-uplift-2026q2-e1-s1` — Apply warm-gray token values to neutral CSS custom properties** (S)

Given `src/styles/theme.css` contains `--bg: oklch(0.10 0.012 252)` and matching cool-blue values for `--panel`, `--panel-2`, `--border`, `--text-dim`
When the developer edits those 5 token declarations to reduce chroma and shift hue warm (`--bg: oklch(0.10 0.006 237)`, chroma-halved + hue-shifted for the remaining four)
Then the newtab dark theme renders with visibly reduced blue tension on all neutral surfaces; `--accent` is untouched; `npm run build` passes with zero TypeScript strict errors

Specialist: Bundle-budget reviewer — confirm zero bundle-size delta (`vite build --report` before/after; this change is CSS-only so the delta must be 0 bytes)

**`frontend-uplift-2026q2-e1-s2` — Verify WCAG AA contrast on all text-on-background token pairs after the shift** (XS)

Given the warm-gray token values are applied in `theme.css`
When the developer runs a contrast-ratio check (browser DevTools / axe-core) on every text-on-background pair: `--text` on `--bg`, `--text` on `--panel`, `--text-dim` on `--panel`, `--text-dim` on `--panel-2`
Then all pairs meet WCAG AA (≥4.5:1 for normal text, ≥3:1 for large text); any pair that fails has its chroma restored to the pre-shift value and the story is re-opened

Specialist: A11y reviewer — run axe-core or equivalent on the rendered newtab after token application; document each pair's contrast ratio in the milestone rectify summary

---

### `frontend-uplift-2026q2-m2` — Motion-library foundation (UPL-1)

**Stories:**

**`frontend-uplift-2026q2-e1-s3` — Record `vite build --report` baseline BEFORE adding `motion` dependency** (XS)

Given the current `package.json` does not contain `motion` and the build is clean
When the developer runs `npm run build` and captures the Rollup bundle report (initial newtab chunk size in KB)
Then the baseline chunk size is recorded in the milestone's research notes; the developer does NOT proceed to s4 until this measurement exists

Specialist: Bundle-budget reviewer — this is the mandatory gate; the pre-UPL-1 baseline is the denominator for the 200 KB ceiling check

**`frontend-uplift-2026q2-e1-s4` — Add `motion` package and wrap App shell in `<LazyMotion>`** (S)

Given the baseline chunk measurement from s3 exists and `motion` is not yet in `package.json`
When the developer runs `npm install motion`, imports `{ LazyMotion, m }` from `motion/react` in `App.tsx`, wraps the top-level JSX in `<LazyMotion features={() => import('motion/react').then(r => r.domAnimation)} strict>`, and replaces any existing `motion.*` usage stubs with `m.*`
Then `npm run build` passes with zero TypeScript strict errors; the App shell compiles without type errors on `LazyMotion` props; no `motion` symbols appear in the newtab's synchronous chunk

Specialist: Manifest-permissions reviewer — confirm `motion` is ISC/MIT licensed and introduces no new Chrome extension `manifest.config.ts` permission requirements

**`frontend-uplift-2026q2-e1-s5` — Verify initial chunk stays under 200 KB AFTER `motion` lands** (XS)

Given `motion` is installed and the `<LazyMotion>` wrapper is in place
When the developer runs `npm run build` and inspects the Rollup report for the initial newtab chunk
Then the initial chunk delta against the s3 baseline is ≤ 30 KB AND the absolute total does not exceed the CLAUDE.md hard ceiling of 500 KB (soft warn at 400 KB; raised from 200/220 in commit 55d81ac on 2026-05-20); if the hard ceiling is breached the `motion` dependency is removed, the epic is re-tiered to Next, and a spike is filed to diagnose the overrun before reattempting

Specialist: Bundle-budget reviewer — compare post-UPL-1 initial chunk against the s3 baseline; the expected delta is ~4.6 KB; flag any delta >10 KB as anomalous

---

### `frontend-uplift-2026q2-m3` — Icon-system adoption (UPL-8 + UPL-21 partial + UPL-22)

**Stories:**

**`frontend-uplift-2026q2-e1-s6` — Install `lucide-react` and replace all Unicode icon characters with named Lucide imports** (M)

Given `lucide-react` is not yet in `package.json` and the codebase contains Unicode icons (`✎`, `✕`, `→`, `▾`, `▸`) and ad-hoc inline SVGs across section components
When the developer runs `npm install lucide-react`, searches for all Unicode icon usages and inline SVG elements, and replaces each with the corresponding named import (e.g. `import { Pencil, X, ArrowRight, ChevronDown, ChevronRight } from 'lucide-react'`)
Then every Unicode character and ad-hoc inline SVG in the newtab UI is replaced by a named Lucide component; `npm run build` passes with zero TypeScript strict errors; named-import pattern is used throughout (no default barrel import)

Specialist: Bundle-budget reviewer — verify tree-shaking produces ≤6 KB gz total for all ~12 icons via `vite build --report`; if a barrel import accidentally inflates the chunk, switch each usage to the explicit named path

**`frontend-uplift-2026q2-e1-s7` — Apply hex-to-token substitutions in icon-touched files (UPL-21 partial)** (S)

Given `lucide-react` icons are in place and the icon-replacement pass has touched specific component files
When the developer scans only the files modified in s6 for hardcoded hex values (`#0b0e14`, etc.) that should instead use `var(--bg)`, `var(--panel)`, `var(--text-dim)`, or other established tokens
Then all hardcoded hex values in those files are replaced with the matching CSS custom-property reference; no new hardcoded hex values are introduced; `npm run build` passes clean

Specialist: Bundle-budget reviewer — this is a CSS-token substitution only; bundle delta must be zero

**`frontend-uplift-2026q2-e1-s8` — Add `@media (prefers-reduced-motion: reduce)` guards at all unguarded motion sites (UPL-22)** (S)

Given approximately 5 motion sites lack the canonical dual-guard convention: sprint progress fill, QuickPrompt banner, MeshBackground fade-in, settings-badge-pulse, and any others identified during the search
When the developer searches for CSS `animation` and `transition` declarations in `src/styles/` and component files, identifies those missing either `@media (prefers-reduced-motion: reduce) { ... }` or `[data-reduced-motion="true"] { ... }`, and adds the missing guard to each site
Then every motion declaration in the codebase carries both a `prefers-reduced-motion` media query guard and a `[data-reduced-motion]` attribute guard; `npm run build` passes with zero TypeScript strict errors; no animation fires in a test with `prefers-reduced-motion: reduce` forced via DevTools

Specialist: A11y reviewer — verify with axe-core and DevTools forced reduced-motion mode that no animation or transition fires under `prefers-reduced-motion: reduce`; the dual-guard pattern (media query + data attribute) must be present at every site, not just the media query alone

---

### `frontend-uplift-2026q2-m5` — UPL-3 stagger-reveal + UPL-16 mobile header fix

Promoted from Next lane on 2026-05-20 after e1 (m1+m2+m3) shipped. Both candidates are pure CSS with zero bundle cost. Sequenced ahead of m4 because UPL-16 is the only outright bug-class item on the roadmap (clock overflows and tabs clip at 390 px viewport) and UPL-3 is the lowest-risk motion win — pure `@keyframes` + `animation-delay`, no React state machine, no `motion` library dependency.

**Stories:**

**`frontend-uplift-2026q2-e2-s9` — UPL-3 CSS stagger-reveal on todo list cold loads** (S)

Given Today/Sprint/LongTerm tab activations render `<ul>` rows instantly with no entry animation, and the section root component already controls when a tab becomes active
When the developer adds a `@keyframes stagger-fade-up` rule, applies `animation: stagger-fade-up 220ms cubic-bezier(0.2, 0, 0, 1) both` with `animation-delay: calc(var(--stagger-idx, 0) * 55ms)` to `<li>` elements under a `[data-staggered="true"]` parent (limit `--stagger-idx` to 9 via CSS or React `Math.min(idx, 9)` so the cap-at-10 invariant holds), and toggles `data-staggered="true"` on the section root on tab activation (clearing it ~250 ms later so subsequent re-renders don't replay)
Then activating Today/Sprint/LongTerm visibly stagger-fade-ups items with a 55 ms inter-item delay; the animation fires once per activation, not per re-render; tab activations under `prefers-reduced-motion: reduce` render items instantly (no animation); `npm run build` passes with zero TypeScript strict errors; the dual-guard convention (`[data-reduced-motion="true"]` + `@media (prefers-reduced-motion: reduce)`) is honored on every new animation declaration

Specialist: A11y reviewer — verify with DevTools forced reduced-motion that items render instantly; the dual-guard must be paired on every new `animation` declaration; the `data-staggered` toggle must clear after the animation completes so a re-mount of the same panel doesn't re-trigger mid-interaction

**`frontend-uplift-2026q2-e2-s10` — UPL-16 mobile header layout fix** (XS)

Given at 390 px viewport the `.clock` element dominates and the `.tabs` row clips horizontally (visual-scout captured this in `today-mobile.png`)
When the developer changes `.clock`'s `font-size` to `clamp(28px, 6vw, 56px)` so it scales fluidly, and adds `overflow-x: auto; scrollbar-width: thin;` to the `.tabs` container (and `flex-shrink: 0` on each tab button so horizontal scroll actually engages instead of squeezing buttons)
Then at 390 px viewport the clock scales without overflow, the tab row scrolls horizontally without clipping, and no layout regression appears at desktop widths (≥1024 px); `npm run build` passes with zero TypeScript strict errors; no new motion sites are introduced (this story is layout-only)

Specialist: Visual reviewer — confirm at 390 px, 768 px, and 1280 px the layout holds; the scrollbar in the tab row should be thin (`scrollbar-width: thin`) and not draw the eye away from active content

---

### Next (shaped)

#### `frontend-uplift-2026q2-e2` — Section Transitions `[VALUE]`

**Goal:** Deliver the two highest-visibility motion improvements (UPL-2 section-fade cross-dissolve on tab switches, UPL-3 stagger-reveal on todo list cold loads) and the mobile layout fix (UPL-16), making every tab navigation and list load feel alive and fixing the clock-overflow / tab-clip at narrow viewports.

**Candidates:** UPL-2 (CSS-only Path a, `hidden=` retained, `[data-leaving]` state machine), UPL-3 (CSS Path a stagger), UPL-16 (mobile clock `clamp` + tab overflow)

**INVEST check:** 6/6 — Independent of e3 and e4; Negotiable (UPL-2 can drop to reveal-only if `[data-leaving]` causes flash-of-content); Valuable (most-frequent daily interaction path); Estimable (UPL-2 is S/M per challenger; UPL-3 + UPL-16 are XS/S); Small (≤2 weeks); Testable (visual regression on all 8 tab transitions, stagger fires once per activation, 390 px mobile renders without overflow).

**Predecessors:** `frontend-uplift-2026q2-e1`

**Key constraint:** UPL-2 v0 MUST use CSS-only Path a (keep `hidden=` intact, animate with `[data-leaving="true"]`). Do NOT replace `hidden=` with `aria-hidden="true"` + opacity — that allows Tab key to reach inactive panel descendants (a11y regression per challenger Axis 3). The `[data-leaving]` state machine is a React useState toggle that fires on tab click and clears after the CSS animation duration (~220 ms).

**Milestones:**
- `frontend-uplift-2026q2-m4` — UPL-2 v0: CSS `[data-leaving]` section-fade state machine
- `frontend-uplift-2026q2-m5` — UPL-3 CSS stagger-reveal + UPL-16 mobile header fix

---

### Later (outcomes only)

- `frontend-uplift-2026q2-e3` — Layer in post-foundation UX polish (modal animations, hover microinteractions, sonner toast feedback, auto-animate list mutations, empty-state illustrations) to make every interaction point feel intentionally crafted.
- `frontend-uplift-2026q2-e4` — Install keyboard-first interaction shell (`react-hotkeys-hook` + Cmd+/ help overlay + `cmdk` Cmd+K palette) to align Proclivity's keyboard ergonomics with Raycast / Linear.

<!-- ROADMAP:section:spikes -->
## 9. Spike lane

- **Spike: `motion` bundle-size gate** (≤1 day) — validates `[MUST]` from §4: "The `motion` library (UPL-1) adds no more than ~4.6 KB to the initial newtab chunk, keeping it under 200 KB when combined with current bundle weight." Blocks: `frontend-uplift-2026q2-e1` (m2, s3–s5). Output: a written finding recording the pre- and post-install initial-chunk sizes from `vite build --report`; if the post-install chunk exceeds 200 KB the finding must include a diagnosis (is the chunk split missing? is LazyMotion not deferring domAnimation?) and a recommendation (adjust split point, or re-tier e1-m2 to Next). This spike is embedded in stories s3 and s5 of m2 — the sequential baseline→install→verify pattern IS the spike; it does not need to be a separate offline work item unless the s3 measurement is blocked by a broken build.

- **Spike: `lucide-react` Vite tree-shaking verification** (≤0.5 days) — validates `[MUST]` from §4: "The `lucide-react` icon tree-shakes correctly under Vite for the ~12 icons used, landing at ≤6 KB gz total." Blocks: `frontend-uplift-2026q2-e1` (m3, s6). Output: `vite build --report` output showing per-icon tree-shaking is active and total Lucide contribution is ≤6 KB gz; if tree-shaking fails (e.g. default barrel import detected in any file), the finding documents the offending import and the fix (switch to named import `import { Pencil } from 'lucide-react'`). This spike resolves during s6 execution — no offline work needed unless Vite plugin config is missing `optimizeDeps` entries.

- **Spike: CSS `[data-leaving]` section-fade — a11y and flash-of-content validation** (≤2 days) — validates `[SHOULD]` from §4: "UPL-2 section-fade Path a (CSS-only `[data-leaving]` state machine) is implementable without touching the `hidden=` attribute on tabpanels, preserving keyboard focus containment." Blocks: `frontend-uplift-2026q2-e2` (m4). Output: a prototype branch (not committed to main) with the `[data-leaving]` state machine wired to one tabpanel pair; the finding records (a) whether flash-of-content is visible during the 220 ms animation window, (b) whether Tab key reaches inactive panel descendants during the leaving state, and (c) whether axe-core reports any new violations. If the prototype surfaces a flash-of-content or keyboard-escape failure, the finding must prescribe the fallback (reveal-only CSS transition: opacity 0→1 on enter, no leaving animation, `hidden=` fully retained) and e2-m4 is re-scoped to the fallback. This spike should be conducted BEFORE beginning m4 story decomposition.

<!-- ROADMAP:section:tracking -->
## 10. Tracking

Not requested (run with --gh-issues to bundle epic + story bodies).

| Epic / Story | GH Issue | Status |
|---|---|---|

<!-- ROADMAP:section:handoff -->
## 11. Execution handoff

First Now-lane milestone: `frontend-uplift-2026q2-m1` (within epic `frontend-uplift-2026q2-e1`).

Invoke: `/milestone-pipeline frontend-uplift-2026q2-m1`

The milestone-pipeline reads:
- The epic body in §8 (Now lane)
- The story list with Given/When/Then AC
- The specialist hints
- Any spike findings under §9

It writes to `.claude/notes/milestones/frontend-uplift-2026q2-m1/state.json` and produces:
- research briefs under `.claude/notes/milestones/frontend-uplift-2026q2-m1/research/`
- Implementation commits on main
- critique and rectify artifacts

---

*This roadmap was produced by `/roadmap`. Update directly with edits; for major restructures, re-invoke `/roadmap frontend-uplift-2026q2` and the orchestrator will resume at the first unpopulated section.*
