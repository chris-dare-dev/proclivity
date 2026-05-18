# Frontend-uplift source registry

**Purpose:** the curated list of sources each scout reaches for first.  Update here when a new platform / library / pattern proves valuable.  Loaded by individual scouts at Phase 1 start.

Keep entries one-line-per-source so a scout can grep this file for relevant rows when narrowing focus.

---

## 1. Visual / motion / interaction inspiration (2026 SOTA)

Studied by the **inspiration-scout** (and skimmed by the **visual-scout** when looking for "what does *good* look like in 2026").

| Platform | URL | Why it matters | Notable patterns to study |
|---|---|---|---|
| Linear | https://linear.app/ | Best-in-class B2B SaaS visual language | Inertial scroll, command-palette ergonomics, smart-list density, micro-animation tempo, dark-first design tokens |
| Vercel Dashboard | https://vercel.com/dashboard | Deploy/observability dashboard SOTA | Skeleton choreography, status pills, gradient-on-hover, syntax-highlighted code, tab-driven detail panels |
| Stripe Docs | https://docs.stripe.com/ | Reference for technical documentation + sidebar nav | Sticky-header-with-scroll-progress, language-tab persistence, inline copy-to-clipboard, signposting |
| Cron / Notion Calendar | https://calendar.notion.so/ | Native-feeling web app | Smooth pane transitions, keyboard-driven flows, drag interactions, time-grid responsiveness |
| Things 3 (Cultured Code) | https://culturedcode.com/things/ | Best-in-class personal task UX | Magic Plus button, Today vs Upcoming, project review flow |
| Sunsama | https://sunsama.com/ | Daily-plan ritual + time-blocking | Drag-to-calendar pattern, daily plan checklist, focus mode |
| Akiflow | https://akiflow.com/ | Triage-to-calendar flow | Command palette, keyboard nav |
| Arc Browser site | https://arc.net/ | Marketing-grade visual storytelling | Scroll-driven section reveals, parallax with restraint, video-in-place |
| Apple Vision OS landing | https://www.apple.com/apple-vision-pro/ | Reference for hero motion + parallax | Multi-layer parallax, scroll-locked storytelling, depth-of-field cues |
| Stripe.com home | https://stripe.com/ | Gradient + animated hero patterns | SVG-mesh gradients, hue-shift loops, animated geometric primitives, conic-gradient backgrounds |
| Raycast | https://www.raycast.com/ | Best-in-class command palette + extension UI | Cmd-palette ergonomics, keyboard-driven flows, settings density |
| Notion | https://www.notion.so/ | Block-based personal planner | Slash-menu, calendar/kanban views, settings density |
| Tabliss (OSS reference) | https://tabliss.io/ | OSS new-tab — direct visual peer | Modular widgets, configurability, theme switching |
| Momentum Dashboard | https://momentumdash.com/ | New-tab "single focus" reference | Daily focus prompt, quote-of-day, big background photo |
| Loom | https://www.loom.com/ | Subtle motion + thumbnail loading | Image fade-in choreography, hover-preview videos, low-jank skeleton patterns |
| Figma | https://www.figma.com/ | Cursor-driven UX + collaborative state | Real-time presence indicators, ghost cursors, smooth zoom/pan inertia |

**Mining heuristic:** WebFetch each platform's **public marketing pages + product changelogs + design-blog posts**.  Avoid auth-walled UI screenshots in your brief (they're hard to verify); cite public assets.

---

## 2. Modern frontend libraries (animation, motion, interaction)

Studied by the **library-scout**.  License + bundle-size + maintenance signal cited per project.  **Critical context: Proclivity is on React 18 (not 19), Vite, plain CSS (no Tailwind), no shadcn, and targets ≤200 KB initial newtab chunk per `CLAUDE.md`.**  Heavy libs MUST lazy-load.

### Animation / motion

| Library | URL | License | Why study it | Proclivity positioning |
|---|---|---|---|---|
| Framer Motion / Motion | https://www.framer.com/motion/ , https://motion.dev/ | MIT | De-facto React motion library — `motion.div`, `AnimatePresence`, layout animations | Major candidate; ~25KB gz with LazyMotion ~5KB; pairs cleanly with React 18 |
| Motion One | https://motion.dev/ | MIT | Smaller bundle alternative; native-CSS-animation under the hood | Lean alternative when Framer Motion bundle is the concern |
| GSAP | https://gsap.com/ | proprietary (free tier for non-commercial uses) | Industry-grade timeline + scroll-driven animations | Powerful but license-watch; reach for it only when Framer Motion can't do scroll-trigger sequencing |
| Lottie / lottie-react | https://airbnb.io/lottie/ | MIT | After-Effects JSON animations | Lazy-load only; for hero illustrations / loading states |
| Anime.js v4 | https://animejs.com/ | MIT | Lightweight imperative animation lib | Alternative to GSAP without the licensing surface |
| auto-animate | https://github.com/formkit/auto-animate | MIT | One-line zero-config list/grid animations | Drop-in upgrade for Today/Sprint/LongTerm list reorders |
| react-spring | https://www.react-spring.dev/ | MIT | Physics-based React animation | Older option vs Framer Motion; mostly superseded |

### Scroll-driven / parallax

| Library | URL | License | Why study it |
|---|---|---|---|
| Native CSS scroll-driven animations | https://developer.mozilla.org/en-US/docs/Web/CSS/animation-timeline | (web standard) | Modern browsers ship `animation-timeline: scroll()` — bundle-free parallax |
| Lenis | https://github.com/darkroomengineering/lenis | MIT | Smooth-scroll engine used by Linear / Arc | Inertial scroll feel; integrates with GSAP / Framer Motion |

### Three.js / WebGL (Proclivity already uses @react-three/fiber for the mesh background)

| Library | URL | License | Why study it |
|---|---|---|---|
| @react-three/fiber | https://r3f.docs.pmnd.rs/ | MIT | Already in Proclivity (`MeshBackground.tsx`) — verify version cadence |
| drei | https://github.com/pmndrs/drei | MIT | r3f helpers (cameras, controls, primitives) | Always pair with r3f |
| postprocessing | https://github.com/pmndrs/postprocessing | Zlib | Postprocessing pipeline for r3f scenes |
| Spline embed | https://spline.design/ | proprietary embed | Designer-friendly 3D scenes | Lower-effort 3D for the background — note non-MIT license |

### Layout / utility / interaction

| Library | URL | License | Why study it |
|---|---|---|---|
| @floating-ui/react | https://floating-ui.com/ | MIT | Tooltip/popover/menu positioning |
| react-aria / react-stately | https://react-spectrum.adobe.com/react-aria/ | Apache-2.0 | Adobe's accessible behavior hooks |
| cmdk | https://cmdk.paco.me/ | MIT | Linear-style command palette |
| Sonner | https://sonner.emilkowal.ski/ | MIT | Toast notifications |
| vaul | https://vaul.emilkowal.ski/ | MIT | Drawer component (mobile-first) |
| react-hot-keys-hook | https://github.com/JohannesKlauss/react-hotkeys-hook | MIT | Declarative keyboard shortcuts |
| date-fns / Temporal polyfill | https://date-fns.org/ , https://github.com/js-temporal/temporal-polyfill | MIT / Apache-2.0 | Date math for Gantt / recurrence / reminders |
| @tanstack/virtual | https://tanstack.com/virtual | MIT | Virtualization for long task lists |
| react-resizable-panels | https://github.com/bvaughn/react-resizable-panels | MIT | Split-pane layouts |
| @tabler/icons-react | https://tabler-icons.io/ | MIT | Icon set; Proclivity does not currently standardize an icon system |
| Lucide React | https://lucide.dev/ | ISC | Alternative icon library |

### Build / DX

| Tool | URL | License | Why study it |
|---|---|---|---|
| @crxjs/vite-plugin (in use) | https://github.com/crxjs/chrome-extension-tools | MIT | MV3 build for Vite — already in Proclivity; verify cadence |
| chrome-types | https://github.com/GoogleChrome/chrome-types | Apache-2.0 | Chrome API TypeScript types |
| Vitest | https://vitest.dev/ | MIT | Vite-native test runner — Proclivity doesn't currently run tests |
| @testing-library/react | https://testing-library.com/ | MIT | Standard React testing utilities |
| Playwright | https://playwright.dev/ | Apache-2.0 | E2E browser testing |

---

## 3. Proclivity codebase orientation (read first by every scout)

| Path | What it is |
|---|---|
| `/CLAUDE.md` | Top-level project conventions; branch rules; "what agents must not do" |
| `/.claude/CLAUDE.md` | Project-scope agent instructions |
| `/src/newtab/App.tsx` | Top-level React entry; section composition |
| `/src/newtab/App.css` , `/src/newtab/index.css` | Newtab-scoped styles |
| `/src/styles/theme.css` | Design tokens (--bg, --panel, --text, --accent, --danger, --warn, --ok, spacing scale) |
| `/src/sections/` | Today / Sprint / LongTerm / Gantt / Reminders / Photos / Calendar / TodoList |
| `/src/components/` | Shared components (Modal, MeshBackground, QuickPrompt, TodoItem, TagChip, etc.) |
| `/src/components/settings/` | Settings modal + panes |
| `/src/storage/storage.ts` , `/src/storage/useStore.ts` | chrome.storage.local wrapper + hook |
| `/src/background/service-worker.ts` | Alarms + notifications |
| `/src/llm/` | Gemini integration |
| `/package.json` | Current frontend deps + version pins |
| `/tsconfig.json` | Strict mode baseline (`strict: true`, `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`) |

The **current-state-critic** owns end-to-end traversal of these.  Other scouts skim them, then focus externally.

---

## 4. Canonical 8-view set for the visual scout

When `views_to_walk` is empty (the default), the visual scout drives the newtab through these states in order.  All states live on the single `chrome-extension://…/src/newtab/index.html` page — these are section / modal states, not separate routes.

1. `today` — Today section (cold-load state with no todos OR with a representative set)
2. `sprint` — Sprint section (active sprint view)
3. `long-term` — LongTerm section
4. `gantt` — Gantt section (timeline rendering)
5. `reminders` — Reminders section (list + creation flow)
6. `settings-general` — Settings modal open at the "general" pane
7. `settings-appearance` — Settings modal open at the "appearance" pane (theme controls)
8. `modal-todo-edit` — TodoEditModal open over a representative section

For each state, the visual scout captures:
- A **viewport screenshot** at 1440×900
- A **mobile / narrow screenshot** at 390×844 (iPhone 12 viewport) — note Proclivity is currently desktop-first; capture so the critic can flag the gap
- A **DOM snapshot** of the primary content
- A **console-log dump** (errors / warnings)
- Recent **network-request summary**

User override via `--views "today,sprint"` replaces this list verbatim.

---

## 5. Hard rules (every scout)

- **License citation is mandatory** for every library / OSS reference.
- **Bundle-size cited** when proposing a new runtime dep (cite the `bundlephobia.com` or published library docs reading).
- **Initial-chunk discipline:** Proclivity's initial newtab chunk targets ≤200 KB per `CLAUDE.md`.  Any new dep >50 KB MUST cite a lazy-load story (`React.lazy + Suspense`).
- **React 18 compatibility check** is non-negotiable.  React 19-only libs are OUT until Proclivity upgrades.
- **Strict-TS compatibility** required (`strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`).
- **Reduced-motion respect:** every animation proposal MUST honor `@media (prefers-reduced-motion: reduce)`.  The `index.css` baseline currently disables most motion under the reduced query — new motion proposals must extend that pattern.
- **Accessibility-first:** proposals that regress WCAG 2.1 AA contrast, keyboard nav, screen-reader semantics get downgraded in priority.
- **No vendor-blog hype.**  Weight a source by primary evidence (changelog, docs, GitHub release notes).  Marketing pages alone are weak signal.
- **No code in briefs.**  Scouts write briefs; implementation happens later via `/milestone-pipeline`.
- **Local-only respect.**  Patterns requiring a hosted endpoint / cross-device sync are categorical non-starters per `CLAUDE.md`.
