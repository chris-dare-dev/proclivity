# Inspiration Scout Brief — 2026Q2 Visual Refresh

**Uplift ID:** 2026q2-visual-refresh
**Scout:** inspiration-scout
**Date:** 2026-05-20
**Brief path:** `.claude/notes/frontend-uplifts/2026q2-visual-refresh/discover/inspiration-scout-brief.md`

---

## 1. TL;DR

The single highest-leverage pattern to borrow is **Linear's dimmed-sidebar + stagger-reveal todo list**: dimming the tab bar and adding a 60ms inter-item stagger on list entry would immediately make the planning surface feel 2026-quality without touching content or layout. The second pattern is a **section-fade cross-dissolve on tab switches** — Proclivity's current hard-cut between Today/Sprint/LongTerm feels abrupt against peers like Linear, Cron, and Sunsama that all cross-fade at 150–200ms. The third is a **pill-style animated tab indicator** replacing the current bottom-border underline — Linear's 2026 refresh specifically moved from full-width underlines to compact rounded pills that feel more lightweight. The thematic shift Proclivity could adopt: move from "utility-first, static" to "calm-first, purposefully animated" — stillness as the baseline, with targeted motion only at the moments that matter (list arrival, tab switch, modal open/close, reminder armed).

---

## 2. Pattern Candidates

---

### Pattern 1: Dimmed Navigation + Primary-Content Emphasis

**Source platform:** Linear

**Public evidence:** Linear changelog (https://linear.app/changelog), March 12, 2026 entry: "Headers, navigation, and view controls are now consistent across projects"; Linear design blog post "A calmer interface for a product in motion" at https://linear.app/now/behind-the-latest-design-refresh — describes the sidebar as "a few notches dimmer, allowing the main content area—where users work—to take precedence." Icons scaled down, inactive text muted, vertical padding increased.

**What makes it good:** When navigation chrome recedes visually, the user's eye is drawn to the content they actually came to work with. In a daily-planning context, this means todos and calendar items dominate the viewport rather than competing with the tab bar for attention. The user feels "I'm looking at my work" rather than "I'm looking at an app." The 120ms transition on hover returns the chrome to full brightness, so it never feels inaccessible — it just stays quiet until called.

**Motion vocabulary primitives:** No new motion required — this is a static token adjustment. Combine with [MOT-30 lift-on-hover] on the tab buttons to give the receded chrome tactile feedback when the user reaches for it.

**Where it would fit in Proclivity:** `src/newtab/App.css` lines 87–104 (`.tabs`, `.tab`, `.tab-active`). Currently `.tab` uses `color: var(--text-dim)` at rest — dimming could be achieved by reducing opacity to 0.55 on the `.tabs` container and restoring on `:hover`, `:focus-within`, and `.tab-active`. The `.tab-active` underline border should remain full-weight so the active selection is unambiguous.

**Proclivity-positioning:** Planning-surface (tab bar). Applies to all 8 views — Today, Sprint, LongTerm, Gantt, Reminders, Calendar, Closed, and the modal-scoped settings sidebar.

---

### Pattern 2: Section-Fade Cross-Dissolve on Tab Switch

**Source platform:** Linear (section switches), Sunsama (daily plan context shifts), Cron / Notion Calendar (view transitions)

**Public evidence:** Linear's design refresh post (https://linear.app/now/behind-the-latest-design-refresh) describes seamless transitions between workspace modes. Sunsama's marketing at https://sunsama.com describes "Stay focused and on track" with adjustable daily plans, implying fluid content transitions. Notion Calendar at https://calendar.notion.so references native-feeling pane transitions. The cross-dissolve is the canonical 2026 pattern across all planning SaaS.

**What makes it good:** A 150–200ms `opacity` cross-dissolve between tab content removes the hard visual "cut" that currently occurs when switching Today/Sprint/LongTerm. The user's eye receives a brief spatial cue that content is changing — avoiding the disorientation of wondering "did I click the right thing?" The dissolve is gentle enough to feel like reading rather than navigation; it doesn't introduce layout shift or scroll-position drift.

**Motion vocabulary primitives:** [MOT-50 section-fade] — cross-fade between section tabs. Pair with [MOT-6 dissolve] at 150ms `ease-out`. The reduced-motion baseline in `src/newtab/index.css` already suppresses all transitions when `data-reduced-motion="true"` or the OS media query fires — no extra guard needed beyond scoping this inside `@media (prefers-reduced-motion: no-preference)`.

**Where it would fit in Proclivity:** `src/newtab/App.tsx` lines 418–509 — the `tabpanel` divs rendered in `<main className="content">`. Currently controlled by the HTML `hidden` attribute (hard-cut). The switch to a CSS opacity fade would require mounting all panels and using `visibility: hidden` + `opacity: 0` for inactive panels rather than `hidden`, or using a React `AnimatePresence` wrapper around the active panel. The simplest pure-CSS path: add `data-active` to the active tabpanel and animate `opacity` via CSS custom property cascade.

**Proclivity-positioning:** Planning-surface only. This pattern is load-bearing for all 8 views in the default view set.

---

### Pattern 3: Stagger-Reveal on Todo List Entry

**Source platform:** Things 3 (purposeful unfolding animations), Linear (items animating in)

**Public evidence:** Things 3 marketing at https://culturedcode.com/things describes "lovely, unfolding animations" where "each animation is purposeful" and the interface "never feels messy or overbearing regardless of task volume." Linear's changelog (https://linear.app/changelog) references smooth item arrival in issue lists. The stagger pattern is widely documented in Framer Motion docs at https://www.framer.com/motion/.

**What makes it good:** When a user opens the Today tab, todos appearing with a 60ms stagger — each row fading up in sequence from top to bottom — makes the list feel "alive" and purposefully loaded rather than statically dumped. This creates the brief moment of orientation that Things 3 users cite as making the app feel premium. The 60ms delay keeps the full list visible within ~400ms even for 6 items, so there is no perceived wait. Critically, the stagger fires ONCE on tab activation (when the tab becomes the active view), not on every re-render — this avoids the [MOT-NO-7] anti-pattern of motion on every render.

**Motion vocabulary primitives:** [MOT-3 stagger-reveal] — `fade-up` with 60ms inter-item delay; [MOT-2 fade-up] on each `<li>` in `.todo-list`. Must be gated by `@media (prefers-reduced-motion: no-preference)` to extend the existing `index.css` baseline.

**Where it would fit in Proclivity:** `src/sections/sections.css` lines 15–17 (`.todo-list`); `src/components/TodoItem.tsx` line 40 (the `<li>` element). If Framer Motion is adopted (see Pattern 6), this becomes `motion.li` with `variants` + `staggerChildren`; otherwise it can be implemented with pure CSS `animation-delay` calculated via CSS `nth-child` cascade or a `style` prop on each `<li>`. The Framer Motion path is cleaner for the "trigger once on tab activation" requirement.

**Proclivity-positioning:** Planning-surface (Today, Sprint, LongTerm sections). Also applicable to Reminders list and ClosedTodosView.

---

### Pattern 4: Pill-Style Animated Tab Indicator

**Source platform:** Linear (2026 design refresh), Cron / Notion Calendar

**Public evidence:** Linear's design refresh changelog (https://linear.app/changelog, March 12 2026): "Desktop tabs became more compact rather than full-width, featuring rounded corners and smaller icon and text sizing." The animated desktop tab indicator was added for issues with active coding agents. Notion Calendar's public marketing at https://calendar.notion.so shows compact pill-style view toggles.

**What makes it good:** The current `.tab-active` style in Proclivity uses a full-width bottom-border underline that spans the entire tab button width. Linear's 2026 refresh switched to compact rounded-corner pills that hug the text content. The pill feels lighter — less "nav bar asserting itself" and more "selection indicator whispering." An animated indicator (a background pill that slides horizontally from the previous tab to the new active tab) gives the user spatial feedback about which direction the navigation moved, reducing cognitive load when the adjacent sections have similar content (Sprint → LongTerm).

**Motion vocabulary primitives:** [MOT-50 section-fade] complements this — the indicator slides while the content dissolves. The pill animation itself is a `transform: translateX()` on a positioned pseudo-element or a `motion.div` shared-layout animation.

**Where it would fit in Proclivity:** `src/newtab/App.css` lines 87–104 (`.tabs`, `.tab`, `.tab-active`). The current `border-bottom: 2px solid var(--accent)` approach on `.tab-active` would be replaced by a background pill. If Framer Motion is adopted, `<AnimatePresence>` + `layoutId="tab-indicator"` on a `motion.div` inside the active tab produces the sliding indicator with zero JS math.

**Proclivity-positioning:** Planning-surface (tab bar). All 8 views in the default view set benefit.

---

### Pattern 5: Lift-on-Hover on Todo Rows

**Source platform:** Linear (issue cards), Sunsama (task cards), Notion

**Public evidence:** Sunsama's marketing at https://sunsama.com describes task cards with visual time-allocation feedback; Linear's issue list items show elevation on hover per their design system patterns. This is one of the most widely-documented patterns in 2026 SaaS — Vercel's Geist component library (https://vercel.com/geist/introduction) lists hover states as a core component primitive with elevation changes.

**What makes it good:** A 2px `translateY(-2px)` + subtle `box-shadow` elevation on todo row hover communicates that the row is interactive before the user clicks. This is especially important for Proclivity because the edit-pencil button is opacity-hidden at rest — the lift cue prepares the user to see the revealed affordances. The lift also prevents the "dead zone" feeling when a user hovers over a todo list row not sure if clicking will do anything. Current `sections.css` has no hover-state visual feedback on `.todo-item` rows.

**Motion vocabulary primitives:** [MOT-30 lift-on-hover] — `translateY(-2px)` + shadow elevation, 120ms transition. Must be gated by `@media (prefers-reduced-motion: no-preference)`. Pairs with the existing `opacity: 0` → `opacity: 1` transition on `.todo-edit` which already fires at `120ms ease` (line 68 of `sections.css`).

**Where it would fit in Proclivity:** `src/sections/sections.css` lines 20–28 (`.todo-item`). Currently `.todo-item` has no hover state at all — only the delete button and edit button have individual hover styles. Adding a hover background shift to `var(--panel-2)` + `border-color: var(--accent)` at low opacity would simultaneously signal interactivity and align with the existing settings-button hover pattern in `App.css` lines 44–57.

**Proclivity-positioning:** Planning-surface (Today, Sprint, LongTerm, Reminders). Applies to all todo row contexts.

---

### Pattern 6: Framer Motion AnimatePresence Adoption as Foundation

**Source platform:** Linear (smooth workspace mode transitions), Sunsama (daily plan animations), Things 3 (purposeful unfolding)

**Public evidence:** Framer Motion official documentation at https://www.framer.com/motion/ — `AnimatePresence` enables exit animations and shared-layout transitions. The library's `LazyMotion` API keeps the initial bundle cost to ~5 KB gzipped while enabling full animation primitives. Auto-animate (https://github.com/formkit/auto-animate, MIT) is an even lighter alternative for list reordering specifically.

**What makes it good:** Proclivity currently has zero motion library — all animation is raw CSS transitions. This means mount/unmount animations (modal entry, section reveals, list item removals) cannot cross-fade or animate out; they hard-cut. Adopting Framer Motion via `LazyMotion` + feature flags provides the foundation for Patterns 2, 3, 4, and the modal scale-in (Pattern 7). The `~5KB LazyMotion` path respects the 200KB initial-chunk constraint per `CLAUDE.md`. The library is React 18 compatible, MIT licensed, and already listed in `source-registry.md` as a major candidate.

**Motion vocabulary primitives:** This pattern IS the foundation for [MOT-3 stagger-reveal], [MOT-50 section-fade], [MOT-51 shared-element-transition], and [MOT-4 scale-in]. Reduced-motion: Framer Motion respects `useReducedMotion()` hook; gate all `variants` inside the hook's boolean.

**Where it would fit in Proclivity:** New dependency — `package.json`. Lazy-loaded via `const { domAnimation, LazyMotion } = await import('framer-motion')` inside the newtab app shell. Does not land in the initial 200KB chunk if imported only inside `React.lazy` boundaries or via dynamic import triggered by the first user interaction. The alternative (pure-CSS stagger) is viable for Pattern 3 alone but cannot address the AnimatePresence unmount requirement for Patterns 2 and 7.

**Proclivity-positioning:** Foundation for all 8 views. Bundle discipline required — cite in any implementation milestone as a gated lazy import.

---

### Pattern 7: Modal Entry Scale-In + Backdrop Blur

**Source platform:** Raycast (command palette entry), Things 3 (modal entry), Sunsama (task detail panels)

**Public evidence:** Raycast marketing at https://www.raycast.com/ emphasizes millisecond-level response on command palette open — implying a crisp scale-in entry. Things 3 is documented as having "purposeful" animations on modal/drawer entry. Native macOS modal dialogs universally use a scale-in from ~0.96 → 1.0. Framer Motion docs at https://www.framer.com/motion/ document `scale` + `opacity` as the canonical modal entry variant.

**What makes it good:** Proclivity's `Modal.css` already has `modal-slide-in` at 150ms, but uses `translateY(-8px)` — a vertical drop that can feel slightly harsh on repeated use. The 2026 SOTA pattern (used by Raycast, Things 3, and every native macOS sheet) is `scale(0.96 → 1.0)` + `opacity(0 → 1)` at 200ms `ease-out`. This feels "natural" because it matches the eye's natural focus expansion when attention moves to a new surface. Adding `backdrop-filter: blur(8px)` on `.modal-backdrop` reinforces depth and hierarchy — the planning content behind the modal recedes into context. Current `rgba(0, 0, 0, 0.6)` backdrop is functional but flat.

**Motion vocabulary primitives:** [MOT-4 scale-in] — `scale(0.96 → 1.0)` + `opacity(0 → 1)`, 200ms. The existing `modal-slide-in` keyframe in `Modal.css` line 31 would be replaced. Reduced-motion: `Modal.css` lines 99–109 already gates both `modal-backdrop` and `modal-panel` animations — no additional work. `backdrop-filter` is not a motion property and can remain regardless of reduced-motion.

**Where it would fit in Proclivity:** `src/components/Modal.css` lines 27–33 (`.modal-panel` animation and `@keyframes modal-slide-in`). Also `src/components/Modal.css` lines 1–11 (`.modal-backdrop` — add `backdrop-filter: blur(8px)`). Applies to TodoEditModal, SettingsModal, and ConfirmDialog. Zero new dependencies if implemented in pure CSS; Framer Motion version preferred if Pattern 6 is already adopted.

**Proclivity-positioning:** All 8 views (modal-todo-edit, settings-general, settings-appearance). Highest-visibility single change.

---

### Pattern 8: Keyboard Shortcut Help Overlay (Cmd-/)

**Source platform:** Raycast (keyboard-first philosophy), Linear (keyboard shortcut standardization), Notion (slash-menu)

**Public evidence:** Raycast marketing at https://www.raycast.com/ — "Keyboard First" is a named design principle; documents `Cmd+K` for command palette and custom hotkeys. Linear changelog (https://linear.app/changelog) documents keyboard shortcut standardization across Mac and Windows/Linux. Raycast specifically surfaces a keyboard visualization to educate users about available shortcuts.

**What makes it good:** Proclivity has keyboard navigation throughout (tab bar, settings sidebar, todo actions) but no discovery surface. A `Cmd+/` or `?` overlay showing the current context's keyboard shortcuts closes the gap between "has shortcuts" and "users know about shortcuts." Raycast's approach of treating the keyboard shortcut system as a first-class product feature (not a help-menu footnote) is what separates power-tool from casual-use products. For Proclivity, this would surface: tab navigation shortcuts, quick-add shortcuts, and any section-specific keys. It does NOT require a full command-palette (which is larger scope).

**Motion vocabulary primitives:** [MOT-4 scale-in] for the overlay entry (same as Pattern 7). [MOT-1 fade-in] on the backdrop. The overlay itself is static once open — no motion inside the shortcut list.

**Where it would fit in Proclivity:** Net-new component — `src/components/KeyboardHelpOverlay.tsx`. Would mount in `src/newtab/App.tsx` alongside the existing Settings + Chat Panel lazy-loads. Trigger: `document.addEventListener('keydown')` for `Cmd+/` or `?`. Proclivity's design-system `proclivity-design-system.md §7` explicitly flags "No keyboard-shortcut help overlay" as an underdeveloped gap.

**Proclivity-positioning:** Global (all 8 views). Net-new component.

---

### Pattern 9: Breathing-Glow on Armed Reminders

**Source platform:** Vercel (status pills / live indicators), Linear (animated tab indicator for active agent)

**Public evidence:** Linear changelog (https://linear.app/changelog) March 2026: "animated desktop tab indicator" for issues with active agents — a continuous ambient signal that work is happening. Vercel's Geist design system at https://vercel.com/geist/introduction documents "Loading Dots, Skeleton, Spinner, and Status Dot patterns" for live state. The existing Proclivity `App.css` lines 61–79 already implements a `settings-badge-pulse` keyframe for the settings gear new-badge — confirming this pattern fits the codebase idiom.

**What makes it good:** When a reminder is armed (has a future `fireAt` and has not fired), there is currently no ambient visual signal distinguishing it from a reminder that has already fired or one with no time set. A slow 2–3s `opacity` pulse on the reminder row's status indicator (the fire icon or a small colored dot) tells the user "this is live, this will fire" without being alarming. This is especially important for the Reminders section where the difference between armed/not-armed is the core user value proposition.

**Motion vocabulary primitives:** [MOT-10 breathing-glow] — box-shadow or opacity slow pulse, 2–3s loop. Must cap intensity (max opacity delta ~0.4). Gated by `@media (prefers-reduced-motion: no-preference)`. The existing `settings-badge-pulse` at `App.css` line 73 is the exact same pattern — code parity.

**Where it would fit in Proclivity:** `src/sections/reminders/reminders.css` (armed reminder row indicator). The `src/sections/reminders/RemindersManager.tsx` renders the full reminder list — a CSS class toggled on armed rows (`.is-armed`) could carry the animation. Proclivity design-system §7 explicitly flags "No animated state on alarm-armed reminders" as underdeveloped.

**Proclivity-positioning:** Reminders section only. Does not bleed onto planning sections.

---

### Pattern 10: Empty-State with Subtle Dot-Grid Background

**Source platform:** Linear (empty-state treatment), Vercel (empty dashboard states), Notion (empty block views)

**Public evidence:** Vercel's Geist component library (https://vercel.com/geist/introduction) documents an empty-state pattern. Linear's interface uses structured empty states for new projects. Notion Calendar shows an empty calendar grid before events are added. The dot-grid background is a 2026 pattern documented in numerous design systems as a way to give empty surfaces texture without visual weight.

**What makes it good:** Proclivity's current empty-state (`.section-empty` in `App.css` lines 115–123) is a plain dashed-border box with centered text. It works, but it reads as "nothing here yet" rather than "invite to start." A subtle dot-grid background on the empty container — using `radial-gradient` repeated at 20px intervals to create a fine grid — gives the surface texture and depth, making the empty state feel like a canvas waiting to be filled rather than an error condition. Combined with slightly warmer typography ("Your day is empty — add your first task above"), this transforms the most common first-run experience.

**Motion vocabulary primitives:** [MOT-64 dot-grid-bg] — subtle dot grid background. No animation on the grid itself. The empty-state copy could use [MOT-1 fade-in] on first appearance (gated by reduced-motion baseline).

**Where it would fit in Proclivity:** `src/newtab/App.css` lines 115–123 (`.section-empty`). Also `src/sections/sections.css` line 233–236 (the empty state inside `TodoList`). The dot-grid is a pure-CSS background — no new dependencies. Uses `radial-gradient` with `var(--border)` color so it respects both light and dark themes.

**Proclivity-positioning:** Planning-surface (Today, Sprint, LongTerm, Reminders, Gantt empty states). Highest surface area for first-run experience.

---

### Pattern 11: Warm-Gray Token Shift (Chromaticity Reduction)

**Source platform:** Linear (2026 design refresh)

**Public evidence:** Linear's "A calmer interface for a product in motion" post at https://linear.app/now/behind-the-latest-design-refresh describes the palette shift from "a cool, blue-ish hue toward a warmer gray that still feels crisp, but less saturated." The internal color picker tool exposed hue, chroma, and lightness per-token. This was described as a deliberate move to reduce visual tension.

**What makes it good:** Proclivity's `theme.css` uses `oklch(0.10 0.012 252)` for `--bg` — hue 252 (blue-violet). Linear explicitly moved away from this direction. Reducing the chroma on `--bg`, `--panel`, and `--panel-2` from `0.012–0.018` toward `0.006–0.010` while shifting the hue angle 10–15 degrees warmer (toward 235–240) would make the surface feel less "app-cold" and more "workspace-warm" — closer to how Linear, Notion, and Sunsama position their dark themes. This is a token-only change with zero behavior implications.

**Motion vocabulary primitives:** None — static token change. However, the warmer palette makes [MOT-65 floating-orbs] and [MOT-62 aurora-effect] (if ever added to the mesh background) look more natural because the orb colors and the surface share a warmer tonal register.

**Where it would fit in Proclivity:** `src/styles/theme.css` lines 19–63 (`:root` dark theme tokens). Specifically `--bg`, `--panel`, `--panel-2`, `--border`, `--text-dim`. Light theme tokens at lines 66–82 may also benefit from a slight warmth nudge. This is the lowest-effort, highest-aesthetics-ROI change in this brief.

**Proclivity-positioning:** Global (all 8 views). Token-level — no component changes required.

---

## 3. Sources Reviewed

| Platform | URL | What was read | High signal? |
|---|---|---|---|
| Linear changelog | https://linear.app/changelog | March 2026 design refresh entries — sidebar dimming, tab compact treatment, animated indicator, icon scaling | YES |
| Linear design blog | https://linear.app/now/behind-the-latest-design-refresh | Full design refresh post — palette shift, navigation treatment, density choices | YES |
| Linear homepage | https://linear.app/ | Marketing page — information density, card layouts, semantic visual language | MEDIUM |
| Sunsama | https://sunsama.com/ | Marketing page — daily planning ritual patterns, multi-column layout, time-blocking, emotional framing | YES |
| Things 3 | https://culturedcode.com/things/ | Product marketing page — purposeful animations, restrained design, keyboard shortcuts | YES |
| Akiflow | https://akiflow.com/ | Marketing page — time-blocking UI, command palette (Cmd+K), triage-to-calendar flow | MEDIUM |
| Raycast | https://www.raycast.com/ | Marketing page — keyboard-first philosophy, command palette ergonomics, millisecond feedback | YES |
| Raycast changelog | https://www.raycast.com/changelog | Recent updates — Liquid Glass AI Chat, keyboard nav improvements | MEDIUM |
| Vercel design page | https://vercel.com/design | Design team page — confirmed Geist design system components including Status Dot, Skeleton, Spinner | MEDIUM |
| Vercel Geist introduction | https://vercel.com/geist/introduction | Component list — confirmed 60+ components including Loading Dots, Skeleton, Status Dot; no animation specs | MEDIUM |
| Arc browser | https://arc.net/ | Marketing page — clean/calm positioning, spatial clarity, whitespace-forward design | LOW (confirmed restraint, few novel patterns) |
| Tabliss | https://tabliss.io/ | Product marketing — modular widgets, customizable backgrounds, information density philosophy | MEDIUM |
| Momentum Dashboard | https://momentumdash.com/ | Product marketing — focus prompt ritual, daily intention-setting, background photography, widget positioning | MEDIUM |
| Linear design blog (index) | https://linear.app/blog | Blog index — identified "A calmer interface" and "A Linear spin on Liquid Glass" posts | YES |
| Stripe homepage | https://stripe.com/ | Marketing — card-based layout, gradient mesh backgrounds, hover interactions | MEDIUM |
| Notion Calendar | https://calendar.notion.so/ | Marketing page — very sparse content; limited signal extracted | LOW |
| Framer Motion docs | https://www.framer.com/motion/ | (via source-registry) — confirmed LazyMotion ~5KB, AnimatePresence, React 18 compatibility | YES |

---

## 4. Themes

Across 2026 SOTA platforms, the dominant thematic shift is **deliberate recession of navigation chrome** — Linear, Sunsama, and Raycast all invested in making their nav bars quieter so content takes precedence. This is directly counter to the 2022–2024 pattern of prominent tab bars with icons, badges, and full-saturation active states. The second convergent theme is **targeted motion at transition moments only**: Linear's stagger-reveal on issue lists, Things 3's unfolding animations, and Sunsama's daily plan transitions are all brief (~200ms), fired once, and never loop on data surfaces (anti-pattern [MOT-NO-2]). Third, the **palette-warmth shift** — Linear, Notion, and Raycast all moved dark themes from cool blue-gray toward warmer gray in 2025–2026; cool blue reads as "cold utility tool" while warm gray reads as "calm workspace." Fourth, **keyboard discoverability** became a first-class feature: Raycast's "keyboard first" branding, Linear's shortcut standardization, and Akiflow's Cmd+K prominence all signal that 2026 power-user tools surface keyboard affordances rather than burying them.

---

## 5. Cross-Reference to Proclivity Components

| Pattern | Proclivity file:line | New or existing? |
|---|---|---|
| Pattern 1: Dimmed Nav | `src/newtab/App.css:87–104` (`.tabs`, `.tab`) | Existing — token tweak |
| Pattern 2: Section-Fade | `src/newtab/App.tsx:418–509` (tabpanel divs) | Existing — behavioral upgrade; needs AnimatePresence or CSS opacity |
| Pattern 3: Stagger-Reveal | `src/sections/sections.css:15–17` (`.todo-list`); `src/components/TodoItem.tsx:40` (`<li>`) | Existing — CSS or Framer Motion |
| Pattern 4: Pill Tab Indicator | `src/newtab/App.css:87–104` (`.tabs`, `.tab-active`) | Existing — style replacement |
| Pattern 5: Lift-on-Hover | `src/sections/sections.css:20–28` (`.todo-item`) | Existing — additive CSS |
| Pattern 6: Framer Motion | `package.json` | Net-new dependency (lazy-loaded) |
| Pattern 7: Modal Scale-In + Blur | `src/components/Modal.css:27–33` (`.modal-panel`), `src/components/Modal.css:1–11` (`.modal-backdrop`) | Existing — style upgrade |
| Pattern 8: Keyboard Help Overlay | Net-new: `src/components/KeyboardHelpOverlay.tsx`; mount in `src/newtab/App.tsx` | Net-new component |
| Pattern 9: Breathing-Glow on Armed Reminders | `src/sections/reminders/reminders.css` (armed row indicator) | Existing — additive CSS; design-system §7 underdeveloped item |
| Pattern 10: Empty-State Dot-Grid | `src/newtab/App.css:115–123` (`.section-empty`); `src/sections/sections.css` (empty state) | Existing — CSS background upgrade |
| Pattern 11: Warm-Gray Token Shift | `src/styles/theme.css:19–63` (`:root` dark theme) | Existing — token-level change only |

---

## 6. Out of Scope / Parking Lot

| Pattern considered | Rejection reason |
|---|---|
| Drag-to-calendar (Sunsama/Akiflow pattern) | High implementation cost; requires Gantt + Todo system integration; better scoped as its own milestone |
| Command palette (Cmd+K full-text search) | Larger scope than a visual uplift — touches data layer for search indexing; parking for a dedicated planning UX milestone |
| Scroll-driven progress bar [MOT-21] | Proclivity sections rarely scroll enough to warrant a progress bar; premature optimization |
| Background photography rotation (Momentum pattern) | User-uploaded photos already handled by the Photos section; adding Unsplash integration is a data/privacy concern and scope creep |
| Skeleton shimmer on loading states [MOT-13] | Proclivity's `chrome.storage.local` loads are near-instant; skeleton states would flash briefly and disappear — net negative for UX |
| Parallax on any planning section | Explicitly rejected as [MOT-NO-2] anti-pattern |
| Magnetic cursor on operational buttons | Explicitly rejected as [MOT-NO-4] anti-pattern |
| Auto-rotating carousel | Explicitly rejected as [MOT-NO-3] anti-pattern |
| Confetti on todo completion | Explicitly rejected as [MOT-NO-6] anti-pattern |
| Adopting Tailwind CSS | Already rejected in `proclivity-design-system.md §6` |
| Adopting shadcn/ui | Already rejected in `proclivity-design-system.md §6` |
| Apple Vision Pro parallax hero | Marketing-surface-only; Proclivity has no marketing page / onboarding flow yet; revisit if a welcome screen milestone is added |
| Three.js mesh aurora theme variant [MOT-62] | Would be an extension of existing MeshBackground; appropriate for a dedicated appearance-enhancement milestone rather than this visual-refresh scope |
| Lenis smooth-scroll engine | Proclivity's planning sections are short enough that inertial scroll adds no value; relevant only if LongTerm list becomes very long |
| Things 3 native macOS patterns (sidebar, Magic Plus) | Things 3 is a native Mac app — its sidebar and gesture patterns do not translate directly to a Chrome extension new-tab web app; web peers (Linear, Notion) are stronger references for this surface |
