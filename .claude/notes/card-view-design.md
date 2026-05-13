# Card View — Visual Design & Settings Integration Plan

**Scope:** UI/UX design spec for the card-view layout feature.
A sibling technical agent owns the drag library, position storage,
`<DraggableCard>`, and `<CardCanvas>` primitives. This document covers
everything the UI agent builds and the contracts between the two.

**Status:** Design plan — not yet implemented.

---

## 1. Settings Toggle — Where and How

### Location in SettingsModal

Add a new sub-section inside the existing **Display** section
(currently holds only the Greeting segmented control). The Display
section already covers how content appears rather than what appears
(that is Dashboard), so "Layout" belongs there.

Order within Display section after this change:
1. Greeting (existing)
2. **Todo layout** (new — segmented control)

No new `<section>` wrapper is needed; the field is appended inside
`DisplaySection` just like other fields.

### Control Type

Use a `SegmentedControl` — the identical pattern already used for
Theme, Font size, Density, Time format, Greeting, and Week start.
Two options: `List` and `Cards`. Matches the existing visual grammar
exactly. A `ToggleSwitch` would work mechanically but is semantically
weaker ("on/off" vs "choose one of two modes").

### Field Name

```
layoutMode: "list" | "card"
```

Added to `UserSettings` as an optional field:

```ts
layoutMode?: "list" | "card" | undefined;
```

Added to `ResolvedUserSettings` as a required field with default `"list"`.

Added to `DEFAULT_SETTINGS` in `src/storage/constants.ts` as `"list"`.

Coordinate with the technical agent: this is the canonical field name.
Both agents read `resolvedSettings(state.settings).layoutMode` to
branch render paths.

### Default Value

`"list"` — all existing users continue to see the current behavior
on first load after the feature ships. No migration needed.

### Per-Section vs Global

**Global single toggle.** The user said "the today / sprint /
long-term and reminders sections" — they mean all four sections,
uniformly. A per-section setting would require four separate controls,
add storage complexity, and confuse users who just want to switch the
whole dashboard to card mode. If a power-user use-case for per-section
layout emerges it can be added later; default to simple.

### Live Preview vs Commit-on-Done

**Live preview (immediate).** The existing pattern is:

- Appearance settings (Theme, Font size, Density, Accent, Reduced
  motion) apply live via the `live()` callback — the page visually
  changes as soon as the control changes.
- Settings that need validation (name, week start, section visibility,
  quiet hours) use `pendingXxx` state and commit on Done.

Layout mode has no validation requirement. Apply it live so the user
immediately sees the card canvas behind the open settings modal and can
confirm they want it before closing. This matches the Theme / Density
precedent exactly.

Implementation: call `live("layoutMode", v)` inside `onChange` of
the segmented control. No `pendingLayoutMode` local state needed.
Cancel (snapshot restore) will revert it just like Theme does.

### Copy

| Element | Text |
|---|---|
| Legend (label above control) | `Todo layout` |
| Option 1 | `List` |
| Option 2 | `Cards` |
| Hint text | `Cards let you drag items freely across the section and snap them to a grid.` |

---

## 2. Card Visual Design

### Dimensions

| Property | Value | Rationale |
|---|---|---|
| `min-width` | `200px` | Prevents illegible slivers when viewport is narrow |
| `max-width` | `320px` | Cards wider than ~320px start looking like list rows |
| `width` | User-positioned; default `240px` | Fixed width assigned at first-time layout; user can reposition but not resize (resize is out of scope for v1) |
| `min-height` | `72px` | Enough for title + one row of notes + tag row |
| Height | Grows with content up to a ceiling | Notes clamped at 3 lines (see Typography) |

The card is **fixed-width, variable-height**. This avoids the
complexity of two-axis resize while still accommodating long notes.

### Padding and Spacing

```
card padding: 12px 14px           (--space-3 × --space-3+2)
title → notes gap: 4px
notes → tags gap: 8px
internal row gap: 4px
```

Density cascade: card padding shrinks in compact mode and expands in
spacious mode by inheriting `--panel-pad-x` / `--panel-pad-y` analogues.
Use CSS custom properties in the card CSS so density data-attributes
on `<html>` automatically adjust spacing. Concrete values:

```css
.task-card {
  --card-pad-x: var(--panel-pad-x);    /* 20px default, 14px compact, 28px spacious */
  --card-pad-y: var(--panel-pad-y);    /* 16px default, 10px compact, 20px spacious */
  padding: var(--card-pad-y) var(--card-pad-x);
}
```

### Background and Border

Use `var(--panel-2)` — **not** `var(--panel)`. Rationale: list rows
sit on the page background and use `var(--panel)` to create one level
of elevation. Cards float above the canvas area which itself sits on
`var(--bg)`. Using `var(--panel-2)` gives the card a second elevation
step, visually distinguishing it from both the background and
hypothetical list-mode rows if the user toggles between modes. In dark
mode `--panel-2` is `oklch(0.17 0.016 252)` — meaningfully lighter
than `--bg` but not glaring.

Border: `1px solid var(--border)` with `border-radius: var(--radius)`
(10px). Consistent with `todo-item`, `sprint-header`, `reminder-item`.

### Shadow

**Rest state:** a subtle `box-shadow` using an OKLCH-compatible trick:
```css
box-shadow: 0 1px 3px 0 color-mix(in srgb, var(--border) 60%, transparent);
```
This reads as the same hue family as the border, never goes too dark
in light mode, and never disappears in dark mode.

**Hover state:** shadow lifts:
```css
box-shadow: 0 4px 12px 0 color-mix(in srgb, var(--border) 80%, transparent),
            0 1px 3px 0 color-mix(in srgb, var(--border) 40%, transparent);
```

**During drag:** shadow becomes more pronounced and the card gets a
subtle upward translate (`transform: translateY(-2px)`). This is owned
by the technical agent's `<DraggableCard>` via an `isDragging` prop
that adds a CSS class.

### Typography

**Title:** `font-size: var(--font-size-base)` (15px default), `font-weight: 500`.
This matches the existing `todo-item` title weight. No line-height
override needed; inherits `var(--line-height-base)`.

**Notes:** `font-size: calc(var(--font-size-base) - 1px)` (14px default),
`color: var(--text-dim)`. Do NOT add `opacity: 0.85` on top of
`var(--text-dim)` — that double-dims and can fail WCAG 1.4.3. The
`--text-dim` token is specifically designed for secondary text. Use it
plain. In dark mode this is `oklch(0.68 0.018 252)` (clearly readable
but subordinate to the title). In light mode `oklch(0.45 0.018 252)`.

**Notes truncation:** clamp at **3 lines** with `-webkit-line-clamp: 3`.
This is the pragmatic choice:
- Full multi-line: cards grow arbitrarily tall, destroying any spatial
  layout the user built.
- Max-height + scroll: scroll within a draggable card is a UX disaster
  (scroll vs. drag conflict).
- 3-line clamp: respects the user's note content without blowing up
  the layout. Full notes remain accessible via the edit modal.

Full text of notes is still accessible: the title attribute on the
notes element shows it on hover; the edit modal shows it in full.

### Tag Chips

**Bottom row**, flush left, `flex-wrap: wrap`, `gap: 4px`. Placed
below notes (or below title if no notes). This mirrors how chips are
shown in `reminder-item-meta` and is consistent with the existing
`.todo-item-tags` placement. Top-right placement (corner badge style)
loses visual hierarchy; inline-in-title cuts into readable space.

At most **3 chips rendered inline**; if there are more, show `+N more`
in the same chip style using `color: var(--text-dim)`. This keeps card
height predictable.

### Done State

`opacity: 0.6` on the entire card + `text-decoration: line-through`
on the title. This matches the existing list-row done pattern
(`.todo-item.done .todo-title`) while adding the opacity fade to de-
emphasize the whole card spatially. Do NOT remove done cards from the
canvas automatically — the user may want to see what they finished.
Done cards retain their position.

### Drag Affordance

**Cursor:** `cursor: grab` at rest on the card body; `cursor: grabbing`
while dragging. The technical agent sets the `grabbing` cursor on the
`<body>` during drag (global override pattern, prevents cursor flicker
on fast mouse movement).

**Grip handle:** do NOT add a visible grip icon by default. The whole
card surface is the drag target. A grip icon adds visual noise and the
`grab` cursor communicates the affordance sufficiently. A faint "drag
me" hint appears only on first-ever use in card mode (see §5 Onboarding
hint).

Rationale: the Gantt bar uses `cursor: ew-resize` on the drag edges —
that is a directional affordance. Card dragging is omnidirectional;
`grab` is the established convention.

### Selected / Focused State

Cards are not "selected" in the traditional sense — there is no
multi-select operation in v1. Focus state only:

```css
.task-card:focus-within {
  outline: none;  /* suppress default */
}
.task-card:focus-visible,
.task-card[data-focused="true"] {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

`data-focused="true"` is set by the technical agent's arrow-key
navigation handler (since the card container itself may not receive
`:focus-visible` when a child button is focused).

---

### CSS — `.task-card` Family (~130 lines)

```css
/* ─── Card canvas ──────────────────────────────────────────── */

.card-canvas {
  position: relative;
  width: 100%;
  min-height: 400px;
  /* Owned by the technical agent — this is the drag surface. */
}

/* ─── Task card ────────────────────────────────────────────── */

.task-card {
  --card-pad-x: var(--panel-pad-x);
  --card-pad-y: var(--panel-pad-y);

  position: absolute;           /* positioned by the technical agent */
  width: 240px;
  min-width: 200px;
  max-width: 320px;
  min-height: 72px;

  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--card-pad-y) var(--card-pad-x);

  box-shadow:
    0 1px 3px 0 color-mix(in srgb, var(--border) 60%, transparent);

  cursor: grab;
  user-select: none;
  display: flex;
  flex-direction: column;
  gap: 4px;

  transition:
    box-shadow 140ms ease,
    transform 140ms ease,
    opacity 140ms ease;
}

/* Hover — shadow lifts */
.task-card:hover {
  box-shadow:
    0 4px 12px 0 color-mix(in srgb, var(--border) 80%, transparent),
    0 1px 3px 0 color-mix(in srgb, var(--border) 40%, transparent);
}

/* Focus ring */
.task-card:focus-visible,
.task-card[data-focused="true"] {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* Dragging state (class toggled by technical agent) */
.task-card.is-dragging {
  cursor: grabbing;
  transform: translateY(-2px);
  box-shadow:
    0 8px 24px 0 color-mix(in srgb, var(--border) 90%, transparent),
    0 2px 6px 0 color-mix(in srgb, var(--border) 60%, transparent);
  z-index: 100;
}

/* Done state */
.task-card.is-done {
  opacity: 0.6;
}
.task-card.is-done .task-card-title {
  text-decoration: line-through;
  color: var(--text-dim);
}

/* Reduced motion — no transitions */
[data-reduced-motion="true"] .task-card {
  transition: none;
}

/* ─── Card header row (checkbox + title + edit button) ───── */

.task-card-header {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.task-card-checkbox {
  flex-shrink: 0;
  margin-top: 2px;   /* optical alignment with first line of title */
  accent-color: var(--accent);
  cursor: pointer;
}

.task-card-title {
  flex: 1;
  font-size: var(--font-size-base);
  font-weight: 500;
  line-height: var(--line-height-base);
  color: var(--text);
  word-break: break-word;
}

/* Edit button — same opacity pattern as .todo-edit */
.task-card-edit {
  flex-shrink: 0;
  background: transparent;
  border: none;
  color: var(--text-dim);
  padding: 2px 4px;
  font-size: 13px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms ease;
  cursor: pointer;
}
.task-card:hover .task-card-edit,
.task-card:focus-within .task-card-edit {
  opacity: 1;
  pointer-events: auto;
}
.task-card-edit:hover { color: var(--accent); }
.task-card-edit:focus-visible {
  opacity: 1;
  pointer-events: auto;
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 3px;
}
[data-reduced-motion="true"] .task-card-edit {
  transition: none;
}

/* ─── Notes ─────────────────────────────────────────────── */

.task-card-notes {
  font-size: calc(var(--font-size-base) - 1px);
  color: var(--text-dim);
  line-height: var(--line-height-base);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
  margin-top: 2px;
}

/* ─── Tags row ───────────────────────────────────────────── */

.task-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

/* Overflow indicator chip */
.task-card-tags-overflow {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 500;
  border-radius: 999px;
  color: var(--text-dim);
  background: color-mix(in srgb, var(--border) 30%, transparent);
  border: 1px solid var(--border);
  white-space: nowrap;
}

/* ─── Delete button ────────────────────────────────────────── */

.task-card-delete {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  background: transparent;
  border: none;
  color: var(--text-dim);
  padding: 2px 4px;
  font-size: 12px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 100ms ease;
  cursor: pointer;
  border-radius: 3px;
}
.task-card:hover .task-card-delete,
.task-card:focus-within .task-card-delete {
  opacity: 1;
  pointer-events: auto;
}
.task-card-delete:hover { color: var(--danger); }
[data-reduced-motion="true"] .task-card-delete {
  transition: none;
}

/* ─── Reminder card extras ──────────────────────────────── */

.task-card-fireat {
  font-size: calc(var(--font-size-base) - 2px);
  font-weight: 600;
  color: var(--accent);
  margin-top: 2px;
}
.task-card-fireat.is-fired {
  color: var(--text-dim);
  font-weight: 400;
}

.task-card-sprint-badge {
  font-size: 11px;
  color: var(--text-dim);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 1px 7px;
  display: inline-block;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
```

---

## 3. Card vs Row Rendering — The Switch

### Where the Switch Lives

**Inside `TodoList` and `RemindersManager`** — the two components
that already own the full render path for their sections.

`TodoList` is used by Today, LongTerm, and (via `SprintManager`) Sprint
tasks. `RemindersManager` owns the reminder render. The switch belongs
in these two components rather than in wrappers like `Today.tsx`
because all the state (items, filter, modals) lives inside them. Lifting
the layout branch to the wrapper would couple `Today.tsx` to tag state,
breaking the existing intentional separation.

Both components read `resolvedSettings(state.settings).layoutMode` from
the store. When it is `"card"`, they render `<CardCanvas>` containing
`<DraggableCard>` wrappers. When it is `"list"` (default), they render
the current `<ul className="todo-list">` unchanged.

### JSX Spec — Todo Card Mode

```tsx
// Inside TodoList render, replacing the <ul className="todo-list"> branch:

{layoutMode === "card" ? (
  <CardCanvas sectionId={`todo-${scope}`}>
    {items.map((t) => {
      const resolvedTags = t.tags
        .map((id) => allTags.find((tag) => tag.id === id))
        .filter((tag): tag is Tag => tag !== undefined);
      return (
        <DraggableCard key={t.id} itemId={t.id} sectionId={`todo-${scope}`}>
          <div
            className={`task-card${t.done ? " is-done" : ""}`}
            data-item-id={t.id}
          >
            <div className="task-card-header">
              <input
                type="checkbox"
                className="task-card-checkbox"
                checked={t.done}
                onChange={(e) => { e.stopPropagation(); toggle(t.id); }}
                aria-label={t.done ? `Mark incomplete: ${t.title}` : `Mark complete: ${t.title}`}
              />
              <span className="task-card-title">{t.title}</span>
              {onEdit && (
                <button
                  className="task-card-edit"
                  onClick={(e) => { e.stopPropagation(); setEditingId(t.id); }}
                  aria-label={`Edit: ${t.title}`}
                  tabIndex={0}
                >
                  ✎
                </button>
              )}
            </div>
            {t.notes && (
              <p className="task-card-notes" title={t.notes}>
                {t.notes}
              </p>
            )}
            {resolvedTags.length > 0 && (
              <div className="task-card-tags">
                {resolvedTags.slice(0, 3).map((tag) => (
                  <TagChip key={tag.id} label={tag.label} color={tag.color} />
                ))}
                {resolvedTags.length > 3 && (
                  <span className="task-card-tags-overflow">
                    +{resolvedTags.length - 3}
                  </span>
                )}
              </div>
            )}
            <button
              className="task-card-delete"
              onClick={(e) => { e.stopPropagation(); remove(t.id); }}
              aria-label={`Delete: ${t.title}`}
              tabIndex={0}
            >
              ✕
            </button>
          </div>
        </DraggableCard>
      );
    })}
  </CardCanvas>
) : (
  <ul className="todo-list">
    {/* existing TodoItem render */}
  </ul>
)}
```

### JSX Spec — Reminder Card Mode

```tsx
// Inside RemindersManager, wrapping filteredUpcoming and filteredFired together:

{layoutMode === "card" ? (
  <CardCanvas sectionId="reminders">
    {[...filteredUpcoming, ...filteredFired].map((r) => {
      const resolvedTags = r.tags
        .map((id) => allTags.find((tag) => tag.id === id))
        .filter((tag): tag is Tag => tag !== undefined);
      return (
        <DraggableCard key={r.id} itemId={r.id} sectionId="reminders">
          <div
            className={`task-card${r.fired ? " is-done" : ""}`}
            data-item-id={r.id}
          >
            <div className="task-card-header">
              <span className="task-card-title">{r.title}</span>
              <button
                className="task-card-edit"
                onClick={(e) => { e.stopPropagation(); setEditingId(r.id); }}
                aria-label={`Edit reminder: ${r.title}`}
                tabIndex={0}
              >
                ✎
              </button>
            </div>
            <div className={`task-card-fireat${r.fired ? " is-fired" : ""}`}>
              <RelativeTime fireAt={r.fireAt} />
              {r.recurrence && r.recurrence !== "none" && (
                <span className="reminder-badge" style={{ marginLeft: 6 }}>
                  {r.recurrence}
                </span>
              )}
              {r.fired && (
                <span className="reminder-badge fired" style={{ marginLeft: 6 }}>
                  fired
                </span>
              )}
            </div>
            {resolvedTags.length > 0 && (
              <div className="task-card-tags">
                {resolvedTags.slice(0, 3).map((tag) => (
                  <TagChip key={tag.id} label={tag.label} color={tag.color} />
                ))}
                {resolvedTags.length > 3 && (
                  <span className="task-card-tags-overflow">
                    +{resolvedTags.length - 3}
                  </span>
                )}
              </div>
            )}
            <button
              className="task-card-delete"
              onClick={(e) => { e.stopPropagation(); deleteReminder(r.id); }}
              aria-label={`Delete reminder: ${r.title}`}
              tabIndex={0}
            >
              ✕
            </button>
          </div>
        </DraggableCard>
      );
    })}
  </CardCanvas>
) : (
  /* existing list render */
)}
```

### DraggableCard Props Contract

The UI agent passes these props; the technical agent owns the
implementation:

```ts
interface DraggableCardProps {
  /** Globally unique item id (todo.id or reminder.id). */
  itemId: string;
  /** Section scope — drives which position map to read/write. */
  sectionId: "todo-today" | "todo-sprint" | "todo-long" | "reminders";
  children: ReactNode;
}
```

The technical agent adds `is-dragging` class to the wrapper element.
The UI agent's `.task-card.is-dragging` CSS rule handles the visual
elevation.

---

## 4. Per-Section Specifics

### Today and LongTerm

`TodoList` is used by both. The only difference is `scope` and
`emptyHint`. In card mode, both sections render a `<CardCanvas>` with
`sectionId="todo-today"` and `sectionId="todo-long"` respectively.
The filter toolbar and add-task form remain above the canvas, identical
to list mode.

### Sprint

Sprint cards live in the **active sprint only**. The sprint header
(progress bar, name, dates) stays above the card canvas. The
`<AddTaskForm>` and `<TagFilterToolbar>` stay above the canvas.

**Archived sprints** always render in **list mode**, regardless of
`layoutMode`. Rationale: archived sprints are read-mostly reference
content inside a collapsed accordion. Adding a drag canvas to each
collapsed archived sprint is unnecessary complexity and would require
storing per-sprint-archive position maps. The `ArchivedSprintRow`
component renders `<TodoItem>` rows unconditionally; no change needed
there.

Archived sprint tasks use a visual affordance in card mode's header
that they are read-only. Consider a note: `"Archived sprints always
display as a list."` in the sprint header when in card mode. This is
a copy-deck item (see §11).

The sprint badge on sprint cards: the `sectionId` for sprint cards
already implies sprint context, so there is no need for a sprint-name
chip on each card. However, the sprint header (name + progress bar)
must remain visible above the canvas so the user knows which sprint
they are looking at. No change to the header.

### Reminders

The existing Upcoming / Fired split (two separate `<div
className="reminders-section">` blocks) is **collapsed into a single
canvas** in card mode. Fired cards carry the `is-done` styling (opacity
+ `is-fired` modifier on `.task-card-fireat`). The user can see both
upcoming and fired cards in the same spatial layout.

The "Upcoming (N)" and "Fired (N)" section headings are **not shown**
in card mode — they are list-mode concepts. The fired badge on each
reminder card carries the same information without requiring visual
grouping.

The canvas ordering for initial layout: upcoming cards placed first
(top-left flow), fired cards placed after. This is the technical
agent's responsibility; the visual contract is that upcoming cards have
no extra styling, fired cards have `is-done` + `is-fired`.

### Filter Toolbar

**Always shown above the canvas in card mode**, same position as list
mode. Filtering hides cards (or shows empty canvas) but does NOT
reflow remaining cards to fill gaps. Cards stay at their saved
positions. This contract is stated explicitly in §5.

### Add-Task / Add-Reminder Forms

**Stay above the canvas**, identical to list mode. No change. The form
is not part of the draggable canvas.

---

## 5. Empty / Initial / Transition States

### First-Time Activation (Populated Section)

When the user switches from list → card mode for the first time on a
section with items, cards need initial positions. The technical agent
owns the position data. The **visual spec** for initial layout:

**Waterfall / cascade from top-left.** Cards are placed in rows with
a natural wrap:
- Start x: 20px from canvas edge
- Start y: 20px from top
- Column gap: 16px (2 grid units at 8px grid)
- Row gap: 16px
- Wrap to a new row when the next card would exceed the canvas width
  minus 20px right margin

This is purely for initial placement — the user repositions from here.
The arrangement is intentionally non-uniform (not a strict grid) to
visually signal that these cards are free to be moved.

**Faint onboarding hint.** On first activation, show a dismissible
text overlay at the bottom of the canvas (not obscuring cards):

```
"Drag cards to rearrange them. They snap to a grid."
                                                [Got it]
```

This hint is shown once per session (not persisted). The technical
agent tracks whether to show it; the UI agent specifies its visual:
`position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%);
background: var(--panel); border: 1px solid var(--border);
border-radius: var(--radius); padding: 8px 14px; font-size: 12px;
color: var(--text-dim);` with a small `[Got it]` button that dismisses.

### Empty Section in Card Mode

```
.card-canvas-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: var(--text-dim);
  border: 1px dashed var(--border);
  border-radius: var(--radius);
}
```

Copy: section-specific (see §11 Copy Deck).

### Active Filter in Card Mode

**Cards matching the filter are shown. Cards not matching are hidden
(`display: none`). Cards retain their saved positions.** The layout does
NOT reflow. Rationale: if positions reflow on filter, the user loses
their spatial arrangement every time they toggle a filter — this defeats
the purpose of free placement.

This is an explicit contract with the technical agent. The technical
agent must:
- Keep the canvas min-height at the high-water mark of all cards'
  positions (not only visible cards' positions), so the canvas does
  not collapse when all cards are hidden.
- Not re-run any initial-layout algorithm when the filter changes.

The UI agent enforces this by setting `visibility: hidden` (not
`display: none`) — this preserves the card's space in the canvas so
the canvas does not collapse. Update: actually `visibility: hidden`
preserves layout space but also leaves a ghost. Prefer `opacity: 0;
pointer-events: none;` instead — fully invisible, no interaction,
but the canvas still knows the card exists at its position.

**Revised contract:** filtered-out cards get:
```css
.task-card.is-filtered-out {
  opacity: 0;
  pointer-events: none;
}
```
The `is-filtered-out` class is set by the section component based on
`filterByTags` result, applied to the wrapping `<DraggableCard>`.

### Reset Positions Affordance

**Per-section toolbar button, not in Settings.** Rationale:

- Settings is for global preferences. "Reset positions for this
  section" is a section-specific action. Putting it in Settings would
  require the user to open Settings, navigate to Display, and click
  Reset — too many steps for a frequently useful action.
- A per-section toolbar button appears inline when the section is in
  card mode. It sits next to the `<TagFilterToolbar>` in the toolbar row.

Visual: a small icon button with tooltip "Reset card positions". Uses
`var(--text-dim)` at rest, `var(--text)` on hover, same styling as the
section header action buttons in sprint (`sprint-header-actions button`).

Label: `↺ Reset layout`

Confirmation: none needed. Position data can be regenerated; resetting
is easily reversible by manual dragging. No two-step confirm.

---

## 6. Grid Snap Visualization

**Recommendation: visible while dragging only (fade-in dots).**

The other options:
- Always hidden: clean, but users with many cards may struggle to align
  things and never discover snapping is happening.
- Always visible: creates visual noise at rest; the grid competes with
  card content.
- Toggleable: adds a settings field for a minor detail; overkill.

Dots (or crosses) fade in when a drag begins and fade out when the drag
ends. Implementation: a CSS pseudo-element on `.card-canvas.is-dragging`
using a radial-gradient background-image pattern:

```css
.card-canvas {
  --grid-size: 8px;   /* Coordinate with technical agent — see §10 */
}

.card-canvas.is-dragging::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: radial-gradient(
    circle,
    color-mix(in srgb, var(--border) 60%, transparent) 1px,
    transparent 1px
  );
  background-size: var(--grid-size) var(--grid-size);
  opacity: 0;
  animation: grid-fade-in 150ms ease forwards;
  z-index: 0;
}

@keyframes grid-fade-in {
  to { opacity: 1; }
}

[data-reduced-motion="true"] .card-canvas.is-dragging::before {
  animation: none;
  opacity: 0.5;
}
```

The `is-dragging` class on `.card-canvas` is set by the technical
agent when any card in the canvas starts dragging. The dots are purely
CSS — no JS needed for the visualization. The grid-size CSS custom
property is set by the technical agent once and can be overridden per
canvas element.

No toggleable setting is needed for the grid dot pattern. If users
complain the dots are too visible the opacity can be reduced without
a settings field. This keeps `UserSettings` clean.

---

## 7. Edit / Click Affordances on Cards

### Distinguishing Drag from Click

The technical agent handles this at the drag library level (the
standard solution is: if pointer moves < 4px before release, treat as
a click). The UI agent does not need to implement this distinction — it
only needs to know the contract:

**A single tap/click that does not initiate a drag triggers the card's
onClick handler.** The card's `onClick` is:
- On the checkbox area: toggle done state (handled by the checkbox
  `onChange`, which calls `e.stopPropagation()`).
- On the delete button: delete (calls `e.stopPropagation()`).
- On the edit button: open edit modal (calls `e.stopPropagation()`).
- Anywhere else on the card body: **do nothing** (no implicit click-to-
  edit). The drag-vs-click threshold means a clean tap would open edit,
  but this feels surprising when the user expects to drag. Explicit
  affordance (the pencil button) is better.

**Edit modal is triggered by the pencil button (✎) only.** This button
is always in the DOM and tab order, shown on hover/focus-within (same
pattern as `.todo-edit` in the list mode). No double-click.

Rationale for rejecting double-click: double-click is not a reliable
affordance on touch devices; it is invisible to new users; it conflicts
with text selection if the card ever becomes text-selectable. The
pencil button is explicit and already exists in list mode — consistency.

### Done Checkbox

**Top-left of the card header row.** The `.task-card-header` flex row:
`[checkbox] [title] [edit-button]`. Checkbox at top-left with
`margin-top: 2px` for optical alignment with the first line of the
title. Same pattern as `todo-item`.

Reminders have no "done" checkbox — use the `is-fired` visual state
(opacity fade + `is-fired` label on the fireAt line) rather than
a checkbox. Reminders are not manually markable as done.

### Delete Button

**Top-right corner of the card**, absolutely positioned.
`position: absolute; top: var(--space-2); right: var(--space-2);`
Hidden at rest (`opacity: 0; pointer-events: none`), revealed on
hover/focus-within of the parent card (same opacity-transition pattern
as `.todo-edit`). Trigger: `e.stopPropagation()` to prevent drag
initiation.

The delete button is intentionally smaller than the list-mode delete
button (12px font size vs the list-row's `✕` at default size) to
avoid accidental triggers during drag.

---

## 8. Accessibility

### Keyboard Navigation

**Tab order:** cards are tabbable in DOM order. DOM order should
reflect the visual waterfall layout (the technical agent places cards
in DOM order matching the default layout position). After the user
drags cards, DOM order becomes divorced from visual order — this is a
known limitation of free-placement canvases and is accepted in v1.

**Arrow key movement (visual spec for the technical agent to implement):**
When a card has focus, `Arrow` keys move it 1 grid unit (8px) in the
pressed direction. `Shift+Arrow` moves it 10 grid units (80px). The
focus ring (`outline: 2px solid var(--accent); outline-offset: 2px`)
is the visual indicator.

**Tab within a card:** Tab moves through the card's interactive
elements in order: checkbox → edit button → delete button → next
card's checkbox. The tab order is natural because all interactive
elements are in DOM order.

**Escape:** If focus is inside a card, Escape moves focus to the
section heading (escaping the canvas). The technical agent implements
this behavior; the section heading needs `tabIndex={-1}` to be
programmatically focusable.

### Screen Reader Story

The canvas uses `role="application"` on `<CardCanvas>`. This signals
to screen readers that keyboard interactions beyond the standard web
model are available here. Within the application region:

- Each card is a `<article>` with `aria-label` = the todo title
  (or `aria-label` = reminder title + fire-at time for reminders).
- The card's position information is NOT announced (screen reader
  users don't benefit from coordinates; they navigate via tab and
  hear the content).
- The done checkbox has `aria-label` as specced in the JSX above.
- The edit button and delete button have `aria-label` as specced.

An `aria-description` on `<CardCanvas>`: `"Use Tab to move between
cards, arrow keys to reposition the focused card."` This is announced
once when focus enters the canvas.

List semantics (using `<ul><li>`) are intentionally NOT used for the
canvas — list semantics imply a linear navigable sequence that does
not match free-placement. `role="application"` with labelled
`<article>` cards is the correct semantic.

### High-Contrast

All colors use CSS custom properties from `theme.css`. In
`forced-colors: active` (Windows High Contrast), browsers substitute
system colors. No additional High Contrast CSS is needed as long as no
hardcoded hex is used in card styles. The only hardcoded hex in the
card CSS above is `#fff` for the toggle thumb — that should be
`ButtonText` in forced-colors context. Use:

```css
@media (forced-colors: active) {
  .task-card {
    border: 1px solid ButtonText;
    forced-color-adjust: auto;
  }
}
```

### Reduced Motion

All transitions on `.task-card` are wrapped in:
```css
[data-reduced-motion="true"] .task-card { transition: none; }
```
Grid fade-in animation is suppressed (see §6 CSS). The `is-dragging`
`translateY(-2px)` lift still applies (it is a static transform, not
an animation). Box-shadow change happens instantly.

---

## 9. Mobile / Narrow Viewport

New tab pages open at full desktop width in most Chrome installations.
However, Chrome on Android and narrow windows exist.

**At `< 600px` width: force list mode regardless of `layoutMode`
setting.**

Rationale: a free-placement drag canvas on a touch screen where the
viewport is < 600px is nearly unusable. Cards at 240px min-width in a
< 600px space leave < 100px of drag room. Touch drag on mobile Chrome
conflicts with page scroll. Graceful degradation is: fall back to the
list view the user already knows.

Implementation: a CSS media query **and** a render branch:

```css
@media (max-width: 599px) {
  .card-canvas { display: none; }
  .card-canvas + .todo-list-fallback { display: block; }
}
```

The component also renders a fallback list in the DOM (with
`className="todo-list-fallback"`) that is hidden at wider widths.
This avoids a JS `window.innerWidth` check (which causes a flash) and
keeps both render paths in the DOM simultaneously at the cost of
minimal extra work.

No user-visible warning is shown. The section simply renders as a list.
If the user opens Settings while in narrow viewport, the layout toggle
is still visible and editable (the preference is preserved; it just
does not take effect at narrow widths).

---

## 10. Integration Contract with the Technical Agent

### Reading layoutMode

Both UI and technical agents read the same value:

```ts
const rs = resolvedSettings(state.settings);
const inCardMode = rs.layoutMode === "card";
```

`resolvedSettings` is already imported in `TodoList.tsx` (indirectly
via `useStore`) — technically it is called at the store layer. The
simplest pattern: read `state.settings.layoutMode ?? "list"` directly
in the component (since the field has a clear default), or add
`layoutMode` to `ResolvedUserSettings` and call `resolvedSettings()`.
Prefer the latter for consistency with every other setting.

### Primitives the UI Agent Will Use

| Primitive | Owner | UI agent uses it by |
|---|---|---|
| `<CardCanvas>` | Technical agent | Wrapping the items render in card mode |
| `<DraggableCard>` | Technical agent | Wrapping each `.task-card` div |

The UI agent does **not** call any position storage APIs directly.
Position reads/writes are entirely inside `<DraggableCard>` and
`<CardCanvas>`.

### Field Name Confirmation

`layoutMode: "list" | "card"` — confirmed. The technical agent must
use this exact name in any storage migration or type extension.

### Grid Size Constant

**8px.** This is a common choice: aligns with `--space-1: 4px` (half
grid) and `--space-2: 8px` (full grid). Cards placed at multiples of
8px align cleanly with padding tokens. The technical agent sets the
snap grid to 8px. The CSS custom property `--grid-size: 8px` is set
on `.card-canvas` (see §6).

Expose it as a shared constant `CARD_GRID_SIZE = 8` in a shared
constants file (e.g., `src/storage/constants.ts` alongside
`DEFAULT_SETTINGS`) so both agents import the same value.

### Reset-Positions Semantics

`resetPositions(sectionId: string)` — a function the technical agent
exports from the data layer. It removes all stored positions for the
given `sectionId`, causing the next render to fall back to the
waterfall initial layout algorithm. Called by the "Reset layout"
button in the UI agent's per-section toolbar.

The UI agent renders the button; the technical agent implements the
function. The button's `onClick` calls `resetPositions(sectionId)`.

### Summary Table

| Decision | Value |
|---|---|
| Field name | `layoutMode: "list" \| "card"` |
| Default | `"list"` |
| Grid size | `8px` (constant `CARD_GRID_SIZE`) |
| Card width | `240px` fixed, `min 200px`, `max 320px` |
| Card height | auto, min `72px`, notes clamped 3 lines |
| DraggableCard props | `itemId`, `sectionId`, `children` |
| Reset fn signature | `resetPositions(sectionId: string): void` |
| Archived sprints in card mode | Always list — never card |
| Filter behavior | Cards hidden in place (`opacity: 0`); no reflow |

---

## 11. Copy Deck

### Settings

| ID | Text |
|---|---|
| `layout.legend` | `Todo layout` |
| `layout.opt.list` | `List` |
| `layout.opt.card` | `Cards` |
| `layout.hint` | `Cards let you drag items freely across the section and snap them to a grid.` |

### Empty States (Card Mode)

| Section | Copy |
|---|---|
| Today (no tasks) | `Nothing due today. Add a task above to get started.` |
| Sprint (no tasks) | `No tasks in this sprint yet. Add one above.` |
| LongTerm (no tasks) | `No long-term tasks yet. Add something to work toward.` |
| Reminders (no reminders) | `No reminders yet. Set one above.` |
| Any section, filter active, no matches | `No items match the selected tags. [Clear the filter] to see everything.` |

### Onboarding Hint

```
Drag cards to rearrange. They snap to a grid.    [Got it]
```

### Reset Positions Button

```
↺ Reset layout
```
Tooltip (title attribute): `Reset card positions to default`

### Archived Sprints Note (Sprint section in card mode)

```
Archived sprints display as a list.
```
(Shown as a small dim note below the archived sprints heading when `layoutMode === "card"`)

### Accessibility Descriptions

`<CardCanvas aria-description>`:
```
Use Tab to move between cards, Arrow keys to reposition the focused card.
```

### Error / Edge Cases

| Situation | Message |
|---|---|
| Canvas fails to load positions (storage error) | Cards display in default waterfall layout. No error surfaced to user — silent degradation. |

---

## 12. Visual Wireframes

### Today Section in Card Mode (3-4 cards)

```
┌─────────────────────────────────────────────────────────────────────┐
│  TODAY                                                         [↺ Reset layout]  │
│  ┌──────────────────────────────────────────┐                         │
│  │ What's on for today?                [Add] │                         │
│  └──────────────────────────────────────────┘                         │
│  [#work] [#personal]                                                  │
│                                                                       │
│  ┌──────────────────────┐       ┌──────────────────────┐             │
│  │ ☐  Write Q2 report   │  ✕   │ ☐  Review PR #142    │  ✕          │
│  │    Still need to add │       │                        │             │
│  │    the charts and    │       │   [#work]              │             │
│  │    exec summary      │       └──────────────────────┘             │
│  │    [#work] [#q2]     │                                              │
│  └──────────────────────┘   ┌──────────────────────────────┐         │
│                               │ ☑  Buy groceries         ✕ │         │
│  ┌──────────────────────┐    │    ~~strikethrough title~~   │         │
│  │ ☐  Call dentist   ✕  │    └──────────────────────────┘         │
│  │    [#personal]         │                                              │
│  └──────────────────────┘                                              │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │  Drag cards to rearrange. They snap to a grid.    [Got it]   │    │
│  └──────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### Single Card with Notes and Tags

```
┌──────────────────────────────────────┐
│ ☐  Write Q2 report                 ✕ │  ← header row: checkbox + title + delete
│                                        │  ← edit pencil (✎) visible on hover
│    Still need to add the charts and    │  ← notes in var(--text-dim), 3-line clamp
│    executive summary. Data comes       │
│    from analytics dashboard.           │
│                                        │
│    [#work]  [#q2]  +1 more             │  ← tag chips + overflow
└──────────────────────────────────────┘
  ↑ var(--panel-2) bg, 1px var(--border), var(--radius) corners
  ↑ grab cursor at rest
  ↑ shadow lifts on hover
```

### Settings Toggle UI (inside Display section)

```
┌─────────────────────────────────────────────────────────┐
│ DISPLAY                                                   │
│                                                           │
│ GREETING                                                  │
│ ┌─────────────────────────────────────────────┐          │
│ │   Off   │   With time of day                │          │
│ └─────────────────────────────────────────────┘          │
│ Shows "Good morning, [name]" at the top of the page.     │
│                                                           │
│ TODO LAYOUT                                               │
│ ┌───────────────────────────┐                            │
│ │     List    │    Cards    │                            │
│ └───────────────────────────┘                            │
│ Cards let you drag items freely across the section and   │
│ snap them to a grid.                                      │
└─────────────────────────────────────────────────────────┘
```

### Reminders Section in Card Mode (Upcoming + Fired)

```
┌──────────────────────────────────────────────────────────────────┐
│  REMINDERS                                          [↺ Reset layout] │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Add Reminder form (unchanged)                              │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  [#work] [#health]   (filter toolbar)                             │
│                                                                    │
│  ┌──────────────────────┐      ┌──────────────────────────┐      │
│  │  Team standup      ✕ │      │  Doctor appointment    ✕ │      │
│  │  ● in 2 hours          │      │  ● tomorrow 9:00 AM    │      │
│  │     [daily]            │      │     [#health]            │      │
│  └──────────────────────┘      └──────────────────────────┘      │
│                                                                    │
│                 ┌──────────────────────────────────┐              │
│                 │  Pay rent                      ✕ │              │
│                 │  ● 3 days ago · May 9 12:00 PM   │              │  ← fired card
│                 │     [fired]  [#finance]           │              │  ← opacity 0.6
│                 └──────────────────────────────────┘              │
└──────────────────────────────────────────────────────────────────┘

● upcoming dot = color: var(--accent), "is-fired" dot = color: var(--text-dim)
```

---

## 13. Risks and Open Questions

### Risks

**R1 — Canvas height / scrolling conflict.** The card canvas is
`position: relative` inside the normal page flow. As users move cards
to large y-coordinates, the canvas grows and the page scrolls. This
is correct behavior but may feel jarring if cards are dragged near the
bottom of the canvas and the page suddenly expands. The technical agent
should set a `max-height` on the canvas (e.g., `80vh`) with
`overflow-y: auto` to contain this, or alternatively let the canvas
grow naturally and accept page scroll as the container mechanism.
**Decision needed from technical agent.**

**R2 — Touch drag vs. scroll on mobile.** Solved by the `< 600px`
force-list-mode rule in §9. However, 600–800px windows on tablet may
still have touch-drag vs. page-scroll conflicts. If a touch library is
used for drag, it needs to call `e.preventDefault()` on `touchstart`,
which suppresses page scroll. The technical agent must decide whether
to support touch drag or mark it as out-of-scope for v1.

**R3 — State drift: layoutMode live preview in Settings.** Since
`layoutMode` applies live (like Theme), the user will see the canvas
animate into existence behind the Settings modal. This is fine visually
but the canvas will have received a `first-time layout` render while
the modal is open. Test that dismissing / canceling Settings does not
trigger a double-layout.

**R4 — `resolvedSettings` call in TodoList.** `TodoList` currently
reads from `useStore()` but does not call `resolvedSettings()` — it
reads raw settings fields. To read `layoutMode` cleanly it should call
`resolvedSettings(state.settings)` inside the component. This adds a
small per-render computation. Wrap in `useMemo` with `[state.settings]`
dependency.

**R5 — Card z-index management.** With `position: absolute` cards,
overlapping cards need a `z-index` strategy. The most-recently-moved
card should sit on top. The technical agent should manage this via a
`lastMoved` list or similar and apply `z-index` dynamically. The UI
agent's CSS sets `z-index: 100` only on `.is-dragging`; at rest all
cards share z-index context managed by the technical agent.

**R6 — Archived sprint interaction.** When `layoutMode === "card"`,
`ArchivedSprintRow` is explicitly kept in list mode. If the user
expects archived sprints to also become cards, this will be a
frustrating surprise. The copy deck note ("Archived sprints display as
a list") mitigates this but is easy to miss.

### Open Questions

**OQ1 — Card resize in v2?** Users may want to resize cards (e.g.,
make a card wider to show more notes). This is out of scope for v1 but
the card CSS should not hardcode widths in a way that prevents future
resizing. Using a CSS custom property `--card-width: 240px` rather than
a hard `width: 240px` would let v2 add resize handles.

**OQ2 — Multi-select and bulk operations?** Some users may want to
select multiple cards and move them together. Out of scope for v1.
No visual infrastructure needs to be added now.

**OQ3 — Card stacking / lanes?** A future version could allow cards
to be grouped into visual lanes (e.g., "by tag color"). Not in scope.
The position storage schema the technical agent designs should be
flexible enough to add metadata later (not just x/y).

**OQ4 — Does Gantt section need card mode?** The user said "today /
sprint / long-term and reminders." Gantt is explicitly excluded. The
`sectionVisibility` object already separates `gantt` from the others.
No card mode for Gantt.

---

## 14. Recommended Commit Sequence

These are the UI/UX agent's commits. Coordinates with the technical
agent who has a parallel sequence.

```
feat(types): add layoutMode field to UserSettings + ResolvedUserSettings
```
- Add `layoutMode?: "list" | "card" | undefined` to `UserSettings`
- Add `layoutMode: "list" | "card"` to `ResolvedUserSettings`
- Add default `layoutMode: "list"` to `DEFAULT_SETTINGS` in constants.ts
- Update `resolvedSettings()` to include the field

```
feat(settings): add Todo layout segmented control to Display section
```
- Add `SegmentedControl<LayoutMode>` to `DisplaySection` in
  `SettingsModal.tsx`
- Wire to `live("layoutMode", v)` (live preview, no pending state)
- No new CSS needed — uses existing `.settings-segmented` styles

```
feat(style): add task-card CSS component
```
- Create `src/components/cards/task-card.css` with all `.task-card`
  family rules from §2
- Import in whichever component first uses it

```
feat(sections): integrate card mode in TodoList
```
- Read `resolvedSettings(state.settings).layoutMode` in `TodoList`
- Render `<CardCanvas>` + `<DraggableCard>` + `.task-card` in card mode
- Keep existing `<ul className="todo-list">` in list mode
- Add "Reset layout" button to toolbar row (card mode only)

```
feat(sections): integrate card mode in RemindersManager
```
- Same pattern as TodoList
- Unified canvas for upcoming + fired reminders
- Reminder card shows `fireAt` prominently with `.task-card-fireat`

```
feat(style): card canvas grid snap visualization
```
- Add `.card-canvas.is-dragging::before` CSS for dot grid
- `--grid-size` CSS custom property

Depend-on from technical agent before these last two commits:
- `<CardCanvas>` and `<DraggableCard>` primitives are merged to `main`

The two agents can develop in parallel on `main` without conflict if
the technical agent lands the primitive components (without integration
wiring) first and the UI agent imports them in the integration commits.
```
