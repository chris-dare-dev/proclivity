# Adversarial Critique — Closed Todos Feature

## Verdict

Do not ship as-is. Two issues require fixes before this is safe to hand users: the storage subscriber bypasses the `closedAt` backfill so a live UI update after a service-worker write can produce `done: true` todos with `closedAt === undefined` that immediately break the purge clock (HIGH), and the `runClosedPurge` telemetry does a bare `readState()` outside the write queue that races with its own `swUpdate` call and will report wrong counts (MEDIUM / bug-in-telemetry only). The missing newtab-open purge path (design spec promised it; it was never wired) means the SW-only 24h cadence is the sole enforcement, which is fine operationally but breaks the spec. Everything else is medium-to-low polish. The core data model, retention logic, and reopen semantics are correct.

---

## Setup notes

**fbd4b31 is genuinely mixed.** The commit titled `feat(closed): ClosedTodosView surface + styles` landed all of: `ClosedTodosView.tsx`, `ClosedTodosView.css`, `App.tsx` changes (Closed tab, NAV_CLOSED_EVENT, TAB_KEY), AND `QuickPrompt.tsx`, `QuickPrompt.css`, `useQuickPrompt.ts`. QuickPrompt has zero relation to closed todos. It appears to be Agent B staging untracked Agent A files that were lying in the tree. QuickPrompt functions correctly (it imports `useQuickPrompt` which imports `@/llm/tools`; the build passes), but the commit message is a lie and the git blame is poisoned. The follow-up `refactor(storage)` commit (e0500ef, 3 minutes later) was clean and correctly scoped.

---

## Severity-graded findings

### CRITICAL

None found. The data model is sound. No data-loss path was confirmed.

---

### HIGH

**H1. `storage.subscribe` delivers raw state — backfill is bypassed for live updates.**

`useStore.ts:20` passes `setState` directly to `storage.subscribe`. The subscribe path (`storage.ts:109`) delivers `changes[STORAGE_KEY].newValue` — the raw JSON from Chrome storage — without running it through the `storage.get()` backfill that stamps `closedAt` on `done: true` todos.

Consequence: if the service-worker writes a purge result, or if another tab writes state while this tab is open, the subscriber receives raw state. Any `done: true` todo in that write that was not backfilled server-side (e.g. a legacy todo closed by the SW's `closeTodo` updater that correctly stamps `closedAt` — actually fine there) OR a todo that exists in Chrome storage from before this release (pre-migration) will land in the React tree with `closedAt === undefined`. The 30-day purge clock, the `getClosedTodos` sort, and the group label in `ClosedTodosView` will all see `closedAt = undefined` and fall back to `completedAt ?? createdAt ?? Date.now()`. For most cases this is gracefully handled, but:

- `purgeOldClosed` uses `t.closedAt ?? t.completedAt ?? t.createdAt ?? now` as its age anchor. A freshly-backfilled todo whose `closedAt` is undefined will get `now` as its age anchor on the *purge read path* (which goes through `storage.get()`), but will appear in the UI with `createdAt` as its group label. The user may see "Today" for a todo created months ago.
- More critically: code that renders `closed.length >= CLOSED_TODO_MAX * 0.9` and other counts runs on the raw subscribed state. If a user has pre-migration `done: true` todos and the SW fires a write, the "N closed" counter in TodoList (`todos.filter((t) => t.scope === scope && t.done).length`) will count them — which is correct — but the group display will be wrong until the next `storage.get()`.

The backfill should also run in the subscribe path. The simplest fix: wrap the newValue in `storage.get()`-equivalent normalization before calling the listener, or run `storage.get()` after each subscribe notification instead of using `newValue` directly.

**H2. Sprint `deleteSprint` silently deletes closed sprint todos without warning the user — and `taskCountForSprint` also undercounts.**

`SprintManager.tsx:539-541` filters out `t.scope === "sprint" && t.sprintId === activeSprintId`. This removes **all** todos for that sprint — active AND closed. Correct per the original design (research-A.md §2.5 says "existing delete cascade already removes closed-pile todos with that sprintId — desirable"), but the confirmation dialog count at `SprintManager.tsx:622` uses:

```ts
todos.filter((t) => t.scope === "sprint" && t.sprintId === sprintId).length
```

This is the **full** `todos` array including closed ones. So the count IS honest. But the message reads "This will also delete N tasks" — the user may be surprised that closed sprint tasks are included. The dialog does not distinguish between active and closed. Low severity by itself, but combined with H2 it becomes a UX lie: the count promises N tasks deleted, but the user conceptually moved those tasks to "Closed" and may believe them safe. There is no mention of closed tasks in the dialog.

**Recommended fix:** Split the count: "active: X, closed: Y — all will be permanently deleted."

**H3. `ArchivedSprintRow` shows closed (done) todos from the full `todos` array.**

`SprintManager.tsx:319-321`: `ArchivedSprintRow` receives `todos` (the full state.todos) and filters with `t.scope === "sprint" && t.sprintId === sprint.id` — no `!t.done` gate. This means closed sprint tasks re-appear inside expanded archived sprint rows. A user who closed a task while the sprint was active, then archives the sprint, will see the task appear in both the Closed tab AND inside the archived sprint row (the archived row passes it to `TodoItem` which can toggle/delete it). Research-B.md §4 explicitly says "leave archived rows alone for v1" but that decision assumed closed tasks wouldn't appear in archived rows — they do.

This creates a second toggle path for closed todos in archived rows. Clicking the checkbox in an archived row calls `toggleTodo` which calls `reopenTodo` on an already-open todo (no-op since `done === false`) or `closeTodo` on a closed todo (re-stamps `closedAt`, no semantic change). Not data-loss, but confusing. The "N closed →" counter affordance won't show in archived rows, so users who toggle there get no navigation feedback.

**Recommended fix:** Filter `!t.done` in `ArchivedSprintRow.sprintTodos` for v1, deferring the "show closed sprint tasks inline" feature.

---

### MEDIUM

**M1. Newtab-open purge promised in the design spec is unimplemented.**

Research-A.md §2.3 explicitly states: "Run the purge: on every newtab open (cheap; user is interacting anyway) AND once per day via `chrome.alarms`." Only the alarm path was wired. `useStore.ts` does not call `purgeOldClosed()` on mount; `App.tsx` has no `useEffect` for it. The 24h service-worker alarm is the only enforcement. For a user who opens a new tab every 5 minutes, this makes zero practical difference. For a user on a Chromebook whose SW is killed and respawned frequently, the alarm may be deleted and recreated with a 24h delay reset each time, meaning purge only runs on install/reinstall. The `ensureClosedPurgeAlarm` function wisely avoids recreating the alarm if it exists, but the absence of the newtab-side purge path is a gap in the spec.

**Recommended fix:** In `useStore.ts` or in a `useEffect` in `App.tsx`, call `storage.update(purgeOldClosed())` once on mount. It's idempotent and fast.

**M2. `runClosedPurge` telemetry races with the write queue.**

`service-worker.ts:188-198`: `runClosedPurge` does:
```
const before = await readState();     // raw read, OUTSIDE write queue
await swUpdate(purgeOldClosed());     // goes through write queue
const after = await readState();      // raw read again, OUTSIDE write queue
```

The `before` read is correct since it precedes the write. But the `after` read races with anything else that might write concurrently between when `swUpdate` resolves and when `readState()` fires. The "purged" count in the log (`beforeClosed - afterClosed`) could be wrong. This is telemetry-only — the actual purge is atomic. But the log is the only observability for users who file "where did my todos go?" bugs.

**Recommended fix:** Compute the "after" count inside the `swUpdate` updater and return it alongside the state, or simply trust `permanentlyDeleteTodos`'s `deleteIds.length` and log that from within the updater.

**M3. `storage.set()` used by `importData` bypasses backfill — imported pre-feature backups get no backfill until the NEXT `storage.get()`.**

`exportImport.ts:186` calls `storage.set(merged)` directly. The import loop does run its own backfill for `closedAt` (lines 128-131) and `closedFromSprintId` (lines 137-143), so the on-disk state is correct after import. But the `useStore` subscription will fire with the newly-written value (via `chrome.storage.onChanged`) and deliver it raw (see H1). If the user's page was open during the import, the post-import state in React state skips backfill until they reload. This combines with H1.

**M4. Settings "Clear all data" wipes `todos: []` — closed todos included — but doesn't scrub `cardLayouts`.**

`SettingsModal.tsx:258-268`: `handleClearAll` returns a fresh `ProclivityState` with `todos: []` but omits `cardLayouts`. The EMPTY_STATE does not include `cardLayouts` (it's optional), but the update spreads over existing state:

```ts
await update((): ProclivityState => ({
  todos: [],
  sprints: [],
  ...
  // cardLayouts NOT present
}));
```

The update replaces the state object entirely (it ignores `s`), so `cardLayouts` key is just absent from the returned object. `{ ...EMPTY_STATE, ...raw }` in `storage.get()` will then return `cardLayouts: undefined`. This is actually correct since EMPTY_STATE has no `cardLayouts`. Verified: not a bug. Struck from findings. (The research-B.md §14 note "please also wipe closedTodos in clear-all" is a non-issue because closed todos live in `todos` — setting `todos: []` covers them.)

**M5. `closedTodo` filter in `TodoList.scopedItems` uses `!t.done` directly instead of the `getActiveTodos` selector.**

`TodoList.tsx:66`: `.filter((t) => !t.done)` is equivalent to `getActiveTodos` for all current code paths, but it's a leaky abstraction. If the "closed" concept ever evolves (e.g. a "paused" state distinct from done), or if a bug causes `done: true` without `closedAt`, `TodoList` will silently filter items that should be visible. The contract between the UI and the data layer is documented only in the data layer; callers should go through the selector. Research-A.md §4.2 explicitly recommended using `getActiveTodos`.

**M6. Grouping boundary "This week" overlaps "Yesterday".**

`groupOf` at lines 95-100: `d === 1` → "Yesterday", `d <= 7` → "This week". So d=2..7 is "This week". This means Sunday evening (d=0 = "Today"), Saturday evening (d=1 = "Yesterday"), and the entire week before that (d=2..7 = "This week"). The label "This week" is misleading when Sunday = d=0, Monday = d=1 ("Yesterday"), Tuesday–Sunday last week = d=2..7 ("This week"). A task closed 7 days ago is labeled "This week" — plausible. A task closed 6 days ago on the same calendar week as today is also "This week" — also plausible. But a task closed 3 days ago (Thursday) is "This week" when today is Sunday, even though Thursday was last week. The calendar-week-aware grouping is not implemented; it's purely a rolling 7-day window. The label should say "Last 7 days" to be accurate, or the implementation should use `getDay()` math.

**M7. Duplicate "Reopen" affordance on every row — UX double-signal.**

`ClosedTodosView.tsx:339-345` and `367-379`: each row has BOTH a checked checkbox (clicking it calls `onReopen`) AND a text "Reopen" button. Both are labeled `aria-label="Reopen: <title>"`. Screen readers will announce two sequential controls with identical labels. Sighted users get redundant affordances. The design spec (research-B.md §9) described the checkbox as the restore mechanism — the text "Reopen" button wasn't in the original per-row spec. One of them should be removed. The text button is more discoverable; the checkbox is more familiar. Pick one.

---

### LOW

**L1. `groupOf` treats future `closedAt` as "Today".**

`groupOf:96`: `if (d <= 0) return "today"`. If `closedAt` is in the future (e.g. user set clock forward, or a buggy migration sets `closedAt = Date.now() + delta`), `daysAgo` returns negative and the item is bucketed as "Today". Not a bug users will hit, but a defensive `Math.max(d, 0)` in `daysAgo` would make the contract explicit.

**L2. "This week" group shows items up to 7 days old — potentially includes 8 days given midnight rounding.**

`daysAgo` rounds to local midnight. A todo closed at 11:58pm yesterday (d=1 → Yesterday) and another closed at 12:01am today (d=0 → Today) are correct. But the 7-day cutoff includes the full calendar day of 7-days-ago at `d=7` (because `d <= 7` is inclusive). Depending on local timezone and daylight savings transitions, `Math.round` at line 91 can round 6.50 days to 7 — putting something closed 6.5 days ago in "This week" while something 7.5 days ago also hits `d <= 7`. The `Math.round` is correct for the intention but the spec says "7 days"; `d <= 7` means "up to and including day 7" which is technically 8 calendar days from now. Minor.

**L3. `closedFromSprintId` not deleted from next in `closeTodo` idempotent re-close path.**

`closedTodos.ts:113-115`: on idempotent re-close (`t.done === true`), the `if (!t.done)` block is skipped, so `closedFromScope` and `closedFromSprintId` from the original close are preserved. This is intentional (the comment says so). But the `next` object is constructed by spreading `t` at line 103, which copies whatever `closedFromSprintId` already has — including a potentially stale sprint id if the user reopen→close cycle edits the sprint in between. This is the correct behavior per spec (preserve original checkpoint). No bug, just worth confirming.

**L4. "Closed" tab is always-visible with no Settings toggle.**

Research-B.md §15 explicitly called this out as a deliberate decision. Fine for v1. But the Settings modal's `sectionVisibility` checklist (SettingsModal.tsx) does not show a "Closed" row. A user who wants to hide it cannot. There's also no documentation comment in the settings modal explaining the absence. Add a `// Note: Closed tab intentionally omitted — always visible per research-B.md §3` inline comment.

**L5. `ClosedTodosView.css` has no `data-font-size` responsive overrides.**

The component uses hard-coded `rem` sizes (0.72rem, 0.78rem, 0.85rem, etc.) against a root that changes with `[data-font-size="sm/lg"]`. Since `rem` is relative to the root font-size, and `useThemeSync` sets `font-size` on `html`, the sizes do scale. No bug. But the density-aware overrides exist only for padding, not for font sizes within compact/spacious modes. The compact heading at `font-size: 0.68rem` is very small — this is a design choice but may be hard to read.

**L6. `runClosedPurge` does two `readState()` calls but the SW purge alarm fires even when the SW has no state (fresh install, pre-first-newtab-open).**

`service-worker.ts:189`: `readState()` returns `null` if storage is empty. `runClosedPurge` handles this: `before?.todos ?? []` gives `[]`, count = 0, `swUpdate` runs `purgeOldClosed()` which reads state inside `swUpdate` → `readState()` returns null there too → `if (!state) return` guard at line 44 exits without writing. Log says `before: 0, after: 0, purged: 0`. Correct. No bug.

**L7. The "N closed" counter in `TodoList` counts by `t.done` not by `t.closedAt !== undefined`.**

`TodoList.tsx:75`: `.filter((t) => t.scope === scope && t.done).length`. Since the backfill ensures all `done: true` todos have `closedAt`, this is equivalent for normal operation. But as noted in H1, raw subscribe delivery can produce `done: true` + `closedAt: undefined`. The counter would show the right number but the view would group them oddly. Minor, but a consequence of H1.

**L8. No "remove this code by [date]" comment on the `storage.get()` backfill.**

`storage.ts:43-64`: the backfill will be dead code once all users have a `closedAt`-stamped version of their data in storage (i.e., after a full retention cycle has run — ~30 days). It should stay at least that long, but a `// TODO(closed-todos-v2): remove this backfill after 2026-07-01` comment would flag it for eventual cleanup. Without it, it silently lives in the hot read path indefinitely.

---

## Code structure / abstractions audit

**Selector inconsistency.** `TodoList.tsx` filters with `!t.done` directly; `ClosedTodosView.tsx` uses `getClosedTodos(state)`; `SprintManager.tsx` uses `!t.done` directly. Three callers, two patterns. The `getActiveTodos` selector was explicitly designed as the single boundary. Two of three callers bypass it.

**`isClosed` helper was not exported.** Research-B.md §10 specified `isClosed(todo: Todo): boolean` as a pure structural helper. `closedTodos.ts` exports no such function. Agent B's research says "I'd prefer no-state variant" — the implementation went with inline `!t.done` checks everywhere instead. Fine for correctness but violates the stated integration contract.

**`closedCountByScope` was not exported.** Research-B.md §10 requested it. `SprintManager.tsx` and `TodoList.tsx` both implement inline `.filter(...).length` counters instead of using a shared helper. Not a bug, but three copies of the same count logic.

**`NAV_CLOSED_EVENT` string literal is duplicated.** Defined as a const in `App.tsx:75` but dispatched as a bare string literal in `TodoList.tsx:291` and `SprintManager.tsx:730`. If the event name changes, three files must change. Export the const from a shared location or from `App.tsx`.

**`runClosedPurge` in the SW has a design smell.** It reads state twice (before/after) outside the write queue to compute telemetry, with the write sandwiched in between. The pattern is: `read → write → read`. Any concurrent write between the SW's `swUpdate` and the second `readState` will corrupt the "after" count. The telemetry should be computed inside the updater function where state is a known-stable snapshot.

**Naming parity.** `closeTodo` vs `permanentlyDeleteTodos` (plural) vs `clearAllClosed` vs `purgeOldClosed` — inconsistent tense and plurality. Should be: `closeTodo` / `reopenTodo` / `deleteTodos` / `clearAllClosed` / `purgeOldClosed`. The plural on `permanentlyDeleteTodos` is correct since it takes an array, but the "permanently" prefix is verbose given the function is already in a file called `closedTodos.ts` that clearly distinguishes reversible vs irreversible operations.

**`ClosedTodosView` does not reuse `<TodoItem>`.** Research-B.md §9 specified "flat list using `<TodoItem>` (reused) with the restore button replacing the edit pencil." The implementation builds a bespoke `<ClosedRow>` component instead. This means: strikethrough styling (`.todo-item.done`), tag display, and keyboard interaction patterns are re-implemented from scratch. If `TodoItem` gets a bug fix or style improvement, `ClosedRow` won't get it. `ClosedRow` is well-implemented, but the divergence creates a maintenance burden.

---

## Documentation gaps

**No state-machine comment.** The lifecycle `active → closed → [purge | permanent-delete | reopen]` is never diagrammed. Research-A.md describes it in prose across sections 2.2–2.6, but there is no ASCII state machine comment in `closedTodos.ts` that would survive after the markdown notes go stale. A 10-line comment at the top of `closedTodos.ts` would suffice.

**Backfill has no sunset comment.** See L8. The read-path backfill will accumulate technical debt. A dated removal comment costs one line.

**`NAV_CLOSED_EVENT` mechanism is documented only inline.** `App.tsx:69-76` has a good JSDoc comment. But the event string is duplicated without cross-reference in TodoList and SprintManager. The mechanism should be either exported with a comment or at minimum forward-referenced.

**The integration contract lives only in markdown notes.** Nowhere in `closedTodos.ts` or `TodoList.tsx` is there a comment saying "the contract for these imports is documented in integration contract §4." The markdown notes will drift; the code will not. Add a `@see` or inline reference from the module docblock.

---

## Divergence from plans

| Plan | Shipped |
|---|---|
| Research-A §2.3: "Run purge on every newtab open" | Not wired. SW alarm only. |
| Research-A §2.6: "Purge job removes cardLayouts[id] for every purged id" | Correctly wired via `permanentlyDeleteTodos`. |
| Research-B §10: export `isClosed(todo): boolean` | Not exported. Callers use `!t.done` directly. |
| Research-B §10: export `closedCountByScope` | Not exported. Callers inline their own counts. |
| Research-B §9: reuse `<TodoItem>` for rows | Bespoke `<ClosedRow>` shipped instead. |
| Research-B §3: "Reuses existing sectionVisibility infrastructure" | Tab is unconditionally visible — no sectionVisibility entry added. |
| Research-B §9: scope filter + tag filter in Closed view | Scope filter absent. Tag filter absent. Not built. |
| Research-A §4: "Try it" step 8: newtab purge can be tested | Newtab purge not implemented, so this verification step would fail. |
| Research-B §14 step 7: "Hide Closed tab in Settings → tab disappears" | No Settings toggle exists for Closed tab. |

---

## Things the plans didn't cover

**The subscribe-bypasses-backfill gap.** Both agents designed around `storage.get()` as the normalization boundary. Neither addressed the fact that `useStore`'s subscribe path delivers raw storage data, creating a window of un-normalized state in the React tree after every write.

**Archived sprint rows showing closed tasks.** Research-B.md §4 says "leave archived rows alone for v1" and does not address the fact that archived rows receive `todos` (full array) and filter without `!t.done`, causing closed sprint tasks to be visible in two places simultaneously.

**The sprint delete dialog undercount for hidden closed tasks.** The dialog counts all todos for the sprint — but users who have been systematically closing tasks before deleting sprints may find the count surprisingly high.

**Clock skew in purge.** The purge uses `Date.now()` at updater-build time (correct per the comment). But the spec says nothing about backwards clock adjustment. If the system clock is set backwards by 60 days, all closed todos will suddenly be "in the future" and the `anchorOf(t) > cutoff` test will pass for everything — no items purge. This is the lenient outcome (no data loss). The aggressive path (forward clock skip) would immediately purge items that were actually recent. Both are documented nowhere.

---

## Recommended fixer agenda

In priority order:

1. **[H1] Fix `useStore.subscribe` to run the backfill normalization** — wrap the `newValue` delivery in the same `todos.map` normalization pass that `storage.get()` runs, so the React tree never sees `done: true` + `closedAt: undefined`.

2. **[H3] Filter `!t.done` in `ArchivedSprintRow.sprintTodos`** — one-line fix, prevents closed tasks appearing in both Closed tab and archived sprint rows simultaneously.

3. **[H2] Improve sprint delete confirmation dialog** — split "N active + M closed tasks will be permanently deleted" so users understand closed sprint tasks are being nuked alongside the sprint.

4. **[M1] Wire newtab-open purge** — `useEffect(() => { void storage.update(purgeOldClosed()); }, [])` in `App.tsx` or `useStore.ts`. Idempotent, cheap, matches the stated spec.

5. **[M5] Replace `!t.done` in `TodoList.scopedItems` with `getActiveTodos` selector** — enforces the abstraction boundary, makes future "closed" semantics changes safe.

6. **[M2] Fix `runClosedPurge` telemetry** — compute before/after counts inside the updater, or use `deleteIds.length` from `purgeOldClosed`'s return, instead of two racy `readState()` calls.

7. **[M6] Rename "This week" group label to "Last 7 days"** — the current label is calendar-week ambiguous; the implementation is a rolling 7-day window.

8. **[M7] Remove duplicate Reopen affordance** — keep the "Reopen" text button; remove the checkbox-as-reopen from `ClosedRow` (or vice versa). Screen readers see two identical labels per row currently.

9. **[L4] Add Settings toggle for Closed tab visibility** — add `closed?: boolean | undefined` to `UserSettings.sectionVisibility`, `ResolvedUserSettings.sectionVisibility`, and `DEFAULT_SETTINGS`. Wire it in `App.tsx` `TAB_KEY` and remove the hardcoded "always-visible" comment. The user asked for a "document" but may want to tidy the tab bar later.

10. **Export `isClosed` and `closedCountByScope` from `closedTodos.ts`** — unify callers onto the stated contract, remove three copies of inline count logic.

11. **Export `NAV_CLOSED_EVENT` from `App.tsx` (or a shared constants file)** and import it in `TodoList` and `SprintManager` — eliminate the string literal duplication.

12. **Add state-machine comment to `closedTodos.ts` module docblock** — 10 lines of ASCII, closes the biggest documentation gap.

13. **Add dated sunset comment on `storage.get()` backfill** — `// TODO: remove after 2026-08-01 (all active users will have closedAt by then)`.
