# Closed Todos — Research + Architecture (Agent A: data layer + Closed view)

> "Currently, closed tickets still show up on the panel in both the cards todo
> layout and the list todo layout. I would like for them to go into some
> 'Closed' document with a temporary persistent storage."

This doc captures the research synthesis, the architecture decisions, and the
exact integration contract for the **sibling agent** (Agent B) that owns the
section-integration side.

---

## 1. Research — how the field handles closed work

| Product | Where closed items live | Retention | Restore UX | Bulk ops | Discoverability |
|---|---|---|---|---|---|
| **Todoist** | Hidden from project list. Surfaced via top-right "Display → Completed tasks" toggle on each project; aggregated "Activity log" tracks completions. | Forever (Pro). Completed tasks are NOT in backup downloads, but they remain searchable indefinitely. | Click checkbox again → returns to its original project/section. | None first-class. | Medium — users assume completed items are "gone" until they explore Display menu. |
| **Linear** | Issues with status category `completed` stay on board until **28 days** elapsed, then auto-move to **Archive** (separate surface). Cancelled category: **7 days**. Recently-deleted: 14 days then permanent. | Auto-archived after configurable window. Archived issues are still searchable / restorable; deleted are recoverable for 14 days. | Restore from archive: returns to its original team/cycle/state. Reopen: choose new status. | Bulk archive / restore in search results. | High — archive is its own searchable view with clear breadcrumb. |
| **Things 3** | Tasks vanish into the **Logbook** on completion (immediate, or batched manually depending on preference). | Forever; no auto-purge built in. | Drag back out / un-tick to restore to original project. | Manual purge only. | Logbook is a permanent first-class list in the sidebar. |
| **Apple Reminders** | Each list has a built-in **Completed** smart list (header chip). | Forever (per-list). Sorted by completion date. | Un-tick to restore. | "Show completed" toggle per list. | Medium — many users don't realise completed items still consume the list. |
| **Asana** | Hidden by default. Filter chip "Completed tasks" reveals; "Recently completed" smart filter. | Forever. | Un-complete. | Bulk multi-select. | Medium — filter is rediscoverable per project. |
| **ClickUp** | Same list, hidden by status filter. Filters can show only Archived. | Forever; manual archive separate from closed status. | Re-open status. | Bulk via multi-select. | Strong — filter chips persistent. |
| **Trello** | Cards "archived" off the board into per-board archive (More → Archived items). | Forever. | "Send to board" restores to original list. | List-wide archive; bulk delete in archive. | Medium — buried in board menu. |
| **Notion** | Pattern, not built-in: usually Status property = "Done" + filtered-out view, OR `archive` checkbox + dedicated archive page/view. Recommended: status-driven, with a `Done` group that can be hidden per-view. | Forever. | Toggle status back. | Database-wide via filters/bulk edit. | Depends on template. |
| **GitHub / GitLab** | `closed`/`merged` items live on the same list, gated by an open/closed tab at the top. Reopenable indefinitely. | Forever. No auto-purge for issues. (Repo deletion: 90 day grace.) | One-click reopen; preserves history. | None destructive in UI. | High — open/closed tab is core IA. |
| **Jira** | "Done" column stays on the board until sprint close; then sprint archives. Issues can additionally be archived (paid). | Sprint-bounded by default; archive is permanent. | Move state back. | Filter / bulk-edit. | Strong for sprint flow, weaker once archived. |

### Synthesis — what users actually want

1. **Hide-by-default with a clear exit door.** The biggest friction is when
   completed items pile up in the active view (Apple Reminders historically
   suffered this). Every modern productivity tool either hides them by default
   or compresses them visually. Our user explicitly asked for this.
2. **A first-class destination, not just a filter chip.** Things 3's Logbook
   and Linear's archive are sticky precisely because users can navigate to a
   distinct surface — not just toggle visibility on the same view. We will
   provide a single "Closed" surface (not per-scope toggles).
3. **Frictionless undo.** Un-tick → restore is universal. Anything else feels
   bureaucratic. We mirror that.
4. **Retention is a memory tax.** Things 3's "forever" Logbook is the only
   pattern that's actively criticised in user forums (slowdowns at scale).
   Linear's 28-day auto-archive + 14-day soft-delete is the cleanest middle
   ground for a single-user productivity tool.
5. **Discoverability matters.** Trello and Todoist hide their archive too well;
   Apple Reminders surfaces "Completed" at the top of each list. We need a
   prominent nav entry, not a buried menu.

---

## 2. Architecture decisions (the spec)

### 2.1 Data model — keep `done: true` in `state.todos`, do **not** introduce a separate array

**Decision:** Closed todos stay in `state.todos` with `done: true`. A new
optional `closedAt: number` field marks when the todo entered the closed pile
(distinct from `completedAt`, which already exists). The Closed view is purely
a **selector** over the existing array.

**Trade-off analysis:**

| Option | Pro | Con |
|---|---|---|
| **A — single array, flag + selector (chosen)** | Zero migration. Existing data already has `done: true` items in place — they transparently become "closed" on next render. Reopen is a flag flip (no array move, no lost position metadata). Card layout entries stay attached to their todo without bookkeeping. Tag references stay intact. `useStore()` and the entire write pipeline are unchanged. Bundle: zero new code in the hot path. | Selectors must filter on every render — but `useMemo` covers it. Quota-wise, no change. |
| B — separate `state.closedTodos` array | Smaller "active" iteration cost. Easier to clear-all without touching `todos`. | Doubles every mutation site that touches todos (reopen = move + tags re-validate + cardLayouts re-attach + sprintId revalidation). Migration becomes a hard requirement. Quota is identical. Exports become two arrays the importer must reconcile. The `cardLayouts` map is keyed by item id and would either need to be split or kept under `todos`-only-keyed semantics. |

Option A wins under `exactOptionalPropertyTypes` (one new optional field, no new
state slot, no migration) and under the 10 MB cap (no duplication). The
selector cost is bounded by `state.todos.length` which is itself bounded by the
retention policy below.

**Type changes (additive only):**

```ts
export interface Todo {
  // ... existing fields ...
  /** Local-clock ms when the todo entered the Closed pile (i.e. `done` became true).
   *  Distinct from `completedAt` so re-checking after a reopen does not reset closure age.
   *  Backfilled lazily in storage.get() for legacy todos. */
  closedAt?: number | undefined;
  /** Scope the todo will return to on reopen. Captured at close time so a later
   *  scope-edit doesn't get clobbered. Optional; falls back to `scope` if absent. */
  closedFromScope?: TodoScope | undefined;
  /** sprintId the todo will return to on reopen. Same rationale. */
  closedFromSprintId?: string | undefined;
}
```

No changes to `ProclivityState` shape. No changes to `EMPTY_STATE`.

### 2.2 Lifecycle — close on check, no grace period

**Decision:** A todo enters the Closed pile the moment the checkbox is ticked
(i.e. `done: true`). No "are you sure", no grace period banner. The active
panels filter `done === true` items out via the selector exported from
`closedTodos.ts`.

**Rationale:** A grace-period or "undo toast" is appropriate when the action is
**destructive**. Closing is not destructive — the item lives on the Closed
surface and is one click from being restored. Adding a toast for every check is
visual noise; the sibling agent's TodoList integration can render a brief
"moved to Closed" pulse if desired, but the data layer treats close as
immediate.

### 2.3 Retention policy — **30 days, cap 500 items**, configurable later

**Decision:** Auto-purge closed todos older than **30 days** (rolling), with a
hard cap of **500 closed items** total (oldest-first eviction past the cap).
Run the purge:

- on every newtab open (cheap; user is interacting anyway)
- once per day via `chrome.alarms` in the service worker (so a long-idle tab
  doesn't accumulate)

**Why 30 / 500:**

- **30 days** matches Linear's 28-day default for the "completed" category
  (the most rigorous shipped reference point) but rounded to a calendar month
  for user recognisability. It's long enough that a Friday-completed task is
  still recoverable into late next month; short enough to bound storage growth.
- **500 items** is the safety net for users who churn through 50+ todos a week.
  At ~200 bytes per todo (id + title + tags + 4 timestamps + scope) that's
  ~100 kB worst-case — under 1% of the 10 MB cap. The cap shouldn't dominate in
  practice; the 30-day window is the operative limit.
- Both numbers are constants in `src/storage/constants.ts`. A future setting
  can expose them; v1 ships fixed.

**No `purgedAt`-style audit trail.** Purges are silent — users only ever see
"my old closed items eventually go away." If we ever need to defend a purge,
the logger ring buffer will record it (`closed.purge` log entry with count).

### 2.4 Reopen semantics

**Decision:** Reopening a closed todo:

1. Sets `done = false`.
2. Sets `completedAt = undefined`, `closedAt = undefined`.
3. Restores `scope` from `closedFromScope` if present, else leaves `scope` as-is.
4. Restores `sprintId` from `closedFromSprintId` if present **and** the sprint
   still exists; otherwise drops the sprint binding (sets `sprintId = undefined`)
   and falls back to scope `"long"` if the original scope was `"sprint"` but
   the sprint is gone.
5. Card layout entry (`cardLayouts[id]`) is preserved if it exists — restoring
   keeps your spatial memory. If the card view was reset while the todo was
   closed, the cascade layout will re-place it on next paint.

This is a single-record update via the `closedTodos.ts` helper, atomic on the
existing `storage.update()` write queue.

### 2.5 Scope handling after sprint archival / scope edits

If the user archived the sprint that owned a closed todo:

- The sprint object remains (sprints aren't deleted on archive; see
  `sprintUtils.isArchived`).
- `closedFromSprintId` still resolves; reopen restores it to that (now archived)
  sprint. The active sprint view won't show it, but the archived sprint view
  will. That mirrors what would have happened if the user had un-checked it
  from the archived sprint's row, which is already supported.

If the user **deleted** the sprint via SprintManager's delete-sprint action,
the existing delete cascade already removes `t.scope === "sprint" && t.sprintId
=== activeSprintId` todos. Closed-pile todos with that `sprintId` will be
deleted alongside their active siblings — desirable and unchanged.

### 2.6 Card-layout entries on close — **keep them**

**Decision:** When a todo is closed, its `cardLayouts[id]` entry is
**preserved**. It is only removed on permanent delete (purge or manual).

**Why:** Closing is reversible; deletion is not. If a user reopens, they expect
to find the card where they left it. The cardLayouts cleanup paths already exist
for the permanent-delete cases:

- Manual delete in TodoList / SprintManager uses `removeCardLayouts([id])`
  through `closeTodo`/permanent delete — this is the data-layer's responsibility.
- Purge job in this milestone removes `cardLayouts[id]` for every purged id.
- Sprint cascade-delete continues to work via the existing
  `state.cardLayouts` cleanup pattern (we don't touch that path).

The current TodoList `remove` and SprintManager `deleteTodo` paths will be
re-wired by the sibling agent to call our `closeTodo` helper for the close
action and `permanentlyDeleteTodos` for the truly-destructive path (e.g.
"Delete forever" from the Closed view).

### 2.7 Tags / linked reminders on close

**Decision:** A closed todo retains its `tags`. The linked reminder (if any)
continues its own lifecycle untouched — the service worker's alarm reconciler
doesn't care whether the linked todo is closed. The reminder will fire when its
own `fireAt` arrives, regardless of the linked todo's `done` state. The user
can clean up reminders manually.

**Why not auto-cancel?** A reminder is its own object. A user who closes a todo
but expects the reminder to still fire (e.g. "follow up on this next week" with
the todo already done) shouldn't be surprised. Keeping behaviours separable is
the conservative choice.

### 2.8 Migration

**Decision:** On first storage read after this ship, any existing `done: true`
todo without a `closedAt` is backfilled with `closedAt = completedAt ?? createdAt`.
Done in the same `storage.get()` pass that already backfills `tags: []`.

This means existing data is immediately consistent with the new selectors — a
user who shipped a week ago with 12 completed todos in their Today list will see
those 12 todos move to the Closed view automatically on next reload, and they
will be subject to the 30-day clock based on their original completion time.

There is **no schema-version bump** because the change is additive (only adds
optional fields to existing items). `ProclivityExport.schemaVersion` stays at
**1** — a v1-shaped backup imported into the new code still works because the
backfill in `storage.get()` runs on import too (we route imports through the
same backfill in `exportImport.ts`).

### 2.9 Export / Import

The export envelope is unchanged in shape — it carries `state.todos` verbatim
including the new `closedAt` / `closedFromScope` / `closedFromSprintId` fields.

The import path:
- Backfills `closedAt` / `closedFromScope` / `closedFromSprintId` defensively
  when a `done: true` todo is missing them.
- Validates `closedFromSprintId` against the imported `state.sprints` (drops if
  orphan, same pattern as the tag-id orphan filter).

No schema bump.

---

## 3. Module layout

### Files I own (Agent A)

```
src/types/index.ts                       — Todo extended (3 optional fields)
src/storage/constants.ts                 — CLOSED_TODO_RETENTION_DAYS, CLOSED_TODO_MAX
src/storage/storage.ts                   — backfill closedAt on get() (same pass as tags)
src/storage/closedTodos.ts               — NEW: helpers + selectors
src/storage/exportImport.ts              — orphan filter for closedFromSprintId; backfill
src/background/service-worker.ts         — purge alarm wiring
src/components/closed/ClosedTodosView.tsx — NEW: the surface
src/components/closed/ClosedTodosView.css — NEW: scoped styles
```

### Files I do NOT touch (Agent B owns)

```
src/sections/TodoList.tsx
src/sections/Today.tsx
src/sections/Sprint.tsx
src/sections/LongTerm.tsx
src/sections/sprint/SprintManager.tsx
src/sections/TodoCardSection.tsx
src/newtab/App.tsx
```

---

## 4. Integration contract for Agent B

### 4.1 Imports

```ts
import {
  // selectors (pure, no side effect)
  getActiveTodos,            // (state) => Todo[]   — done === false
  getClosedTodos,            // (state) => Todo[]   — done === true, sorted newest-first by closedAt
  countClosedTodos,          // (state) => number   — for badge counts

  // storage updaters (return (s) => s, pass to update())
  closeTodo,                 // (id) => updater     — flip to closed pile, capture scope/sprint
  reopenTodo,                // (id) => updater     — restore from closed pile
  permanentlyDeleteTodos,    // (ids[]) => updater  — destructive, scrubs cardLayouts too
  clearAllClosed,            // () => updater       — destructive, same scrub
  purgeOldClosed,            // () => updater       — retention enforcement, idempotent

  // lazy-loadable component
  // (NOT exported from this module — Agent B should lazy-import the View directly)
} from "@/storage/closedTodos";
```

### 4.2 How Agent B should filter active lists

In `TodoList.tsx` the existing `scopedItems` memo:

```ts
const scopedItems = useMemo(
  () =>
    todos
      .filter((t) => t.scope === scope)
      .filter((t) => (filter ? filter(t) : true))
      .sort(...),
  [todos, scope, filter],
);
```

becomes:

```ts
const scopedItems = useMemo(
  () =>
    getActiveTodos({ ...state, todos })   // or pass state directly
      .filter((t) => t.scope === scope)
      .filter((t) => (filter ? filter(t) : true))
      .sort(...),
  [todos, scope, filter],
);
```

Equivalent for SprintManager: replace `t.scope === "sprint" && t.sprintId ===
activeSprintId` with the same predicate AFTER passing through `getActiveTodos`.

### 4.3 How Agent B should wire the check-off (toggle) action

The current `toggle` in TodoList.tsx flips `done` directly. The sibling agent
should replace it with a branch:

```ts
const toggle = async (id: string) => {
  const todo = state.todos.find((t) => t.id === id);
  if (!todo) return;
  if (!todo.done) {
    await update(closeTodo(id));            // active → closed
  } else {
    await update(reopenTodo(id));           // closed → active
  }
};
```

`closeTodo` and `reopenTodo` are atomic and idempotent.

### 4.4 How Agent B should render the Closed surface

A lazy import keeps the component out of the initial chunk:

```ts
const ClosedTodosView = lazy(() =>
  import("@/components/closed/ClosedTodosView").then((m) => ({
    default: m.ClosedTodosView,
  })),
);

// in render
{tab === "closed" && (
  <Suspense fallback={null}>
    <ClosedTodosView />
  </Suspense>
)}
```

`ClosedTodosView` is self-contained — it pulls from `useStore()`, drives its
own state, and exposes no props besides an optional `onTabChange` (signature
mirrors `Calendar.tsx`) for the "Open in Today" link from a restored todo.

### 4.5 Data shapes Agent B reads

```ts
// Closed todo (same Todo type, with done === true)
interface Todo {
  id: string;
  title: string;
  scope: TodoScope;            // pre-close scope (preserved for visual continuity)
  done: true;
  done: false;                 // (active)
  closedAt?: number;           // ms — only on closed
  closedFromScope?: TodoScope; // pre-close scope checkpoint
  closedFromSprintId?: string; // pre-close sprint checkpoint
  // ... plus tags, notes, completedAt, etc.
}
```

`countClosedTodos(state)` returns an integer Agent B can use for a tab badge.

---

## 5. Commit plan (sequenced)

| # | Conventional commit | What |
|---|---|---|
| 1 | `feat(storage): closed-todos data layer scaffold` | Types extension + constants + `storage.get()` backfill + skeleton `closedTodos.ts` with selectors + helpers, fully typed, builds clean. No UI; existing code paths still pass. |
| 2 | `feat(storage): export/import roundtrip for closed-todos` | Defensive backfill + orphan filter for `closedFromSprintId` in `exportImport.ts`. |
| 3 | `feat(sw): periodic purge alarm for closed-todos` | Service-worker daily purge wired through the existing write queue + logger. |
| 4 | `feat(closed): ClosedTodosView surface + styles` | The lazy-loaded view component. Built so default users without closed todos pay 0 kB (lazy chunk only loads when the tab is opened). |

If Phase 4's component lands cleanly, no fix-up commit is needed; otherwise a
`fix(closed): …` micro-commit follows.

---

## 6. Constraints honored

- **Initial chunk** stays at 199.15 kB pre-feature. Only the data layer
  (selectors + helpers) lands in the shared / hot path; that's a few hundred
  bytes minified. `ClosedTodosView.tsx` and its CSS are in their own lazy
  chunk loaded only when Agent B mounts the Closed tab.
- **TS strict** — every new optional field uses the explicit `T | undefined`
  pattern per the file's existing convention.
- **No new npm deps**.
- **No new schema version** — additive change, backfill in `storage.get()`.
- **Service-worker logging** — purge fires through the existing `getLogger`
  pipeline with namespace `closed` so users can opt in via debug toggle.
- **`exactOptionalPropertyTypes`** — `closeTodo` builds the patch object with
  conditional spreads to avoid writing `undefined` to optional-but-narrowed
  fields, matching the pattern in `setCardPositionToFront`.

---

## 7. "Try it in the browser" verification steps

After Agent B's integration lands:

1. Reload the unpacked extension on the build.
2. Open a new tab — Today section appears as before.
3. Add three todos. Tick two off. Verify those two **disappear** from Today.
4. Navigate to the Closed tab/view — verify the two appear, sorted newest-first.
5. Un-tick one in the Closed view → confirm it returns to Today.
6. Hit "Delete forever" on the remaining one → confirm it vanishes from both views.
7. From DevTools, inspect `chrome.storage.local` — confirm `proclivity:state:v1`
   no longer carries the deleted todo, and that the remaining active todo's
   `closedAt` is `undefined`.
8. Manually set a closed todo's `closedAt` to a timestamp older than 30 days
   in DevTools, then call `chrome.alarms.create("proclivity:closed:purge",
   {when: Date.now()+1000})` — verify it's gone next tick.
9. Export the data; reimport into a fresh profile; verify closed todos roundtrip.
