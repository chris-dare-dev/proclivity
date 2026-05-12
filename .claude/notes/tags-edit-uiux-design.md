# Tags & Edit — UI/UX Design Plan

> **Scope:** Visual design, interaction model, accessibility, and copy for
> (1) labels/tags on Todo and Reminder items with filter-by-tag, and
> (2) inline editing of Todo and Reminder items after creation.
>
> **Not in scope:** data schema, storage layer, service-worker changes
> (owned by sibling agent). Schema assumptions are called out generically
> (`tag.label`, `tag.color`, `todo.tags[]`, `reminder.tags[]`, etc.).

---

## Executive Summary

Five key decisions this plan stakes out:

1. **Tag chips use background-tint + text-on-tint (no solid fill).** Each
   chip reads `background: color-mix(in oklch, <tagColor> 18%, transparent)`
   with text at the full hue. This keeps chips visually soft in both dark
   and light themes without requiring per-chip contrast math.

2. **Edit via modal, not inline.** Inline editing cannot surface notes,
   scope reassignment, sprint reassignment, or the tag picker without
   pushing complex layout into a 44 px tall row. The existing `Modal`
   component with focus-trap and escape handling is already production-ready
   — editing re-uses it at zero extra bundle weight.

3. **Pencil icon on hover, not full-row click.** The row is already used
   for checkbox toggling (Todo) and visual scanning. Making the whole row
   clickable to edit creates ambiguity. A pencil icon that appears on hover
   is discoverable and does not conflict with the existing delete (×) affordance.

4. **Filter toolbar lives directly above each section's todo list, below
   the add-input.** It is persistent but visually subdued when no tags are
   active (opacity 0.5). When filters are active it becomes full-opacity
   with a tinted background strip, making the active-filter state obvious
   when returning to the tab.

5. **Tag manager lives in Settings, not a separate modal.** A new "Tags"
   section follows the existing Settings pattern (section heading + inline
   list). This is consistent with "Visible sections" in the Dashboard pane —
   a list of items with inline controls.

---

## ASCII Wireframes

### (a) Tagged Todo row with filter toolbar visible

```
┌────────────────────────────────────────────────────────────────┐
│  FILTER  ● design  ● backend  ○ infra          [Clear filters] │  ← filter toolbar, "design" + "backend" active
│  Showing 2 of 7 items                                          │
├────────────────────────────────────────────────────────────────┤
│  ☐  Write API spec         ╔═design══╗ ╔═backend═╗   ✏  ✕  │  ← todo row
│  ☑  Review PR              ╔═backend═╗                  ✏  ✕  │
└────────────────────────────────────────────────────────────────┘
  ↑checkbox  ↑title (flex:1)  ↑tag chips (flex-wrap)  ↑edit ↑delete
```

Key: ● = active filter chip  ○ = inactive filter chip

### (b) Edit Todo modal

```
┌──────────────────────────────────────────────┐
│  Edit task                                    │
│  ─────────────────────────────────────────── │
│  Title                                        │
│  ┌──────────────────────────────────────────┐ │
│  │ Write API spec                           │ │
│  └──────────────────────────────────────────┘ │
│                                               │
│  Notes (optional)                             │
│  ┌──────────────────────────────────────────┐ │
│  │                                          │ │
│  │                                          │ │
│  └──────────────────────────────────────────┘ │
│                                               │
│  Scope                                        │
│  [ Today ]  [ Sprint ]  [ Long-term ]         │  ← segmented control
│                                               │
│  Sprint  (visible only when scope = sprint)   │
│  [ Sprint 12 ▾ ]                              │
│                                               │
│  Tags                                         │
│  ╔══design══╗ ╔══backend══╗  [+ Add tag]     │
│  ┌──────────────────────────────────────────┐ │
│  │ Search or create tag…            ↑ shown │ │  ← picker popover (open)
│  ├──────────────────────────────────────────┤ │
│  │  ● frontend                              │ │
│  │  ● infra                                 │ │
│  │  + Create "analytics"                    │ │
│  └──────────────────────────────────────────┘ │
│                                               │
│                       [Cancel]  [Save changes]│
└──────────────────────────────────────────────┘
```

### (c) Edit Reminder modal

```
┌──────────────────────────────────────────────┐
│  Edit reminder                                │
│  ─────────────────────────────────────────── │
│  ┌──────────┬───────────────────────────────┐ │
│  │  Title   │ [Reminder title…            ] │ │
│  ├──────────┼───────────────────────────────┤ │
│  │  Fire at │ [date-time input            ] │ │
│  ├──────────┼───────────────────────────────┤ │
│  │  Repeat  │ [ None ▾ ]                    │ │
│  ├──────────┼───────────────────────────────┤ │
│  │  Todo    │ [ — none — ▾ ]               │ │
│  ├──────────┼───────────────────────────────┤ │
│  │  Tags    │ ╔=work=╗  [+ Add tag]        │ │
│  └──────────┴───────────────────────────────┘ │
│                                               │
│                       [Cancel]  [Save changes]│
└──────────────────────────────────────────────┘
```

---

## 1. Tag Chip Visual Design

### Structure

A tag chip is a `<span class="tag-chip">` containing the tag's `tag.label`
text. No icons inside the chip — the label is the only signal.

```
╔══ design ══╗   ← background-tint, colored border, colored text
```

### CSS specification

```css
/* Chip base — in sections.css or a new tag-chip.css */
.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 500;
  border-radius: 10px;
  line-height: 1.4;
  white-space: nowrap;
  /* Color is driven by --chip-color, set via inline style on each chip */
  background: color-mix(in oklch, var(--chip-color, var(--accent)) 15%, transparent);
  color: color-mix(in oklch, var(--chip-color, var(--accent)) 80%, var(--text));
  border: 1px solid color-mix(in oklch, var(--chip-color, var(--accent)) 35%, transparent);
  /* Prevents text from shrinking aggressively in flex rows */
  flex-shrink: 0;
}

/* Remove-button inside chip (edit context only, not in list rows) */
.tag-chip-remove {
  background: transparent;
  border: none;
  padding: 0 0 0 2px;
  color: inherit;
  opacity: 0.7;
  cursor: pointer;
  font-size: 10px;
  line-height: 1;
  border-radius: 50%;
}
.tag-chip-remove:hover {
  opacity: 1;
}
```

The `--chip-color` is set as an inline style property by the rendering
component: `style={{ "--chip-color": tag.color } as React.CSSProperties}`.

### Multi-chip wrapping in a row

The `.todo-item` uses `display: flex; align-items: center`. Tags are
grouped inside a `.todo-item-tags` container:

```css
.todo-item-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  /* Prevents chips from expanding to fill all remaining space */
  flex: 0 1 auto;
  min-width: 0;
}
```

The title gets `flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis;
white-space: nowrap;` so it shrinks before chips wrap. Chips wrap onto a
second line if the row is tight; this is acceptable because the row height
is variable (it already wraps for the "done" strikethrough state).

**Row layout after tags:**
```
[checkbox] [title………………] [chip][chip] [✏] [✕]
```
For a row with 2 chips at 44 px (default density):
```
☐  Write API spec         ╔design╗ ╔backend╗  ✏  ✕
```

### Dark/light theme

The `color-mix(in oklch, ...)` approach automatically adapts:
- Dark theme (`--panel: oklch(0.14 …)`): the 15% tint is barely visible
  against the very dark panel. Text at 80% hue is vivid and readable.
- Light theme (`--panel: oklch(1.00 …)`): white panels — 15% tint gives
  a clear pastel swatch. Text at 80% hue remains >4.5:1 against white
  for most palette colors (see §2 for palette choices).

No media query is needed — the `oklch` color-mix responds to the CSS
custom properties that the theme data-attribute already overrides.

---

## 2. Tag Color Palette

### Chosen approach: 8 presets + native `<input type="color">`

This matches the accent swatch picker in Settings v2 exactly. The
rationale: consistency beats novelty. The user already knows this
pattern from the accent color picker; adding a 9th "rainbow" swatch
opens a native color picker. Any tag color is therefore legal.

### Eight preset colors

Selected for:
- Deuteranopia/protanopia safety: no pure red/green pairs at close
  perceptual proximity. Blue, teal, amber, violet, rose, orange, sky, lime
  avoid the most common CVD failure modes.
- 4.5:1 minimum contrast against the dark `--panel` (`oklch(0.14 …)`) at
  80% hue saturation (tested with the WCAG relative luminance formula).
- Distinct enough to tell apart at a glance even at 11 px chip size.

```css
/* TAG_PRESETS — matches the ACCENT_PRESETS pattern in SettingsModal.tsx */
const TAG_PRESETS = [
  { name: "Indigo",  value: "oklch(0.65 0.18 264)" },  /* blue-violet */
  { name: "Teal",    value: "oklch(0.68 0.16 179)" },  /* teal-green  */
  { name: "Rose",    value: "oklch(0.65 0.20 0)"   },  /* rose-red    */
  { name: "Amber",   value: "oklch(0.72 0.16 60)"  },  /* warm amber  */
  { name: "Violet",  value: "oklch(0.62 0.20 300)" },  /* purple      */
  { name: "Sky",     value: "oklch(0.68 0.16 220)" },  /* sky blue    */
  { name: "Lime",    value: "oklch(0.72 0.16 130)" },  /* yellow-green*/
  { name: "Orange",  value: "oklch(0.70 0.19 45)"  },  /* warm orange */
] as const;
```

Using OKLCH values (rather than hex) means the mix formula `color-mix(in
oklch, …)` operates in a perceptually uniform space — tints are naturally
proportional regardless of hue.

**Light theme check:** against `--panel: oklch(1.00 0 0)` (pure white),
the chip text color is `color-mix(in oklch, <tag> 80%, var(--text))`.
At the light-mode `--text: oklch(0.18 …)`, this pulls each chip text
toward near-black at 20%, guaranteeing contrast even for light presets
like Lime and Amber. Verified acceptable perceptually; implementor should
run a final WCAG check on Lime/Amber against `oklch(1.00 0 0)`.

---

## 3. Tag Picker UX During Create/Edit

### Location

A `<div class="tag-picker-area">` appears below the title input in both
the create-todo and edit-modal contexts. It is not in the compact `todo-input`
row (which is width-constrained) — it appears as a distinct field row.

For Reminders the picker area slots between the "Link to todo" field and
the form actions, as a new `reminder-form-field reminder-form-field-full` row.

### Interaction flow

1. **Assigned chips + trigger button.** The area renders currently-assigned
   chips (with × remove buttons) followed by a dashed chip-shaped button:
   `[+ Add tag]`. This mirrors the `sprint-tab-new` dashed button pattern.

2. **Opening the popover.** Clicking `[+ Add tag]` opens an inline popover
   below the trigger. This is a `<div role="listbox" aria-label="Tag picker">`
   attached via absolute positioning to the form. It is not a portal — it
   lives inside the form so focus-trap logic in Modal.tsx continues to work
   without modification. The popover has `max-height: 180px; overflow-y: auto`.

3. **Searching/creating.** A `<input type="text" placeholder="Search or
   create tag…" autoFocus>` is at the top of the popover. As the user types,
   the list filters existing tags by `tag.label`. If the input value matches
   no existing tag, a `+ Create "<value>"` row appears at the bottom of the
   list (matches GitHub label picker convention).

4. **Selecting an existing tag.** Clicking (or pressing Enter on) a tag
   row adds it to the item's `tags[]` list. The chip appears in the picker
   area. Multiple selections are allowed. Already-selected tags show a
   checkmark and are de-selectable by clicking again.

5. **Creating a new tag.** Clicking `+ Create "<value>"` (or pressing
   Enter when the value matches nothing): creates a new tag in the global
   tag store, sets a default color (first unused preset), adds it to the
   item. The user can later recolor it in Settings > Tags.

6. **Removing a chip.** The × button on a chip in the picker area removes
   the tag from the item but does NOT delete the tag globally. Global
   deletion happens only in Settings > Tags.

7. **Closing the popover.** Click outside the popover, press Escape, or
   press Tab past the last item. Focus returns to the `[+ Add tag]` button.

### CSS (popover)

```css
.tag-picker-popover {
  position: absolute;
  z-index: 100;
  top: calc(100% + 4px);
  left: 0;
  min-width: 200px;
  max-width: 280px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.tag-picker-search {
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
  /* Override global input styles — no rounded bottom corners */
  border-radius: 0;
  border-top: none;
  border-left: none;
  border-right: none;
  background: transparent;
  font-size: 13px;
}
.tag-picker-search:focus {
  outline: none;
  border-bottom-color: var(--accent);
}

.tag-picker-list {
  list-style: none;
  margin: 0;
  padding: 4px 0;
  max-height: 160px;
  overflow-y: auto;
}

.tag-picker-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
}
.tag-picker-item:hover,
.tag-picker-item[aria-selected="true"] {
  background: color-mix(in oklch, var(--accent) 8%, transparent);
}
.tag-picker-item-check {
  width: 14px;
  height: 14px;
  color: var(--accent);
  flex-shrink: 0;
}

.tag-picker-create {
  padding: 6px 12px;
  font-size: 12px;
  color: var(--accent);
  cursor: pointer;
  border-top: 1px solid var(--border);
}
.tag-picker-create:hover {
  background: color-mix(in oklch, var(--accent) 8%, transparent);
}
```

### Dependency note for sibling agent

The picker needs access to the global tag store (`state.tags[]`). The
create-tag action (`onCreateTag(label: string): Tag`) and the select/
deselect actions (`onToggleTag(tagId: string)`) should be passed as props
so the picker component is pure. The initial color assigned on creation
should be the first preset not yet used by any tag — implementor picks
the cycle logic.

---

## 4. Tag Management (Settings Section)

### Decision: inline in Settings modal, new "Tags" section

**Rationale:** A standalone tag-manager modal adds another modal layer and
another trigger button to discover. The Settings panel already contains
the accent swatch (color picking), visible-sections checklist (list
management), and the "Data" danger zone — adding "Tags" as a sibling
section is zero new UI chrome. The user already expects to manage
preferences in Settings.

The Tags section lives between "Dashboard" and "Account" in the settings
body, following the sectioned layout in `SettingsModal.tsx`.

### Tags section UI spec

```
TAGS
────────────────────────────────────────
  ┌─────────────────────────────────────────┐
  │ ╔═design═╗  design     [●●●●●●●●] [🎨] │  ← label + color swatches + delete
  │ ╔═backend═╗ backend    [●●●●●●●●] [🎨] │
  │ ╔═infra══╗  infra      [●●●●●●●●] [🎨] │
  └─────────────────────────────────────────┘
  No tags yet. Tags are created while adding items.

  (empty state when no tags exist)
```

Each row is a `<div class="tag-manager-row">`:
- **Preview chip** (read-only `.tag-chip` with the tag's current color).
- **Editable name field** — a plain text input, not a `<button>` trigger
  for a rename modal. Blur or Enter commits the rename. This removes a
  modal-within-modal nesting that would violate focus-trap assumptions.
- **Color swatch row** — 8 mini swatches (identical layout to `accent-swatch-grid`
  but smaller: `grid-template-columns: repeat(9, 20px)`, swatch size 20×20 px)
  plus the custom `<input type="color">`. Clicking a swatch immediately
  applies the recolor (live preview in the chip at left).
- **Delete button** — dimmed × button. Clicking triggers an inline
  confirm row (the same two-stage pattern as "Clear all data" in DataSection:
  first click → confirm row appears; "Delete" button in confirm row calls
  onDeleteTag). The confirm row shows: _"Remove tag? Items will keep their
  other tags."_

### CSS

```css
.tag-manager-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tag-manager-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.tag-manager-name-input {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  padding: 3px 6px;
}
.tag-manager-name-input:hover {
  border-color: var(--border);
}
.tag-manager-name-input:focus {
  border-color: var(--accent);
  background: var(--panel);
  outline: none;
}

.tag-manager-swatches {
  display: grid;
  grid-template-columns: repeat(9, 20px);
  gap: 4px;
}
/* Reuses .accent-swatch-label but at 20px scale */

.tag-manager-delete {
  background: transparent;
  border: none;
  color: var(--text-dim);
  padding: 2px 6px;
  font-size: 12px;
}
.tag-manager-delete:hover {
  color: var(--danger);
}
```

### Dependency note for sibling agent

The Settings body receives the full resolved state. The Tags section needs:
- `state.tags[]` passed down (or use `useStore` directly — consistent with
  how `SettingsModal.tsx` does it).
- `onRenameTag(id, newLabel)`, `onRecolorTag(id, color)`, `onDeleteTag(id)`
  callbacks. These should write-through immediately (live update, no
  Done/Cancel staging) because tag metadata is not part of the
  `snapshotRef` that Cancel reverts.

---

## 5. Filter Toolbar

### Placement

The toolbar renders **inside each section, between the add-input row and
the item list**. It is not a sticky bar — that adds scroll-position
complexity with the existing tab layout. Because sections are not
individually scrollable (the whole page scrolls), placing it just above
the list is sufficient.

```
[add-input row]
[filter toolbar]    ← new
[item list or empty state]
```

For Sprint, the toolbar renders between the `AddTaskForm` and the
`<ul class="todo-list">`. For Reminders, it renders between
`AddReminderForm` and the "Upcoming" / "Fired" sub-sections.

### Toolbar layout

```css
.tag-filter-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px 0 10px;
  /* At rest: dimmed so it doesn't compete with the list */
  opacity: 0.55;
  transition: opacity 140ms ease;
}
.tag-filter-toolbar:hover,
.tag-filter-toolbar.is-active {
  opacity: 1;
}
.tag-filter-toolbar.is-active {
  background: color-mix(in oklch, var(--accent) 6%, transparent);
  border-radius: var(--radius);
  padding: 6px 10px 8px;
  margin: 0 -10px 2px;
}
```

`is-active` is applied when `activeTags.length > 0`.

### Filter chip appearance (in the toolbar)

Filter chips are button elements, not spans. Their visual state:
- **At rest (unselected):** outline-only, like `sprint-tab` at rest.
  `border: 1px solid var(--border); background: transparent; color: var(--text-dim)`.
- **Selected:** solid tinted fill matching the tag color. Same
  background/border/text treatment as `.tag-chip` above, but slightly
  bolder border (2px) to signal interactive selection.

```css
.tag-filter-chip {
  /* inherits .tag-chip sizing */
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 500;
  border-radius: 10px;
  cursor: pointer;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-dim);
  transition: background 100ms, border-color 100ms, color 100ms;
}
.tag-filter-chip.is-selected {
  background: color-mix(in oklch, var(--chip-color, var(--accent)) 15%, transparent);
  color: color-mix(in oklch, var(--chip-color, var(--accent)) 80%, var(--text));
  border: 2px solid color-mix(in oklch, var(--chip-color, var(--accent)) 50%, transparent);
}
.tag-filter-chip:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

### Multi-select and clear

All tags in the toolbar are independently togglable (OR semantics — see §6).
A "Clear" button appears at the right when any tag is selected:

```
[ design ] [ backend ] [ infra ]  ×  Clear
```

The `×  Clear` button:
```css
.tag-filter-clear {
  font-size: 11px;
  color: var(--text-dim);
  background: transparent;
  border: none;
  padding: 3px 8px;
  border-radius: 10px;
  margin-left: 4px;
}
.tag-filter-clear:hover { color: var(--text); }
```

### Status line (count)

Immediately below the toolbar (inside the section wrapper, above the list):
```html
<div class="tag-filter-status" role="status" aria-live="polite">
  Showing 2 of 7 items
</div>
```
```css
.tag-filter-status {
  font-size: 11px;
  color: var(--accent);
  margin-bottom: 8px;
  /* Hidden when no filters are active */
}
```
When filters are cleared, the element is removed from the DOM (not
just hidden) so the screen reader announces nothing extra.

### Empty state under active filters

When filters return zero items, the standard `.section-empty` element is
used but with filter-specific copy (see Copy deck, §appendix).

---

## 6. Filter Logic Communication

### Decision: OR semantics, with a one-line status string

**Reasoning:** AND semantics in a tag filter are rarely what users want
on a personal productivity list — if you tag 3 items "design+backend" and
toggle both chips, AND returns 3 items while OR also returns everything
tagged either. The difference only matters once a user has many items with
mixed tagging. For the current scale of Proclivity (dozens of items, not
thousands), OR is more predictably useful. AND would require explicit
documentation or a mode toggle — more cognitive overhead for a newtab page.

**Copy:** the status line (`role="status"`) under the toolbar reads:
```
Showing N of M items — any selected tag
```
When only one tag is selected: `Showing N of M items`.

The phrase "any selected tag" is appended only when two or more tags are
selected, making the OR behavior explicit exactly when it might cause
confusion. It disappears again when the user is back to one tag (because
it becomes trivially obvious).

### Toolbar visual state at rest vs active

| State | Toolbar opacity | Background | Status line |
|-------|----------------|------------|-------------|
| No tags in section | Toolbar absent | — | — |
| Tags exist, none selected | 55% opacity | None | None |
| 1+ tags selected | 100% opacity | Tinted accent bg strip | "Showing N of M items" |
| 1+ selected, multi-tag | 100% opacity | Tinted accent bg strip | "Showing N of M items — any selected tag" |

The tinted background on the toolbar row is the primary "hey, you are
filtered" signal for users who return to the tab. It is unmissable because
it spans the full section width and is filled with accent color.

---

## 7. Edit Todo UX

### Decision: modal

**Inline edit** is disqualified because the row must expose notes (textarea),
scope picker (segmented control), sprint selector (dropdown), and a tag
picker popover — all in a 44 px row. The resulting DOM would require
expanding the row into a form that visually displaces surrounding items,
re-implements the sprint form's layout, and adds significant rendering
complexity.

**Slide-over** panel would require a z-layer, a new overlay primitive, and
CSS for a drawer animation — none of which exist in the codebase. It would
add ~3–4 kB of new JS+CSS for negligible benefit over a centered modal.

**Modal** reuses `Modal.tsx` (already has focus-trap, escape, restore-
focus, backdrop close, aria-labelledby, portal). Zero added bundle weight
for the shell. The form inside is new but small.

### Modal form spec

**Title:** "Edit task"

**Fields (in order, top to bottom):**

| Field | Control | Validation |
|-------|---------|------------|
| Title | `<input type="text">`, autoFocus | Required. Show inline error "Title is required." if blank on Save. |
| Notes | `<textarea rows="3">`, optional | None (trim on save) |
| Scope | SegmentedControl: Today / Sprint / Long-term | Required (always has a value) |
| Sprint | `<select>` (live sprints only), shown only when scope = "sprint" | Required when visible: if no sprints exist, show hint "Create a sprint first." and disable Save |
| Tags | TagPickerArea (see §3) | None |

**Footer:** `[Cancel]` (plain button) + `[Save changes]` (`.modal-btn-primary`).

**Behavior:**
- Opens pre-filled with the item's current values.
- Cancel restores no changes (form state is local; no optimistic write happens until Save).
- Save calls `onUpdateTodo(id, patch)` where patch covers all changed fields.
- If `scope` changes from "sprint" to another value, clear `sprintId` from the patch.

**Panel sizing:** `max-width: 520px` (wider than the default 480 px for the notes textarea).
Add class `todo-edit-modal-panel` to the modal panel and set:
```css
.todo-edit-modal-panel {
  max-width: 520px;
}
```

**Scope change + sprint interaction:** when scope changes away from "sprint"
while a sprint is selected, a note appears under the Sprint field:
_"Changing scope will unlink this task from its sprint."_

---

## 8. Edit Reminder UX

### Decision: modal (same rationale as §7)

The existing `AddReminderForm` is a `<div class="reminder-form">` with a
2-column grid. The edit modal adapts this layout directly:
- Same `reminder-form-grid` structure.
- Pre-populated with current values on open.
- Title changes to "Edit reminder".
- Submit button changes label to "Save changes".

### Modal form spec

**Title:** "Edit reminder"

**Fields:**

| Field | Control | Validation |
|-------|---------|------------|
| Title | `<input type="text">`, autoFocus | Required. |
| Fire at | `<input type="datetime-local">` | Required. Must be a valid datetime. |
| Recurrence | `<select>` (None / Daily / Weekly) | Required (always has a value) |
| Link to todo | `<select>` (all todos) | Optional |
| Tags | TagPickerArea | None |

**Footer:** `[Cancel]` + `[Save changes]`.

**Behavior:**
- `fireAt` is converted from timestamp to `datetime-local` string using the
  existing `tsToDatetimeLocal()` utility.
- Cancel discards changes.
- Save calls `onUpdateReminder(id, patch)`.
- If `fireAt` is in the past, show an inline warning (not a block): _"This
  time is in the past — the reminder won't fire again unless you set a
  future time."_ Warning uses `.settings-hint--info` styling; it is not a
  blocking error.

**Panel class:** default `max-width: 480px` (same as standard modal) is fine.

---

## 9. Edit Affordance Discoverability

### Decision: pencil icon on hover (row-level), coordinated with existing × delete

**Rationale:**
- Full-row click is used in `sprint-archived-row` (expand/collapse) and
  would create a conflict for todo items where the checkbox also lives in
  the row. Clicking anywhere on the row to edit would fight with checkbox
  click targets.
- Right-click context menu is non-discoverable on a newtab page and adds
  JS event overhead.
- Long-press / double-click: newtab pages are primarily desktop. Double-click
  on a span selects text (browser default) — a poor trigger. Long-press is
  not a desktop convention.
- **Pencil on hover:** naturally pairs with the existing × button (both
  appear in the right gutter of the row on hover). The ✏ icon appears at
  12 px in the same color as the existing `.todo-delete` (`var(--text-dim)`),
  only on `li:hover`. This is the pattern used by GitHub Issues, Linear,
  and Notion list rows.

### Implementation

The pencil button is always rendered in the DOM but has `visibility: hidden`
at rest and `visibility: visible` on `.todo-item:hover` and
`.todo-item:focus-within`. Using `visibility` (not `display: none`) keeps
it in the layout so the row width doesn't shift.

```css
.todo-edit {
  visibility: hidden;
  background: transparent;
  border: none;
  color: var(--text-dim);
  padding: 4px 6px;
  font-size: 13px;
}
.todo-item:hover .todo-edit,
.todo-item:focus-within .todo-edit {
  visibility: visible;
}
.todo-edit:hover {
  color: var(--accent);
}
```

For Reminders, the same pattern applies: a pencil button joins the existing
`reminder-item-actions` div, left of the Delete button.

```css
/* Inside .reminder-item-actions — pencil is always rendered, hidden at rest */
.reminder-edit {
  visibility: hidden;
}
.reminder-item:hover .reminder-edit,
.reminder-item:focus-within .reminder-edit {
  visibility: visible;
}
```

**Keyboard users:** The pencil button is always present in the tab order
(because `visibility: hidden` removes it from screen but NOT from the
accessibility tree — it IS reachable by Tab). Screen readers will encounter
it. Therefore the button must have a descriptive `aria-label`:
`aria-label={\`Edit: ${todo.title}\`}` (same pattern as the existing delete
button: `aria-label={\`Delete: ${todo.title}\`}`).

For sighted keyboard users who Tab to the row, `focus-within` makes the
pencil visible even without hovering. This is the correct behavior.

---

## 10. Accessibility Audit

### Tag chips in list rows

- Each chip is a `<span>` with `aria-label={tag.label}`. The label is also
  the visible text, so `aria-label` is redundant — but it anchors the chip
  name if assistive tech collapses whitespace around the chip boundary.
- **Color-only concern:** chips use both color (background tint) AND text
  label. The text label is the primary signal. Color is decoration. WCAG
  1.4.1 satisfied.
- If no `aria-label` is added (relying on inner text), ensure the chip
  `<span>` has `role="img"` if it ever becomes icon-only. For now it never
  does — the label text is always present.
- Screen reader reads: `"design, tag"` — the label text, plus the element
  role. This is sufficient.

### Filter toolbar

- The toolbar is a `<div role="group" aria-label="Filter by tag">`.
- Each filter chip is `<button aria-pressed="true|false" aria-label="Filter by design">`.
  `aria-pressed` communicates toggle state to screen readers.
- The "Clear" button is `<button aria-label="Clear all tag filters">`.
- The status `<div role="status" aria-live="polite">` emits
  "Showing 2 of 7 items" when the count changes. `aria-live="polite"` means
  the announcement is queued, not interruptive.
- **Keyboard navigation:** Tab moves through toolbar chips linearly. This
  is correct for a filter toolbar (not a radio group); multi-select is
  expected. Arrow keys are NOT used (that would imply radio-group single-select
  semantics). Each chip requires one Tab stop.

### Edit modal

- Focus management: `<input type="text" autoFocus>` on the title field.
  `Modal.tsx` already saves and restores focus via `previousFocusRef`.
  No additional work needed.
- Escape: handled by `Modal.tsx`'s `handleKeyDown`. The modal closes and
  focus returns to the edit button that opened it.
- Focus trap: `Modal.tsx` already implements a full Tab/Shift+Tab trap via
  `getFocusable()`. The edit form adds new focusable elements (title input,
  textarea, scope segmented control, sprint select, tag picker area) — all
  discovered automatically by `FOCUSABLE_SELECTORS`.
- Error announcement: inline field errors use `role="alert"` (matching
  `sprint-form-error`) so they are announced immediately on Save attempt.

### Tag picker

- The search input is `<input type="text" role="combobox" aria-expanded="true"
  aria-haspopup="listbox" aria-controls="tag-picker-list-{id}">`.
- The list is `<ul role="listbox" id="tag-picker-list-{id}">` with each
  item as `<li role="option" aria-selected="true|false">`.
- Keyboard behavior:
  - Typing in search input filters the list.
  - ArrowDown / ArrowUp move `aria-activedescendant` through the listbox.
  - Enter on a highlighted option selects/deselects it.
  - Enter when "Create" row is highlighted creates the tag.
  - Escape closes the popover, returns focus to `[+ Add tag]`.
  - Tab from the search input closes the popover (treated as blur).
- `aria-activedescendant` is set on the search input pointing to the
  currently-highlighted list item, so screen readers announce the item
  name without moving DOM focus away from the input.

---

## 11. Section-by-Section Integration

### Today

| Element | Change |
|---------|--------|
| Filter toolbar | Renders between `.todo-input` and `.todo-list`. Only visible if `state.tags.length > 0`. |
| Edit affordance | Pencil button added to `TodoItem`. `onEdit` callback wires the edit modal. |
| Tag chips in row | Shown in `.todo-item` between title and pencil/delete buttons. |
| Empty state (filters) | `.section-empty` with text: "No tasks match the selected tags." |
| Empty state (no tasks) | Unchanged: "No tasks for today yet. Add one above." |

### Sprint (active sprint tasks)

| Element | Change |
|---------|--------|
| Filter toolbar | Renders between `AddTaskForm` and `<ul class="todo-list">` for active sprint. |
| Edit affordance | Same as Today. `onEdit` callback; the edit modal includes Sprint scope + sprint selector pre-filled. |
| Tag chips | Same as Today. |
| Empty state (filters) | "No tasks match the selected tags." |
| Empty state (no tasks) | Unchanged: "No tasks yet. Add one above." |
| Archived sprint tasks | Tag chips shown in `ArchivedSprintRow`. Filter toolbar does NOT apply to archived sprints (no inline `AddTaskForm` to anchor it; archived items are read-mostly). Edit pencil IS shown for archived tasks so the user can re-tag them. |

### Long-term

Identical to Today. Scope = "long"; placeholder unchanged.

### Reminders

| Element | Change |
|---------|--------|
| Filter toolbar | Renders between `AddReminderForm` and the "Upcoming (N)" heading. Filters apply to both Upcoming and Fired lists. |
| Edit affordance | Pencil button in `reminder-item-actions`, left of Delete. Opens edit reminder modal. |
| Tag chips | Rendered inside `.reminder-item-meta` as a flex-wrapped chip group, after the recurrence/fired badges. |
| Empty state (filters, upcoming) | "No upcoming reminders match the selected tags." |
| Empty state (filters, fired) | "No fired reminders match the selected tags." |
| Tags in AddReminderForm | `TagPickerArea` added as a `reminder-form-field-full` row. |

---

## 12. Mobile / Narrow-Viewport Consideration

The extension is Chrome-native and targets desktop newtab pages. The
existing `App.css` uses `max-width: 1100px; padding: 48px 32px`. At 600 px
width, the layout is functional but tight.

**Strategy: graceful degradation for filter toolbar.**

The filter toolbar already uses `flex-wrap: wrap`, so chips wrap to a
second line at narrow widths. No truncation occurs. This is acceptable.

The edit modal's `max-width: 520px` is `width: 100%` bounded by that max,
so on a 600 px screen the modal is 520 px wide — fine. The reminder form's
`grid-template-columns: 1fr 1fr` already has a `@media (max-width: 640px)`
breakpoint that collapses to `1fr` — the edit modal inherits this.

The tag picker popover is `max-width: 280px; min-width: 200px` — it fits
within any column width above 200 px.

**Formal declaration:** narrow viewport is supported incidentally by the
existing grid/flex patterns. No additional work is needed. If Chrome
mobile newtab is explicitly targeted in future, the toolbar should move
into a collapsible `<details>` element, but that is out of scope here.

---

## Appendix A: Copy Deck

### Buttons

| Button | Copy |
|--------|------|
| Open tag picker | `+ Add tag` |
| Create new tag (picker) | `+ Create "{value}"` |
| Clear active filters | `Clear` |
| Save edit (todo) | `Save changes` |
| Save edit (reminder) | `Save changes` |
| Cancel edit | `Cancel` |
| Delete tag (Settings) | `×` (dimmed) → confirm row appears |
| Confirm delete tag | `Remove tag` |
| Cancel delete tag | `Cancel` |

### Labels (forms)

| Field | Label |
|-------|-------|
| Todo title | `Title` |
| Todo notes | `Notes (optional)` |
| Todo scope | `Scope` |
| Todo sprint | `Sprint` |
| Tags picker | `Tags` |
| Reminder title | `Title` |
| Reminder fire time | `Fire at` |
| Reminder recurrence | `Repeat` |
| Reminder linked todo | `Link to todo (optional)` |

### Helper / hint text

| Context | Copy |
|---------|------|
| Notes textarea | Placeholder: `Add notes…` |
| Tag picker search | Placeholder: `Search or create tag…` |
| Sprint field (no sprints exist) | `No sprints yet — create a sprint first.` |
| Tags section (Settings, empty) | `No tags yet. Tags are created while adding tasks or reminders.` |
| Reminder fireAt in the past | `This time is in the past — the reminder won't fire again unless you set a future time.` |
| Tag rename (Settings) | Placeholder in name input: `Tag name` |

### Empty states

| Context | Copy |
|---------|------|
| Today — filtered, zero results | `No tasks match the selected tags. Try different tags or clear the filter.` |
| Sprint — filtered, zero results | `No tasks in this sprint match the selected tags.` |
| Long-term — filtered, zero results | `No goals match the selected tags.` |
| Reminders Upcoming — filtered | `No upcoming reminders match the selected tags.` |
| Reminders Fired — filtered | `No fired reminders match the selected tags.` |

### Status strings

| Context | Copy |
|---------|------|
| Filter active, single tag | `Showing {N} of {M} items` |
| Filter active, multiple tags | `Showing {N} of {M} items — any selected tag` |

### Validation errors

| Field | Copy |
|-------|------|
| Title (blank on save) | `Title is required.` |
| Sprint (scope = sprint but no sprint selected) | `Select a sprint.` |

### Modal titles

| Modal | Title |
|-------|-------|
| Edit todo | `Edit task` |
| Edit reminder | `Edit reminder` |

### Delete tag confirm row

> Remove **{tag.label}**? Items keep their other tags.
> [Cancel] [Remove tag]

---

## Appendix B: Risks & Open Questions

1. **`color-mix(in oklch, ...)` browser support.** `color-mix` is
   Baseline 2023. Chrome 111+. Newtab pages run in the installed Chrome
   version. Chrome 111 shipped March 2023 — over 3 years ago. Risk: low.
   If a user is on an ancient Chrome, chips will fall back to the
   transparent background (no solid fill), which is acceptable.

2. **Tag count per item vs. row height.** Spec allows unbounded tags per
   item. A todo with 6+ chips will wrap the row significantly. Recommend
   the sibling agent cap `todo.tags[]` at 5 items in the UI (not the
   storage schema) with a `+N more` overflow chip if exceeded. This is
   not designed here because the storage shape is out of scope.

3. **Filter state persistence.** The spec does not address whether tag
   filters survive tab navigation (switching from Today to Sprint and back)
   or page reload. Recommend: filter state is ephemeral (component-local
   `useState`). A returning user expects to see all their items, not a
   filtered subset from last session. **Open question for implementor.**

4. **Tag ordering in the filter toolbar.** The toolbar shows all tags that
   appear in the current section. If a section has 10+ tags, the toolbar
   could be very tall. Recommend: show at most 8 chips, with a `+N more`
   overflow button opening a compact picker. Not fully designed here.
   **Out of scope for first cut.**

5. **Rename conflict.** If the user renames tag "design" to a label that
   already exists (e.g., "backend"), the `onRenameTag` call must reject
   with an inline error: `"A tag named "backend" already exists."` The
   Settings section should show this in a `.settings-hint--error` span
   below the input. **Implementor must handle uniqueness check.**

6. **Sprint scope change in edit modal.** When a todo's scope changes
   FROM "sprint" TO anything else, the `sprintId` field must be cleared.
   The warning copy ("Changing scope will unlink this task from its sprint")
   is defined but whether the sprint field hides immediately on scope
   change is an **implementor decision**. Recommended: hide immediately
   with a 150 ms CSS transition.

7. **Tags on archived sprint tasks.** The filter toolbar is not placed
   above archived sprint tasks. If a user wants to filter archived content
   by tag, they cannot. This is an acceptable limitation for v1 — archived
   sprints are collapsed by default and rarely browsed.

8. **SettingsModal scroll position on tag create.** When a tag is created
   via the picker (not via Settings), it appears at the bottom of the
   Settings > Tags list. On next Settings open, the user will see it after
   scrolling. The `.settings-body` has custom scrollbar styling already.
   No action needed but worth noting.

9. **Focus management: picker inside modal inside modal.** The tag picker
   popover opens inside the edit modal. The existing `Modal.tsx` focus trap
   uses `getFocusable()` which discovers inputs inside the popover.
   The popover's search input is inside the modal's DOM subtree, so it
   is found by the trap. Escape from the popover should close the popover,
   NOT the modal. **Implementor must stop `e.propagation()` on Escape
   inside the popover** before it bubbles to `Modal.tsx`'s `handleKeyDown`.

---

## Appendix C: Recommended Commit Sequence

Break the UI work into these commits (schema/storage work is separate,
owned by sibling agent, and must land first):

### Commit 1 — Tag chip component + CSS
`feat(tags): add TagChip component and base chip CSS`

- New `src/components/TagChip.tsx` — renders a single chip with
  `--chip-color` inline style and optional remove button.
- New CSS in `src/components/TagChip.css` — `.tag-chip`, `.tag-chip-remove`.
- No integration yet; component is standalone.
- Bundle impact: ~0.3 kB.

### Commit 2 — Tag picker component
`feat(tags): add TagPickerArea component with popover`

- New `src/components/TagPickerArea.tsx` — renders assigned chips +
  `[+ Add tag]` trigger + popover with search + list + create row.
- CSS in `src/components/TagPickerArea.css`.
- Props: `tags: Tag[]`, `assigned: string[]`, `onToggle`, `onCreate`.
- Bundle impact: ~1.5 kB.

### Commit 3 — Tags section in Settings
`feat(tags): add Tags section to SettingsModal`

- New `TagsSection` sub-component inside `SettingsModal.tsx`.
- CSS additions in `SettingsModal.css` — `.tag-manager-*` classes.
- Wires to `onRenameTag`, `onRecolorTag`, `onDeleteTag` from `useStore`.
- Bundle impact: ~0.8 kB (within the lazy-loaded settings chunk).

### Commit 4 — TodoItem edit + filter toolbar
`feat(tags): integrate edit modal and tag filter toolbar for todos`

- Update `TodoItem.tsx`: add pencil button, `onEdit` prop, tag chips display.
- New `TodoEditModal.tsx` reusing `Modal`.
- New `TagFilterToolbar.tsx` component.
- Update `TodoList.tsx`: add filter state, render toolbar, pass `onEdit`.
- CSS additions in `sections.css` — `.tag-filter-toolbar`, `.tag-filter-chip`, etc.
- Bundle impact: ~2 kB.

### Commit 5 — Reminder edit + filter toolbar
`feat(tags): integrate edit modal and tag filter for reminders`

- Update `RemindersManager.tsx`: add pencil, `ReminderEditModal`,
  `TagFilterToolbar`, tag chips in `ReminderItem`.
- CSS additions in `reminders.css`.
- Bundle impact: ~1.5 kB (reminder chunk is not split; lands in main).

**Total estimated new JS:** ~6 kB uncompressed (~2 kB gzipped), within
budget given the 200 kB initial chunk cap.
