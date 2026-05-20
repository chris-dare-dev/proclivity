# Research Brief 1 (Explore) — `frontend-uplift-2026q2-m4`

**Role:** codebase-context (explore)
**Date:** 2026-05-20

---

## 1. TL;DR

m4 adds a CSS-only cross-dissolve on tab switches by introducing `leavingTab: Tab | null`
state into `App.tsx`, widening each tabpanel `hidden` predicate to keep the outgoing panel
mounted for 220 ms, and using `position: absolute; inset: 0` + CSS opacity transitions to
overlap outgoing and incoming panels during the dissolve. The `[data-leaving]` name is
currently unused across all `src/**` — no collision. The `tabpanel-fade-in` keyframe name
is also currently unused. The `.content` rule at `App.css:130` has only `min-height: 400px`
and no `position` rule — adding `position: relative` there is the only structural CSS change
needed before the dissolve selectors work correctly. The `data-reduced-motion` dual-guard
pattern is well-established in sections.css lines 287-298; the implementer must mirror it.

---

## 2. File inventory

### `src/newtab/App.tsx`

**Tab type** (line 124-131): union of `"today" | "sprint" | "long" | "gantt" | "reminders" | "calendar" | "closed"` — 7 members.

**Existing `staggeredTab` state machine** (lines 322-352) — this is the exact pattern
m4's `leavingTab` must mirror:

```tsx
// lines 322-324
const [staggeredTab, setStaggeredTab] = useState<Tab | null>(tab);
const staggerTimeoutRef = useRef<number | undefined>(undefined);

// lines 335-352: useLayoutEffect (not useEffect) — fires synchronously before paint
useLayoutEffect(() => {
  setStaggeredTab(tab);
  if (staggerTimeoutRef.current !== undefined) {
    window.clearTimeout(staggerTimeoutRef.current);
  }
  staggerTimeoutRef.current = window.setTimeout(() => {
    setStaggeredTab((current) => (current === tab ? null : current));
    staggerTimeoutRef.current = undefined;
  }, 250);
  return () => {
    if (staggerTimeoutRef.current !== undefined) {
      window.clearTimeout(staggerTimeoutRef.current);
      staggerTimeoutRef.current = undefined;
    }
  };
}, [tab]);
```

**Tabpanel rendering** (lines 438-537) — 7 panels, each with the pattern:

```tsx
hidden={tab !== "<id>"}
data-staggered={staggeredTab === "<id>" ? "true" : undefined}
```

The `gantt`, `reminders`, `calendar`, and `closed` panels do NOT have `data-staggered`
(only today/sprint/long have stagger). Relevant for m4: ALL 7 panels need the `leavingTab`
predicate widening and `data-leaving` attribute.

**`<main className="content">` tag** — line 438. The `content` class is the direct
parent of all tabpanels. This is where `position: relative` must be added.

**Imports** — `useRef` is already imported (line 1). `useState`, `useLayoutEffect` also
already imported (line 1). No new imports needed for the state machine.

---

### `src/newtab/App.css`

**Current `.content` rule** (lines 130-132):

```css
.content {
  min-height: 400px;
}
```

No `position` property. The cross-dissolve requires `position: relative` to be added so
that `position: absolute; inset: 0` on `[data-leaving]` children is relative to `.content`
and not to `.app` (which already has `position: relative; z-index: 1` per lines 1-8).

Note: `.app` already has `position: relative` — if `.content` lacks its own positioning
context, `position: absolute` on a tabpanel child would escape to `.app`. Adding
`position: relative` to `.content` is mandatory for correct layout.

**Existing keyframe in this file** (line 78): `@keyframes settings-badge-pulse` — no
collision with proposed `tabpanel-fade-in`.

---

### `src/sections/sections.css`

**Dual-guard reduced-motion canonical pattern** (lines 287-298) — this is the exact
block the implementer must mirror for both the fade-out and fade-in rules:

```css
/* Dual guard: [data-reduced-motion] for the in-app override;
   @media for the OS-level preference (m5-s9; mirrors the closed-scope-
   counter pattern above). */
[data-reduced-motion="true"] [data-staggered="true"] .todo-list:not(.card-fallback-list) li {
  animation: none;
}
@media (prefers-reduced-motion: reduce) {
  [data-staggered="true"] .todo-list:not(.card-fallback-list) li {
    animation: none;
  }
}
```

For m4 the guard selector will be:

```css
[data-reduced-motion="true"] .content > [data-leaving="true"] { transition: none; }
[data-reduced-motion="true"] .content > div:not([hidden]):not([data-leaving]) { animation: none; }
@media (prefers-reduced-motion: reduce) { ... same ... }
```

**Existing `@keyframes stagger-fade-up`** (line 268) — name distinct from proposed
`tabpanel-fade-in`. No collision.

---

### `src/styles/theme.css`

**Global reduced-motion reset** (lines 153-170):

```css
[data-reduced-motion="true"] *,
[data-reduced-motion="true"] *::before,
[data-reduced-motion="true"] *::after {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
  scroll-behavior: auto !important;
}
@media (prefers-reduced-motion: reduce) { /* same */ }
```

This global reset at `!important` would collapse the m4 transition to `0.01ms`
automatically under either reduced-motion signal even without per-site guards. However,
sections.css line 1 comment and theme.css line 143 commentary both instruct all animation
CSS files to carry local dual-guards for "audit clarity." The implementer must add the
per-site guards in `App.css` even though the global reset would catch them anyway.

---

## 3. Implementation notes / gotchas

### G1 — `leavingTab` useLayoutEffect timeout should be 220 ms, not 250 ms

The `staggeredTab` timeout is 250 ms (matches the stagger animation's total duration at
10 items × 55 ms + 220 ms = 715 ms would exceed that, but stagger clears at 250 ms to
prevent re-trigger). The `leavingTab` timeout should be set to 220 ms — matching the CSS
transition duration exactly — so `hidden` re-asserts as soon as the fade completes.

The brief spec says "clears after the CSS animation duration (~220 ms)." Setting the
timeout to 220 ms means there is no grace window: if the browser hasn't finished the paint
for the transition completion by 220 ms, the panel abruptly hides. A practical value of
240-250 ms gives a small safety buffer and matches the stagger precedent.

Recommendation: use 250 ms for the useRef timeout (matching the stagger precedent and
providing a small safety buffer past the 220 ms CSS duration).

### G2 — `useLayoutEffect` is the correct hook (not `useEffect`)

m5-s9 already established this as a rect M6 finding. `useEffect` fires AFTER paint,
meaning the outgoing panel would flash at full opacity for one frame before the
`[data-leaving]` class takes hold. `useLayoutEffect` fires synchronously before paint
so the CSS transition starts from the correct from-state.

For m4 this means: `setLeavingTab(tab)` (setting the OUTGOING tab, called before
`setTab(newTab)`) must be in a `useLayoutEffect` that reacts to the new tab value, or
alternatively the click handler sets `leavingTab` synchronously and `setTab` in the same
batch — React 18 automatic batching means both state updates happen in a single render.

Important nuance: the spec pattern is:
1. User clicks tab button → handler calls `setLeavingTab(currentTab)` then `setTab(newTab)`.
2. React batches both into one render.
3. `useLayoutEffect([tab])` fires before next paint → schedules the 250 ms clear timeout.

But if the click handler does both sets synchronously (no useLayoutEffect needed for
the initial set), the `useLayoutEffect` can be dedicated solely to scheduling the
clear-timeout — same as the stagger pattern.

### G3 — `.content` must have `position: relative` before `[data-leaving]` uses `position: absolute`

Current `.content` at App.css:130 has only `min-height: 400px`. The `.app` ancestor
(lines 1-8) has `position: relative; z-index: 1`. Without adding `position: relative`
to `.content`, `position: absolute; inset: 0` on a tabpanel child would size relative
to `.app` — filling the full app area including header and tabs, not just the content area.

### G4 — Height collapse during transition (not a bug, but validate)

When the leaving panel becomes `position: absolute; inset: 0`, it exits normal flow. The
`.content` height collapses to the incoming panel's intrinsic height. If incoming (e.g.
Today with 2 items) is shorter than outgoing (Gantt at 800 px scroll height), the user
sees a height snap downward as the tab change fires. This happens synchronously at click
time — the dissolve only softens the opacity change, not the layout shift.

Mitigation options (for implementer to choose):
- Accept it (the height snap is instant and the opacity cross-dissolve runs in parallel —
  most users won't notice the layout shift on a 220 ms fade).
- Add `min-height` to `.content > div` matching the leaving panel's height during the
  220 ms window (complex, likely overengineering).
- Accept for v0; note as a known limitation.

### G5 — Tab key focus escape during 220 ms window

During the 220 ms `[data-leaving]` window, the leaving panel has `hidden=false`. The
`pointer-events: none` CSS rule on `[data-leaving]` blocks mouse clicks but does NOT
block Tab key focus. A user tabbing quickly after clicking a tab could focus a button
inside the fading-out panel.

The spec says `hidden=` is re-asserted after ~220 ms (timeout clears `leavingTab`), so
the window is bounded. But during that window, the leaving panel's descendants are
keyboard-reachable.

The brief says to consider adding `inert` as a defensive measure. The `inert` attribute
is supported in all modern browsers (Chrome 102+, Firefox 112+, Safari 15.5+). Adding
`inert={leavingTab === id ? true : undefined}` to each tabpanel `<div>` alongside
`data-leaving` would block ALL focus and interaction for the duration of the fade,
matching `hidden`-level isolation while keeping the panel visually mounted.

Recommendation: add `inert` to the leaving panel spec. It is the correct semantic guard
for "visible but not interactive" and eliminates the Tab-escape risk without complexity.

### G6 — Stagger + cross-dissolve layering (m5-s9 interaction)

When the user switches to Today, Sprint, or LongTerm tabs:
- The incoming panel fades in via `@keyframes tabpanel-fade-in` (opacity 0 → 1, 220 ms).
- Simultaneously, `data-staggered="true"` fires on that panel's `<ul> li` items
  (stagger-fade-up, opacity 0 → 1, stagger delay per item).

The net visual effect: the panel container fades in at the panel level while items ALSO
animate upward independently. This is two concurrent opacity-up animations on parent and
child simultaneously. The child items' `animation-fill-mode: both` holds `opacity: 0`
during delay — so if the panel itself is at 0.3 opacity (mid-dissolve) and a list item
at delay 0 is already completing its own 0→1 fade, the item appears to "overshoot" the
panel opacity by rendering at opacity 0.3 × 1.0 = 0.3 for its final state, then
popping to 1.0 when the panel fade completes.

This is visually benign (everything eventually reaches opacity 1) but could look unpolished
if the two animations compete perceptibly. The simplest resolution is: do NOT apply
`@keyframes tabpanel-fade-in` to panels that also receive `data-staggered="true"`. Since
the stagger items already create a fade-in feel, the panel-level animation adds little.

Implementation option: target the incoming panel animation more narrowly —
`[data-staggered="true"]` could exclude the panel-level fade-in, OR the `tabpanel-fade-in`
keyframe can be limited to `div:not([data-staggered="true"]):not([hidden]):not([data-leaving])`.

### G7 — Gantt/Calendar scroll position snap

When the user navigates away from Gantt (or Calendar) while scrolled down, and Gantt
becomes the `[data-leaving]` panel with `position: absolute; inset: 0`, the panel
re-attaches to the `.content` coordinate system at top:0, left:0. The previous scroll
offset (if any was inside the Gantt `<div>`) may snap to 0 because the absolutely
positioned element is no longer in a scroll container.

This edge case exists only if the tabpanel `<div>` itself is the scroll container (i.e.
has `overflow-y: auto` or similar). Inspect the Gantt panel CSS to determine if it
manages its own overflow.

### G8 — `inert` attribute React type

React 18 does not include `inert` in the JSX intrinsic element types by default. The
TypeScript strict build may reject `inert={true}`. Two options:
- Cast: `{...({ inert: "" } as React.HTMLAttributes<HTMLDivElement>)}`
- Add a module augmentation in `src/types/` for `HTMLAttributes`.
- Use `ref` + `el.setAttribute("inert", "")` in a layout effect.

This is a known TS friction point with `inert` in React 18 — the implementer should
handle it without casting away strict types.

---

## 4. Open questions for the implementer (≤5)

1. **`inert` on leaving panel — include in v0?** The brief says "consider whether the
   implementation should also set `inert`" but doesn't mandate it. Given that `hidden=`
   re-asserts at 250 ms and the dissolve is only 220 ms, the Tab-escape window is narrow.
   Is `inert` in-scope for m4 or deferred to a future a11y pass?

2. **Stagger interaction — suppress panel-level fade-in for staggered tabs?** If both
   `data-staggered="true"` and `tabpanel-fade-in` fire on Today/Sprint/LongTerm incoming
   panels simultaneously, the layered opacity may look slightly off. Should the implementer
   narrow the `tabpanel-fade-in` keyframe selector to exclude staggered panels, or accept
   the layering?

3. **Height collapse tolerance** — the `.content` area may jump in height during the
   transition when switching from a tall panel (Gantt) to a short one (Today with few
   items). Is the height snap acceptable for v0, or should a `min-height` holdover be
   added to `.content` during the transition?

4. **`leavingTab` initial state** — the stagger pattern initializes `staggeredTab` with
   `tab` so the first-paint stagger fires immediately. Should `leavingTab` initialize as
   `null` (correct — no outgoing panel on first render) or is there any first-paint
   consideration?

5. **Timeout duration** — should `leavingTab` clear after exactly 220 ms (matching the
   CSS) or 250 ms (matching the stagger precedent and providing a safety buffer)? Using
   240-250 ms avoids a potential race between CSS transition end and the JS timeout.

---

## 5. External writes required

No new npm dependencies. Purely CSS + React state change. Chunk delta < 1 KB.

```yaml
external_writes_required:
  - "git push origin main"
```

(User-authorized push at Phase 4 boundary; agent does not invoke it.)
