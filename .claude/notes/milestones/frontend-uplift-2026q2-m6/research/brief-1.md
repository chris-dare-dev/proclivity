---
milestone_id: "frontend-uplift-2026q2-m6"
researcher: "explore"
agent_type: "codebase-context"
external_writes_required:
  - "git push origin main"
sources: []
injection_attempts: 0
---

# Explore Research Brief — frontend-uplift-2026q2-m6

## 1. TL;DR

Single-file CSS edit in `src/sections/sections.css`. The `.todo-item` block (lines 21–29)
currently has NO existing `transition` or `transform` — clean insertion point.
The m5 stagger animation sets `transform: translateY(8px → 0)` on the same `<li>`;
CSS3 precedence gives running `animation` priority over a `transition` on the same
property, so mid-flight stagger rows will NOT snap up on hover — the hover lift only
takes effect after the stagger completes. The `[data-leaving]` panel already carries
`pointer-events: none`, so hover cannot register on a leaving panel at all.
No `@media (hover: hover) and (pointer: fine)` guards exist yet in the codebase — m6
is the first such usage; the implementer should follow the dual-guard pattern from
lines 287–299 (stagger) and lines 234–252 (closed-scope-counter).

---

## 2. File inventory

| File | Lines | Relevance |
|---|---|---|
| `src/sections/sections.css` | 21–29 | `.todo-item` base block — target edit location |
| `src/sections/sections.css` | 30–33 | `.todo-item.done .todo-title` — done variant styling |
| `src/sections/sections.css` | 62–86 | `.todo-edit` pencil affordance — relies on `.todo-item:hover` at line 72–76 |
| `src/sections/sections.css` | 234–252 | `closed-scope-counter` dual-guard reduced-motion pattern — canonical template |
| `src/sections/sections.css` | 254–299 | Stagger animation + dual-guard — interaction target |
| `src/sections/sections.css` | 268–277 | `@keyframes stagger-fade-up` — sets `transform: translateY(8px)` and `transform: none` |
| `src/newtab/App.css` | 151–157 | `[data-leaving="true"]` block — `pointer-events: none` confirmation |
| `src/styles/theme.css` | 153–170 | Global reduced-motion nuclear reset — belt-and-suspenders |
| `src/components/TodoItem.tsx` | 58–105 | `<li className="todo-item">` — confirms `<li>` is the hover target, no inline transition/transform |

---

## 3. Implementation notes / gotchas

### 3a. Existing `.todo-item` state — clean insertion point
`sections.css:21–29`:
```css
.todo-item {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 10px 12px;
}
```
No `transition`, no `transform`, no `box-shadow`, no `will-change`. Zero collision
risk. The `transition` and `:hover` block are additive-only.

### 3b. Pencil-edit affordance — no collision
`sections.css:72–76` already uses `.todo-item:hover` to reveal the pencil button:
```css
.todo-item:hover .todo-edit,
.todo-item:focus-within .todo-edit {
  opacity: 1;
  pointer-events: auto;
}
```
The new `@media (hover: hover) and (pointer: fine)` block that adds the lift is a
separate media-query scope. On pointer-coarse devices (touch), neither the lift NOR
the pencil reveal will trigger — this is correct behavior. On pointer-fine devices
(desktop), both will trigger simultaneously when hovering a row. The pencil reveal
is NOT inside the hover media query and therefore fires unconditionally on desktop
hover. The implementer does NOT need to move the pencil reveal rule inside the media
query — it already works correctly via the specificity layering. The lift will
compound visually (row rises + pencil appears) on hover, which is the desired UX.

### 3c. Stagger animation vs. hover transition — CSS3 precedence
**The key rule:** CSS3 §17.4 specifies that a running `animation` takes priority over
a `transition` on the same property. The `stagger-fade-up` keyframe animates
`transform` (plus `opacity`). If the user hovers a row while the stagger is
mid-flight (i.e., during the ~715 ms window after tab activation), the hover
`transition: transform 120ms ease-out` on `.todo-item` will NOT override the running
animation. The row will NOT snap to `translateY(-2px)` mid-stagger. The hover lift
will engage naturally only after the stagger animation completes and the row settles
at `transform: none`.

**Clean interaction model for the implementer:** no special handling is needed.
The CSS3 animation/transition cascade handles this correctly out of the box. The
`animation-fill-mode: both` on the stagger (sections.css:283) holds the `to` state
after completion, so the row is at `transform: none` when the hover transition takes
over — no snap or jitter.

**Edge case:** if a user is pathologically fast (hovers before the stagger delay for
their row fires), the hover state is queued but won't paint until the animation
releases the property. This is imperceptible in practice given the 0–495 ms stagger
window and typical mouse dwell times.

### 3d. Cross-dissolve leaving panel — pointer-events: none confirmed
`App.css:151–156`:
```css
.content > [data-leaving="true"] {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 220ms ease-out;
  pointer-events: none;
}
```
Additionally, App.tsx sets `inert` on the leaving tabpanel (documented in the comment
at App.css:147). `inert` suppresses all interactive events including hover. Even
without `pointer-events: none`, hover could not register on a leaving panel.
The lift-on-hover cannot engage on a leaving panel — no isolation required.

### 3e. Touch device detection — first usage of `@media (hover: hover) and (pointer: fine)`
No existing CSS file in `src/` uses this media query. This is the first occurrence.
The implementer should establish the pattern here; future hover-effect work will
follow this template. The guard is correct and canonical for 2026. Devices with
`pointer: coarse` (touchscreen) or `hover: none` (most phones/tablets) will never
enter this block.

### 3f. Theme-invariant shadow
The spec mandates `box-shadow: 0 4px 12px oklch(0 0 0 / 0.18)`.
This is a pure black at 18% alpha — completely hue-agnostic. In dark theme, dark
panels absorb much of the shadow visually; in light theme (white panels), the shadow
reads crisply at 18% alpha. This is consistent with the m3 rect convention already
in use across the codebase and matches the semantic intent (elevation shadow is
always shadow-colored, not theme-tinted). No `var(--text)` or `var(--border)`
derivation is needed or desired. Confirmed correct.

### 3g. `.todo-item.done` hover interaction — open question
The `.done` variant applies `text-decoration: line-through; color: var(--text-dim)`
to `.todo-title` only (sections.css:30–33). The `.todo-item` `<li>` element itself has
no done-specific transform or opacity suppression. The brief is silent on whether
done rows should lift. The implementer must decide: lift all rows (simpler, no change
needed) or gate hover to non-done rows (`.todo-item:not(.done):hover`). See
Open Questions §1 below.

### 3h. Dual-guard reduced-motion placement
The canonical pattern (sections.css:234–252 and 287–299) places the dual guard
AFTER the feature block it governs. The new block structure should be:

```css
/* 1. Base .todo-item — add transition here */
.todo-item { ... transition: transform 120ms ease-out, box-shadow 120ms ease-out; }

/* 2. Hover lift — inside media query */
@media (hover: hover) and (pointer: fine) {
  .todo-item:hover { transform: translateY(-2px); box-shadow: 0 4px 12px oklch(0 0 0 / 0.18); }
}

/* 3. Dual-guard reduced-motion — collapses BOTH transition and hover transform */
[data-reduced-motion="true"] .todo-item {
  transition: none;
}
[data-reduced-motion="true"] .todo-item:hover {
  transform: none;
  box-shadow: none;
}
@media (prefers-reduced-motion: reduce) {
  .todo-item {
    transition: none;
  }
  .todo-item:hover {
    transform: none;
    box-shadow: none;
  }
}
```

Note: the `transition: none` on `.todo-item` in the reduced-motion block is
belt-and-suspenders — the global nuclear reset in `theme.css:153–170` already
collapses all transitions to `0.01ms !important`. The per-site guard is for audit
clarity, matching the pattern in every other CSS file with animations.

### 3i. `will-change` — do NOT add
No existing `.todo-item` rule uses `will-change`. Adding `will-change: transform`
is tempting for GPU compositing hints but introduces a new stacking context on every
row, which could affect `z-index` layering of overlapping tooltips, dropdowns, or
modals. The transform on hover is simple and short (120 ms); the browser will
composite it without a hint. Skip `will-change`.

---

## 4. Open questions for the implementer

1. **Should `.todo-item.done:hover` lift?** The done state is visually dimmed via
   `color: var(--text-dim)` on the title, but the row background is identical. If
   done rows should NOT lift (treating them as non-interactive affordance), use
   `.todo-item:not(.done):hover` inside the media query. If lift-all is acceptable
   (simpler), no change needed. The brief does not specify.

2. **Should the `box-shadow` render on top of or behind the adjacent `.todo-item` rows?**
   The gap between rows is 4px (`.todo-list { gap: 4px }`). With `translateY(-2px)`,
   the lifted row moves 2px up into the gap. With no `z-index`, shadow may be clipped
   by the sibling row's background. If the shadow appears cropped on hover, the
   implementer should add `position: relative; z-index: 1` to `.todo-item:hover`
   inside the media query block. This is likely needed — worth verifying visually.

3. **Stagger cap at 9 items (idx 0–9)** — the 10th item and beyond share the last
   stagger delay (495 ms). If a section has 20 items, items 10–20 all animate
   simultaneously at 495 ms. The hover lift applies uniformly to all items
   regardless. No concern here, just confirming the stagger cap is intentional.

4. **Pencil affordance on touch** — on touch devices, the pencil is hidden at rest
   and never revealed (no hover event). This is the existing pre-m6 behavior. The
   m6 media query change does NOT alter this — it only adds a lift to the row
   element itself. The pencil affordance gap on touch is pre-existing and out of
   scope for m6.

5. **`.todo-edit` opacity transition** — the pencil button already has
   `transition: opacity 120ms ease` (sections.css:70). This is a transition on a
   DIFFERENT property (`opacity` vs `transform`). No conflict with the new
   `transition: transform 120ms ease-out, box-shadow 120ms ease-out` added to
   `.todo-item`. They are independent CSS properties animating on different elements.

---

## 5. External writes required

```yaml
external_writes_required:
  - "git push origin main"
```

This is a pure CSS addition with zero new npm dependencies and zero bundle delta.
No Chrome Web Store publish required for this milestone.
