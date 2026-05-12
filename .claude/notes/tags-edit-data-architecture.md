# Tags + Edit Data Architecture

**Author:** data-model agent  
**Date:** 2026-05-12  
**Scope:** data model, storage helpers, filter logic, edit-flow architecture. Visual UI/UX is out of scope — owned by a sibling agent.

---

## Executive Summary

Five decisions that shape everything downstream:

1. **Normalized tags** — `Tag` objects live in `state.tags: Tag[]`; items hold `tags: string[]` of ids. Rename and color changes are a single-point write; delete cascades cheaply on read via `?? []`.
2. **Required-but-empty tag arrays** — both `Todo.tags` and `Reminder.tags` are declared `tags: string[]` (not optional), defaulting to `[]` on construction. This eliminates `?? []` noise at every callsite and is safe under `exactOptionalPropertyTypes` as long as persisted items that predate this field are normalised on read through a one-liner in `storage.get()`.
3. **Transient, per-section filter state** — active tag filters live in `useState` inside each section manager, never in `ProclivityState`. Durable filter state would mean every tab-open restores the filter, which is surprising; per-session clarity is the right trade for a personal newtab.
4. **OR filter semantics** — selecting multiple tags shows items that have _any_ selected tag. A personal task list is used for quick scanning, not boolean-query research; OR produces shorter, more useful results.
5. **Modal edit flow** — the existing `Modal` primitive (with focus-trap and Escape-close) is reused for both Todo and Reminder editing. Inline-expanding rows add layout complexity across all three scopes; a modal keeps `TodoItem` a pure display component and avoids layout thrash in sprint's sorted list.

---

## 1. Tag Data Model

### Decision: Normalized

Tags are first-class entities stored in `ProclivityState`. Items reference them by id.

**Considered alternatives:**

| Approach | Pro | Con |
|---|---|---|
| Inline strings (`tags: string[]` of labels) | Zero schema change to ProclivityState; no foreign-key work | Rename requires rewriting every item; label-based identity breaks on import if two users have "work" tags with different colors |
| Normalized ids (chosen) | Rename/recolor is a single write to `state.tags`; delete can cascade or be lazy; color is authoritative in one place | Slightly more complex reads — join needed to resolve label for display |

**Justification against existing patterns:**
- `Todo.sprintId` is already a normalized foreign key; tags follow the same model.
- `Reminder.recurrence` is an inline enum because it has no identity — it's a value, not an entity. Tags have identity (they're named, colored, reusable across items), so normalization is correct.
- With `noUncheckedIndexedAccess` the cost of a `.find()` lookup is a nullable guard that is already required everywhere.

### TypeScript additions to `src/types/index.ts`

```typescript
// ── Tag ──────────────────────────────────────────────────────────────────

/**
 * A reusable label that can be attached to Todos and Reminders.
 * Color is a CSS hex string (e.g. "#7c9cff"). The empty string "" is a
 * valid sentinel meaning "use the accent color default" — avoids storing
 * undefined under exactOptionalPropertyTypes.
 */
export interface Tag {
  id: string;
  label: string;
  /** Hex color, e.g. "#7c9cff". Empty string = inherit accent color. */
  color: string;
}
```

Updated `Todo` (add one field):

```typescript
export interface Todo {
  id: string;
  title: string;
  notes?: string | undefined;
  scope: TodoScope;
  done: boolean;
  createdAt: number;
  completedAt?: number | undefined;
  dueAt?: number | undefined;
  sprintId?: string | undefined;
  /** Tag ids referencing ProclivityState.tags. Always present; empty array = untagged. */
  tags: string[];
}
```

Updated `Reminder` (add one field):

```typescript
export interface Reminder {
  id: string;
  title: string;
  fireAt: number;
  recurrence?: "daily" | "weekly" | "none" | undefined;
  fired?: boolean | undefined;
  linkedTodoId?: string | undefined;
  /** Tag ids referencing ProclivityState.tags. Always present; empty array = untagged. */
  tags: string[];
}
```

Updated `ProclivityState`:

```typescript
export interface ProclivityState {
  todos: Todo[];
  sprints: Sprint[];
  activeSprintId?: string | undefined;
  ganttCharts: GanttChart[];
  ganttTasks: GanttTask[];
  reminders: Reminder[];
  settings: UserSettings;
  /** Global tag registry. Items reference entries here by id. */
  tags: Tag[];
}
```

Updated `EMPTY_STATE`:

```typescript
export const EMPTY_STATE: ProclivityState = {
  todos: [],
  sprints: [],
  ganttCharts: [],
  ganttTasks: [],
  reminders: [],
  settings: {},
  tags: [],
};
```

---

## 2. Tag CRUD Operations

### Where they live: `src/storage/tags.ts` — a new helper module

The same pattern as if `sprintId` management were extracted from `SprintManager`. The module imports `storage` and exports pure functions that compose `storage.update()`. Section components import what they need.

Do **not** inline in section components — the same tag operations (create, delete) will be needed from at least Today/Sprint/LongTerm/Reminders. A shared module avoids duplication. The service worker does **not** need tag awareness — tags are display metadata, not alarm triggers.

### API surface

```typescript
// src/storage/tags.ts

import { storage, uid } from "./storage";

/**
 * Create a new tag and append it to state.tags. Returns the new tag's id.
 */
export async function createTag(label: string, color: string): Promise<string> {
  const id = uid();
  await storage.update((s) => ({
    ...s,
    tags: [...s.tags, { id, label: label.trim(), color }],
  }));
  return id;
}

/**
 * Rename an existing tag. No-ops if the id does not exist.
 */
export async function renameTag(id: string, label: string): Promise<void> {
  await storage.update((s) => ({
    ...s,
    tags: s.tags.map((t) => (t.id === id ? { ...t, label: label.trim() } : t)),
  }));
}

/**
 * Recolor an existing tag.
 */
export async function recolorTag(id: string, color: string): Promise<void> {
  await storage.update((s) => ({
    ...s,
    tags: s.tags.map((t) => (t.id === id ? { ...t, color } : t)),
  }));
}

/**
 * Delete a tag and cascade-remove its id from all todos and reminders.
 *
 * Cascade-remove is chosen over orphan-tolerant for the following reasons:
 * - Items with a dangling tag id are silently invisible in filter results
 *   ("tagged items" filter misses them) — a subtle, confusing bug.
 * - The cascade is cheap: a single storage.update() pass over todos and
 *   reminders.
 * - Forbid-with-warning adds UI complexity (count references, surface
 *   warning) for a solo personal tool where "just remove it" is the right
 *   default.
 */
export async function deleteTag(id: string): Promise<void> {
  await storage.update((s) => ({
    ...s,
    tags: s.tags.filter((t) => t.id !== id),
    todos: s.todos.map((t) => ({ ...t, tags: t.tags.filter((tid) => tid !== id) })),
    reminders: s.reminders.map((r) => ({
      ...r,
      tags: r.tags.filter((tid) => tid !== id),
    })),
  }));
}
```

**Where tag assignment (add/remove tag from item) lives:** Inline in each section component as a one-liner `storage.update()` call, exactly like `toggle` and `remove` already are. No need to extract these into `tags.ts` — they are too tightly coupled to the specific item type.

---

## 3. Adding Tags to Todo and Reminder

### Required-but-empty, not optional

Declaration: `tags: string[]` (no `?`).

**Justification under `exactOptionalPropertyTypes`:**

The existing pattern for fields that _conceptually_ default to a value but may be absent in stored JSON uses `?: T | undefined` — because the serialised bytes may genuinely lack the key. That pattern is chosen specifically to permit spreading partial patches that set a field to `undefined`.

For `tags`, there is no semantic meaning to _absent_ vs _empty_ — an item with no tags is the same state either way. Making it non-optional with a default of `[]` means:
- No `?? []` at every callsite.
- TypeScript enforces that every constructor supplies the field.
- The storage migration section (§7) explains how to handle pre-existing persisted records.

**Construction — every item constructor must include `tags: []`:**

```typescript
// TodoList.tsx add()
{
  id: uid(),
  title,
  scope,
  done: false,
  createdAt: Date.now(),
  tags: [],          // ← new required field
}
```

```typescript
// SprintManager.tsx addTask()
{
  id: uid(),
  title,
  scope: "sprint",
  done: false,
  createdAt: Date.now(),
  sprintId: activeSprintId,
  tags: [],          // ← new required field
}
```

```typescript
// RemindersManager.tsx addReminder()
{ ...reminder, id, fired: false }
// reminder: Omit<Reminder, "id" | "fired"> — the Omit must now include tags
// so the caller supplies it from AddReminderForm state, or the type is
// Omit<Reminder, "id" | "fired"> and AddReminderForm initialises tags: [].
// Simplest: leave Omit as-is; AddReminderForm initialises tags state to []
// and includes it in the onSave payload.
```

---

## 4. Filter State

### Decision: Transient `useState` per section manager — per-tab context

**Options evaluated:**

| Location | Durable | Per-tab | Notes |
|---|---|---|---|
| `UserSettings` (persisted) | Yes | No — shared across all tabs | Opening a new tab restores the last filter — confusing for "quick glance" use |
| Single global React context | No | Shared in-session | Still bleeds Today's filter into Sprint view |
| `useState` per section manager | No | Yes — each section is independent | Simplest; each manager already owns its local UI mode state (e.g. `UIMode` in SprintManager) |

**Verdict: per-section `useState`.**

A newtab page is ephemeral by design. Persisting filter state would mean "I filtered on #work yesterday" is silently applied today, hiding items. Per-section state also lets the user browse reminders filtered on #personal while the Today section is unfiltered.

### Exact state shape

In each section manager:

```typescript
const [activeTagIds, setActiveTagIds] = useState<string[]>([]);
```

No wrapper object needed — a flat `string[]` suffices. If in future we need per-section persistence, a `UserSettings.activeFilters` patch can be added; the `useState` shape is wire-compatible.

**SprintManager** gets the same `activeTagIds` state, scoped to the active sprint's task list only (not the archive rows — filtering archived sprints is low-value and adds complexity).

---

## 5. Filter Logic

### Decision: OR semantics

Selecting tags A and B shows items that have _at least one_ of {A, B}.

**Justification:**
- Personal productivity lists are used for quick scanning, not database queries. OR returns a superset — "show me everything vaguely related to work or admin." AND would hide items that have _only_ one of the tags, which is rarely the intent when selecting two tags on a personal list.
- AND is available as a composition: the user can simply select one tag at a time to narrow further.
- Parity with most note-taking and to-do apps (Notion, Bear, Things) — they all default to OR for multi-tag selection.

**Special case: empty `activeTagIds` → show all items (no filter active).**

### Filter helper

```typescript
// src/storage/tags.ts (or a separate src/utils/filter.ts — preference is to
// colocate with tags.ts since it operates on tag ids)

/**
 * Filter a list of tagged items by active tag ids using OR semantics.
 * Returns all items if activeTagIds is empty (no filter active).
 *
 * Generic constraint ensures T always carries a tags: string[] field,
 * which is guaranteed by the updated Todo and Reminder interfaces.
 */
export function filterByTags<T extends { tags: string[] }>(
  items: T[],
  activeTagIds: string[],
): T[] {
  if (activeTagIds.length === 0) return items;
  return items.filter((item) =>
    activeTagIds.some((tagId) => item.tags.includes(tagId)),
  );
}
```

**Usage in `TodoList.tsx`:**

```typescript
const items = useMemo(
  () =>
    filterByTags(
      state.todos
        .filter((t) => t.scope === scope)
        .filter((t) => (filter ? filter(t) : true)),
      activeTagIds,
    ).sort((a, b) => Number(a.done) - Number(b.done) || b.createdAt - a.createdAt),
  [state.todos, scope, filter, activeTagIds],
);
```

`TodoList` receives `activeTagIds: string[]` as a prop from the section wrapper (Today / LongTerm), which owns the `useState`. SprintManager runs the same filter inline on `activeSprintTodos`.

---

## 6. Edit Flow Architecture

### Todo — Modal, commit-on-submit

**Where the edit form lives:** `Modal` (reusing the existing primitive).

Alternatives rejected:
- **Inline-expanding row** — complicates `TodoItem` (currently a pure display component), requires the sorted list to reflow around an open editor, and creates z-index / focus issues inside `<ul>` elements. SprintManager's sorted active list makes this especially messy.
- **Slide-over panel** — no existing primitive; would require new CSS and a new animation container. Over-engineered for the single-field edit case (title + notes + scope + sprintId + tags).

**Data flow:** snapshot pattern (same as `SprintForm`'s `EditSprintForm`). On "Edit" click, open a modal pre-populated with the current field values. On Save, call `storage.update()` with the full patched todo. On Cancel, discard local state — nothing written.

**Editable fields:**

| Field | Editable | Notes |
|---|---|---|
| `title` | Yes | Required, non-empty |
| `notes` | Yes | Optional textarea |
| `scope` | Yes | `<select>` — today / sprint / long |
| `sprintId` | Yes, conditional | Only shown when `scope === "sprint"`; `<select>` over live sprints |
| `tags` | Yes | Tag picker (UI-agent concern); data: array of ids |
| `createdAt` | No | Immutable audit field |
| `completedAt` | No | Set by toggle only |
| `dueAt` | No | Reserved, no UI yet |
| `done` | No | Already toggleable via checkbox — duplicating in edit modal is noise |

**Can a done todo be edited?** Yes. There is no semantic reason to lock a completed item. The user may want to fix a typo in the title, adjust tags for reporting/filtering, or add notes after completion. The `done` field itself is not editable in the modal (see above) — the checkbox stays as the toggle mechanism.

**Edit action placement:** the "Edit" affordance is owned by the UI agent. The data contract is a callback `onEdit: (id: string) => void` on `TodoItem`, and a sibling `onSave: (patch: Partial<Omit<Todo, "id" | "createdAt" | "done" | "completedAt">>) => void` on the modal.

### Reminder — Modal, commit-on-submit

**Same Modal approach.** `ReminderItem` is already a local component in `RemindersManager.tsx`, so adding `onEdit` prop is straightforward.

**Editable fields:**

| Field | Editable | Notes |
|---|---|---|
| `title` | Yes | Required |
| `fireAt` | Yes | `datetime-local` input (reuse `tsToDatetimeLocal` / `datetimeLocalToTs` from `reminderUtils`) |
| `recurrence` | Yes | `<select>` |
| `linkedTodoId` | Yes | `<select>` over todos (same as `AddReminderForm`) |
| `tags` | Yes | Tag picker |
| `fired` | No | System-set only |

**Service-worker implications — `fireAt` edit:**

The `diffAndSyncAlarms` listener in `service-worker.ts` (lines 246–280) already handles `fireAt` changes precisely:

```typescript
} else if (old.fireAt !== r.fireAt) {
  // fireAt changed — recreate alarm
  chrome.alarms.clear(alarmName(id));
  chrome.alarms.create(alarmName(id), { when: r.fireAt });
}
```

When the UI calls `storage.update()` to save an edited reminder with a new `fireAt`, the storage change event fires synchronously in the service worker context, `diffAndSyncAlarms` runs the diff, detects `old.fireAt !== r.fireAt`, clears the old alarm, and creates a new one with `{ when: r.fireAt }`. No additional service-worker code is required. Confirmed.

---

## 7. Storage Migrations

### Additive fields — no migration needed under shallow-merge

`storage.get()` in `storage.ts` (line 34) applies:

```typescript
return { ...EMPTY_STATE, ...s };
```

With `EMPTY_STATE.tags = []`, any stored state without a `tags` key gets the empty array merged in at the top level. This handles `ProclivityState.tags`.

For `Todo.tags` and `Reminder.tags`: the shallow merge applies at the state level only, not recursively to array items. A todo stored before this change will lack the `tags` field when read back.

**The correct guard — normalise on read in `storage.get()`:**

Extend the `get()` method to backfill the field on array items:

```typescript
async get(): Promise<ProclivityState> {
  const s = await readRaw();
  const base = { ...EMPTY_STATE, ...s };
  // Backfill tags field on items that predate this feature
  return {
    ...base,
    todos: base.todos.map((t) => ({ tags: [], ...t })),
    reminders: base.reminders.map((r) => ({ tags: [], ...r })),
  };
},
```

The spread order `{ tags: [], ...t }` means an existing `tags` field (if present) wins. This is a zero-cost O(n) pass that only runs on the initial `get()` call. It requires no schema version bump and no migration file.

**Why this is safe under `exactOptionalPropertyTypes`:** `tags: string[]` is required (non-optional) on the interface. TypeScript would flag a spread of a stored object that lacks `tags` if we tried to use it directly — the backfill in `get()` is precisely the enforcement boundary. All code after `storage.get()` can treat `tags` as guaranteed.

**Consumers must use `item.tags` directly** (never `item.tags ?? []`) after the backfill is in place, since `tags` is non-optional. The one exception is `noUncheckedIndexedAccess` on array element access — `item.tags[0]` is `string | undefined` — but that's a different concern from the field's presence.

---

## 8. Tag References in Export/Import

### Summary: no conflict possible; visual duplicates are fine

`exportData()` and `importData()` in `exportImport.ts` round-trip the full `ProclivityState` verbatim. Tags are keyed by `id` (a `uid()` string — 36-bit random base-36 collision probability is negligible). The import path is:

```typescript
const merged: ProclivityState = { ...EMPTY_STATE, ...(data as Partial<ProclivityState>) };
await storage.set(merged);
```

This **replaces** the entire state. There is no merge of existing tags with imported tags — the import is a full restore. Therefore:

- **Same id, same label** — fine, it's the same tag from the same backup.
- **Same label, different id** — two tags with the label "work" could exist after an import if the user had created a new "work" tag after their last backup. The label duplicates visually in the tag list, which is slightly confusing but harmless. Items correctly reference their respective ids. No data is corrupted.
- **Tag id in item, tag missing from state.tags** — can happen if the user imports a todo-only partial state (unsupported, but the envelope only validates top-level shape). The `filterByTags` helper won't match the orphan id; the tag pill in the item row would need to handle the case where `state.tags.find(t => t.id === tagId)` returns `undefined` — display as `"[unknown]"` or skip rendering the pill.

**Recommendation:** When rendering a tag pill, guard with `const tag = state.tags.find(t => t.id === tagId); if (!tag) return null;` — silently skip unknown ids. No enforcement needed at the storage layer.

**Export schema version:** No bump required. The `tags` field on `ProclivityState` and items is additive. Existing importers (schemaVersion === 1) that do `{ ...EMPTY_STATE, ...data }` will silently drop the `tags` key from `EMPTY_STATE` if the backup predates this feature — which is correct (empty tag registry for old backups).

---

## 9. Performance

### Assessment: O(n×m) is fine; useMemo is already in place

At the scale of 200 todos × 20 active tag ids, `filterByTags` does at most 200 × 20 = 4,000 `Array.includes()` calls per render cycle. Each `includes` is O(k) where k is the number of tags per item — say 5 on average. Total: ~20,000 scalar comparisons per render. On a modern V8 engine this is microseconds.

**`useMemo` boundaries:** The existing `useMemo` in `TodoList.tsx` (line 20) already gates the filter+sort pipeline on `[state.todos, scope, filter]`. Adding `activeTagIds` to the dependency array is sufficient:

```typescript
[state.todos, scope, filter, activeTagIds]
```

SprintManager's `activeSprintTodos` memo (line 388) similarly needs `activeTagIds` added to its dep array when the filter call is inserted.

**Larger-scale concerns (none immediately actionable):**
- If `state.todos` grows beyond ~5,000 items, the memo still protects the render path — the memo itself only re-runs on deps change, not every render.
- The `storage.update()` write chain serializes all writes, so tag assignment + filter re-render will never race.
- There is no indexing structure needed at these scales. A `Map<tagId, Set<itemId>>` inverse index would be premature optimization and would need to be kept in sync.

---

## 10. Integration Touch Points

### Files requiring changes

**Type changes — 1 file:**
- `src/types/index.ts` — add `Tag` interface; add `tags: string[]` to `Todo` and `Reminder`; add `tags: Tag[]` to `ProclivityState` and `EMPTY_STATE`.

**Storage helpers — 1 new file + 1 edit:**
- `src/storage/tags.ts` — new file; `createTag`, `renameTag`, `recolorTag`, `deleteTag`, `filterByTags`.
- `src/storage/storage.ts` — edit `get()` to backfill `tags: []` on existing todo/reminder items.

**Section components — 4 files:**
- `src/sections/TodoList.tsx` — add `activeTagIds` prop; apply `filterByTags` inside the existing `useMemo`; add `tags: []` to the `add()` constructor call; add `onEdit` callback wiring.
- `src/sections/sprint/SprintManager.tsx` — add `activeTagIds` state; apply `filterByTags` to active sprint todos; add `tags: []` to `addTask()` constructor; wire `onEdit` for `TodoItem`.
- `src/sections/reminders/RemindersManager.tsx` — add `activeTagIds` state; apply `filterByTags` to upcoming reminders; update `AddReminderForm` to include `tags: []` initial state; wire `onEdit` for `ReminderItem`; add edit handler that calls `storage.update()`.
- `src/sections/Today.tsx` and `src/sections/LongTerm.tsx` — these are thin wrappers around `TodoList`. They need to lift `activeTagIds` state and pass it down (or `TodoList` owns the state internally — simpler, pick this). If `TodoList` owns it, these files do not change.

**Component files — 2 files:**
- `src/components/TodoItem.tsx` — add `onEdit: (id: string) => void` prop; add edit button (visual concern, but the prop contract must be specified here).
- `src/sections/reminders/RemindersManager.tsx` already contains `ReminderItem` as a local component — add `onEdit` prop to `ReminderItemProps`.

**Modal files — 0 new files:**
- The edit modals for Todo and Reminder are new local components, co-located in their section files (`TodoList.tsx` for `TodoEditModal`, `RemindersManager.tsx` for `ReminderEditModal`). They reuse `Modal` from `src/components/Modal.tsx`.

**Export/Import — 0 changes:**
- `src/storage/exportImport.ts` requires no changes (see §8).

**Service worker — 0 changes:**
- `src/background/service-worker.ts` requires no changes (see §6, fireAt edit is already handled).

**Settings modal — 0 changes:**
- Filter state is transient (see §4). No settings fields needed.

**Tests — 0 (project has none today):**
- No test files to add or change.

**Summary table:**

| File | Change type |
|---|---|
| `src/types/index.ts` | Edit — add Tag, extend Todo/Reminder/ProclivityState |
| `src/storage/storage.ts` | Edit — backfill tags in get() |
| `src/storage/tags.ts` | New — CRUD helpers + filterByTags |
| `src/sections/TodoList.tsx` | Edit — filter, edit wiring, constructor |
| `src/sections/sprint/SprintManager.tsx` | Edit — filter, edit wiring, constructor |
| `src/sections/reminders/RemindersManager.tsx` | Edit — filter, edit wiring, constructor |
| `src/components/TodoItem.tsx` | Edit — add onEdit prop |
| `src/sections/Today.tsx` | Likely no change (if TodoList owns filter state) |
| `src/sections/LongTerm.tsx` | Likely no change (if TodoList owns filter state) |

---

## Risks and Open Questions

1. **Bundle size.** The initial newtab chunk is at 194.6 kB — 5.4 kB under the 200 kB limit. The tag + edit additions will add code. The edit modals are small (a few hundred bytes each). The `tags.ts` module is ~2 kB. If a color picker widget is added for tag creation, that must be a native `<input type="color">` (zero bundle cost) rather than a third-party component. **Risk: low, but monitor after each commit.**

2. **`TodoList` owns filter state vs. section wrappers own it.** If `TodoList` owns `activeTagIds` state, the tag filter UI must live inside `TodoList`. If the sibling UI agent wants the tag filter chips above the section heading (outside `TodoList`), they need to be lifted to `Today`/`LongTerm`. Coordinate with the UI agent on where the filter chrome lives before choosing.

3. **Sprint edit flow — which tasks are shown when filtering?** The active sprint shows tasks; archived sprints show tasks in collapsed rows. Applying `filterByTags` to archived sprint rows changes the collapsed task count. Decide: filter applies to active sprint only, or also to archive rows? Recommendation: active sprint only, to keep archive rows simple.

4. **Tag color picker — UX vs. data.** The data model stores `color: string` (CSS hex). The UI agent needs to decide whether users pick from a preset palette or use a free-form color input. The data layer is indifferent — any hex string is valid. An empty string `""` is the "use accent color" sentinel; ensure the UI agent is aware.

5. **`AddReminderForm` prop shape for tags.** The form currently passes `Omit<Reminder, "id" | "fired">` to `onSave`. Adding `tags` to `Reminder` means this type now includes `tags: string[]`. The form must initialise `tags: []` and include it in the payload — this is a small change but needs coordination if the UI agent is building the tag picker inside `AddReminderForm`.

6. **`noUncheckedIndexedAccess` on `activeTagIds[0]`** — not directly used in filter logic (we use `.length === 0` and `.some()`), but any future code that indexes into the tag array will need guards. No action needed now.

7. **Tag management UI location.** Where does the user create, rename, delete, recolor tags? Options: (a) inline within the tag picker during item edit, (b) a dedicated "Manage Tags" section in the Settings modal, (c) both. This is a UI/UX decision, but it has a data implication: if tags can only be created from item edit flows, there is no standalone "create tag" surface and `createTag` is always called with a label the user typed in a picker. If a Settings panel is added, it calls the same `createTag`/`renameTag`/`deleteTag` functions — no data-layer difference. Recommend option (a) to start: create tags inline, manage (rename/delete/recolor) from a future Settings panel.

---

## Recommended Commit Sequence

### Commit 1 — `feat(tags): Tag type + ProclivityState field`
- `src/types/index.ts`: add `Tag` interface, extend `ProclivityState`, update `EMPTY_STATE`.
- `src/storage/storage.ts`: backfill `tags: []` in `get()`.
- Build must pass. No visual change.

### Commit 2 — `feat(tags): tags field on Todo and Reminder + CRUD helpers`
- `src/types/index.ts`: add `tags: string[]` to `Todo` and `Reminder`.
- `src/storage/tags.ts`: new file with `createTag`, `renameTag`, `recolorTag`, `deleteTag`, `filterByTags`.
- All item constructors updated: `TodoList.tsx`, `SprintManager.tsx`, `RemindersManager.tsx` (add `tags: []`).
- Build must pass. No visual change.

### Commit 3 — `feat(tags): filter wiring in section managers`
- `src/sections/TodoList.tsx`: `activeTagIds` state (or prop from parent), `filterByTags` in memo.
- `src/sections/sprint/SprintManager.tsx`: same.
- `src/sections/reminders/RemindersManager.tsx`: same.
- The filter state exists and is wired, but the UI agent ships the filter chips. Build must pass.

### Commit 4 — `feat(tags): Todo edit modal`
- `src/components/TodoItem.tsx`: add `onEdit` prop.
- `src/sections/TodoList.tsx`: `TodoEditModal` component + `editTodo` handler.
- `src/sections/sprint/SprintManager.tsx`: same wiring.
- Build must pass. Editing todos is functional.

### Commit 5 — `feat(tags): Reminder edit modal`
- `src/sections/reminders/RemindersManager.tsx`: add `onEdit` to `ReminderItemProps`; `ReminderEditModal` component + `editReminder` handler (calls `storage.update()`; `diffAndSyncAlarms` handles alarm re-arm automatically).
- Build must pass. Editing reminders is functional.

---

*End of document. This covers data contracts only. Visual controls, copy, layout, and accessibility are out of scope and owned by the sibling UI agent.*
