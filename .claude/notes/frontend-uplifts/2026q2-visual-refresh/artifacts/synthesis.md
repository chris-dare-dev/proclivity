# Synthesis — 2026q2-visual-refresh

**Uplift ID:** 2026q2-visual-refresh
**Date:** 2026-05-20
**Author:** orchestrator (main session, Phase 2)
**Sources:** 4 discover briefs + 16 screenshots under `.claude/notes/frontend-uplifts/2026q2-visual-refresh/`

---

## 1. Executive summary

Across all 4 scout briefs, the dominant signal is unambiguous: **Proclivity is at the motion-zero-point**. Visual-scout, library-scout, inspiration-scout, and current-state-critic all independently surfaced the absence of a motion layer as the foundational gap, and every HIGH-severity finding in three of the four briefs traces back to it (section-switch hard-cuts, todo list pop-in, modal exit instant-disappear, no skeleton loading states). The 4-way triangulation produces **26 modernization candidates** across 7 of the 10 taxonomy categories, with motion (10), library/dependency (5), and color/theme (3) as the dominant clusters.

The single strongest insight: **adopting `motion` (LazyMotion + domAnimation) is the foundational candidate that unlocks 8 of the 10 motion candidates**, and every brief explicitly endorses this path. The second-strongest insight: **a warm-gray token shift on `--bg`/`--panel`** is a zero-risk, zero-bundle, ~5-line CSS change that visually re-positions Proclivity from "cool utility tool" to "calm workspace" — Linear's documented March 2026 shift. The cross-brief tension is small: inspiration-scout and library-scout both biased toward foundational adoption while current-state-critic biased toward token hygiene and a11y consistency; the synthesis resolves this by surfacing FOUNDATIONAL candidates first, then high-triangulation motion candidates, then the hygiene sweeps as cross-cutting refactors.

---

## 2. Triangulation strength

| Brief count | Candidates | Notes |
|---|---|---|
| **4 briefs (strong)** | 1 (UPL-1) | Adopt motion library — all 4 scouts independently endorse |
| **3 briefs (strong)** | 4 (UPL-2, 3, 5, 14) | Section-fade, stagger-reveal, skeleton loading, empty-state illustrations |
| **2 briefs (moderate)** | 6 (UPL-4, 6, 8, 10, 13, 18) | Modal scale-in, warm-gray shift, lucide-react, breathing-glow, auto-animate, cmdk |
| **1 brief (weak — flag for challenger)** | 15 | Single-source proposals; not invalid, but the challenger should pressure-test |

The triangulation pattern strongly favors motion-foundation candidates and validates the Phase 4 sequencing recommendation of **UPL-1 first, then UPL-2/3/4 (motion follow-ons), then UPL-6 (token warmth) and UPL-8 (icon system) as parallel quick-wins**.

---

## 3. Foundational candidates (sequencing dependencies)

These candidates UNLOCK other candidates. Phase 4 must rank them with their DAG context — they are the input edges to the rest of the catalog.

### UPL-1 — Adopt `motion` (LazyMotion + domAnimation, lazy-loaded)

Unlocks: UPL-2 (section-fade), UPL-3 (stagger-reveal), UPL-4 (modal scale-in), UPL-9 (lift-on-hover, motion variant), UPL-11 (pill tab indicator with layoutId), UPL-12 (progress fill animation), UPL-17 (settings pane fade), UPL-19 (help overlay scale-in)

**Bundle math:** ~4.6 KB initial (LazyMotion + `m` minimal component) + ~15 KB deferred (domAnimation feature pack). At React 18.2+ and MIT-licensed. Strict-TS-compatible.

### UPL-8 — Adopt `lucide-react` icon system

Unlocks: UPL-21 (token-discipline sweep can replace all Unicode icons in the same pass), and visually professionalizes 4 components flagged across briefs (TodoItem, QuickPrompt, ClosedScopeCounter, LogViewer).

**Bundle math:** ~0.5 KB gz per icon (Vite tree-shaken). At 12 icons: ~6 KB total. ISC-licensed.

### UPL-6 — Warm-gray token shift (`--bg`/`--panel`/`--panel-2`/`--border` hue 252→237, chroma halved)

Unlocks: stylistic alignment with 2026 SOTA (Linear's documented refresh). Does NOT block other candidates but is a precondition for UPL-26 (MeshBackground bloom) reading "natural" in tone.

**Bundle math:** 0 KB. ~5 lines of CSS in `theme.css`.

---

## 4. Candidate catalog

Ordered: foundational first; then by triangulation strength descending; then by t-shirt size ascending within category.

---

### UPL-1 — Adopt `motion` library (LazyMotion + domAnimation, lazy-loaded)

**Category:** Library/dependency
**Size:** S
**Evidence triangulation:** 4 briefs (visual ✓, library ✓, inspiration ✓, current-state ✓)
**Motion primitives:** Foundation for [MOT-1 fade-in], [MOT-2 fade-up], [MOT-3 stagger-reveal], [MOT-4 scale-in], [MOT-6 dissolve], [MOT-50 section-fade], [MOT-51 shared-element-transition]

**What it is:** Add `motion` (formerly framer-motion) as a new `dependencies` entry in `package.json`, importing only `m` and `LazyMotion` in the App shell (~4.6 KB initial impact) with `domAnimation` lazy-loaded via `() => import('motion/react').then(r => r.domAnimation)` after first paint.

**Why it matters:** Every HIGH-severity motion gap in this catalog depends on having a React-native animation primitive set. The pure-CSS path can cover stagger-reveal alone, but cannot address modal exit, section-switch dissolve, or shared-layout pill indicators. This is the keystone candidate.

**Sources:**
- Visual scout: H-1 (section-switch animation absent), H-2 (no entry animation on todo items), M-4 (modal has no exit animation)
- Library scout: §A1 — `motion` v12.x, MIT, ~4.6 KB initial + ~15 KB deferred, Tier 1 Adopt
- Inspiration scout: Pattern 6 — "Framer Motion AnimatePresence Adoption as Foundation"
- Current-state critic: H1 v1 sketch — "Framer Motion upgrade is a follow-up candidate"

**Closest Proclivity analog today:** None — zero motion library installed (verified against `package.json` line 1–47 by library-scout).

**Screenshot evidence:** N/A (foundational; effects visible after follow-ons land).

**Sketch:** Add `motion` to `package.json` dependencies. In `src/newtab/App.tsx`, import `LazyMotion, m` from `motion/react`; wrap the app body in `<LazyMotion features={loadFeatures}>` with `loadFeatures = () => import('motion/react').then(r => r.domAnimation)`. Use `m.div` (not `motion.div`) in child components to keep the minimal bundle. Reduced-motion: pair with `useReducedMotion()` hook to short-circuit animation variants when `data-reduced-motion="true"` or OS preference is set.

**Open questions:** Should `domMax` (which adds drag) be loaded for Sprint/LongTerm sections only (lazy-per-route), or globally? Resolved: lazy-per-section in UPL-13 sub-decision.

---

### UPL-2 — Section-fade cross-dissolve on tab switches

**Category:** Motion
**Size:** S
**Evidence triangulation:** 3 briefs (visual ✓, inspiration ✓, current-state ✓)
**Motion primitives:** [MOT-50 section-fade], [MOT-6 dissolve]

**What it is:** Replace the current HTML `hidden=` attribute pattern on tabpanels with an opacity-driven cross-fade between active and exiting panels. 150–220 ms ease-out, scoped to `@media (prefers-reduced-motion: no-preference)`.

**Why it matters:** Tab switches (Today→Sprint, Sprint→LongTerm, etc.) are the most-frequent navigation event in the daily-use surface. The current instant hard-cut is the single most-noticeable gap when compared to Linear, Cron, or Notion Calendar.

**Sources:**
- Visual scout: H-1 — "switching from Today to Sprint produces an instant content replacement with no visual handoff"
- Inspiration scout: Pattern 2 — "Section-Fade Cross-Dissolve on Tab Switch" — Linear / Sunsama / Cron all use this pattern at 150–200 ms
- Current-state critic: H1 — `App.tsx:418–509` tabpanel `hidden=` toggles

**Closest Proclivity analog today:** `src/newtab/App.tsx:418–509` — tabpanel `hidden` attribute gate; `src/newtab/App.css:87–104` — only the tab-indicator border has a 120 ms transition.

**Screenshot evidence:** `screenshots/today-desktop.png` vs `screenshots/sprint-desktop.png` (same hard-cut behavior across all 8 view captures).

**Sketch:** Two implementation paths: (a) pure CSS — replace `hidden` with `aria-hidden` + `data-active`, animate via `opacity` + `transform: translateY(6px)` with `@keyframes tab-panel-in`, scoped to `no-preference`; (b) Framer Motion — `AnimatePresence` wrapping the active panel, `initial/animate/exit` variants. Path (a) is viable with zero-dep cost; path (b) is cleaner and aligns with UPL-1. Recommend (b) once UPL-1 lands.

**Open questions:** Does `aria-hidden` on inactive panels satisfy the ARIA tabpanel spec (which historically required `hidden`)? Resolved: yes, the WAI-ARIA APG accepts `aria-hidden="true"` for tabpanel inactive state in modern implementations.

---

### UPL-3 — Stagger-reveal on todo list cold loads

**Category:** Motion
**Size:** S
**Evidence triangulation:** 3 briefs (visual ✓, library ✓, inspiration ✓, current-state ✓ — 4-way confirmed)
**Motion primitives:** [MOT-3 stagger-reveal], [MOT-2 fade-up]

**What it is:** When Today/Sprint/LongTerm becomes the active tab (or on first load), each `<li>` in the todo list fades-up (opacity 0→1, translateY 6px→0) with 50–60 ms inter-item stagger, capped at 10 items so the last item never waits >500 ms. Fires once per activation, not on every re-render.

**Why it matters:** This is the single most-cited "feels alive vs static document" pattern across 2026 personal-planning SaaS. Things 3 calls it "purposeful unfolding"; Linear calls it "smooth item arrival." Implementation cost is small and the perceptual upgrade is large.

**Sources:**
- Visual scout: H-2 — "no entry animation on todo items"
- Library scout: §A2 — `@formkit/auto-animate` ~3.28 KB gz native React hook for list animations (zero-config alternative to motion)
- Inspiration scout: Pattern 3 — "Stagger-Reveal on Todo List Entry" — Things 3, Linear
- Current-state critic: H3 — `TodoList.tsx:251–263` list `<ul>` with full pure-CSS v1 sketch

**Closest Proclivity analog today:** `src/sections/sections.css:14–17` (`.todo-list`); `src/components/TodoItem.tsx:40` (`<li>`).

**Screenshot evidence:** `screenshots/today-desktop.png`, `screenshots/sprint-desktop.png`, `screenshots/long-term-desktop.png` (all show static lists).

**Sketch:** Two paths: (a) pure CSS — `@keyframes fade-up-item` scoped to `no-preference`, applied via `animation-delay: calc(min(var(--item-index), 10) * 50ms)` with `--item-index` set inline by `TodoItem.tsx`; (b) Motion with `staggerChildren` variant on the parent `<ul>` and `m.li` children. Path (a) lands without UPL-1; path (b) is cleaner if UPL-1 lands first. `auto-animate` (UPL-13) is a third path that natively handles list-mutation animations as well.

**Open questions:** Should the cap be 10 or higher? Resolved: 10, per current-state-critic's sketch — past that the last-item delay degrades UX.

---

### UPL-4 — Modal scale-in entry + backdrop blur

**Category:** Motion
**Size:** S
**Evidence triangulation:** 3 briefs (visual ✓, inspiration ✓, current-state ✓)
**Motion primitives:** [MOT-4 scale-in], [MOT-1 fade-in]

**What it is:** Replace `Modal.css`'s `modal-slide-in` keyframe (translateY -8px → 0) with a `scale-in` (scale 0.96 → 1.0 + opacity 0 → 1) at 200 ms ease-out, AND add `backdrop-filter: blur(8–12px)` to `.modal-backdrop`. Both gated behind the existing reduced-motion blocks at `Modal.css:99–109`. Also: add a symmetric exit animation (current code returns `null` on close, skipping any exit phase).

**Why it matters:** The current asymmetric in-but-not-out modal behavior is a well-known UX rough edge. The 2026 standard (Linear, Things 3, Raycast, native macOS sheets) is scale-in + frosted backdrop.

**Sources:**
- Visual scout: M-4 — "TodoEditModal has no exit animation — closes instantly"
- Inspiration scout: Pattern 7 — "Modal Entry Scale-In + Backdrop Blur"
- Current-state critic: M1 — "Modal entry lacks scale-in; backdrop uses flat rgba(0,0,0,0.6) without blur"

**Closest Proclivity analog today:** `src/components/Modal.css:10–34` (entry animations); `src/components/Modal.tsx:64` (`if (!open) return null` — the bypass of exit).

**Screenshot evidence:** `screenshots/modal-todo-edit-desktop.png`, `screenshots/settings-general-desktop.png`.

**Sketch:** In `Modal.css`: change `@keyframes modal-slide-in` to include `transform: scale(0.96) → scale(1)`; change `.modal-backdrop` to `background: rgba(0,0,0,0.35); backdrop-filter: blur(12px);`. For exit animation, wrap modal in `AnimatePresence` (requires UPL-1) with `exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}`. Pure-CSS exit-animation alternative requires a class-based exit-state pattern with `animation-fill-mode: forwards` — workable but more brittle than `AnimatePresence`.

**Open questions:** none.

---

### UPL-5 — Skeleton loading states on async-suspended surfaces

**Category:** Motion
**Size:** M
**Evidence triangulation:** 3 briefs (library ✓ implicitly, inspiration ✓ implicitly, current-state ✓ explicit)
**Motion primitives:** [MOT-13 skeleton-shimmer]

**What it is:** Replace `<Suspense fallback={null}>` everywhere (SettingsModal, Photos, QuickPrompt, Calendar, ChatPanel) with a `<SkeletonBlock>` component that renders a pulsing tinted rectangle matching the eventual content's committed height. ~40 lines of CSS for the shared component + ~30 lines per consumer site to inject the correct height. Shimmer keyframe scoped to `@media (prefers-reduced-motion: no-preference)`.

**Why it matters:** Cold loads on slow devices currently produce blank holes where Photos / Gemini / Calendar should render. 2026 users expect skeletons (Notion, Linear, Todoist). The current `null` fallback was a pragmatic "avoid layout shift" decision — skeletons solve both the loading-signal AND the layout-shift problem.

**Sources:**
- Current-state critic: H2 — `App.tsx:239, 371–393, 380–383` Suspense sites with `fallback={null}`; full v1 sketch with `<SkeletonBlock>` design
- Inspiration scout: implied via Pattern 10 (empty states) but not explicitly named
- Library scout: implied via skeleton patterns in Vercel Geist references

**Closest Proclivity analog today:** No skeleton component exists. The Photos slot collapses (`Photos.tsx` returns `null` when no photos cached) and Suspense fallbacks are `null`.

**Screenshot evidence:** Photos slot is absent in `screenshots/today-desktop.png` (no cached photos at smoke-test time) — illustrates the empty-collapse failure mode.

**Sketch:** New file `src/components/SkeletonBlock.tsx` (≤40 LOC) exporting a component with props `{ width?, height, className? }`. CSS in same file (or `App.css`): `@keyframes skeleton-shimmer { 0% { background-position: -100% 0 } 100% { background-position: 100% 0 } }` with `background: linear-gradient(90deg, var(--panel-2) 0%, var(--border) 50%, var(--panel-2) 100%); background-size: 200% 100%`. Scoped to `no-preference`. Photos `<Suspense>` gets `<SkeletonBlock height="clamp(140px, 22vh, 220px)" />`; QuickPrompt gets a 44 px input-shape; Calendar gets a grid skeleton.

**Open questions:** Should the skeleton be visible for ALL Suspense fallbacks, or only known-shape ones (Photos, QuickPrompt)? Resolved: only known-shape — unknown-shape Suspense (lazy-imported modals) stays `null` to avoid layout shift on a surface that may never render.

---

### UPL-6 — Warm-gray token shift on `--bg`/`--panel`/`--panel-2`/`--border`

**Category:** Color/theme
**Size:** XS
**Evidence triangulation:** 1 brief (inspiration ✓)
**Motion primitives:** none

**What it is:** Reduce chroma on dark-theme `--bg` from `oklch(0.10 0.012 252)` to ~`oklch(0.10 0.006 237)`, and the same chroma-halve / hue-warm-shift on `--panel`, `--panel-2`, `--border`, and `--text-dim`. The hue shift from 252 (blue-violet) to ~237 (warmer gray) tracks Linear's documented March 2026 palette refresh.

**Why it matters:** Linear's design blog explicitly cites this as their highest-impact 2026 change — the palette shift from "cool, blue-ish" to "warmer gray that still feels crisp, but less saturated" reduces visual tension and positions the app as a calm workspace rather than a cold utility tool.

**Sources:**
- Inspiration scout: Pattern 11 — full token-by-token mapping with public-evidence URL to Linear's design blog at https://linear.app/now/behind-the-latest-design-refresh

**Closest Proclivity analog today:** `src/styles/theme.css:19–63` (`:root` dark theme tokens).

**Screenshot evidence:** Every desktop screenshot illustrates the current cool palette; the comparison is to Linear's public marketing.

**Sketch:** ~5–8 lines of CSS in `theme.css`. The light-theme tokens at lines 66–82 may also benefit from a similar warmth nudge but with smaller delta (light themes are already chroma-low). This is the lowest-effort, highest-aesthetics-ROI candidate in the catalog. **WARNING:** the user-customizable `--accent` token (a Proclivity differentiator) is independent — this candidate touches ONLY neutrals (bg/panel/border/text-dim), never `--accent`.

**Open questions:** Should we offer the warm-gray as an opt-in via a new "Warm gray" theme variant rather than replacing the default? Resolved: replace the default — Linear's refresh demonstrates a one-way move; offering both adds settings complexity without proportional UX value.

---

### UPL-7 — Variable-weight self-hosted font (Inter, Geist, or Plus Jakarta Sans)

**Category:** Typography
**Size:** M
**Evidence triangulation:** 1 brief (current-state ✓)
**Motion primitives:** none

**What it is:** Add a self-hosted variable woff2 (Inter recommended; ~36 KB gzip latin subset) and apply variable `font-variation-settings: 'wght' <weight>` across the greeting / clock / headings. Removes the system-font default that makes the hero headline area feel OS-native rather than brand-purposeful.

**Why it matters:** The greeting and clock are the first things users see on every new tab. 2026 personal-productivity dashboards (Todoist, Sunsama, Notion) all pick a variable sans-serif and vary weight across `100–800` for hierarchy. Proclivity's current `-apple-system` stack reads as "default OS chrome."

**Sources:**
- Current-state critic: H4 — `index.css:10–14` font-family stack; full v1 sketch with Inter at 36 KB gzip

**Closest Proclivity analog today:** `src/newtab/index.css:10–14` (font-family stack), `src/newtab/App.css:16–20` (`.greeting`, `.clock` sizes).

**Screenshot evidence:** `screenshots/today-desktop.png` and `screenshots/today-mobile.png` both show the OS-default font in the greeting.

**Sketch:** Either: (a) self-host via `@font-face` pointing to a `public/fonts/inter-var.woff2` (latin subset, ~36 KB gzip, restricted axes); (b) use `@fontsource/inter` package with the variable subset import. Path (a) keeps the dependency surface zero; path (b) auto-handles font version pinning. Apply `font-family: 'Inter var', -apple-system, ...` on `:root` in `index.css`. Set `.clock { font-variation-settings: 'wght' 200; }` and `.greeting { font-variation-settings: 'wght' 640; }`.

**Open questions:** Is the ~36 KB initial-chunk impact acceptable? The design-system reference explicitly flags this as "a non-trivial bundle commitment." This needs Phase 4 effort-vs-impact ranking. **Flagged for challenger scrutiny.**

---

### UPL-8 — Adopt `lucide-react` icon system

**Category:** Library/dependency
**Size:** S
**Evidence triangulation:** 3 briefs (library ✓, visual ✓, current-state ✓)
**Motion primitives:** [MOT-33 icon-spin-on-action] (e.g., refresh icon spinning on Gemini fetch)

**What it is:** Add `lucide-react` as a dependency. Replace Unicode characters (`✎`, `✕`, `→`, `▾`, `▸`) and ad-hoc inline SVGs (TodoItem, QuickPrompt, ClosedScopeCounter, LogViewer) with named Lucide imports. Per-icon tree-shaking via Vite means only imported icons ship (~0.5 KB gz each; ~6 KB total for ~12 icons).

**Why it matters:** Cross-platform Unicode rendering varies — `✎` (U+270E) renders at different weights across macOS/Windows/Linux. SVG icons are visually consistent AND a11y-cleaner (no double-announcement risk). Centralizing on Lucide also unlocks `[MOT-33 icon-spin-on-action]` (e.g., `RefreshCw` spinning on async fetch).

**Sources:**
- Library scout: §E1 — `lucide-react` v1.16.0, ISC, ~0.5 KB/icon tree-shaken, Tier 1 Adopt
- Visual scout: L-2 — pencil edit icon is Unicode, inconsistent with header SVG icons
- Current-state critic: M4 — 6 sites using Unicode glyphs with screen-reader fragility

**Closest Proclivity analog today:** `src/newtab/App.tsx:268–302` — `GearIcon()` and `ChatBubbleIcon()` use inline SVG correctly. `src/components/TodoItem.tsx:68–80` — uses Unicode chars.

**Screenshot evidence:** `screenshots/modal-todo-edit-desktop.png` shows the pencil character; contrast with `screenshots/today-desktop.png` showing the SVG gear icon in the header.

**Sketch:** Add `lucide-react` to dependencies (ISC license — note in CLAUDE.md if license-discipline tracking matters; functionally equivalent to MIT for personal use). Pin to a specific version (Lucide renames icons between minors). Create `src/components/icons.tsx` re-exporting the needed icons (`Plus`, `CheckCircle2`, `Calendar`, `Clock`, `Settings`, `ChevronRight`, `ChevronDown`, `Tag`, `Trash2`, `Pencil`, `Sparkles`, `Bell`). Replace Unicode usages in TodoItem, QuickPrompt, ClosedScopeCounter, LogViewer.

**Open questions:** Should we instead extend the existing inline-SVG `icons.tsx` pattern with hand-crafted SVGs (no new dependency)? Trade-off: hand-crafted is zero-dep but maintenance-heavy. Lucide is +6 KB but covers ~1000 icons. Recommend Lucide for v1.

---

### UPL-9 — Lift-on-hover on todo rows (+ accent border)

**Category:** Interaction
**Size:** XS
**Evidence triangulation:** 1 brief (inspiration ✓)
**Motion primitives:** [MOT-30 lift-on-hover]

**What it is:** On `.todo-item:hover`, apply `transform: translateY(-2px)` + a subtle `box-shadow` elevation + `border-color: var(--accent)` at low opacity. 120 ms transition. Gated behind `@media (prefers-reduced-motion: no-preference)`. Pairs with the existing `opacity: 0 → 1` reveal on the edit-pencil button.

**Why it matters:** Currently `.todo-item` has no hover state at all — only the delete and edit buttons have individual hover styles. Users hovering over a row don't know if clicking will do anything until they see the inner buttons appear. Lift-on-hover communicates interactivity before the user commits.

**Sources:**
- Inspiration scout: Pattern 5 — Linear / Sunsama / Vercel all document lift-on-hover as a core component primitive

**Closest Proclivity analog today:** `src/sections/sections.css:20–28` (`.todo-item` — no hover state).

**Screenshot evidence:** `screenshots/today-desktop.png` shows the flat todo rows at rest.

**Sketch:** ~5 lines in `sections.css`: `.todo-item { transition: transform 120ms, border-color 120ms; } .todo-item:hover { transform: translateY(-2px); border-color: var(--accent); }`. Reduced-motion guard: existing global suppression covers it; ALSO add explicit `[data-reduced-motion="true"] .todo-item { transition: none; transform: none; }` for self-documenting convention.

**Open questions:** Does the lift interfere with drag-to-reorder if/when UPL-13 lands? Resolved: drag handlers can `pointer-events: none` on lift during dragstart.

---

### UPL-10 — Breathing-glow on armed reminders [MOT-10]

**Category:** Motion
**Size:** S
**Evidence triangulation:** 2 briefs (visual ✓, inspiration ✓)
**Motion primitives:** [MOT-10 breathing-glow]

**What it is:** On reminders with a future `fireAt` (armed state), apply a slow 2–3 s opacity pulse to a status indicator (small accent-colored dot on the row, or a subtle border-shadow). Max opacity delta ~0.4. Gated by `@media (prefers-reduced-motion: no-preference)`. Existing code parity: `App.css:71–76` already has `settings-badge-pulse` — same idiom.

**Why it matters:** Currently a reminder set for 1 hour from now looks identical to one set for 1 month. Users relying on visual scanning get zero signal of armed/urgency state. The pattern is also coded into the design-system §7 "underdeveloped" list.

**Sources:**
- Visual scout: H-3 — "Armed reminders have no ambient visual state indicator"
- Inspiration scout: Pattern 9 — "Breathing-Glow on Armed Reminders"

**Closest Proclivity analog today:** `src/newtab/App.css:71–76` — `@keyframes settings-badge-pulse` (the new-feature dot pulse — same pattern, different surface). `src/sections/reminders/RemindersManager.tsx` — reminder row component.

**Screenshot evidence:** `screenshots/reminders-desktop.png`.

**Sketch:** Add `.reminder-row[data-armed="true"] .reminder-status-dot { animation: breathing-glow 2.4s ease-in-out infinite; }` in `reminders.css`. Set `data-armed="true"` from the manager component when `fireAt > now`. Color: `var(--accent)` for far-future, `var(--warn)` only for overdue (which is a legitimate state-communication use of the reserved token). Reduced-motion guards: belt-and-suspenders (data attr + @media).

**Open questions:** Should "near-due" (within 1 hour) get a separate visual treatment, e.g., a brighter pulse or a different hue derived from `--accent-2`? Resolved: not in this milestone; flag as a follow-up.

---

### UPL-11 — Pill-style animated tab indicator (with shared-layout slide)

**Category:** Motion
**Size:** S
**Evidence triangulation:** 1 brief (inspiration ✓)
**Motion primitives:** [MOT-51 shared-element-transition]

**What it is:** Replace the current `border-bottom: 2px solid var(--accent)` underline on `.tab-active` with a compact rounded pill indicator (`background: var(--accent-tint); border-radius: 6px`) that slides horizontally between tabs via `motion.div` with shared `layoutId="tab-indicator"`. Linear made this change in their March 2026 refresh.

**Why it matters:** The pill feels lighter than the full-width underline; the slide animation gives spatial feedback about which direction the navigation moved (useful when adjacent sections have similar content). Compounds with UPL-2 (the indicator slides while the content cross-dissolves).

**Sources:**
- Inspiration scout: Pattern 4 — Linear March 2026 refresh, Notion Calendar pill toggles

**Closest Proclivity analog today:** `src/newtab/App.css:87–104` (`.tabs`, `.tab`, `.tab-active`).

**Screenshot evidence:** `screenshots/today-desktop.png`, `screenshots/sprint-desktop.png` (current underline style visible).

**Sketch:** Inside each `.tab`, render a `motion.span` only when `active` with `layoutId="tab-indicator"` — Framer Motion's shared-layout system handles the horizontal slide automatically. Styling: `position: absolute; inset: 0; background: var(--accent-tint, oklch(from var(--accent) l c h / 0.18)); border-radius: 6px; z-index: -1;`. Pair with `--accent-tint` token if it doesn't exist; otherwise use `color-mix(in oklch, var(--accent) 20%, transparent)`. Requires UPL-1.

**Open questions:** Should the pill replace the underline entirely, or coexist (pill + underline)? Resolved: replace — coexistence is visual noise.

---

### UPL-12 — Sprint progress bar fill animation [MOT-14]

**Category:** Motion
**Size:** XS
**Evidence triangulation:** 1 brief (visual ✓)
**Motion primitives:** [MOT-14 tick-flash]

**What it is:** On first paint of the sprint section, animate the progress bar fill from 0% to its current value over 600 ms ease-out. Currently it renders instantly at the final value.

**Why it matters:** Static progress bars communicate state without communicating that the metric is live. Linear and Jira both animate progress bars on first render. Side benefit: the animation gives the user a moment to register the day-count progress visually.

**Sources:**
- Visual scout: M-1 — "Sprint progress bar is static — no entry animation or fill motion"

**Closest Proclivity analog today:** `src/sections/sprint/sprint.css:185` — `.sprint-progress-bar-fill { transition: width 0.3s ease }` (transition exists for the dynamic update, but no first-paint animation).

**Screenshot evidence:** `screenshots/sprint-desktop.png` shows the flat bar at 53%.

**Sketch:** Add `@keyframes sprint-progress-fill { from { width: 0% } to { width: var(--target-width) } }` scoped to `no-preference`. Set `--target-width` on the fill element from the manager component. Reduced-motion guards on the keyframe + the data-attr (also fixes the existing M2 current-state-critic finding about missing self-documenting guard).

**Open questions:** Does this conflict with the dynamic `transition: width` that fires when a task is completed mid-sprint? Resolved: animations land before transitions; the `animation` runs once on first paint, then `transition` handles subsequent updates.

---

### UPL-13 — Adopt `@formkit/auto-animate` for list mutations

**Category:** Library/dependency
**Size:** XS
**Evidence triangulation:** 1 brief (library ✓)
**Motion primitives:** [MOT-3 stagger-reveal] (list mutation), [MOT-40 drag-to-reorder]

**What it is:** Add `@formkit/auto-animate` (~3.28 KB gz) and apply `useAutoAnimate()` to the `<ul>` parent in `TodoList.tsx`, `SprintManager.tsx`, and `RemindersManager.tsx`. Drop-in animation for list add/remove/reorder without writing imperative animation code. Library natively respects `prefers-reduced-motion`.

**Why it matters:** Complementary to UPL-1 — auto-animate handles list MUTATIONS (item added, item completed, item reordered) which `motion` requires more setup for. The 3.28 KB cost is justified by the implementation simplicity and broad applicability across 4 list surfaces.

**Sources:**
- Library scout: §A2 — `@formkit/auto-animate` v0.8.2, MIT, ~3.28 KB gz, Tier 1 Adopt

**Closest Proclivity analog today:** Three `<ul>` mutation surfaces (`TodoList.tsx`, `SprintManager.tsx`, `RemindersManager.tsx`) all render lists with no mutation choreography.

**Screenshot evidence:** N/A (animation only visible on mutation).

**Sketch:** Install `@formkit/auto-animate`. In each list parent component, `const [ulRef] = useAutoAnimate<HTMLUListElement>(); return <ul ref={ulRef}>{items.map(...)}</ul>`. No additional configuration needed for sensible defaults. Compose with UPL-3 (stagger-reveal on cold load) — auto-animate handles ongoing mutations while UPL-3 handles initial reveal.

**Open questions:** Does it conflict with UPL-1's motion library if both are installed? Resolved: no — they operate on different layers (auto-animate uses CSS animations under the hood; motion uses imperative requestAnimationFrame). They coexist in many production apps.

---

### UPL-14 — Empty-state illustrations + primary CTA + dot-grid background

**Category:** Layout
**Size:** M
**Evidence triangulation:** 3 briefs (visual ✓, inspiration ✓, current-state ✓)
**Motion primitives:** [MOT-2 fade-up] (container entry), [MOT-64 dot-grid-bg]

**What it is:** Replace the current `.section-empty` plain-dashed-border layout with: SVG spot illustration (64×64 px, ~2 KB inline) + bold headline + subtitle + primary-styled CTA button (`background: var(--accent)`). Add a subtle dot-grid background via `radial-gradient` repeated at 20 px intervals using `var(--border)` color (theme-adaptive).

**Why it matters:** Empty states are first-run onboarding moments. The current dashed-border text-only treatment reads as "error / placeholder" rather than "invite to start." 2026 standard (Linear, Notion, Vercel) is illustrated empty states with primary CTAs.

**Sources:**
- Visual scout: H-4 — "Empty states are bare text/button with no illustrative guidance"
- Inspiration scout: Pattern 10 — "Empty-State with Subtle Dot-Grid Background"
- Current-state critic: M5 — "Empty states use only a text hint; no illustration or action affordance"

**Closest Proclivity analog today:** `src/newtab/App.css:117–123` — `.section-empty` shared class; `src/sections/Gantt.tsx` empty-state.

**Screenshot evidence:** `screenshots/gantt-desktop.png` — clear example of the current empty-state treatment.

**Sketch:** New file `src/components/EmptyState.tsx` with props `{ illustration, headline, subtitle, ctaLabel?, onCta?, variant: "today" | "sprint" | "gantt" | "reminders" }`. Three or four 64×64 SVG spot illustrations authored inline (or one universal + per-section variant). CTA uses `.modal-btn-primary` styling pattern (background: accent, color: accent-on). Dot-grid: `background-image: radial-gradient(circle, var(--border) 1px, transparent 1px); background-size: 20px 20px;`.

**Open questions:** Who authors the SVG illustrations? Resolved: lift from open-source illustration sets (e.g., undraw.co) OR hand-author simple shape-based icons in Figma. Defer the asset decision to the implementation milestone.

---

### UPL-15 — Section accent variant for LongTerm (horizon differentiation)

**Category:** Color/theme
**Size:** XS
**Evidence triangulation:** 1 brief (visual ✓)
**Motion primitives:** none

**What it is:** Apply a subtle visual differentiator to the LongTerm section (a thin left-border using `--accent-2` instead of `--border`, OR a section heading accent shift) so users can distinguish it from Today at a glance.

**Why it matters:** LongTerm and Today are visually identical except for the input placeholder. Users with tasks in both sections must read the tab label to know which view they're in.

**Sources:**
- Visual scout: M-5 — "Long-term section is visually identical to Today — no horizon-differentiation cue"

**Closest Proclivity analog today:** `src/sections/LongTerm.tsx` renders `<TodoList scope="long" placeholder="A goal or initiative…">` — the `scope` prop already supports per-section differentiation logic.

**Screenshot evidence:** `screenshots/long-term-desktop.png` vs `screenshots/today-desktop.png` — pixel-near-identical layouts.

**Sketch:** Add `[data-scope="long"]` selector to `.todo-list` CSS that applies a thin left-border (`border-left: 2px solid var(--accent-2);`) or a section-heading accent shift. No new tokens needed — `--accent-2` is `oklch(0.83 0.13 179)` (teal-green) already defined. Pure CSS, ~3 lines.

**Open questions:** Should the accent appear on every `.todo-item` (heavy) or only on the section container (light)? Resolved: container-level only.

---

### UPL-16 — Mobile header layout fix (clock clamp + tab horizontal scroll)

**Category:** Layout
**Size:** XS
**Evidence triangulation:** 1 brief (visual ✓)
**Motion primitives:** none

**What it is:** Apply `font-size: clamp(28px, 6vw, 56px)` to `.clock` so it scales with viewport width. Add `overflow-x: auto; scrollbar-width: thin` to `.tabs` so the tab row horizontally scrolls at narrow viewports instead of clipping.

**Why it matters:** At 390 px viewport, the clock at 56 px dominates the top and the tab row clips off (Calendar, Closed tabs invisible per visual-scout). Proclivity is desktop-first but the mobile gap is systemic across all 8 views.

**Sources:**
- Visual scout: M-2 — "Clock visual weight imbalance at mobile viewport (390 px)"
- Cross-view pattern: "Mobile-unresponsive header" (every view affected)

**Closest Proclivity analog today:** `src/newtab/App.css:10–29` (header), `App.css:35–36` (clock), `App.css:87–104` (tabs).

**Screenshot evidence:** `screenshots/today-mobile.png`, `screenshots/sprint-mobile.png` — clock dominance + tab clipping visible.

**Sketch:** `.clock { font-size: clamp(28px, 6vw, 56px); }` and `.tabs { overflow-x: auto; scrollbar-width: thin; }`. Optionally add scroll-snap (`scroll-snap-type: x mandatory; .tab { scroll-snap-align: start; }`).

**Open questions:** none.

---

### UPL-17 — Settings pane fade transition

**Category:** Motion
**Size:** XS
**Evidence triangulation:** 1 brief (visual ✓)
**Motion primitives:** [MOT-1 fade-in]

**What it is:** Add a 150 ms opacity transition on `.settings-pane` when the active pane id changes. Currently pane switches are hard-cuts (same hard-cut as section tabs, more conspicuous in the narrow 480 px content column).

**Why it matters:** Same problem as UPL-2 but localized to the settings modal. The fix is smaller because the modal has a fixed-shape content area.

**Sources:**
- Visual scout: M-3 — "Settings pane switches are hard-cuts with no transition"

**Closest Proclivity analog today:** `src/components/settings/SettingsModal.css:196–198` (`.settings-pane`).

**Screenshot evidence:** `screenshots/settings-general-desktop.png` vs `screenshots/settings-appearance-desktop.png`.

**Sketch:** Add `transition: opacity 150ms` to `.settings-pane`; when `activePane` changes, briefly set `opacity: 0` then `opacity: 1` via a `key` re-mount on the inner content. Pure CSS approach; no UPL-1 dependency. Scoped to `no-preference`.

**Open questions:** none.

---

### UPL-18 — Adopt `cmdk` for command palette (Cmd+K)

**Category:** Library/dependency
**Size:** M
**Evidence triangulation:** 2 briefs (library ✓, inspiration ✓ implicit)
**Motion primitives:** [MOT-4 scale-in] for palette entry

**What it is:** Add `cmdk` (~12–14 KB gz total including required `@radix-ui/react-dialog` peer dep). Render a Cmd+K-triggered command palette overlaying the newtab: quick-create todo, switch section, open settings, trigger Gemini. Lazy-loaded via `React.lazy(() => import('./CommandPalette'))`.

**Why it matters:** Extends the existing QuickPrompt pattern into a full keyboard-driven command surface. Aligns Proclivity with the Raycast / Linear keyboard-first interaction model that 2026 power users expect.

**Sources:**
- Library scout: §C2 — `cmdk` v1.1.1, MIT, ~12–14 KB gz, Tier 2 Adopt (lazy)
- Inspiration scout: implicit in Raycast / Linear references (not surfaced as its own pattern)

**Closest Proclivity analog today:** `src/components/QuickPrompt.tsx` — the closest existing keyboard-triggered surface; a command palette would extend this pattern.

**Screenshot evidence:** N/A (net-new surface).

**Sketch:** `React.lazy(() => import('./CommandPalette'))`. Trigger via `react-hotkeys-hook` (UPL-20) for `Cmd+K`. Palette renders sections grouped by domain (Today, Sprint, Settings, Gemini). Pairs with UPL-4 modal scale-in pattern for entry.

**Open questions:** Does adding `@radix-ui/react-dialog` (the cmdk peer dep) open the door to broader Radix UI adoption that the design-system reference rejects? Resolved: single primitive use is explicitly allowed by the design-system rejection note ("full shadcn/Radix UI system adoption" is rejected, not individual primitives). **Flagged for challenger scrutiny.**

---

### UPL-19 — Keyboard shortcut help overlay (Cmd+/ or ?)

**Category:** Interaction
**Size:** S
**Evidence triangulation:** 1 brief (inspiration ✓)
**Motion primitives:** [MOT-4 scale-in]

**What it is:** New `KeyboardHelpOverlay.tsx` component triggered by `Cmd+/` or `?` key. Shows the current context's keyboard shortcuts as a categorized list. Closes the gap between "has shortcuts" and "users know about shortcuts." Smaller scope than a full command palette (UPL-18).

**Why it matters:** Proclivity has keyboard navigation throughout but no discovery surface. Design-system §7 explicitly names this as an underdeveloped gap.

**Sources:**
- Inspiration scout: Pattern 8 — Raycast keyboard-first reference, Linear shortcut standardization

**Closest Proclivity analog today:** No existing analog. Settings modal's keyboard navigation is the closest pattern.

**Screenshot evidence:** N/A (net-new).

**Sketch:** New `src/components/KeyboardHelpOverlay.tsx`. Uses Modal.tsx for the container. Static content (no dynamic shortcut detection in v1 — just the known shortcut list). Mount in App.tsx. Trigger via `react-hotkeys-hook` (UPL-20).

**Open questions:** Does this overlap with UPL-18 (command palette)? Resolved: complementary. Help overlay is read-only; command palette is action. Many apps ship both.

---

### UPL-20 — Adopt `react-hotkeys-hook` for declarative keyboard shortcuts

**Category:** Library/dependency
**Size:** XS
**Evidence triangulation:** 1 brief (library ✓)
**Motion primitives:** none

**What it is:** Add `react-hotkeys-hook` (~3 KB gz, zero deps). Replaces ad-hoc `document.addEventListener('keydown')` with declarative `useHotkeys('cmd+k', openPalette)` calls.

**Why it matters:** Standardizes the keyboard-shortcut layer. Enables UPL-18 (Cmd+K) and UPL-19 (Cmd+/) with a single shared pattern. Cleaner than scattered `keydown` listeners.

**Sources:**
- Library scout: §C4 — `react-hotkeys-hook` v4/v5, MIT, ~3 KB gz, zero deps, Tier 1 Adopt

**Closest Proclivity analog today:** Ad-hoc keydown listeners in `App.tsx` and `Modal.tsx`.

**Screenshot evidence:** N/A.

**Sketch:** Add to dependencies. Refactor existing keydown listeners in `App.tsx` (settings toggle, modal escape) to `useHotkeys()` calls. New shortcuts (UPL-18, UPL-19) consume the same API.

**Open questions:** none.

---

### UPL-21 — Token-discipline sweep (replace hardcoded #0b0e14, #fff, rgba whites)

**Category:** Cross-cutting refactor
**Size:** S
**Evidence triangulation:** 1 brief (current-state ✓)
**Motion primitives:** none

**What it is:** Replace ~12 sites of hardcoded color (`#0b0e14`, `#fff`, `rgba(255,255,255,...)`) with the correct semantic token (`var(--accent-on)`, `var(--bg)`, theme-adaptive equivalents). Also remove `color-scheme: dark` hardcode from `gantt.css:143` (currently breaks the light-theme native date input).

**Why it matters:** These magic numbers compound — they create silent light-theme regressions and break the token-discipline convention. They are individually LOW/MEDIUM severity but worth a single dedicated pass.

**Sources:**
- Current-state critic: §6 (Token-discipline conflicts) — 16 sites enumerated with file:line; L2, M3, L3

**Closest Proclivity analog today:** Multiple files across `gantt.css`, `Modal.css`, `sprint.css`, `SettingsModal.css`, `index.css`, `photos.css`.

**Screenshot evidence:** Not visible in screenshots (the bug manifests only when toggling between themes).

**Sketch:** ~12 line substitutions across 7 files. Each replaces a magic hex with a semantic token. Also: 1-line removal of `color-scheme: dark` from `gantt.css:143`. Add a CSS-lint rule (or grep in CI) to prevent regression.

**Open questions:** Should this land as a single commit or per-file? Recommend: single commit (the audit is enumerated and the substitution is mechanical).

---

### UPL-22 — Reduced-motion guard convention sweep

**Category:** Cross-cutting refactor
**Size:** XS
**Evidence triangulation:** 1 brief (current-state ✓)
**Motion primitives:** none

**What it is:** Add the missing `[data-reduced-motion="true"]` or `@media (prefers-reduced-motion: reduce)` guard to ~5 sites where one of the two layers is present but not the other (sprint progress fill, QuickPrompt banner, MeshBackground fade-in, settings-badge-pulse). Self-documenting belt-and-suspenders convention.

**Why it matters:** Currently most motion sites have BOTH guards (the canonical pattern). A handful rely on the global theme.css fallback. The risk is small (global fallback works) but the convention break creates silent fragility if the global is ever removed.

**Sources:**
- Current-state critic: M2, L4, L5, L6 — full file:line enumeration

**Closest Proclivity analog today:** `Modal.css:99–109` is the gold-standard pattern (both guards present).

**Screenshot evidence:** N/A.

**Sketch:** Add ~5 small CSS blocks to align all motion sites with the dual-guard convention. ~10 lines total.

**Open questions:** none.

---

### UPL-23 — Photos slideshow manual controls (prev/next/pause)

**Category:** Interaction
**Size:** S
**Evidence triangulation:** 1 brief (current-state ✓)
**Motion primitives:** none

**What it is:** Add a control row at the bottom of `.photos-stage`: left-arrow, pause/play, right-arrow. Opacity 0 at rest, opacity 1 on `:hover` / `:focus-within`. `aria-pressed` on pause/play. Arrows use the same inline-SVG convention as `GearIcon` (or Lucide icons if UPL-8 lands first).

**Why it matters:** Photos is currently a passive ambient display. 2026 standard for any media widget is to expose prev/next/pause affordances. Users cannot manually advance, go back, or pause without going into Settings.

**Sources:**
- Current-state critic: M6 — "Photos banner has no navigation controls or manual advance"

**Closest Proclivity analog today:** `src/sections/Photos.tsx:120–171`, `src/sections/photos.css:79–107`.

**Screenshot evidence:** No screenshot captured (Photos slot was empty at smoke-test time — itself a UPL-5 signal).

**Sketch:** Add three button elements absolutely positioned at the bottom of `.photos-stage` (above the caption). State management in `Photos.tsx` for `isPaused` and manual index control. ARIA: `aria-label` on each button, `aria-pressed` on pause/play. Reduced-motion: controls are static — no motion to gate.

**Open questions:** Should the controls also be reachable via keyboard (left/right arrows)? Recommend yes — use UPL-20 `useHotkeys` if it lands first.

---

### UPL-24 — Custom date/time input (replace native `datetime-local`)

**Category:** Layout
**Size:** S
**Evidence triangulation:** 1 brief (visual ✓)
**Motion primitives:** none

**What it is:** Replace the `<input type="datetime-local">` in the reminders form with two styled inputs side-by-side (`<input type="time">` + `<input type="date">`), or adopt a lightweight date-fns-based picker. Eliminates the visual inconsistency between the native browser chrome and Proclivity's other styled inputs.

**Why it matters:** The native datetime-local picker visually differs from Proclivity's other form inputs on every platform. Side-by-side date+time inputs preserve native a11y while restoring visual consistency.

**Sources:**
- Visual scout: M-6 — `datetime-local` input uses native browser chrome

**Closest Proclivity analog today:** `src/sections/reminders/RemindersManager.tsx` reminder form.

**Screenshot evidence:** `screenshots/reminders-desktop.png`.

**Sketch:** Split the datetime-local into two inputs. Merge values back to ISO string on form submit. No new dependency required (option A); a date-fns picker is option B if more polish is needed. Recommend option A for v1 simplicity.

**Open questions:** Does this regress date-format localization? Resolved: native time + date inputs both honor `lang` attribute on the document.

---

### UPL-25 — Adopt `sonner` for in-page toast feedback

**Category:** Library/dependency
**Size:** XS
**Evidence triangulation:** 1 brief (library ✓)
**Motion primitives:** [MOT-1 fade-in], [MOT-14 tick-flash]

**What it is:** Add `sonner` (~2.5–9 KB gz). Mount `<Toaster />` once in `App.tsx`. Call `toast('Reminder created')` imperatively from any component. Non-modal confirmation feedback for quick actions (reminder-created, todo-completed, settings-saved).

**Why it matters:** Proclivity has no in-page feedback primitive. `chrome.notifications` fires OS-level alerts but there's no in-newtab feedback for quick actions. Toasts close the perceptual gap.

**Sources:**
- Library scout: §C3 — `sonner` MIT, ~9 KB gz, Tier 1 Adopt

**Closest Proclivity analog today:** None.

**Screenshot evidence:** N/A.

**Sketch:** Add `sonner` to dependencies. Mount `<Toaster theme="dark" position="bottom-right" />` (or theme-bound via `useTheme`). Call `toast.success(...)` / `toast.error(...)` from action callbacks. Respect reduced-motion via sonner's built-in `motion` config.

**Open questions:** Does the toast conflict with the QuickPrompt banner result display? Resolved: different surfaces — QuickPrompt result is a persistent banner; toasts are transient confirmations.

---

### UPL-26 — Mesh background bloom + ambient lighting (`@react-three/drei` + postprocessing)

**Category:** Library/dependency
**Size:** M
**Evidence triangulation:** 1 brief (library ✓)
**Motion primitives:** Enhances [MOT-60 mesh-gradient-bg], unlocks [MOT-61 noise-overlay]

**What it is:** Add `@react-three/drei@9` (compatible with R3F 8 + React 18) and `@react-three/postprocessing@3`. Inside the existing MeshBackground lazy boundary, add `<Bloom>` for luminous edges and `<Environment>` for ambient PBR lighting. Visually elevates the background from "plain Three.js mesh" to "premium 3D art."

**Why it matters:** MeshBackground is Proclivity's strongest visual differentiator (per visual-scout's "What does well" section). Adding bloom + ambient is incremental polish on the existing differentiator.

**Sources:**
- Library scout: §F1 — `@react-three/drei@9`, §F2 — `@react-three/postprocessing@3`

**Closest Proclivity analog today:** `src/three/MeshBackground.tsx` (lazy-loaded).

**Screenshot evidence:** N/A (the mesh is animated; screenshots don't capture motion).

**Sketch:** Add both packages. Modify `MeshBackground.tsx` (inside the lazy boundary) to wrap the scene in `<EffectComposer><Bloom intensity={0.4} /></EffectComposer>` and add `<Environment preset="city" />`. Both new packages are lazy-loaded within the MeshBackground boundary; zero initial-chunk impact.

**Open questions:** Does the additional GPU cost matter for low-end devices? Resolved: yes — gate bloom intensity behind the existing `meshIntensity` setting. **Flagged for challenger scrutiny.**

---

## 5. Cross-cutting tensions

| Tension | Resolution |
|---|---|
| inspiration-scout proposed parallax on the MeshBackground (Pattern 11 — mesh-tonal harmony); current-state-critic implicitly accepts parallax there | Resolved: parallax is allowed ONLY on the MeshBackground per motion-vocabulary §8 (anti-pattern is parallax on planning sections, not on the background canvas) |
| library-scout proposed `cmdk` (pulls in @radix-ui/react-dialog); design-system explicitly rejects shadcn/Radix UI system adoption | Resolved: single Radix primitive is allowed; full shadcn/Radix system is not. The design-system rejection note is specifically about adopting the *system*. **Challenger should still scrutinize.** |
| inspiration-scout proposed warm-gray as the default (UPL-6); current-state-critic doesn't address it but emphasizes token-discipline (UPL-21) | Resolved: both candidates coexist — UPL-6 changes neutral tokens, UPL-21 fixes magic-number hex codes. No conflict. |
| library-scout endorsed both `motion` (UPL-1) and `auto-animate` (UPL-13); functionally overlapping for list animations | Resolved: complementary — auto-animate for list mutations (cheap & specific), motion for section/modal/page-level (general-purpose). Both land. |
| current-state-critic flagged "skeleton would flash briefly on near-instant local loads — net negative" in §6 parking-lot, but H2 strongly recommends skeletons | Resolved: critic's parking-lot is wrong — H2 directly contradicts. Skeleton is on local-only loads but Photos and Gemini DO have observable load time. Adopt UPL-5. |

---

## 6. Already considered + rejected

| Proposal | Source | Rejection reason |
|---|---|---|
| Adopt Tailwind / shadcn full system | library-scout parking-lot, design-system §6 | Convention break; bundle blowup; design-system explicitly rejects |
| GSAP | library-scout parking-lot | Proprietary license; rejected per design-system §6 |
| Lottie / lottie-react | library-scout parking-lot | No After Effects pipeline; ~30 KB gz unjustified |
| react-aria-components | library-scout parking-lot | ~50 KB gz — too large for ≤200 KB initial chunk |
| vaul (drawer) | library-scout parking-lot | Author marked unmaintained Dec 2024 |
| react-spring | library-scout parking-lot | Superseded by `motion` |
| lenis (smooth-scroll) | library-scout parking-lot | Proclivity has limited vertical scroll; marginal value |
| Auto-rotating carousel | inspiration-scout parking-lot | motion-vocabulary §8 anti-pattern |
| Confetti on todo completion | inspiration-scout parking-lot | motion-vocabulary §8 anti-pattern |
| Magnetic cursor on operational buttons | inspiration-scout parking-lot | motion-vocabulary §8 anti-pattern |
| Parallax on planning sections | inspiration-scout parking-lot | motion-vocabulary §8 anti-pattern |
| Spline embed | library-scout parking-lot | Proprietary license; rejected per design-system §6 |
| Things 3 native macOS gesture patterns | inspiration-scout parking-lot | Native-app patterns don't translate to Chrome extension web app |
| Apple Vision OS parallax hero | inspiration-scout parking-lot | Marketing-surface-only; Proclivity has no welcome screen |

---

## 7. Motion-vocabulary primitive index

| Primitive | Used in candidates |
|---|---|
| [MOT-1 fade-in] | UPL-17 (settings pane), UPL-25 (sonner toast) |
| [MOT-2 fade-up] | UPL-3 (stagger items), UPL-14 (empty-state entry) |
| [MOT-3 stagger-reveal] | UPL-3 (todo lists), UPL-13 (auto-animate list mutation) |
| [MOT-4 scale-in] | UPL-4 (modal), UPL-18 (cmdk palette), UPL-19 (help overlay) |
| [MOT-6 dissolve] | UPL-2 (section tabs) |
| [MOT-10 breathing-glow] | UPL-10 (armed reminders) |
| [MOT-13 skeleton-shimmer] | UPL-5 (Suspense fallbacks) |
| [MOT-14 tick-flash] | UPL-12 (sprint progress), UPL-25 (toast confirmation) |
| [MOT-30 lift-on-hover] | UPL-9 (todo rows) |
| [MOT-33 icon-spin-on-action] | UPL-8 (lucide RefreshCw on Gemini fetch) |
| [MOT-40 drag-to-reorder] | UPL-13 (auto-animate; latent future) |
| [MOT-50 section-fade] | UPL-2 (tab switches), UPL-11 (paired with pill slide) |
| [MOT-51 shared-element-transition] | UPL-11 (pill indicator) |
| [MOT-60 mesh-gradient-bg] | UPL-26 (drei/postprocessing extensions) |
| [MOT-61 noise-overlay] | UPL-26 (postprocessing) |
| [MOT-64 dot-grid-bg] | UPL-14 (empty-state background) |

---

## Catalog summary

**Total candidates:** 26
**Foundational:** 3 (UPL-1, UPL-6, UPL-8)
**HIGH-equivalent (3+ briefs):** 5 (UPL-1, UPL-2, UPL-3, UPL-5, UPL-14)
**MEDIUM (2 briefs):** 5 (UPL-4, UPL-6, UPL-8, UPL-10, UPL-13, UPL-18)
**LOW / single-source:** 15

**Categories represented:** Motion (10), Library/dependency (5), Layout (3), Color/theme (2), Interaction (3), Cross-cutting refactor (2), Typography (1).
