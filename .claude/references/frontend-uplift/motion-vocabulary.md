# Motion + visual-effect vocabulary

**Purpose:** a curated reference so every scout speaks the same language when proposing motion / animation / parallax / interaction upgrades.  Cite by name (e.g. `[MOT-3 stagger-reveal]`) in briefs and synthesis catalogs.

This file is loaded by scouts and by the synthesizer at phase start.  It is NOT a tutorial — it's a vocabulary table.

**Reduced-motion baseline (load-bearing):** Proclivity's `src/newtab/index.css` already includes a `@media (prefers-reduced-motion: reduce)` block that disables most animation.  EVERY proposal in this vocabulary must honor that block.  When proposing a new pattern, the brief MUST cite the reduced-motion fallback (typically: animate only inside `@media (prefers-reduced-motion: no-preference)`).

---

## 1. Entry / exit primitives

| ID | Name | Description | When to use | Reduced-motion requirement |
|---|---|---|---|---|
| MOT-1 | `fade-in` | Opacity 0 → 1 over 200–400ms | Default for any element appearing in-place | Wrap in `@media (prefers-reduced-motion: no-preference)` OR use `transition: opacity` which the reduced-motion block neutralizes |
| MOT-2 | `fade-up` | Opacity 0→1 + `translateY(8px → 0)` over 250–400ms | Section-headings appearing on first load | Same; reduced-motion users get the final state instantly |
| MOT-3 | `stagger-reveal` | Sequence of `fade-up` with 50–80ms inter-item delay | Today / Sprint / LongTerm todo lists landing on the screen | Framer Motion `staggerChildren`; or pure-CSS delays nested in `@media (no-preference)` |
| MOT-4 | `scale-in` | Opacity 0→1 + `scale(0.96 → 1)` over 200–300ms | Modal / popover entry (TodoEditModal, settings modal) | Pair with backdrop fade |
| MOT-5 | `slide-from-edge` | `translateX(±100% → 0)` over 250–350ms | Drawer / sheet entry (if added) | Always honor reduced-motion |
| MOT-6 | `dissolve` | Cross-fade between two elements in the same slot | Section switches (Today ↔ Sprint), tab content swaps | `AnimatePresence` |

## 2. Continuous / ambient motion

| ID | Name | Description | When to use | Caveats |
|---|---|---|---|---|
| MOT-10 | `breathing-glow` | Box-shadow or opacity slow pulse, 2–4s loop | Live indicators (alarms armed, sync state) | Cap intensity; respect reduced-motion |
| MOT-11 | `gradient-shift` | Hue rotation or conic-gradient angle drift, 8–20s loop | Background mesh accents, status badges | GPU-friendly; pause off-screen via IntersectionObserver |
| MOT-12 | `cursor-tracking-spotlight` | Radial gradient that follows pointer | Premium feature cards | Disable on touch / reduced-motion |
| MOT-13 | `skeleton-shimmer` | Diagonal sheen across skeleton bg | Loading placeholders | Use only where Proclivity actually shows skeletons; not a license to add them everywhere |
| MOT-14 | `tick-flash` | Brief color flash on numeric / status value change | Reminder armed, todo completed, sprint progress update | Tasteful; cap intensity |

## 3. Scroll-driven

| ID | Name | Description | Implementation | When to use |
|---|---|---|---|---|
| MOT-20 | `parallax-bg` | Background layer moves slower than foreground | Native CSS `animation-timeline: scroll()` OR Framer `useScroll` | Decorative MeshBackground extension ONLY; don't apply to data sections |
| MOT-21 | `progress-bar-by-scroll` | Sticky header gets a progress bar reflecting scroll position | `useScroll` + `motion.div` | Long content surfaces (LongTerm with >50 items) |
| MOT-22 | `pinned-section-reveal` | Section pins while inner content scrolls | GSAP ScrollTrigger or CSS sticky | Onboarding flow, capability showcases (if added) |
| MOT-23 | `scroll-triggered-counter` | Number counts up when an element enters viewport | Framer `useInView` + `motion.span` | Welcome screen metrics (active sprint count, etc.) |

## 4. Pointer / hover / focus

| ID | Name | Description | When to use |
|---|---|---|---|
| MOT-30 | `lift-on-hover` | `translateY(-2px)` + shadow elevation | Interactive cards (todo items, reminders) |
| MOT-31 | `magnetic-cursor` | Element nudges toward cursor within X px | Marketing CTAs ONLY — NEVER on operational buttons (accidental-click risk on Complete / Delete) |
| MOT-32 | `border-on-hover` | Border color shift or gradient-border reveal | Settings panel rows, card-style buttons |
| MOT-33 | `icon-spin-on-action` | Refresh / loading icons rotate 360° once on action trigger | Refresh buttons, retry buttons |
| MOT-34 | `inline-accent-edge-glow` | Subtle accent border / outline glow on focus-visible | Accessibility-required focus rings (NOT decorative) |

## 5. Drag / gesture

| ID | Name | Description | When to use | Caveat |
|---|---|---|---|---|
| MOT-40 | `drag-to-reorder` | List items dragged with rearranging visual feedback | Today/Sprint/LongTerm todo reorder, gantt bar reorder | Pair with auto-animate or Framer's `Reorder` |
| MOT-41 | `swipe-to-action` | Touch gesture revealing actions per row | Mobile reminder rows (if mobile becomes a target) | Mobile-only; desktop equivalent is hover-revealed action buttons |
| MOT-42 | `drag-to-calendar` | Drag a todo onto a Gantt timeslot | Gantt section: time-block a task | Sunsama / Akiflow pattern |
| MOT-43 | `drag-time-scrubber` | Horizontal drag scrubs a timeline | Gantt timeline navigation | Pair with HiDPI cursor signal |

## 6. View-transition / section-switch primitives

| ID | Name | Description | When to use |
|---|---|---|---|
| MOT-50 | `section-fade` | Cross-fade between section tabs (Today → Sprint) | Default for section switches |
| MOT-51 | `shared-element-transition` | Element morphs from list-card to detail-modal position | Todo card → TodoEditModal |
| MOT-52 | `view-transitions-api` | Native `document.startViewTransition` | Browser-supported; pair with framer fallback |

## 7. Decorative / brand-feel

| ID | Name | Description | When to use | Caveat |
|---|---|---|---|---|
| MOT-60 | `mesh-gradient-bg` | SVG / WebGL mesh gradient | Hero / settings header backgrounds | Proclivity already has @react-three/fiber mesh — extend rather than replace |
| MOT-61 | `noise-overlay` | Subtle SVG-noise texture over gradient | Background warmth | 2-4% opacity max |
| MOT-62 | `aurora-effect` | Multi-layer radial gradients animating opacity | Optional theme variant | Off by default with reduced-motion |
| MOT-63 | `border-beam` | Animated gradient sweeping along a card border | Highlighted card / "what's new" badge | Cap to 1–2 instances per viewport |
| MOT-64 | `dot-grid-bg` | Subtle dot grid background | Settings / empty-state surfaces | Pair with cursor-tracking spotlight |
| MOT-65 | `floating-orbs` | Blurred gradient orbs drifting behind content | Cold-load warmth | Pause off-screen; GPU-cheap |

## 8. Anti-patterns (do NOT propose)

| ID | Name | Why it's an anti-pattern |
|---|---|---|
| MOT-NO-1 | `bouncy easing on data values` | Bouncy/elastic curves on planning values look like the UI is unstable — disrupts trust |
| MOT-NO-2 | `parallax on the Today / Sprint / Gantt sections` | Users want stillness on planning surfaces; parallax causes motion sickness reports and obscures data |
| MOT-NO-3 | `auto-rotating carousel for plannable content` | Users must control what they see; auto-advance loses information |
| MOT-NO-4 | `magnetic-cursor on operational buttons` | Complete / Delete / Snooze buttons must NOT move toward the cursor — accidental-click risk |
| MOT-NO-5 | `continuous animation without prefers-reduced-motion fallback` | A11y regression — categorically rejected per `index.css` baseline |
| MOT-NO-6 | `confetti / celebration on completing every todo` | Tone mismatch — Proclivity is a calm planning surface, not a gamified to-do app.  A *subtle* once-per-day milestone effect could be in scope; tighten to that. |
| MOT-NO-7 | `motion that fires on every render` | Component-level remount-driven animation feels broken when state changes; tie animations to explicit triggers (visibility, user action) |

---

## How to cite in a brief or candidate

In a scout brief, when proposing an upgrade that uses one of these primitives, cite it by ID + name:

> "On the cold-load Today section, replace the static fade with `[MOT-3 stagger-reveal]` paired with `[MOT-65 floating-orbs]` for ambient warmth.  Both gated by `@media (prefers-reduced-motion: no-preference)` per the index.css baseline."

In the Phase 2 synthesis catalog, each candidate's "Sketch" section calls out the motion primitives it composes:

> **Sketch:** Apply `[MOT-3 stagger-reveal]` to the TodoList children with 60ms inter-item delay; pair with `[MOT-50 section-fade]` between tab changes.  Use Framer Motion's `AnimatePresence` + `staggerChildren`, lazy-loaded via `React.lazy` to stay under the 200 KB initial-chunk budget.

This shared vocabulary is the load-bearing thing that lets the synthesizer dedupe across scout briefs ("library-scout cites Framer Motion; visual-scout cites *fade-up on todo cards*; both are pointing at `[MOT-3 stagger-reveal]`").
