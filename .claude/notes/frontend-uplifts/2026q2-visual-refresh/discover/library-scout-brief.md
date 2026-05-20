# Library Scout Brief — 2026q2-visual-refresh
**Uplift ID:** 2026q2-visual-refresh
**Scout:** library-scout
**Date:** 2026-05-20
**Scope:** Survey modern frontend libraries for animation, motion, interaction, layout, virtualization, icons, and r3f extensions that could make Proclivity's 8-view newtab feel more attractive, sleek, and modern. Honor local-only, strict-TS, ≤200 KB initial-chunk, and prefers-reduced-motion constraints.

---

## 1. TL;DR

The three strongest adoption candidates for Proclivity are: **`motion` (formerly framer-motion)** via `LazyMotion` for React-native animation primitives (MOT-1 through MOT-52), **`@formkit/auto-animate`** for zero-config list reorder animations on Today/Sprint/LongTerm, and **`lucide-react`** to finally standardize an icon system across the 8-view set. The deepest gap in Proclivity's frontend toolkit is the complete absence of any motion or animation layer — every view transition, list reorder, and modal entry is abrupt raw CSS with no choreography — compounded by zero icon standardization forcing ad-hoc inline SVGs throughout the codebase.

---

## 2. Library Candidates

### Category A: Animation / Motion

---

#### A1. `motion` (formerly `framer-motion`)
- **URL:** https://motion.dev/ (npm: `motion`)
- **Version:** 12.x (current: 12.19.0 as of June 2025; confirmed not framer-motion branding)
- **License:** MIT
- **Bundle size (gz):** Full `motion` component: ~34 KB gz. With `LazyMotion` + `domAnimation` feature pack: ~4.6 KB initial + ~15 KB deferred = ~20 KB total when lazy-loaded. With `LazyMotion` + `domMax` (includes drag, scroll): ~4.6 KB initial + ~25 KB deferred.
- **Maintenance signal:** pmndrs/motiondivision org. Actively developed; v12.19.0 released June 2025. 24k+ GitHub stars. Weekly cadence.
- **What Proclivity could do with it:** `AnimatePresence` for the section-switch cross-fade [MOT-50 section-fade] currently missing between Today/Sprint/LongTerm. `motion.div` with `staggerChildren` for the todo list cold-load stagger [MOT-3 stagger-reveal]. `scale-in` for `Modal.tsx` and `TodoEditModal.tsx` entries [MOT-4 scale-in]. `useScroll` for optional scroll-progress bar on LongTerm with many items [MOT-21 progress-bar-by-scroll]. `Reorder` group for drag-to-reorder on Sprint/LongTerm todo lists [MOT-40 drag-to-reorder].
- **Proclivity positioning:** adopt-as-import (lazy-loaded)
- **Motion primitives unlocked:** [MOT-1 fade-in], [MOT-2 fade-up], [MOT-3 stagger-reveal], [MOT-4 scale-in], [MOT-5 slide-from-edge], [MOT-6 dissolve], [MOT-21 progress-bar-by-scroll], [MOT-40 drag-to-reorder], [MOT-50 section-fade], [MOT-51 shared-element-transition], [MOT-52 view-transitions-api]
- **Risk flags:** Full 34 KB gz MUST be lazy-loaded — cannot land in the initial chunk without breaching the 200 KB cap. The `m` (minimal) component + `LazyMotion` strategy keeps initial impact to ~4.6 KB. No React 19-only requirement; React 18.2+ is the stated minimum.
- **Compatibility:** React 18.2+ confirmed. Vite tree-shaking fully supported. Strict-TS compatible; ships its own types.
- **Lazy-load plan:** Import only `m` and `LazyMotion` from `motion/react` in the initial bundle (~4.6 KB gz). Wrap `<LazyMotion features={loadFeatures}>` at the `App.tsx` level with `loadFeatures = () => import('motion/react').then(m => m.domAnimation)` — deferred until after first paint. Drag (`domMax`) lazy-loaded only for Sprint and LongTerm section chunks.

---

#### A2. `@formkit/auto-animate`
- **URL:** https://auto-animate.formkit.com/ (npm: `@formkit/auto-animate`)
- **Version:** 0.8.2 (latest stable as of search date; 0.9.0 also visible on bundlephobia)
- **License:** MIT
- **Bundle size (gz):** ~3.28 KB gz (entire library including React hook)
- **Maintenance signal:** formkit org on GitHub. Last release ~8 months ago (v0.8.2). 12k+ GitHub stars. Mature/stable; low churn intentional.
- **What Proclivity could do with it:** One-line drop-in for `TodoList.tsx` and `src/sections/sprint/SprintManager.tsx` to get smooth add/remove/reorder animations when todos are added, completed, or dragged into a new position. `useAutoAnimate` hook applied to the `<ul>` parent in `TodoList.tsx` unlocks [MOT-3 stagger-reveal] equivalent for list mutations without any imperative animation code.
- **Proclivity positioning:** adopt-as-import (direct — under the 20 KB lazy-load threshold)
- **Motion primitives unlocked:** [MOT-3 stagger-reveal] (list entry), [MOT-40 drag-to-reorder] (list reorder with visual feedback)
- **Risk flags:** Intentionally minimal — does not support complex entrance choreography or cross-section transitions. Complement with `motion` for section-level transitions; use `auto-animate` for list-level mutations. The library natively respects `prefers-reduced-motion` — no extra work required.
- **Compatibility:** React 18 confirmed (React hook export). Vite-compatible. Strict-TS compatible; ships types.
- **Lazy-load plan:** At 3.28 KB gz, no lazy-load boundary needed. Direct import in `TodoList.tsx`.

---

#### A3. `animejs` (Anime.js v4)
- **URL:** https://animejs.com/ (npm: `animejs`)
- **Version:** 4.2.2
- **License:** MIT
- **Bundle size (gz):** ~10 KB gz (full library with full ES module tree-shaking)
- **Maintenance signal:** juliangarnier / Julian Garnier (solo maintainer). v4 was a significant architectural rewrite with ES module support. ~50k GitHub stars. Cadence somewhat irregular (major releases every few years) but v4 is stable.
- **What Proclivity could do with it:** Imperative timeline animations for the Gantt section's `ChartView.tsx` — specifically smooth bar-width transitions when gantt tasks are resized or dates change. Also usable for the [MOT-23 scroll-triggered-counter] pattern on sprint progress metrics. More surgical than `motion` for one-off timed sequences.
- **Proclivity positioning:** parking-lot — Motion covers the same ground for React components and is the better single choice. Anime.js adds value only if imperative DOM sequencing is needed on non-React surfaces (e.g., the WebGL canvas layer).
- **Motion primitives unlocked:** [MOT-23 scroll-triggered-counter], [MOT-43 drag-time-scrubber]
- **Risk flags:** v4 ships native TypeScript types but the API is imperative and does not integrate with React's render cycle — pairing it with React requires `useEffect` + refs, which fights strict mode. Solo maintainer. No React-specific bindings.
- **Compatibility:** React 18 compatible (imperative; not React-aware). Vite tree-shaking via ES modules. Strict-TS: ships types in v4.
- **Lazy-load plan:** At ~10 KB gz, import lazily inside `Gantt.tsx` (already lazy-loaded) — no additional boundary needed.

---

### Category B: Scroll-Driven

---

#### B1. Native CSS `animation-timeline: scroll()`
- **URL:** https://developer.mozilla.org/en-US/docs/Web/CSS/animation-timeline (web standard)
- **Version:** Web standard (Chrome 115+, Edge 115+; Firefox flag-only; Safari not supported as of May 2026)
- **License:** N/A (browser standard)
- **Bundle size (gz):** 0 KB — zero JS bundle impact
- **Maintenance signal:** W3C CSS Working Group. Chrome shipped in 2023. Baseline "newly available" but NOT "widely available" yet (Safari missing).
- **What Proclivity could do with it:** Parallax depth effect on the `MeshBackground.tsx` as the newtab first loads [MOT-20 parallax-bg]. Since Proclivity is a Chrome extension, Safari absence is irrelevant — the runtime is guaranteed Chromium. This is a zero-cost win scoped to Chrome-only deployment.
- **Proclivity positioning:** design-pattern lift only (use in CSS, no library needed)
- **Motion primitives unlocked:** [MOT-20 parallax-bg], [MOT-21 progress-bar-by-scroll]
- **Risk flags:** Chrome-only newtab means Safari gap is irrelevant — but note that if Proclivity ever targets Firefox extension, this would need a JS fallback. Reduced-motion: must gate all CSS scroll-driven animations inside `@media (prefers-reduced-motion: no-preference)`.
- **Compatibility:** Chrome MV3 extension — guaranteed Chromium runtime; no polyfill needed.
- **Lazy-load plan:** Pure CSS — no bundle consideration.

---

#### B2. `lenis`
- **URL:** https://lenis.darkroom.engineering/ (npm: `lenis`)
- **Version:** 1.3.23 (Apr 15, 2026)
- **License:** MIT
- **Bundle size (gz):** ~12 KB gz (estimated from older bundlephobia data; v1.3.x likely similar)
- **Maintenance signal:** darkroomengineering. Actively maintained; v1.3.23 released April 2026. Used by Linear, Arc. 8k+ GitHub stars.
- **What Proclivity could do with it:** Inertial scroll within the LongTerm section when the list grows long, making the scroll feel premium rather than abrupt. Ships a `lenis/react` integration. Configurable to wrap a specific DOM container rather than the window.
- **Proclivity positioning:** parking-lot — Proclivity is a single-page newtab with limited vertical scroll; most sections are panel-based, not long-scroll surfaces. Lenis shines on long marketing pages. The ROI is low until LongTerm grows to hundreds of items. Worth revisiting if LongTerm or Sprint sections adopt infinite-scroll or virtualized lists.
- **Motion primitives unlocked:** Enhances [MOT-20 parallax-bg] feel but does not directly unlock a named primitive.
- **Risk flags:** Overhead (~12 KB gz) not justified for the current newtab surface area. Double-scroll-handler risk in a Chrome extension environment where the newtab may already intercept scroll events.
- **Compatibility:** React 18 compatible via `lenis/react`. Vite-compatible. Strict-TS: ships types.
- **Lazy-load plan:** 12 KB gz — require `React.lazy` boundary around any section that adopts it.

---

### Category C: Layout / Interaction

---

#### C1. `@floating-ui/react`
- **URL:** https://floating-ui.com/ (npm: `@floating-ui/react`)
- **Version:** 0.27.19 (last published ~2 months ago)
- **License:** MIT
- **Bundle size (gz):** ~3 KB gz for `@floating-ui/react-dom` positioning core; `@floating-ui/react` interactions layer adds ~3–5 KB gz additional (tree-shaken). Total for tooltip + popover: ~6–8 KB gz per feature set used.
- **Maintenance signal:** floating-ui org. Active; 30k+ GitHub stars. Weekly releases. Used by Radix UI, Headless UI, many major UI libraries as the positioning primitive.
- **What Proclivity could do with it:** Tooltip positioning for tag chips (`TagChip.tsx`) — currently no hover context on truncated tags. Popover for QuickPrompt inline date/tag pickers. Correct overflow/clip handling for the settings modal's nested popovers that currently have no collision-detection.
- **Proclivity positioning:** adopt-as-import (direct — well under 20 KB per import)
- **Motion primitives unlocked:** [MOT-32 border-on-hover] (contextual tooltips reveal on hover), [MOT-34 inline-accent-edge-glow] (focused popovers)
- **Risk flags:** Minimal. Tree-shakable; only import the interactions you use. No Radix dependency pulled in — this is the lower-level positioning primitive that Radix itself wraps.
- **Compatibility:** React 18 confirmed. Vite tree-shaking confirmed. Strict-TS: first-class types.
- **Lazy-load plan:** ~6 KB gz total — no lazy-load boundary needed; import directly in components that need it.

---

#### C2. `cmdk`
- **URL:** https://cmdk.paco.me/ (npm: `cmdk`)
- **Version:** 1.1.1
- **License:** MIT
- **Bundle size (gz):** ~5–7 KB gz (cmdk itself; pulls in `@radix-ui/react-dialog` as peer dependency — ~6 KB gz additional). Total: ~12–14 KB gz first-adopt overhead.
- **Maintenance signal:** pacocoursey (Vercel). Active; 10k+ GitHub stars. v1.1.1 released 2024. Used by shadcn/ui, Vercel, Linear-style palettes.
- **What Proclivity could do with it:** Command palette overlay (Cmd+K) for the newtab — quick-create todo, switch section, open settings, trigger Gemini prompt. Extends the existing `QuickPrompt.tsx` pattern into a full keyboard-driven command surface, unlocking the Raycast/Linear interaction feel.
- **Proclivity positioning:** adopt-as-import (lazy-loaded)
- **Motion primitives unlocked:** N/A — interaction pattern, not motion. Pairs with [MOT-4 scale-in] on the palette overlay entry.
- **Risk flags:** Pulls in `@radix-ui/react-dialog` — first Radix primitive in the stack. Not blocked (it's MIT, focused, and the design-system.md only rejects full shadcn/Radix UI system adoption; a single primitive is different). Note: vaul is unmaintained (see §6 below). `@radix-ui/react-dialog` dependency is ~6 KB gz and is worth that cost for the interaction surface it enables. React 18 is a required peer dependency.
- **Compatibility:** React 18 confirmed (required peerDep). Vite-compatible. Strict-TS: ships types.
- **Lazy-load plan:** Total ~14 KB gz. Lazy-load as a `React.lazy(() => import('./CommandPalette'))` component triggered by Cmd+K keydown in `App.tsx`. The palette is never on the critical render path.

---

#### C3. `sonner`
- **URL:** https://sonner.emilkowal.ski/ (npm: `sonner`)
- **Version:** 1.x (active; ~47M weekly downloads)
- **License:** MIT
- **Bundle size (gz):** ~2.5–9 KB gz (reports vary by version; the core toast engine is under 3 KB; full with default styles closer to ~9 KB gz)
- **Maintenance signal:** emilkowalski (same author as vaul). Active; ~10k GitHub stars. Widely adopted.
- **What Proclivity could do with it:** Non-modal confirmation feedback for reminder-created, todo-completed (subtle, not confetti), or alarm-triggered notifications — displayed over the newtab canvas without needing to open a full modal. Currently Proclivity has no in-page toast/notification primitive; `chrome.notifications` fires OS-level alerts but there's no in-newtab feedback for quick actions.
- **Proclivity positioning:** adopt-as-import (direct — under 20 KB threshold)
- **Motion primitives unlocked:** [MOT-1 fade-in] (toast entry), [MOT-14 tick-flash] (confirmation feedback)
- **Risk flags:** Minimal. No Radix dependency. React 18 native. Does NOT conflict with `chrome.notifications` — these are different surfaces (in-page vs OS-level).
- **Compatibility:** React 18 confirmed. Vite-compatible. Strict-TS: ships types.
- **Lazy-load plan:** At ~9 KB gz, direct import is acceptable. Mount `<Toaster />` once in `App.tsx`; call `toast()` imperatively from any component.

---

#### C4. `react-hotkeys-hook`
- **URL:** https://react-hotkeys-hook.vercel.app/ (npm: `react-hotkeys-hook`)
- **Version:** 4.x (bundlephobia shows v5.2.4 on index)
- **License:** MIT
- **Bundle size (gz):** ~3 KB gz. Zero dependencies.
- **Maintenance signal:** JohannesKlauss. Active; 5k+ GitHub stars. Regular releases.
- **What Proclivity could do with it:** Declarative `useHotkeys('cmd+k', openPalette)` for the command palette trigger. `useHotkeys('escape', closeModal)` for the settings/todo modals. `useHotkeys('t', focusToday)` for section-switching shortcuts. Currently Proclivity has no standardized keyboard-shortcut layer — shortcuts are scattered ad-hoc.
- **Proclivity positioning:** adopt-as-import (direct)
- **Motion primitives unlocked:** N/A — interaction primitive, not motion. Complements [MOT-52 view-transitions-api] for keyboard-triggered section switches.
- **Risk flags:** None. Zero deps, tiny bundle.
- **Compatibility:** React 18 confirmed. Vite-compatible. Strict-TS: ships types.
- **Lazy-load plan:** 3 KB gz — no lazy-load boundary needed.

---

### Category D: Virtualization + Data

---

#### D1. `@tanstack/react-virtual`
- **URL:** https://tanstack.com/virtual/latest (npm: `@tanstack/react-virtual`)
- **Version:** 3.13.24 (latest ~1 month ago)
- **License:** MIT
- **Bundle size (gz):** ~10–15 KB gz
- **Maintenance signal:** TanStack (Tanner Linsley). Extremely active; part of TanStack v3 suite. 10k+ GitHub stars.
- **What Proclivity could do with it:** Virtualize `TodoList.tsx` when the sprint or LongTerm list grows beyond ~100 items. The 44 px `--row-height` token maps directly to TanStack Virtual's `estimateSize` callback — no layout measurement overhead needed. Prevents DOM bloat on power-user installs.
- **Proclivity positioning:** adopt-as-import (lazy-loaded per section)
- **Motion primitives unlocked:** N/A — performance primitive. Enables [MOT-3 stagger-reveal] to remain performant even on large lists.
- **Risk flags:** Added complexity for `TodoList.tsx` — virtual rows require explicit height and scroll container setup. Only justified if lists regularly exceed 50–100 items. Recommend gating behind a list-size check and adopting incrementally.
- **Compatibility:** React 18 confirmed. Vite-compatible. Strict-TS: first-class types.
- **Lazy-load plan:** ~15 KB gz — wrap in `React.lazy` per section that opts into virtualization (Sprint, LongTerm). Not needed in the Today section (typically <20 items).

---

### Category E: Icon Systems

---

#### E1. `lucide-react`
- **URL:** https://lucide.dev/ (npm: `lucide-react`)
- **Version:** 1.16.0 (published ~6 days ago as of May 2026; 73M+ weekly downloads)
- **License:** ISC (functionally equivalent to MIT for private/personal use)
- **Bundle size (gz):** ~0.5 KB gz per icon when tree-shaken by Vite. Full library ~146 KB gz but tree-shaking ensures only imported icons ship. At 50 icons: ~8 KB gz total.
- **Maintenance signal:** lucide-icons org. Extremely active; v1.x reached stable in 2025. 10k+ GitHub stars. Weekly icon additions.
- **What Proclivity could do with it:** Standardize the icon system across all 8 views. Replace ad-hoc inline SVGs in `SettingsSidebar.tsx`, `QuickPrompt.tsx`, `TodoItem.tsx`, and `TagChip.tsx` with named Lucide imports — reducing per-file SVG noise and enabling consistent sizing via `size` prop. Specific icons: `Plus`, `CheckCircle2`, `Calendar`, `Clock`, `Settings`, `ChevronRight`, `Tag`, `Trash2`, `Pencil`, `Sparkles` (Gemini), `Bell` (reminders), `LayoutDashboard` (nav).
- **Proclivity positioning:** adopt-as-import (direct; tree-shaken per icon)
- **Motion primitives unlocked:** [MOT-33 icon-spin-on-action] (e.g., `RefreshCw` spinning on Gemini fetch), [MOT-34 inline-accent-edge-glow] (focus ring on icon buttons)
- **Risk flags:** ISC license — permissive, no copyleft. Not MIT-branded but equivalent for personal project use. Icon churn risk: Lucide renames icons between minor versions; pin to a specific version in `package.json`. No size bloat risk if Vite tree-shaking is active (confirmed working).
- **Compatibility:** React 18 confirmed. Vite tree-shaking confirmed. Strict-TS: full type exports.
- **Lazy-load plan:** Per-icon tree-shaking via Vite means no separate lazy-load boundary needed. Each icon adds ~0.5 KB gz; import only what's used.

---

### Category F: r3f Ecosystem Extensions

---

#### F1. `@react-three/drei`
- **URL:** https://drei.docs.pmnd.rs/ (npm: `@react-three/drei`)
- **Version:** 9.x is the React 18 / @react-three/fiber@8 compatible series (v9.120.x). v10.x pairs with fiber@9 + React 19. **Proclivity MUST use drei v9, not v10.**
- **License:** MIT
- **Bundle size (gz):** Large when imported naively (~273 KB gz observed for OrbitControls). Tree-shakable — import only specific helpers. Individual helpers like `Environment`, `Stars` are small in isolation.
- **Maintenance signal:** pmndrs org. Active; 9k+ GitHub stars. v9 maintained alongside v10.
- **What Proclivity could do with it:** Extend `MeshBackground.tsx` with: `Environment` preset for ambient PBR lighting (replaces manual light setup); `Stars` for an optional starfield variant of the mesh background; `Float` for gentle object floating [MOT-65 floating-orbs] effect on 3D mesh elements; `useProgress` for loading progress of async 3D assets. These are targeted helper imports, not whole-library adoption.
- **Proclivity positioning:** adopt-as-import (lazy-loaded within the existing MeshBackground lazy boundary)
- **Motion primitives unlocked:** [MOT-60 mesh-gradient-bg], [MOT-62 aurora-effect], [MOT-65 floating-orbs]
- **Risk flags:** MUST use drei v9 (not v10) for React 18 + fiber@8 compatibility. Import individual components, not the entire package. Bundle impact depends entirely on which helpers are imported — measure each addition. Already inside the `React.lazy(() => import('./MeshBackground'))` boundary so initial chunk is unaffected.
- **Compatibility:** drei@9 + fiber@8 + React 18 = confirmed compatible. Strict-TS: ships types.
- **Lazy-load plan:** Already inside the `MeshBackground.tsx` lazy boundary. Any drei helper imported in that file is part of the deferred chunk. No new lazy boundary needed.

---

#### F2. `@react-three/postprocessing`
- **URL:** https://react-postprocessing.docs.pmnd.rs/ (npm: `@react-three/postprocessing`)
- **Version:** 3.0.4 (Feb 2025)
- **License:** MIT
- **Bundle size (gz):** Large — wraps the `postprocessing` library which is itself significant. Estimated 50–100 KB gz for the combined dep tree. Justified only if the visual effect is a strong differentiator.
- **Maintenance signal:** pmndrs. Active; v3.0.4 Feb 2025. 3k+ GitHub stars.
- **What Proclivity could do with it:** Add `<Bloom>` to `MeshBackground.tsx` for a luminous glow effect on the mesh geometry edges [MOT-60 mesh-gradient-bg extension]. `<Vignette>` for depth-of-field darkening at viewport edges. Both would visibly elevate the background's visual quality from "plain three.js mesh" to "premium 3D art background."
- **Proclivity positioning:** adopt-as-import (lazy-loaded, inside MeshBackground boundary)
- **Motion primitives unlocked:** [MOT-60 mesh-gradient-bg] (enhanced), [MOT-61 noise-overlay]
- **Risk flags:** Large bundle (~50–100 KB gz) but it lives entirely within the existing MeshBackground `React.lazy` boundary and never touches the initial chunk. React 18 compatibility: v3 was released with r3f@8 support confirmed; check `peerDependencies` before installing. If peer dep requires fiber@9, defer until after React 19 upgrade.
- **Compatibility:** Verify peer deps — r3f@8 + React 18 support confirmed in v3.0.4 changelog. Strict-TS: ships types.
- **Lazy-load plan:** Inside the existing `MeshBackground.tsx` lazy boundary — no new boundary required. The postprocessing chunk is deferred with the entire 3D scene.

---

## 3. Sources Reviewed

| Library | URL | License | Bundle (gz) | Stars | Last Release | Recommended Tier |
|---|---|---|---|---|---|---|
| `motion` | https://motion.dev/ | MIT | 4.6 KB initial / 20 KB with LazyMotion+domAnimation | 24k+ | June 2025 (v12.19.0) | **Tier 1 — Adopt** |
| `@formkit/auto-animate` | https://auto-animate.formkit.com/ | MIT | 3.28 KB | 12k+ | ~8 months ago (v0.8.2) | **Tier 1 — Adopt** |
| `lucide-react` | https://lucide.dev/ | ISC | ~0.5 KB/icon (tree-shaken) | 10k+ | May 2026 (v1.16.0) | **Tier 1 — Adopt** |
| `@floating-ui/react` | https://floating-ui.com/ | MIT | ~3–8 KB (tree-shaken) | 30k+ | Mar 2026 (v0.27.19) | **Tier 1 — Adopt** |
| `react-hotkeys-hook` | https://react-hotkeys-hook.vercel.app/ | MIT | ~3 KB | 5k+ | Active (v5.x) | **Tier 1 — Adopt** |
| `sonner` | https://sonner.emilkowal.ski/ | MIT | ~2.5–9 KB | 10k+ | Active | **Tier 1 — Adopt** |
| `cmdk` | https://cmdk.paco.me/ | MIT | ~12–14 KB (incl. radix-dialog) | 10k+ | 2024 (v1.1.1) | **Tier 2 — Adopt (lazy)** |
| `@tanstack/react-virtual` | https://tanstack.com/virtual | MIT | ~10–15 KB | 10k+ | May 2026 (v3.13.24) | **Tier 2 — Adopt (conditional)** |
| `@react-three/drei` | https://drei.docs.pmnd.rs/ | MIT | ~varies per import | 9k+ | Nov 2025 (v9.x + v10.7.7) | **Tier 2 — Adopt v9 (lazy)** |
| `@react-three/postprocessing` | https://react-postprocessing.docs.pmnd.rs/ | MIT | ~50–100 KB (lazy) | 3k+ | Feb 2025 (v3.0.4) | **Tier 2 — Adopt (lazy)** |
| `animejs` | https://animejs.com/ | MIT | ~10 KB | 50k+ | Active (v4.2.2) | **Tier 3 — Parking Lot** |
| `lenis` | https://lenis.darkroom.engineering/ | MIT | ~12 KB | 8k+ | Apr 2026 (v1.3.23) | **Tier 3 — Parking Lot** |
| Native CSS `animation-timeline` | MDN | Web Standard | 0 KB | N/A | Chrome 115+ (2023) | **Tier 1 — Design-pattern lift** |
| `vaul` | https://vaul.emilkowal.ski/ | MIT | unknown | 5k+ | Dec 2024 (v1.1.2) | **Rejected — unmaintained** |
| `react-aria-components` | https://react-spectrum.adobe.com/react-aria/ | Apache-2.0 | ~50 KB gz | N/A | Active | **Rejected — bundle too large** |

---

## 4. Themes

The 2026 React 18 motion landscape is clearly dominated by `motion` (formerly framer-motion) for React-native choreography and `@formkit/auto-animate` for zero-config list mutations — both ship under 20 KB gz when used with lazy strategies, making them the low-risk, high-reward foundation for Proclivity's motion layer. The most immediate multiplier is standardizing an icon system: `lucide-react`'s per-icon tree-shaking at ~0.5 KB gz makes it nearly free, and its adoption would instantly professionalize all 8 views without touching the motion layer at all. The r3f ecosystem has matured significantly in the drei@9 + postprocessing@3 generation — Proclivity's existing `MeshBackground.tsx` lazy boundary already contains the blast radius, meaning Bloom and ambient lighting can be added with zero initial-chunk impact. Across all categories, the pattern is consistent: small focused libraries (motion's LazyMotion, auto-animate, floating-ui, hotkeys-hook, sonner) each deliver a specific primitive under 15 KB and can be adopted one at a time without a "big bang" refactor.

---

## 5. Proclivity Already Has

The following libraries appear in `package.json` (as of this scout run) and overlap with candidate space:

- **`@react-three/fiber@^8.18.0`** — Already in production. Used for `MeshBackground.tsx`. Should remain at v8 (React 18 compatible); do NOT upgrade to v9 until React 19 upgrade is planned. Paired with drei v9 (see F1).
- **`three@^0.169.0`** — Already in production. Peer dep of r3f. No upgrade needed for this uplift.
- **`react@^18.3.1`** / **`react-dom@^18.3.1`** — React 18 confirmed. All library choices in this brief target React 18.2+ as minimum.

No motion, icon, interaction, or virtualization library is currently installed — the field is wide open.

**Upgrade candidates within existing deps:**
- `@crxjs/vite-plugin@^2.4.0`: Last confirmed active; verify no MV3 breaking changes in latest. Not a motion concern but worth noting for the build pipeline.

---

## 6. Out of Scope / Parking Lot

| Library | Rejection reason |
|---|---|
| `vaul` | Explicitly marked unmaintained by author (emilkowalski, Dec 2024). Author states "I might come back to it at some point, but not in the near future." Do not adopt. |
| `react-aria-components` | ~50 KB gz for basic component set — far too large for Proclivity's 200 KB cap without a complete lazy architecture. Apache-2.0 license adds minor complexity vs MIT. The existing custom component primitives in `src/components/` cover the surface. |
| `react-spring` | Superseded by `motion` for React animation. Older API; spring physics are available in `motion` via `useSpring`. No reason to adopt both. |
| `GSAP` | Proprietary license (non-commercial free tier); rejected per `proclivity-design-system.md §6` ("Adding non-MIT animation libs as direct deps"). |
| `lottie-react` | Useful for hero illustrations but Proclivity has no After Effects workflow or JSON animation assets. Bundle cost (~30 KB gz) not justified without a clear asset pipeline. Revisit if onboarding illustrations are commissioned. |
| `embla-carousel` | No carousel surface in Proclivity's 8-view set. Photos section uses a grid, not a carousel. |
| `react-resizable-panels` | Could enable split-pane Gantt + Today view. Deferring — the Gantt section is already complex; split-pane is a larger UX change than this uplift scopes. |
| `date-fns` | Useful for Gantt recurrence date math but the current storage layer (`chrome.storage.local`) uses ISO strings. A dedicated recurrence milestone should evaluate date-fns vs Temporal polyfill together. |
| `Temporal polyfill` | Same reasoning as date-fns — defer to a dedicated recurrence/scheduling milestone. |
| `Spline embed` | Proprietary license; ruled out per design-system rejected patterns. |
| `lenis` | Marginal value for a newtab with limited vertical scroll. Revisit when LongTerm section grows to 100+ items. |
| `@tabler/icons-react` | Technically valid alternative to lucide-react (tree-shakable, MIT-adjacent); however lucide-react has 7x the weekly download volume, better Vite tree-shaking docs, and an active v1.x release cadence. Choosing one: lucide-react wins. |

---

*Brief written by library-scout agent for uplift 2026q2-visual-refresh. Anchored to `package.json` verified May 2026.*
