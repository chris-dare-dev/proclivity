# Visual Scout Brief — 2026q2-visual-refresh

**Uplift ID:** 2026q2-visual-refresh
**Scout:** visual-scout
**Date:** 2026-05-20
**Screenshots:** `.claude/notes/frontend-uplifts/2026q2-visual-refresh/screenshots/` (16 images, 8 views × desktop + mobile)
**Tool path:** Playwright headless Chromium (fallback — `mcp__Claude_Preview__*` not available in this session; dev server at localhost:5173 confirmed reachable)

---

## TL;DR

The three most impactful visual gaps in Proclivity are: (1) **abrupt, zero-animation section switching** — every tab change is an instant content swap with no cross-fade or transition, in stark contrast to 2026 SOTA planners like Linear and Cron; (2) **the sprint section's dense information hierarchy is visually undifferentiated** — sprint header, goal, progress bar, and task list share the same flat panel surface without the visual depth layering that makes similar views readable on Things 3 or Notion; and (3) **the header clock at 56 px is visually dominant relative to the greeting and date**, making the cold-load experience feel more like a clock widget than a planning surface. Overall visual-coherence rating: **6 / 10** — the design system is consistently applied and tokens are used correctly throughout, but almost every surface is static (zero entry animation, no hover motion beyond border-color changes, hard-cut tab switches), which reads as unfinished relative to the 2026 SOTA baseline.

---

## Per-view observations

### 1. `today` — Today section

The Today view (`today-desktop.png`, `today-mobile.png`) renders correctly with the mesh background, greeting header, tabs, and a clean card-per-todo list. The mesh background (`MeshBackground.tsx`) renders at full canvas size and is visually compelling. Three todos are visible with `--panel` card backgrounds and `--border` outlines. The `todo-edit` pencil button is invisible at rest (opacity:0 per `sections.css:65`) — fully correct behavior. At 390 px the header stack-wraps but the large clock (`56px` / font-weight 300) dominates the viewport at mobile, pushing the tab row uncomfortably low.

**Gaps found:**
- G-1 (HIGH): No entry animation on todo items — flat, static list on every tab load
- G-2 (MEDIUM): Clock visual weight imbalance at mobile
- G-3 (LOW): Empty-state card ("No tasks for today yet") is a plain dashed-border box with no illustrative content

**Screenshots:** `today-desktop.png`, `today-mobile.png`

---

### 2. `sprint` — Sprint section

The Sprint view (`sprint-desktop.png`, `sprint-mobile.png`) shows a rich surface: sprint-tab sub-navigation, sprint header card, progress bar, goal text, and task list. The sprint header (`sprint-header`) uses a `--panel` card with a `--border` outline — the same styling as every other panel in the app. The progress bar is a flat filled rectangle with no animation. The "Day 8 of 15" text and "0/3 tasks done" label sit on one row at small font size. On mobile, the sprint tab chip (accent-filled pill) is the only visual affordance distinguishing the active sprint — a good pattern, but it disappears at wider viewports in favor of a text-style sub-tab. No animation fires when switching from Today → Sprint (hard cut).

**Gaps found:**
- G-4 (HIGH): No section-switch animation (section-switch is instant hard-cut across all tab changes)
- G-5 (MEDIUM): Sprint progress bar is flat/static with no enter-animation and no visual "fill" motion on load
- G-6 (MEDIUM): Sprint header card has no visual elevation differentiation from the task list cards — the whole view reads as one flat level
- G-7 (LOW): "0/3 tasks done" progress label uses plain small text — no visual weight to communicate progress state

**Screenshots:** `sprint-desktop.png`, `sprint-mobile.png`

---

### 3. `long-term` — LongTerm section

The Long-term view (`long-term-desktop.png`, `long-term-mobile.png`) is visually identical to Today in layout — same `todo-input` + `todo-list` pattern, same card styling, same static appearance. The input placeholder reads "A goal or initiative…" which is the only semantic differentiator from Today. No visual cue differentiates a "long-horizon initiative" from a "today task" other than the placeholder string. The section is visually indistinguishable from Today once populated, which may cause users to question which section they're in.

**Gaps found:**
- G-8 (MEDIUM): Long-term section is visually identical to Today — no horizon-differentiation cue (color, icon, badge, or typographic treatment)
- G-1 (HIGH): Same no-entry-animation gap as Today (shared component `TodoList`)

**Screenshots:** `long-term-desktop.png`, `long-term-mobile.png`

---

### 4. `gantt` — Gantt section

The Gantt view (`gantt-desktop.png`, `gantt-mobile.png`) shows an empty state: a plain dashed-border box reading "No Gantt charts yet." with a "Create your first chart" button. No illustration, no contextual hint about what Gantt mode does or looks like. The empty-state design system (`section-empty` in `App.css:117-123`) is minimal — dashed border, centered text, background `--panel`. The "Create your first chart" button uses the default button style (no accent fill, not primary-styled). Note: screenshots were captured in the empty state — no chart data was injected. Console logs show WebGL "GPU stall due to ReadPixels" warnings from the Three.js canvas, though these are GPU-driver performance hints, not render errors.

**Gaps found:**
- G-9 (HIGH): Empty-state is bare text + button with no illustration or contextual guidance — contrast with Notion/Linear's onboarding empty-states
- G-10 (LOW): "Create your first chart" CTA button is default-styled — should be a primary (accent-filled) action to clearly invite first use
- G-11 (LOW): WebGL console warnings (`GL Driver Message: GPU stall due to ReadPixels`) — not a visual gap per se, but indicates the Three.js render loop may be doing synchronous readbacks

**Screenshots:** `gantt-desktop.png`, `gantt-mobile.png`

---

### 5. `reminders` — Reminders section

The Reminders view (`reminders-desktop.png`, `reminders-mobile.png`) shows the Add Reminder form above the UPCOMING list. The form is a plain vertical stack: Title input, Fire-at datetime-local picker (raw browser native input — visually inconsistent with the rest of the form), Recurrence select, Link-to-todo select, Tags button, Add Reminder button. The two upcoming reminders ("Team standup", "Submit expense report") render as simple labeled rows with Delete buttons. No alarm-state visual indicator (e.g., clock icon, color badge, or pulse) distinguishes armed reminders. The datetime-local picker (`<input type="datetime-local">`) inherits platform native styling — on macOS/Chrome this is a styled input but its visual language differs from other inputs in the form.

**Gaps found:**
- G-12 (HIGH): Armed reminders have no ambient visual state — a user cannot tell at a glance whether a reminder is "countdown-live" vs. far-future
- G-13 (MEDIUM): `datetime-local` input uses native browser chrome — visually inconsistent with the other styled form inputs
- G-14 (MEDIUM): No urgency gradient or color band on near-due reminders — 2026 SOTA planners (Sunsama, Akiflow) use subtle color coding on near-due items

**Screenshots:** `reminders-desktop.png`, `reminders-mobile.png`

---

### 6. `settings-general` — Settings modal / general pane

The Settings modal (`settings-general-desktop.png`, `settings-general-mobile.png`) uses a well-structured two-column layout: 200 px sidebar with accent-left-border active indicator, content pane with section groups, sticky footer with Cancel/Done. The sidebar active state (`box-shadow: inset 3px 0 0 0 var(--accent)` per `SettingsModal.css:106`) is correct and clean. The pane switches between General/Appearance/etc. are **instant hard-cuts with no transition** — the content swaps immediately without any fade. The modal itself has a `120ms fade-in` backdrop animation and `150ms slide-in` panel animation (per `Modal.css:10-34`) — this is the only modal animation in the entire app. On mobile (390 px), the settings sidebar correctly collapses to a horizontal scroll row (per the responsive CSS at `SettingsModal.css:702-742`).

**Gaps found:**
- G-15 (MEDIUM): Settings pane switches are hard-cuts — no fade or slide between General → Appearance
- G-16 (LOW): The "Settings" title in the modal header has no icon or visual anchor — the modal reads as a generic dialog, not a structured control panel

**Screenshots:** `settings-general-desktop.png`, `settings-general-mobile.png`

---

### 7. `settings-appearance` — Settings modal / appearance pane

The Appearance pane (`settings-appearance-desktop.png`, `settings-appearance-mobile.png`) shows the theme segmented control (System/Light/Dark), accent color swatch grid (9 circles), font size control, density control, Reduce motion toggle, Mesh background toggle, and intensity slider. The accent swatch grid uses circles with `scale(1.1)` on hover (`SettingsModal.css:446`) — the only pointer-hover motion in the settings surface. The active swatch has a double-ring indicator (border + box-shadow). The color swatches on the second row include Coral, Orange-yellow, Cyan, Mint, Orange, and a rainbow conic-gradient "custom" swatch — visually the most colorful element in the entire app. The Reduce Motion toggle and Mesh background toggle use the custom `settings-toggle` pattern (36 × 20 px, `140ms` transition).

**Gaps found:**
- G-17 (MEDIUM): Accent swatch preview does not render a live preview of how the accent color changes the UI — the user must click and observe the background change
- G-18 (LOW): The color swatch row has no label ("Accent Color") visible above it on mobile — the label truncates to invisible due to small viewport + lack of wrapping

**Screenshots:** `settings-appearance-desktop.png`, `settings-appearance-mobile.png`

---

### 8. `modal-todo-edit` — TodoEditModal

The TodoEditModal (`modal-todo-edit-desktop.png`, `modal-todo-edit-mobile.png`) opens over the Today tab and shows: Title input (auto-focused, accent border on focus), Notes textarea, Scope radio group (Today/Sprint/Long-term as segmented-style labels), Tags section with "+ Add tag" trigger, Cancel/Save buttons. The modal has the `120ms fade-in` + `150ms slide-in` entry animation from `Modal.css`. The backdrop is `rgba(0,0,0,0.6)`. On mobile at 390 px the modal fills 94 vw and the scope radio row wraps correctly. The delete buttons (✕) on the todo list behind the modal are visible through the blurred/dimmed backdrop. The edit button icon is a Unicode `✎` (pencil) — not a standardized SVG icon.

**Gaps found:**
- G-19 (MEDIUM): TodoEditModal has no exit/close animation — it disappears instantly (Modal.css has `animation` on entry but not on exit; `Modal.tsx:64` returns null when `open === false` immediately)
- G-20 (MEDIUM): The scope radio group uses plain text labels ("Today", "Sprint", "Long-term") with no icon/color differentiation — the user must read carefully, especially on mobile
- G-21 (LOW): The pencil edit button icon is a Unicode character (`✎`) rather than an SVG — inconsistent with the gear/chat icons in the header which use inline SVG

**Screenshots:** `modal-todo-edit-desktop.png`, `modal-todo-edit-mobile.png`

---

## Critical gaps

None. The page renders correctly across all 8 views. No blank screens, no crashed WebGL, no broken layouts.

---

## High gaps

### H-1: No section-switch animation — all tab changes are instant hard-cuts
**Affects:** today, sprint, long-term, gantt, reminders (every tab change)
**Screenshot evidence:** `today-desktop.png` vs. `sprint-desktop.png` — switching between these states produces an instant content replacement with no visual handoff
**What a user sees:** When clicking from "Today" to "Sprint", the content area immediately replaces its entire contents without any visual continuity. There is no fade, slide, or dissolve. The effect is jarring by 2026 standards — every major B2B planner (Linear, Notion, Cron) uses at minimum a cross-fade when switching sections.
**2026 SOTA:** `[MOT-6 dissolve]` — a 200 ms cross-fade between tab panels driven by `AnimatePresence` (Framer Motion) or a CSS opacity transition pair. The `hidden` attribute on tabpanels (App.tsx:424, 433, etc.) would need to change to a visibility/opacity gate rather than DOM removal to enable CSS transitions.
**Severity:** HIGH
**Closest existing pattern:** `src/newtab/App.tsx:418-514` — tabpanel `hidden` attribute gate; `src/newtab/App.css:87-104` — tab indicator transition (120ms border-bottom only, not content transition)
**Reduced-motion:** Gated inside `@media (prefers-reduced-motion: no-preference)`; falls back to instant-swap (the current behavior) for reduced-motion users.

---

### H-2: No entry animation on todo list items — static flat presentation
**Affects:** today, sprint, long-term
**Screenshot evidence:** `today-desktop.png` — the three todo cards appear as a fully-rendered static list with no sense of arrival
**What a user sees:** On every page load or tab switch to Today/Sprint/Long-term, the todo list items appear all at once, fully opaque, with no visual choreography. Competing planners (Things 3, Sunsama) use subtle stagger-in effects on list items to create a sense of live, responsive UI. The current static appearance makes the app feel like a rendered document rather than a live planning surface.
**2026 SOTA:** `[MOT-3 stagger-reveal]` — each `li.todo-item` fades up (opacity 0→1 + translateY 6px→0) with 50ms inter-item stagger. Composable via CSS `animation-delay` scoped inside `@media (prefers-reduced-motion: no-preference)`.
**Severity:** HIGH
**Closest existing pattern:** `src/sections/sections.css:18-26` — `.todo-item` styles; `src/components/TodoItem.tsx:40` — the `<li>` render target for animation

---

### H-3: Armed reminders have no ambient visual state indicator
**Affects:** reminders
**Screenshot evidence:** `reminders-desktop.png` — the two upcoming reminders ("Team standup", "Submit expense report") appear as flat labeled rows; no clock icon, no temporal urgency, no color distinction
**What a user sees:** A reminder set for 1 hour from now looks identical to one set for 1 month from now. There is no indicator of alarm-armed state, no urgency gradient, and no visual pulse on near-due items. Users relying on visual scanning to assess urgency get zero signal.
**2026 SOTA:** `[MOT-10 breathing-glow]` — a slow (2–3s) pulse on the `--border` or a subtle background tint using a relative luminance shift of `--panel` for near-due items (within 1 hour). Color coding must use hue variation on `--accent`/`--accent-2` only — `--warn` is reserved for explicit warning state and would be appropriate for overdue reminders per the design system §2 reserved colors.
**Severity:** HIGH
**Closest existing pattern:** `src/sections/reminders/RemindersManager.tsx` (the RemindersManager component); `src/styles/theme.css:47` — `--warn` (reserved for overdue); `--accent` for near-due ambient pulse

---

### H-4: Empty states are bare text/button with no illustrative guidance
**Affects:** gantt (confirmed), likely today (no todos state)
**Screenshot evidence:** `gantt-desktop.png` — "No Gantt charts yet." in a plain dashed box; `today-desktop.png` (empty-state version from earlier capture) — "No tasks for today yet. Add one above." in a plain dashed box
**What a user sees:** First-time users landing on Gantt or Today (empty) see a plain dashed-border card with text and a default-styled button. There is no visual warmth, no illustration, no contextual hint about what the section enables. By 2026 standards (Linear, Notion, Figma), empty states are onboarding moments with illustrated intent and a clearly primary CTA.
**2026 SOTA:** Inline SVG spot illustration (budget: ~2 KB inline, zero network) + primary-styled CTA button using `background: var(--accent); color: var(--accent-on)`. The `[MOT-2 fade-up]` on the empty-state container itself when it enters the viewport.
**Severity:** HIGH
**Closest existing pattern:** `src/newtab/App.css:117-123` — `.section-empty` shared class; `src/sections/Gantt.tsx` empty-state render path

---

## Medium gaps

### M-1: Sprint progress bar is static — no entry animation or fill motion
**Affects:** sprint
**Screenshot evidence:** `sprint-desktop.png` — the progress bar ("Day 8 of 15") is a flat filled rectangle
**What a user sees:** The sprint progress bar renders instantly at its final percentage value (53% in the screenshot). No motion communicates that this is a live metric. Competitors (Jira, Linear) animate progress bars from 0% on first render.
**2026 SOTA:** `[MOT-14 tick-flash]` on first paint — progress bar fill animates from 0% to current value over 600ms, eased. Scoped to `@media (prefers-reduced-motion: no-preference)`.
**Severity:** MEDIUM
**Closest existing pattern:** `src/sections/sprint/SprintManager.tsx` — sprint header renders the progress bar; `src/sections/sprint/sprint.css` — progress bar styles

---

### M-2: Clock visual weight imbalance at mobile viewport (390 px)
**Affects:** today, sprint, long-term, gantt, reminders (header)
**Screenshot evidence:** `today-mobile.png` — the clock ("11:16 AM") renders at the equivalent of ~56 px and dominates the top-right, pushing the tab row far down. The greeting ("Good morning.") is large but the clock renders larger still.
**What a user sees:** At 390 px the header is a two-column flex row where the clock font-size (56px, weight 300) is the most visually heavy element on screen — heavier than the greeting and nearly as tall as the tab row. This is a desktop-first design that was not adapted for narrow viewports.
**2026 SOTA:** Responsive `font-size` clamp on `.clock` — e.g., `clamp(28px, 6vw, 56px)` — that scales with viewport width. The greeting and clock should share proportional dominance on mobile.
**Severity:** MEDIUM
**Closest existing pattern:** `src/newtab/App.css:35-36` — `.clock { font-size: 56px; font-weight: 300; }` — no responsive override exists

---

### M-3: Settings pane switches are hard-cuts with no transition
**Affects:** settings-general, settings-appearance (and all other panes)
**Screenshot evidence:** `settings-general-desktop.png` vs `settings-appearance-desktop.png` — the pane content replaces instantly when clicking the sidebar
**What a user sees:** Clicking a settings sidebar item (e.g., "Appearance") replaces the pane content area instantly with no visual handoff. This is the same hard-cut problem as section tabs but more conspicuous in the narrow 480 px content column.
**2026 SOTA:** `[MOT-1 fade-in]` on the active pane — 150 ms opacity transition on `.settings-pane` when the active pane id changes. Compatible with existing CSS (no new dependencies needed).
**Severity:** MEDIUM
**Closest existing pattern:** `src/components/settings/SettingsModal.css:196-198` — `.settings-pane` is the render target; the pane switch is controlled by `activePane` state in `SettingsModal.tsx`

---

### M-4: TodoEditModal has no exit animation — closes instantly
**Affects:** modal-todo-edit
**Screenshot evidence:** `modal-todo-edit-desktop.png` — the modal has entry animation but `Modal.tsx:64` returns `null` immediately when `open === false`, skipping any exit
**What a user sees:** The TodoEditModal (and all modals using the shared `Modal.tsx`) fades in with a 120ms backdrop + 150ms slide-in, but on close the entire modal tree disappears in a single frame. This asymmetry (animated in, instant out) is a well-known UX rough edge.
**2026 SOTA:** `[MOT-4 scale-in]` reversed for exit — `AnimatePresence` from Framer Motion wrapping the `Modal` portal, or a CSS class-based exit state with `animation-fill-mode: forwards`. The current `Modal.tsx` returns `null` on close without an exit phase.
**Severity:** MEDIUM
**Closest existing pattern:** `src/components/Modal.css:10-34` — entry animations; `src/components/Modal.tsx:64` — the `if (!open) return null` gate that bypasses exit

---

### M-5: Long-term section is visually identical to Today — no horizon differentiation
**Affects:** long-term
**Screenshot evidence:** `long-term-desktop.png` vs `today-desktop.png` — pixel-identical layout, same card styling, only the input placeholder differs
**What a user sees:** A user who adds tasks to both Today and Long-term cannot distinguish the sections at a glance without reading the tab label. There is no color tint, iconography, or typographic treatment that communicates "these items have a longer horizon." Competing planners (Things 3: Someday vs Today; Notion: separate databases with visual indicators) create clear visual separation between time horizons.
**2026 SOTA:** A subtle section-specific accent variant — e.g., a `--long-term-accent` tint (derived from `--accent-2`) on the section heading or a thin left-border on the card using `--accent-2` instead of `--border`. No new color tokens needed if `--accent-2` is used (currently `oklch(0.83 0.13 179)` — a teal-green distinct from the blue `--accent`).
**Severity:** MEDIUM
**Closest existing pattern:** `src/sections/LongTerm.tsx` renders `<TodoList scope="long" placeholder="A goal or initiative…">` — the `scope` prop could drive a CSS data-attribute for visual differentiation

---

### M-6: `datetime-local` input in reminders uses native browser chrome
**Affects:** reminders
**Screenshot evidence:** `reminders-desktop.png` — the "Fire at" field shows a native datetime-local picker that visually differs from the other form inputs
**What a user sees:** All other form inputs in Proclivity use the custom-styled `input` baseline from `index.css` (background: `--panel-2`, border: `--border`, border-radius: 6px). The `datetime-local` input inherits that baseline for its outer box but its internal date/time picker UI (the spinners, calendar popover) is entirely native browser — visually inconsistent on both macOS and other platforms.
**2026 SOTA:** Custom date/time input using two styled `<input type="time">` + `<input type="date">` fields side-by-side, or a lightweight date-fns-based picker (already listed in source-registry §2). This removes the native picker inconsistency without adding a heavy dependency.
**Severity:** MEDIUM
**Closest existing pattern:** `src/sections/reminders/RemindersManager.tsx` — the reminder form with `type="datetime-local"`

---

## Low gaps

### L-1: "Create your first chart" CTA is default-styled, not primary
**Affects:** gantt
**Screenshot evidence:** `gantt-desktop.png` — the button uses the default `button` style (panel-2 background, border) rather than accent-filled primary
**What a user sees:** The only action in an empty Gantt view has the same visual weight as a secondary action. It does not invite action.
**Severity:** LOW
**Closest existing pattern:** `src/components/Modal.css:88-97` — `.modal-btn-primary` (accent background) is the existing primary button pattern

---

### L-2: Edit pencil icon is a Unicode character, not SVG
**Affects:** modal-todo-edit (the edit trigger), today, sprint, long-term
**Screenshot evidence:** `modal-todo-edit-desktop.png` — the edit affordance on `TodoItem` uses `✎` (U+270E); contrast with header's inline SVG gear and chat icons
**What a user sees:** The pencil edit icon renders as a Unicode character (cross-platform rendering varies) while all header icons use carefully crafted SVG. On some systems/fonts the pencil character renders at a different visual weight than the surrounding UI.
**Severity:** LOW
**Closest existing pattern:** `src/newtab/App.tsx:268-285` — `GearIcon()` function using inline SVG with `aria-hidden="true"`; `src/components/TodoItem.tsx:69` — the `✎` character

---

### L-3: Empty-state card uses dashed border — differs from all other card borders
**Affects:** today (empty), gantt, long-term (empty)
**Screenshot evidence:** `gantt-desktop.png` — `border: 1px dashed var(--border)` on `.section-empty` visually stands out against all other `border: 1px solid var(--border)` cards
**What a user sees:** The empty state card has a dashed border that signals "placeholder / not yet real content" — which is semantically accurate but creates a visual inconsistency with the rest of the card system.
**Severity:** LOW
**Closest existing pattern:** `src/newtab/App.css:117-123` — `.section-empty` definition

---

### L-4: Sprint "0/3 tasks done" progress text has no visual weight
**Affects:** sprint
**Screenshot evidence:** `sprint-desktop.png` — the task progress label ("0/3 tasks done") is the same size and color as surrounding date labels
**What a user sees:** The sprint completion metric is visually indistinguishable from the sprint date range label. A user scanning for progress status must read rather than perceive.
**Severity:** LOW
**Closest existing pattern:** `src/sections/sprint/SprintManager.tsx` — sprint header stats area; `src/styles/theme.css:27-29` — `--accent` for progress highlight

---

## Cross-view patterns

### Pattern: Universal static presentation
Across all 8 views, the UI is completely static after initial render. No item entrance, no ambient motion, no hover lift on cards, no scroll-triggered effects. The only motions in the entire app are: (1) `120ms` modal backdrop fade-in, (2) `150ms` modal panel slide-in, (3) `120ms` border-color transitions on interactive elements, (4) the `MeshBackground` WebGL canvas (lazy-loaded, continuously animated), and (5) the `settings-badge-pulse` animation on the new-settings indicator. Everything else is instantaneous. This is a deliberate baseline (`src/newtab/index.css` has an aggressive reduced-motion suppressor) but the baseline leaves the entire UI feeling static even for users who have NOT enabled reduced motion.

### Pattern: Section-switch hard-cut (all tabs)
The `hidden` attribute pattern (`App.tsx:419-514`) means every tab switch is a DOM visibility toggle with no opportunity for CSS transition. This is the correct a11y pattern for tabpanel content (hidden is required per ARIA spec) but it blocks CSS-based transitions. A motion-capable solution needs either: (a) `AnimatePresence` wrapping each tabpanel, (b) `[MOT-52 view-transitions-api]` around the `setTab` call, or (c) a custom `is-exiting` / `is-entering` CSS class approach that defers `hidden` until the exit animation completes.

### Pattern: Consistent token usage (positive)
All color usage correctly follows the token system — no hardcoded hex values in component CSS (verified across `sections.css`, `Modal.css`, `SettingsModal.css`, `App.css`). The `--danger`, `--warn`, `--ok` semantic tokens are used exclusively for state-communication (delete button, error text, success flash) — not decoratively.

### Pattern: Mobile-unresponsive header
At 390 px, the header layout (`App.css:10-29`) flex-row stacks improperly: the 56 px clock dominates, and the greeting wraps. None of the section tabs (`App.css:81-104`) horizontally scroll at narrow viewports — tabs overflow and are clipped (visible in `today-mobile.png` where "Calendar" and "Closed" are not fully visible). This is a systemic gap that affects every view.

### Pattern: Zero drag-to-reorder
None of the todo list sections (Today, Sprint, Long-term) support drag reordering. The `todo-list` `<ul>` is a static stack with no drag affordance. This gap is visible on every list view as there is no visual indicator (grab handle, drag cursor) that reordering is possible.

---

## What Proclivity does well visually

- **Token consistency.** Every color, spacing, and typography value traces back to a CSS custom property in `src/styles/theme.css`. No rogue hex values, no magic numbers outside the scale. Light and dark themes are both fully token-driven with correct `oklch()` color values.
- **MeshBackground is a compelling differentiator.** The lazy-loaded Three.js WebGL mesh (`MeshBackground.tsx`) creates a distinctive visual identity that no other new-tab extension replicates. It renders correctly in headless Chromium (WebGL warnings noted but no crash). Its lazy-load pattern is clean — `React.lazy + Suspense with null fallback` means the planner UI is usable before the canvas loads.
- **Modal accessibility is well-implemented.** The `Modal.tsx` component correctly implements focus trap, Escape key, backdrop-click dismiss, focus-restore on close, `aria-modal`, `aria-labelledby`, and keyboard focus with `useId()`. The reduced-motion fallback in `Modal.css:99-108` correctly suppresses entry animations.
- **Settings modal responsive layout.** The `SettingsModal.css` responsive breakpoint (`max-width: 639px`) correctly collapses the sidebar from a 200 px vertical nav to a horizontal scroll row with tab-style indicators. This works at 390 px (confirmed in `settings-general-mobile.png`).
- **Todo item a11y detail.** The `todo-edit` pencil button (`sections.css:59-83`) correctly uses `opacity: 0` (not `visibility: hidden`) at rest so it remains in the tab order and a11y tree, with `pointer-events: none` preventing accidental mouse activation. This is a nuanced accessibility implementation that most UI libraries get wrong.
- **Sprint section information density is appropriate.** The sprint view surfaces goal text, date range, day-count progress, task count, and task list in a single view without feeling cramped on desktop. The sub-tab navigation for multiple sprints is a clean solution to the multi-sprint use case.

---

## Appendix: Diagnostic data

**Console warnings (captured during full-session walk):**
- 4 × `GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels` — WebGL driver warning from the Three.js render loop. Not a render error. Indicates the canvas's readback path may synchronize the GPU pipeline; relevant to performance-critic review of `MeshBackground.tsx`.

**Network errors:** None observed (4xx/5xx). All Vite assets loaded from localhost:5173.

**Slow requests (>1500ms):** None. All assets served from Vite dev server under 100ms. Three.js chunk lazy-loads on first mesh-tab visit but was not measured here.

**Tool fallback note:** `mcp__Claude_Preview__*` tools were unavailable in this session. Playwright headless Chromium (npx playwright, v1.60.0, chromium-headless-shell v1223) was used as the fallback tool. The Vite dev server was started by this agent at the session start (`npm run dev` — localhost:5173). `chrome.storage.local` is unavailable in plain Chromium; the app correctly falls back to `localStorage` (per `src/storage/storage.ts:13-21`). Mock state was injected via `context.addInitScript` to populate representative todo / sprint / reminder data before page load.
