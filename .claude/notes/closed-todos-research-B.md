# Closed Todos — Research B (Integration + Navigation)

**Agent:** Opus 4.7 (1M ctx) — **Role:** UI/UX integration + navigation surfacing
**Sibling agent:** owns data layer + ClosedTodosView component (research-A.md)

## 1. The user's brief, parsed

> "Currently, closed tickets still show up on the panel in both the cards
> todo layout and the list todo layout. I would like for them to go into
> some 'Closed' document with a temporary persistent storage."

Two load-bearing words:

- **"document"** (singular, not "documents"). The user envisions **one**
  surface — not a Today-closed, Sprint-closed, Long-closed triad.
- **"temporary persistent storage"** — closed todos persist across page
  reloads / new-tab opens, but the user expects them to be cleared
  eventually (sibling owns the purge policy; not my territory).

Two implications for IA:

- A **single global Closed surface** beats per-section sub-headers.
- Done todos should be **invisible by default** in active sections (the
  user is explicit: "I would like for them to go into…" — the
  destination, not the source, is where they live now).

## 2. Competitor IA survey

| App | Where closed/completed lives | Default visibility in active list | Restore UX |
|---|---|---|---|
| **Todoist** | Per-project bottom + opt-in beta in Today | Hidden — user must turn on "Show completed" or open the per-project completed view | Uncheck the task |
| **Linear** | "All issues" view + per-team option to hide completed; status filter dropdown | Visible (Linear shows everything; status column is the filter) | Change status back to non-completed |
| **Things 3** | **Logbook** sidebar entry (single global archive) | Hidden — Logbook is opt-in nav | Re-open ("untick") in the Logbook list |
| **Apple Reminders** | "Completed" header **inside each list** that toggles show/hide; plus a per-list scroll-to-top section | Hidden by default; pull-down reveals | Uncheck |
| **TickTick / Microsoft To Do** | "Show Completed" subsection toggle **within each list** | Hidden by default | Uncheck |
| **GitHub Issues** | "Closed N" filter pill at top of list — switches the whole list to closed | Hidden (open is default) | Reopen button on issue |
| **Trello** | **Archive** lives behind a menu (board menu → More → Archived Items) | Hidden | "Send to board" / unarchive button |
| **Asana** | Per-section "Show completed" picker (last 1 week / 2 weeks / all / no completed) | Hidden by default | Uncheck the task |

Common patterns across the better-designed apps:
- Things 3, Trello, Linear's "All issues": **global archive surface** that
  is one click away from main nav.
- Apple Reminders, TickTick, MS To Do, Asana: **per-list inline toggle**.

What Proclivity wants — given the brief uses singular "document" — is
the **Things 3 / Trello pattern**: one global archive, accessible from
the existing tab bar.

## 3. IA decision

**Pick: (a) new top-level tab "Closed" alongside Today / Sprint / Long-term / Gantt / Calendar / Reminders.**

Rejected alternatives and reasoning:

- **(b) Per-section "Closed" toggle** — violates the "some 'Closed'
  document" singular phrasing. Also fights the existing tabbed
  navigation: you'd add 3 toggles (Today, Sprint, Long-term) for one
  feature, and the user would have to remember which closed-todo lives
  under which section. Worse for retrieval.

- **(c) Modal/overlay** — modals are interruptive and the closed list
  is meant to be browsable, scannable, and possibly restored from. A
  scrollable surface earns its real estate on the page.

- **(d) Hybrid** — premature. Phase 1 ships the simplest thing that
  satisfies the brief: one global archive. If the user later wants
  per-section closed counters or a per-section restore picker, that's a
  follow-up; the existing tab bar can grow inline affordances.

**Justification for the new top-level tab:**

1. Discoverability — a labeled tab is visible from first paint. New
   users see "Closed" without reading docs.
2. Reuses the existing `sectionVisibility` infrastructure (no new
   global toggle pattern to invent).
3. Mounts only when visible (`hidden={tab !== "closed"}`); the
   ClosedTodosView is lazy-loaded by the sibling. No initial-chunk
   bloat from a tab the user hasn't clicked.
4. Keyboard nav and tablist ARIA already wired in App.tsx — the new
   tab inherits a11y for free.
5. Consistent with the **rightmost / archival** mental model: the
   Calendar and Reminders tabs already cluster "things outside the
   active flow." Closed slots in naturally next to them.

**Placement:** rightmost tab. Order: Today / Sprint / Long-term / Gantt
/ Calendar / Reminders / **Closed**. Putting it last reinforces
"archive / done-with-it" semantics.

## 4. Per-section behavior contract

When a todo is checked off (`done` flips to `true`) AND the sibling's
new "move to closed" data flow is in effect:

- **List mode (TodoList.tsx):** the row is filtered out of
  `scopedItems`. It does NOT slide in place at the bottom of the list
  the way today's code sorts by `Number(a.done) - Number(b.done)`. That
  sort line stops doing anything because closed items are gone.
- **Card mode (TodoCardSection.tsx):** the card is filtered out. Its
  `cardLayouts` entry stays (sibling decides whether to wipe on close
  vs. wipe on delete; from the integration side I just consume their
  selectors). When the user restores the todo, if a card-mode layout
  entry still exists, the card reappears in its old position.
- **Active sprint (SprintManager.tsx):** filtered out of
  `activeSprintTodosAll` AND the "Unassigned" group AND archived sprint
  rows. Closing a sprint task moves it to the Closed surface; the
  sprint's "X/Y tasks done" progress bar still counts closed-but-once-
  done tasks (otherwise progress jumps to 0 when you close a task,
  which is wrong).

### Sprint progress counter — critical subtlety

`sprintTaskStats(todos, sprint.id)` in `src/sections/sprint/sprintUtils.ts`
counts done vs. total within a sprint. If closed tasks are filtered out
of `todos` for display, the progress bar will read 0/0 done. We need
either:

- **(A)** The progress counter looks at **all** todos including closed
  ones — so closing a sprint task keeps it counted as "done in this
  sprint." Implementation: the closed list IS a property the sibling
  exposes (e.g. `state.closedTodos[]`); the progress helper concats
  open + closed when computing stats for a sprint.
- **(B)** The progress counter doesn't change; closed sprint tasks
  stay in `state.todos` with a new field (e.g. `closedAt`); the filter
  for *display* excludes them but stats include them.

I'll defer to the sibling. **My integration code will pass `allTodos`
(open + closed) to `sprintTaskStats` whatever shape they choose.**
Documented in §10 (integration contract).

### Sprint archived rows

Archived-sprint expansion currently shows ALL tasks of that sprint,
including done ones (via `t.scope === "sprint" && t.sprintId === s.id`
filter). With closed-todos-as-separate-bucket, the user can't see
closed tasks expanded in an archived sprint row.

**Decision: leave archived rows alone for v1.** Archived sprints
already represent "past work" — burying closed sprint tasks in the
Closed tab is the consistent move. If feedback arrives that users want
a per-sprint closed view inside archived rows, that's a follow-up.

The Closed tab's filter UI (grouping by scope, by close date) gives
the user a way to see "all closed sprint X tasks" via the scope
filter, which addresses the loss of the per-sprint expanded view.

## 5. Filtering — exact location

### `TodoList.tsx` `scopedItems` selector
Today:
```ts
todos
  .filter((t) => t.scope === scope)
  .filter((t) => (filter ? filter(t) : true))
  .sort((a, b) => Number(a.done) - Number(b.done) || b.createdAt - a.createdAt)
```

After:
```ts
todos
  .filter((t) => t.scope === scope)
  .filter((t) => !isClosed(t))   // NEW — calls sibling helper
  .filter((t) => (filter ? filter(t) : true))
  .sort((a, b) => b.createdAt - a.createdAt) // sort by done removed (no closed)
```

The `Number(a.done) - Number(b.done)` sort key is now dead because
done todos are filtered out before sort. We can remove that half of
the comparator for a tiny perf and clarity win, but I'll keep it to
minimize blast radius — if a todo is *checked but not yet processed
into the closed bucket* (race condition during a `toggle()`), the old
sort key keeps it from jumping to the top.

### Sibling-exported `isClosed` helper
Contract (see §10):
```ts
export function isClosed(todo: Todo): boolean;   // OR
export function isClosed(todo: Todo, state: ProclivityState): boolean;
```
I'd prefer no-state variant — purely structural on Todo (e.g. presence
of a `closedAt` field). Less coupling.

### `SprintManager.tsx`
Same filter applied to:
- `activeSprintTodosAll` — exclude closed
- `unassignedSprintTodos` — exclude closed
- The card-mode `sortedActiveSprintTodos` — exclude closed
- `sprintTaskStats` call — **passes UNFILTERED `todos` always** so the
  progress bar doesn't drop when tasks are closed (assumes sibling
  keeps `state.todos` source-of-truth and `state.closedTodos[]` is a
  derived/parallel array). If the data model differs, we adapt — but
  the progress display must reflect "this sprint had 8 tasks, 6 are
  done" regardless of whether the 6 done ones are visible.

`taskCountForSprint(sprintId)` in SprintManager — counts tasks for the
"Delete sprint" confirm. Should include closed sprint tasks so the
warning is honest ("this will also delete 8 tasks" — the user wants to
know all of them disappear, including the closed ones).

### Card mode — `cardLayouts` cleanup on close

Open question for sibling: when a card transitions from active → closed,
do we:
- (i) keep the cardLayout entry so restore re-places the card; or
- (ii) wipe the cardLayout entry, accepting that restore goes to default cascade.

My pref: **(i)** — keeps the user's spatial memory intact for restored
items. Cardlayouts are bounded by item count (10MB cap is plenty).

## 6. Close transition

Decision: **instant filter-out, no fade.** Reasoning:

- Existing toggle behavior is instant (`onChange` flips `done` and
  re-renders). Adding a 200ms exit animation introduces a window where
  a user can re-click "uncheck" mid-fade and get confusing behavior.
- The "where did it go?" affordance is handled by:
  1. The visible "Closed" tab in the nav bar — destination is named.
  2. The "N closed" counter in each section's toolbar (see §8).
- `reducedMotion` users (and Proclivity has a setting) get the right
  behavior for free with instant.

Sibling controls *when* the close actually persists — they may
debounce or write-through immediately. The UI just re-renders when
state updates.

## 7. Visibility setting (Settings toggle: "Show closed items inline")?

**Recommendation: NO.** Reasons:

- The brief is unambiguous — done todos go to the Closed document.
  Adding a "show them in active lists too" toggle re-introduces the
  exact behavior the user explicitly asked to remove. Anti-feature.
- The Closed tab is one click away. Discoverability cost is near zero.
- Reduces the Settings surface area (already 9 sections; resisting bloat).

Counter-argument I considered: power users sometimes want a
single-pane view. Reply: the existing card mode's `cardLayouts`
preservation + the Closed tab's filter UI (by scope, by date) handles
this better than a global toggle that hides the new feature.

## 8. Counter affordance — "N closed" per section

**Decision: yes, subtle inline counter linking to the Closed tab.**

Placement: in the existing `TagFilterToolbar` row of each section, OR as
a small text link below the input. After reviewing the toolbar layout,
**below the input** is cleaner — the tag toolbar is already busy.

Visual:
```
[input............................] [Add]
✓ 12 closed this week →
```
- Subtle text, accent-colored, link-styled.
- Click switches to the Closed tab.
- Only renders when count > 0.
- "this week" copy because the sibling's purge policy is time-based
  (sibling clarifies window); fallback copy: "12 closed →".

This affordance also reassures the user that the close action worked
("yes, that task moved somewhere — you can see the count went up").

## 9. Closed surface UI shell — spec for sibling

The sibling owns the component. **My spec for what they should
render** (they may push back; we coordinate via these markdown notes):

### Header
- H1 / page title: "Closed"
- Subtitle: "Tasks you've completed. They'll stay here for [policy
  window] before being cleared."
- Right-aligned: bulk-action button cluster (see Bulk ops below)

### Filter controls
A toolbar row, three controls (LTR):
1. **Scope filter** — segmented control: All / Today / Sprint / Long-term
2. **Tag filter** — reuse `<TagFilterToolbar>` (already in repo,
   composable; sibling can import)
3. **Search input** (optional v1; mention to sibling, low pri)

### Grouping
**Group by close-date, newest-first.** Headers like:
- "Today" (closed today)
- "Yesterday"
- "This week"
- "Last week"
- "Earlier"

Within each group: flat list using `<TodoItem>` (reused) with the
restore button replacing the edit pencil.

**Alternative considered:** flat newest-first with no headers. Decided
against — when the list grows past ~20 items, date headers anchor scan.

### Empty state
Copy: "Nothing closed yet. Tasks you check off will land here."
Visual: subtle (matches existing `.section-empty` class).

### Per-row UX
Each closed todo shows:
- Checkbox (CHECKED, restoring it un-closes / re-opens)
- Title (strikethrough by `.todo-item.done`)
- Tags chips
- Scope badge (small, secondary): "today" / "sprint" / "long"
- Close-date relative timestamp ("2h ago", "yesterday at 3pm") via
  `rs.relativeDates` setting
- **Restore button** (one-click) replacing the edit pencil
- Delete button (permanent — confirm dialog because this is destruction)

### Bulk operations
Header cluster:
- **Restore all** (in current filter) — confirm before restoring >5
- **Delete all** (permanent) — destructive, red, confirm with count
- *No* "Mark all unread" / archive-archive — out of scope

## 10. Integration contract — what sibling MUST export

Read-side helpers I'll consume from `src/storage/closedTodos.ts`:

```ts
// PURE — no state arg. Operates on Todo shape.
export function isClosed(todo: Todo): boolean;

// Selector — returns closed todos (read-only view).
export function getClosedTodos(state: ProclivityState): Todo[];

// Optional convenience — count per scope, used in §8 counters.
// If absent, I can compute from getClosedTodos().
export function closedCountByScope(
  state: ProclivityState,
  scope: TodoScope,
): number;
```

Write-side helpers I'll call from `TodoList.toggle` / `SprintManager.toggleTodo`:

```ts
// Patch a state to move a todo into the closed bucket.
// Pure updater consistent with existing storage patterns.
export function closeTodo(id: string):
  (s: ProclivityState) => ProclivityState;

// Reverse — moves back to active.
export function reopenTodo(id: string):
  (s: ProclivityState) => ProclivityState;

// Final deletion from the closed bucket.
export function deleteClosed(id: string):
  (s: ProclivityState) => ProclivityState;
```

**Existing toggle() shape today:**
```ts
const toggle = async (id: string) => {
  await update((s) => ({
    ...s,
    todos: s.todos.map((t) =>
      t.id === id
        ? { ...t, done: !t.done, completedAt: t.done ? undefined : Date.now() }
        : t,
    ),
  }));
};
```

**Proposed new toggle() shape:**
```ts
const toggle = async (id: string) => {
  await update((s) => {
    const t = s.todos.find((x) => x.id === id);
    if (!t) return s;
    if (!t.done) {
      // Active → checked → moves to closed (sibling helper)
      return closeTodo(id)(s);
    }
    // Already done? unusual since done items are filtered out — but
    // safe to undo via the same path:
    return reopenTodo(id)(s);
  });
};
```

### Sprint progress contract

`sprintTaskStats(todos, sprintId)` continues to receive `state.todos`
plus `state.closedTodos` (concat or unified — sibling decides). If
sibling adopts unified `state.todos` with a `closedAt` field, then no
helper change; sprintTaskStats keeps working.

**My code in SprintManager.tsx will pass `[...state.todos, ...(getClosedTodos(state))]`
into `sprintTaskStats` IF the data model splits the arrays. Otherwise
just `state.todos`.** Concrete call site adapts after sibling finalizes.

### Section visibility for the Closed tab

I need to add `closed?: boolean | undefined` to
`UserSettings.sectionVisibility` and to `ResolvedUserSettings.sectionVisibility`.
**Sibling owns `src/types/index.ts`** per the assignment. **Request:
please add the `closed` field to both interfaces. Default: `true`
(visible).**

I'll also need `DEFAULT_SETTINGS.sectionVisibility.closed = true` and a
fallback in `resolvedSettings()`. Sibling, please wire those in
`src/storage/constants.ts` (also owned by sibling).

If for any reason sibling can't add it before I'm ready to commit, I
can ship the tab gated on a literal `true` and stitch the
settings-visibility wiring in a follow-up commit. Either path keeps
both agents unblocked.

### Export/Import schema

`src/storage/exportImport.ts` is sibling-owned. If `closedTodos[]`
becomes a new top-level state array, sibling must include it in
export and import-validate it. Out of my scope; flagging.

## 11. Out-of-scope for this milestone (deferred)

- Animated "fly to Closed tab" transition — nice but not blocking.
- Bulk multi-select in Closed view (shift-click, etc.) — v1 has just
  "all in current filter" bulk actions.
- Search within Closed — possible but I'll defer to sibling's call.
- Per-sprint expansion of closed sprint tasks in archived rows — see §4.
- Settings-driven retention window slider — sibling owns purge policy;
  surface it later via a Settings sub-section.

## 12. Concrete edit plan for MY files

| File | Change | Bundle impact (est.) |
|---|---|---|
| `src/newtab/App.tsx` | Add "closed" Tab union member; add to TABS array; new TAB_KEY entry; mount tabpanel that lazy-loads ClosedTodosView | + tab definition ~0.2 kB; ClosedTodosView is lazy (sibling) |
| `src/sections/TodoList.tsx` | Filter `scopedItems` to exclude closed; rewrite `toggle()` to call closeTodo / reopenTodo helpers; add inline "N closed →" counter linking to Closed tab | ~0.4 kB |
| `src/sections/sprint/SprintManager.tsx` | Filter active+unassigned sprint todos to exclude closed; keep sprint progress counter inclusive of closed; counter affordance | ~0.4 kB |
| `src/sections/sections.css` | New `.closed-counter-link` style (small, accent, link); new `.tab` class doesn't need a variant (uses existing tab styles) | ~0.1 kB CSS |
| `src/components/settings/SettingsModal.tsx` | Add "Closed" row to the DashboardSection visibility checklist | ~0.1 kB (lazy chunk anyway) |

I will NOT touch:
- `src/types/index.ts`
- `src/storage/constants.ts`
- `src/storage/closedTodos.ts` (new — sibling)
- `src/storage/exportImport.ts`
- `src/components/closed/*`
- `src/background/service-worker.ts`

## 13. Cross-tab navigation — how the counter link switches tabs

The current `setTab(t)` lives in `App.tsx`. `Calendar` already has an
`onTabChange` prop. I'll follow that pattern: pass an `onJumpToClosed`
callback down through TodoList and SprintManager (or use a small
context — but a callback is simpler given the modest depth).

Actually, simpler: a **custom event on window** (`"proclivity:nav-closed"`)
that App listens for. Avoids prop drilling 3 levels deep into
`TodoCardSection`. Pattern reused if a future feature needs the same.

Decision: **CustomEvent.** It's a 4-line addition in App + a 1-line
dispatch from the section components. Keeps prop interfaces clean.

## 14. Verification plan

1. `npm run build` clean (must be a sub-1 kB delta on the initial chunk).
2. Toggle a todo in Today list mode → disappears from active, appears
   in Closed tab.
3. Same in Today card mode → card disappears; counter increments.
4. Same in Sprint → disappears from active sprint task list AND the
   sprint progress bar reflects the new "done" count (e.g. 6/8).
5. Restore from Closed tab → todo reappears in original scope; in card
   mode, position is preserved if cardLayouts entry survived.
6. Delete from Closed → confirm dialog → permanent.
7. Hide Closed tab in Settings → tab disappears from nav. Closing a
   todo still works (counter still shows in active sections; clicking
   it does nothing since target is hidden — accept this minor edge or
   suppress counter when tab is hidden; **suppress for clarity**).
8. The clearAll function in DataSection — sibling: please also wipe
   closedTodos in clear-all so users get a true reset.

## 15. Coordination handoff — RESOLVED with sibling research-A.md

After reading sibling's research-A.md, the contract is:

**Data model (confirmed):** single `state.todos[]` with three new
optional fields on `Todo`: `closedAt`, `closedFromScope`,
`closedFromSprintId`. No new top-level state array.

**Helpers I'll consume from `@/storage/closedTodos`:**

```ts
getActiveTodos(state): Todo[]          // done === false
getClosedTodos(state): Todo[]          // done === true, newest-first by closedAt
countClosedTodos(state): number        // total closed count (for badges)
closeTodo(id): (s) => s                // active → closed updater
reopenTodo(id): (s) => s               // closed → active updater
permanentlyDeleteTodos(ids[]): (s) => s
clearAllClosed(): (s) => s
purgeOldClosed(): (s) => s             // retention enforcement, idempotent
```

**Toggle wiring (per sibling §4.3):**
```ts
const toggle = async (id: string) => {
  const todo = state.todos.find((t) => t.id === id);
  if (!todo) return;
  if (!todo.done) {
    await update(closeTodo(id));
  } else {
    await update(reopenTodo(id));
  }
};
```

**Sprint progress (resolved):** Since the data model keeps closed todos
in `state.todos`, `sprintTaskStats(todos, sprintId)` already includes
them. I just need to NOT pass it `getActiveTodos(state)`. Filter for
display, keep stats over the full array.

**Card layouts on close (confirmed):** preserved. Removed only on
permanent delete via sibling's `permanentlyDeleteTodos`.

### Unresolved: `sectionVisibility.closed`

Sibling did NOT include `closed` in their files-owned changes to
`src/types/index.ts` / `src/storage/constants.ts`. Per the
assignment constraints, I cannot edit those files.

**My resolution:** Ship the Closed tab as **always-visible** (no
sectionVisibility entry). Rationale:

- The brief explicitly asks for a "Closed document" destination —
  it should always be findable.
- Hide-the-Closed-tab is a niche preference; the v1 user
  experience doesn't need it.
- Reduces coordination overhead; the feature ships without
  blocking on cross-agent type changes.
- Follow-up commit can add the setting once both feature pieces
  are stable.

### Counter affordance and bulk operations

My counter affordance (§8) uses `countClosedTodos` from the sibling's
exports. The Closed surface UI (§9) is the sibling's territory; my
spec is advisory.

## Sources

- [Todoist – View completed tasks](https://www.todoist.com/help/articles/view-completed-tasks-in-todoist-J19h2s)
- [Linear – Display options](https://linear.app/docs/display-options)
- [Things 3 – Quick Find / Logbook](https://culturedcode.com/things/support/articles/2803584/)
- [Apple Reminders – Mark complete/incomplete](https://support.apple.com/guide/reminders/mark-reminders-complete-or-incomplete-remndbeda47c/mac)
- [TickTick – List View help](https://help.ticktick.com/articles/7055782365863346176)
- [GitHub Issues – Filtering and searching](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/filtering-and-searching-issues-and-pull-requests)
- [Trello – Archive or delete a card](https://support.atlassian.com/trello/docs/archiving-and-deleting-cards/)
