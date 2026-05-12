# Observability Audit — Proclivity

> Audit date: 2026-05-12. Read-only pass; no source files modified.
> Companion to the observability system design doc (produced in parallel).

---

## 1. TL;DR

- **LLM is the blindest subsystem.** Every `session.prompt()` call is a black
  box: no latency, no token usage, no session-lifecycle event, no parse-rate
  history. The m3 20-prompt eval is a manual, ephemeral spreadsheet exercise;
  there is no permanent hook that would let it be replayed or compared across
  Nano model updates.
- **The service worker is silent after install.** `reconcileAlarms()` logs two
  lines on install/startup. Everything else — quiet-hours deferrals, missed
  reminder fires, snooze computations, `diffAndSyncAlarms()` diffs — is
  completely invisible. Because the SW is killed and restarted, events lost at
  kill time are unrecoverable without persistence.
- **Storage writes are fire-and-forget.** `storage.update()` swallows write
  failures silently (`next.catch(() => undefined)`). There is no write-queue
  depth counter, no per-write payload size, and no chrome.storage.local quota
  monitor. A quota overflow would manifest as silent data loss.
- **Settings v2 resolved-vs-raw distinction has no assertion.** With ~30 fields
  in `ResolvedUserSettings` and a distinct `UserSettings` (all optional), a
  field added to the type but missed in `resolvedSettings()` produces a runtime
  `undefined` that TypeScript cannot catch without a shape-completeness check.
- **Reference-integrity violations are silent.** Orphan tag ids in todos/
  reminders, todos with `scope: "sprint"` pointing to a deleted sprint,
  `activeSprintId` pointing to nothing, Gantt tasks with nonexistent `parentId`
  — all of these silently corrupt the UI with no error surfaced.
- **Rendering hot paths have no metrics.** The mesh background runs a full
  shader loop every frame with no dropped-frame counter; `flattenTasks()` runs
  O(n) on every render of `ChartView` with no timing probe as the task count
  grows.

---

## 2. Existing Logs / Errors Inventory

All `console.*`, `throw`, and `catch` sites found in `src/`.

| Location | Level | Present? | Has tag? | Useful? | Notes |
|---|---|---|---|---|---|
| `service-worker.ts:285` | `log` | yes | yes `[proclivity]` | yes | "service worker installed" — one-time, OK |
| `service-worker.ts:288` | `error` | yes | yes `[proclivity]` | yes | reconcileAlarms fail on install — good |
| `service-worker.ts:294` | `error` | yes | yes `[proclivity]` | yes | reconcileAlarms fail on startup — good |
| `service-worker.ts:24` | — | `.catch(() => undefined)` | no | **no** | SW write chain swallows all storage errors silently |
| `exportImport.ts:115` | `warn` | yes | yes `[proclivity]` | yes | unknown tag id during import |
| `exportImport.ts:126` | `warn` | yes | yes `[proclivity]` | yes | unknown tag id during import for reminder |
| `exportImport.ts:55` | catch (swallow) | yes | no | **no** | file.text() failure → returns error string, no log |
| `exportImport.ts:62` | catch (swallow) | yes | no | **no** | JSON.parse failure → returns error string, no log |
| `exportImport.ts:145` | catch (swallow) | yes | no | **no** | chrome.runtime.getManifest() → returns "unknown", no log |
| `storage.ts:66-68` | — | `.catch(() => undefined)` | no | **no** | write-chain error swallowed; future updates unblocked but error is lost |
| `nano.ts:49` | `throw` | yes | — | yes | `NanoUnavailableError` — clean, typed |
| `nano.ts:175-177` | `throw` | yes | — | yes | `NanoParseError` with raw payload — clean, typed |
| `llm/tools.ts:253` | catch (swallow) | yes | no | partial | JSON.parse failure → returns `parse-failed` kind; raw string preserved |
| `useChatSession.ts:277-292` | catch | yes | no | partial | AbortError silenced (correct); QuotaExceededError named; generic errors surfaced as `err.message` in UI — but never logged |
| `useChatSession.ts:332` | catch (swallow) | yes | no | **no** | `undo()` `update()` rejection caught; emits a system-notice to the user but **no log** to help diagnose root cause |
| `NanoSection.tsx:136-148` | catch | yes | no | partial | AbortError silenced; NanoUnavailableError displayed in UI — not logged |
| `SettingsModal.tsx:71` | catch (swallow) | yes | no | **no** | `resolveSystemHourCycle` Intl.DateTimeFormat error → returns "h12" with no log |
| `ChartView.tsx:374` | catch (swallow) | yes | no | **no** | `releasePointerCapture` in DraggableCard — legitimately ignorable but silently fails |
| `DraggableCard.tsx:178` | catch (swallow) | yes | no | OK | releasePointerCapture is a best-effort call; silence is intentional |

**Summary of inconsistencies:**

1. **No consistent tag prefix for non-SW code.** The SW uses `[proclivity]` but
   all UI-layer catches produce no log at all. Grep for `[proclivity]` finds
   exactly 5 lines — all in the SW.
2. **Silent error swallowing is the norm, not the exception.** Seven out of
   eighteen error sites produce no log output when they fail, making post-hoc
   debugging impossible without a repro.
3. **Errors that reach the user (UI notices) are never logged.** When `undo()`
   fails or a chat error message is shown, the user sees a string but the
   console stays clean. Debugging requires attaching a debugger.
4. **Successful actions are never logged.** No log exists for: todo added,
   reminder created, sprint activated, tag created, Gantt task dragged, import
   succeeded. This makes it impossible to trace the sequence of events leading
   up to a bug.

---

## 3. Storage Layer Observability Gaps

**File:** `src/storage/storage.ts`, `src/storage/useStore.ts`,
`src/storage/constants.ts`, `src/storage/tags.ts`, `src/storage/exportImport.ts`

### 3.1 Write-queue depth not visible

`storage.ts:30` maintains `writeChain` as a module-level promise. There is no
counter tracking how many `update()` calls are pending. Under rapid-fire UI
interactions (e.g., drag-completing while Nano is writing a tool result), the
chain can grow deep with no visibility into the backlog.

**What to instrument:** increment a counter on `update()` entry; decrement on
resolution. Log `[storage] write queued — depth N` at the point the chain
reaches depth > 1. Expose `writeQueueDepth()` as an introspectable getter.

### 3.2 Per-update payload size and delta

`storage.ts:60-63`: `this.get()` → transform → `this.set()` with no size
tracking. There is no log of how large the serialized state is before or after
each write, no byte-delta between old and new, and no caller-identification
(which component triggered this write?).

**What to instrument:** at `writeRaw()` entry, log `JSON.stringify(state).length`
in bytes and the diff vs the previous write. Callers should pass an optional
`caller` label (e.g., `"TodoList.add"`, `"useChatSession.undo"`) so writes can
be attributed in a log viewer.

### 3.3 chrome.storage.local quota

`chrome.storage.local` has a ~10 MB cap per the CLAUDE.md. There is no call to
`chrome.storage.local.getBytesInUse()` anywhere in the codebase. If the state
approaches the cap (e.g., after importing a backup or accumulating thousands of
card positions), writes will fail silently via the `() => undefined` catch path
at `storage.ts:67-68`.

**What to instrument:** after each successful `writeRaw()`, call
`chrome.storage.local.getBytesInUse(STORAGE_KEY)` and log the percentage of the
10 MB cap used. Emit a `warn` when usage exceeds 70%; emit an `error` when it
exceeds 90%.

### 3.4 Write-chain error swallowing

`storage.ts:66-68`:
```ts
writeChain = result.then(
  () => undefined,
  () => undefined,   // ← error swallowed here
);
```
And `service-worker.ts:24`:
```ts
swWriteChain = next.catch(() => undefined);
```
Both the newtab write chain and the SW write chain silently swallow errors. A
storage quota overflow, a serialization failure, or a chrome API error would
manifest only as data not being saved — with nothing in the logs.

**What to instrument:** replace `() => undefined` error handlers with
`(err) => { /* log err, increment errorCounter */ }`. Never escalate — the
chain-isolation behavior is correct — but always record the error.

### 3.5 Tag / sprint / chart reference integrity

There is no runtime check that verifies:
- Every `Todo.tags[i]` exists in `state.tags`
- Every `Reminder.tags[i]` exists in `state.tags`
- Every `Todo.sprintId` (if set) exists in `state.sprints`
- Every `GanttTask.chartId` exists in `state.ganttCharts`
- Every `GanttTask.parentId` (if set) exists in another `GanttTask`
- `state.activeSprintId` (if set) exists in `state.sprints`

`exportImport.ts:108-130` checks tag ids on import, but this check only runs at
import time. A bug in `deleteTag()`, `deleteTag()` cascade, or any direct state
manipulation that leaves a dangling id will not be caught until a UI interaction
fails silently (e.g., `filterByTags` with an orphaned id produces an empty
filter with no warning).

**What to instrument:** a `checkStateIntegrity(state)` assertion function
(see Section 7) that can be called at startup and after state changes.

### 3.6 First-load state shape

`useStore.ts:15-19`: after `storage.get()` resolves, the shape of what was on
disk is unknown to the developer. There is no log of the loaded state's summary
(count of todos, reminders, sprints, gantt charts, tags, schema version, etc.).

**What to instrument:** log a one-time "state loaded" summary on first resolve:
`[storage] loaded — todos:N sprints:M charts:C reminders:R tags:T settings:{...
truncated keys ...}`.

---

## 4. LLM Observability Gaps

**Files:** `src/llm/nano.ts`, `src/llm/tools.ts`, `src/hooks/useChatSession.ts`,
`src/components/settings/NanoSection.tsx`

### 4.1 Session lifecycle not logged

`useChatSession.ts:115-129`: sessions are created lazily in `ensureSession()`.
`useChatSession.ts:349-364`: sessions are destroyed in `clear()` and unmount.
Neither creation nor destruction produces any log. With the m2 H1 fix (unmount
cleanup), it's now critical to verify that sessions are actually being destroyed
and not leaked — but there is nothing to confirm this at runtime.

**What to instrument:** log `[nano] session created` (with a session sequence
number) on `LM.create()` resolve; log `[nano] session destroyed (reason: clear
| unmount | contextoverflow-recreate)` on `session.destroy()`. Track a
`sessionCount` gauge (created minus destroyed); log a `warn` when it exceeds 1.

### 4.2 `LanguageModel.availability()` outcome history

`NanoSection.tsx:69-80` calls `nanoAvailability()` once on mount. The result is
stored as transient component state; it is never persisted or logged. If the
availability changes during a session (e.g., the download completes while
settings is open, or the model becomes unavailable mid-session), there is no
record of the transition.

**What to instrument:** log `[nano] availability checked → <result>` on every
`availability()` call. Note the time and whether this is the initial check or a
re-check.

### 4.3 Per-prompt latency

`useChatSession.ts:177`: `session.prompt(trimmed, ...)` is awaited with no
timing around it. For the 20-prompt eval, latency is a key quality metric —
slow prompts indicate context-window pressure or model instability — but nothing
is measured today.

**What to instrument:** `const t0 = performance.now()` before `session.prompt()`;
log `[nano] prompt completed in Nms — kind: <parsed.kind>` after `parseToolCall`.

### 4.4 Per-prompt token usage

The Gemini Nano SDK exposes `session.inputUsage`, `session.outputUsage`, and
`session.tokensSoFar` / `session.maxInputTokens` (exact API surface depends on
Chrome version; `contextUsage` / `contextWindow` in some versions). None of
these are read anywhere in the codebase. Token pressure is invisible until the
`contextoverflow` event fires.

**What to instrument:** after each prompt, read and log the available token
metrics. Alert when `tokensUsed / contextWindow > 0.8` so the operator knows a
context trim is imminent.

### 4.5 Tool-call parse outcomes

`useChatSession.ts:182-199`: `parseToolCall` returns one of four kinds:
`chat | add_todo | add_gantt_task | set_reminder | parse-failed`. The `parse-
failed` branch emits a system-notice to the UI but produces no log. Over the
20-prompt eval, there is no mechanism to aggregate "how many prompts produced
each kind?" — this data lives only in the maintainer's memory after manual runs.

**What to instrument:** log `[nano] parsed → kind: <kind>` for every call.
Track a session-level counter map (`parsedKinds: Record<string, number>`) and
log it on session destroy. This makes the eval permanently reproducible.

### 4.6 Schema validation failures (apply-time)

`useChatSession.ts:205-220`: `applyToolCall()` returns `null` for bad `chartId`
or past `fireAt`. When this happens, a system-notice is rendered in the chat
thread but no log is produced. The operator has no persistent record of how
often the model hallucinates invalid chart ids or past timestamps.

**What to instrument:** log `[nano] tool-call validation failed — kind: <kind>
reason: <chartId-not-found | fireAt-past>` and include the raw model output
(truncated to 200 chars).

### 4.7 Tag drop warnings

`tools.ts:424-425` and `tools.ts:487-488`: when model-emitted tag ids don't
exist in `state.tags`, a `systemNotice` is set and rendered in the UI. No log
is produced. Frequency of tag hallucination is unknown.

**What to instrument:** log `[nano] dropped tagIds: [<ids>] (not in state.tags)`
whenever `droppedTagIds.length > 0`.

### 4.8 Undo lifecycle

`useChatSession.ts:305-341`: the `undo()` function either succeeds silently or
emits a system-notice on failure. No log exists for either outcome. For debugging
the m3 M3 fix ("undo removes message before update resolves"), a transaction log
around `update()` would have been invaluable.

**What to instrument:** log `[nano] undo requested — token: <undoToken[:8]>`;
log `[nano] undo succeeded` or `[nano] undo failed — error: <err.message>`.

### 4.9 Download progress

`NanoSection.tsx:107-120`: download progress is tracked in component state as a
`number | null` and displayed in the badge. There is no persistent record that
the download happened, when it completed, or what percentage was reported.

**What to instrument:** log `[nano] download progress: N%` every 10% increment;
log `[nano] download complete` when `availability` transitions from `downloading`
to `available`.

### 4.10 Eval reproducibility hook

The m3 eval (`plans/gemini-nano-eval-snapshot.md`) is a manual spreadsheet.
There is no code that could automatically run the 20 prompts and capture their
parse outcomes. This is a known gap (m3 H1 deferred).

**What to instrument:** a `runEval(prompts: string[]): Promise<EvalResult[]>`
function in a dev-only module that sends each prompt through the live session,
captures kind + latency + raw output, and returns a structured summary. The
summary could be logged or persisted to a separate storage key.

---

## 5. Service Worker Observability Gaps

**File:** `src/background/service-worker.ts`

### 5.1 SW lifecycle events

`service-worker.ts:284-295`: only `onInstalled` and `onStartup` produce any
log. The SW is killed and restarted by Chrome constantly (MV3 lifecycle). There
is no log for "SW woke up to handle an alarm" or "SW was idle and will be killed
soon." Without these, it's impossible to know whether a missed reminder was due
to the SW not starting or due to a bug in `fireMissedReminder`.

**What to instrument:** log `[sw] startup — reason: install | startup | alarm
| storage-change` at the top of each event handler, before any async work.

### 5.2 `reconcileAlarms()` before/after diff

`service-worker.ts:60-103`: `reconcileAlarms()` reads existing alarms, computes
`activeIds`, clears orphans, and creates missing alarms. The result is never
logged. If a reminder fires late (or not at all) after a SW restart, there is no
record of what alarms existed at reconcile time.

**What to instrument:** log `[sw] reconcileAlarms — found N alarms, activeIds:
M, orphans cleared: X, missing created: Y` at the end of `reconcileAlarms()`.

### 5.3 `diffAndSyncAlarms()` per-event details

`service-worker.ts:246-280`: this function runs on every `storage.onChanged`
event. It creates and clears alarms without any log. If a reminder update causes
the alarm to be set to the wrong time (e.g., a timezone bug), there is no record
of the `fireAt` values passed to `chrome.alarms.create()`.

**What to instrument:** log `[sw] diffAndSyncAlarms — created: [{id, fireAt}],
cleared: [id], unchanged: N` after each call.

### 5.4 Missed reminder firings

`service-worker.ts:107-133`: `fireMissedReminder()` fires a notification and
advances/marks the reminder. The comment references "finding #3" but no log is
emitted. The maintainer cannot know how many reminders were missed while the SW
was killed, or whether the missed-fire notification was actually created.

**What to instrument:** log `[sw] missed reminder fired — id: <id> title:
<title[:40]> originalFireAt: <ts> next: <next | null>`.

### 5.5 Quiet-hours deferrals

`service-worker.ts:204-208`: when a reminder fires during quiet hours, the alarm
is rescheduled silently. There is no log of "this reminder was deferred; it will
fire at X instead of Y."

**What to instrument:** log `[sw] quiet-hours deferral — id: <id>
deferredFrom: <alarm.scheduledTime> deferredTo: <deferUntil>`.

### 5.6 Snooze action handler

`service-worker.ts:304-316`: the snooze button handler reads `snoozeMinutes`,
creates a new alarm, and clears the notification — all without logging. If the
snooze duration is wrong (e.g., because `settings.snoozeMinutes` was not
persisted), there is no trace.

**What to instrument:** log `[sw] snooze — notificationId: <id> nextFireAt:
<ts> (snoozeMinutes: N)`.

### 5.7 Storage-change reactions

`service-worker.ts:319-330`: the `storage.onChanged` listener compares
`oldReminders` and `newReminders` without logging which keys changed or how many
reminders were added/removed. Combined with the missing `diffAndSyncAlarms` log,
it is impossible to trace "why did this alarm get cleared?"

**What to instrument:** log `[sw] storage changed — reminders delta: added N,
removed M, updated P` at the top of the `onChanged` handler.

### 5.8 Events lost on SW kill

Because the MV3 SW is killed frequently, any in-memory state (queue depth,
session counts, etc.) is lost. The only way to make these observable across kill
cycles is to persist them to `chrome.storage.local` under a debug key. This is
particularly important for:
- How many times the SW was killed and restarted between two alarm firings
- Whether `reconcileAlarms` ran before the alarm that triggered the notification

---

## 6. UI & Rendering Observability Gaps

### 6.1 Mesh background — frame rate and GPU pressure

`MeshBackground.tsx:153-180`: `useFrame()` runs on every animation frame.
`PlaneGeometry` has 140×80 segments (11,200 vertices) and a 3-octave simplex
noise shader. There is no FPS counter, no dropped-frame detection, and no log
when the tab becomes hidden (visibility change). The `frameloop="demand"` path
is used only when `reducedMotion` or tab hidden — there is no adaptive degradation
based on measured GPU pressure.

**What to instrument:** expose a dev-mode FPS counter (read `state.clock.getDelta()`
in `useFrame`; emit a `warn` if the rolling average drops below 30 FPS). Log
`[mesh] paused (tab hidden)` and `[mesh] resumed` on visibility changes.

### 6.2 Gantt — `flattenTasks` cost

`ganttUtils.ts:36-73`: `flattenTasks()` builds a full `byId` map and `byParent`
map, then walks the tree recursively. This is O(n) in the number of tasks. In
`ChartView.tsx:63`, it runs on every render: `const rows = flattenTasks(tasks)`.
There is no memoization guard and no timing probe. At 500+ tasks across multiple
charts, this could become a paint bottleneck.

**What to instrument:** wrap in `performance.mark` / `performance.measure`; log
`[gantt] flattenTasks — N tasks in Xms` when the call takes more than 5 ms.

### 6.3 `checkBounds` rejection reasons

`ganttUtils.ts:87-116`: `checkBounds()` returns a `BoundsViolation | null`. The
caller in `ChartView.tsx` displays the error message in a transient toast that
auto-clears after 4.5s. There is no log of how often date-containment violations
occur or which tasks are most frequently rejected.

**What to instrument:** log `[gantt] bounds-violation — taskId: <id> reason:
<message[:80]>`.

### 6.4 Settings modal — field-level change tracking

`SettingsModal.tsx:86-150`: `pendingName`, `pendingWeekStart`, etc., are
initialized from `resolvedSettings()` at modal-open. There is no tracking of
which fields the user actually changed vs. left untouched. If a setting drift
bug occurs (stored value diverges from displayed value), there is no record of
the "before" snapshot.

**What to instrument:** on `handleDone()`, compute a diff between `snapshotRef
.current` and the pending values; log `[settings] saved — changed fields: [...]`.

### 6.5 Chat panel — message count and trim events

`useChatSession.ts:134-145`: when `messages.length > MAX_MESSAGES` (100), the
oldest messages are sliced off silently. There is no log of when this trim
occurred. Combined with the `contextoverflow` event (which trims the session-
side history), the user may experience unexplained message loss.

**What to instrument:** log `[chat] history cap — trimmed N messages (was M,
now MAX_MESSAGES)` when the slice occurs. Log `[chat] contextoverflow — trimmed
session-side history; visible count: N`.

---

## 7. State-Invariant Assertions Worth Adding

These are cheap O(n) checks that can run at startup (after `storage.get()`) and
optionally after each `update()` in a debug mode. Each returns a list of
violations; any non-empty result should be logged at `warn` level.

```
checkStateIntegrity(state: ProclivityState): string[]
```

| Assertion | What it catches |
|---|---|
| Every `todo.tags[i]` exists in `state.tags` | Orphan tag reference from a bug in cascade-delete |
| Every `reminder.tags[i]` exists in `state.tags` | Same, for reminders |
| Every `todo.sprintId` (if set) exists in `state.sprints` | Sprint-scoped todo whose sprint was deleted |
| Every `GanttTask.chartId` exists in `state.ganttCharts` | Task whose chart was deleted |
| Every `GanttTask.parentId` (if set) exists in another `GanttTask` with the same `chartId` | Orphan parentId from a delete bug |
| `state.activeSprintId` (if set) exists in `state.sprints` | Active sprint pointer after sprint deletion |
| Reminders with `fireAt < Date.now()` and `fired !== true` and no recurrence | Stuck "upcoming" reminders that the SW never fired |
| `resolvedSettings(state.settings)` has no `undefined` field values | Field added to `ResolvedUserSettings` but missed in `resolvedSettings()` |
| No two `Tag` entries share the same `label` (case-insensitive) | Duplicate tags from a concurrent write or import |
| No two `Sprint` entries have overlapping `[startsAt, endsAt]` ranges | Sprint overlap bug |

For the settings shape check specifically, a simple Object.entries scan over the
resolved output — asserting that no value is `undefined` where the type does not
permit it — would catch the "added a field to `ResolvedUserSettings` but forgot
the `?? DEFAULT_SETTINGS.x` line" class of bugs at runtime rather than in
production.

---

## 8. Build / Bundle Observability

### 8.1 `rollup-plugin-visualizer` absent from vite.config.ts

`vite.config.ts` has no bundle visualization plugin. The `CLAUDE.md` notes a
200 kB initial chunk budget and Three.js must be lazy-loaded. The commit history
shows manual chunk-size notes (e.g., "199.74 kB" in m2 rectify), but this is
fragile — it relies on the agent reading Vite's stdout.

**Flag:** add `rollup-plugin-visualizer` as a devDependency and enable it via an
env var (`VITE_VISUALIZE=1 npm run build`) so the maintainer can inspect bundle
composition on demand without always-on overhead.

### 8.2 No test framework

`package.json` has no `vitest`, `jest`, or `mocha` dependency. The verification
bar is `npm run build`. All four rect summaries (m1, m2, m3, settings-v2) note
"no test framework" as a project gap. Without tests, observability instrumentation
cannot be validated without a live browser session.

### 8.3 `tsc -b` compile time not tracked

`tsconfig.json` uses `strict: true`, `exactOptionalPropertyTypes: true`, and
`noUncheckedIndexedAccess: true`. With `@types/three` in scope and the growing
number of component files, compile time will increase. It is not currently
measured or tracked per-commit.

---

## 9. What Would Have Caught Past Bugs

Each entry cites the fix commit SHA and describes the minimal instrumentation
that would have made the bug obvious before the critique pass.

### m1 H1 — `ProgressEvent.loaded` byte vs fraction (`b99a92b`)

The download progress badge showed `e.loaded * 100` as a percentage — but
`e.loaded` is bytes (e.g., 200,000,000), so the badge showed "20000000%".

**Instrumentation that would have caught it:** a single log line:
`[nano] download progress event — loaded: ${e.loaded} total: ${e.total}
fraction: ${e.loaded / e.total}` would have shown the mismatch immediately.
Comparing `e.loaded` to `e.total` explicitly (both raw byte values) would have
made the unit clear.

### m2 H1 — no `useEffect` cleanup for session on unmount (`65c6651`)

Closing the chat panel without clearing first left a Nano session holding GPU
resources, because the hook had no unmount cleanup.

**Instrumentation that would have caught it:** a session-lifecycle counter
(created vs destroyed) logged on every session create/destroy would have shown
`created: 3, destroyed: 0` after three panel open/close cycles, flagging the
leak immediately.

### m2 H2 — `ChatPanel` stayed mounted whenever `chatEnabled` (`65c6651`)

The panel was gated on `chatEnabled` alone, so it stayed mounted (and the
session alive) even when the user pressed Close. The actual bug was that "close"
didn't unmount the panel.

**Instrumentation that would have caught it:** a log `[chat] panel mounted` /
`[chat] panel unmounted` would have shown the panel never unmounting on close.
A session-count gauge (see 9.2) would have shown the session persisting.

### m3 M3 — `undo()` removed message before `update()` resolved (`035e00e`)

`undo()` removed the tool-result message from React state before awaiting the
storage write; if the write failed, the user lost both the undo affordance and
the rollback.

**Instrumentation that would have caught it:** a transaction log around
`storage.update()` — `[storage] update begin — caller: undo` / `[storage]
update resolved` / `[storage] update rejected` — with timestamps would have
shown that the UI state changed _before_ the storage resolve, making the time-
order bug obvious in the console.

### m3 M2 — Undo expiry timers never cleared (`035e00e`)

`setTimeout` timers for undo-button fade were never cleared on `clear()` or
unmount, causing `setMessages` to run on an unmounted component.

**Instrumentation that would have caught it:** logging the size of
`undoTimersRef.current` on `clear()` — e.g., `[chat] clear — cancelling N
pending undo timers` — would have flagged that timers were accumulating across
clears.

### m2 M1 — Nested `aria-live` regions in ChatPanel (`65c6651`)

Duplicate `aria-live` on the outer message list container and each
`system-notice` child caused garbled screen reader announcements.

**Instrumentation that would have caught it:** a static lint rule or a dev-mode
DOM assertion: "no `aria-live` element nested inside another `aria-live`" — this
is not runtime observability but fits the spirit of cheap assertions.

### m1 M2 — `CreateSessionOpts.initialPrompts` narrowed away the system-message overload (`b99a92b`)

The `initialPrompts` type accepted `LanguageModelMessage[]` but not the SDK's
`[LanguageModelSystemMessage, ...LanguageModelMessage[]]` overload. m3 needed
the system prompt at session creation.

**Instrumentation that would have caught it:** a log `[nano] session created
with initialPrompts: N messages (system: yes/no)` would have caught the
silent omission of the system message when the type cast failed.

### Settings v2 — `resolvedSettings()` diverges from `ResolvedUserSettings`

Not a committed bug, but an ongoing risk: adding a field to `ResolvedUserSettings`
in `src/types/index.ts` without adding the corresponding `?? DEFAULT_SETTINGS.x`
line in `src/storage/constants.ts` produces a runtime `undefined` that TS cannot
catch because the function's return type is structural.

**Instrumentation that would have caught it:** the `checkStateIntegrity` assertion
proposed in Section 7, run at startup, would have logged a warning like
`[storage] resolvedSettings: field 'newField' is undefined` immediately on
first load after the bad commit.

### SW write-chain error swallowing — silent data loss risk

Not yet a confirmed bug but a latent one: `storage.ts:66-68` swallows all write
errors. If a storage quota overflow occurs during a rapid-fire update burst
(e.g., dragging many cards), the data is lost with no trace.

**Instrumentation that would have caught it:** replacing `() => undefined` with
`(err) => console.error('[storage] write chain error:', err)` costs zero bytes
at runtime and would have surfaced the quota error immediately.

### Tag cascade-delete — orphan window between `deleteTag` and `update()` resolve

`tags.ts:80-86`: `deleteTag()` does a single `storage.update()` that atomically
removes the tag and cascades. If the update fails (storage error), the tag is
deleted from the in-memory view but the cascade never runs, leaving dangling ids
in todos/reminders until the next page load.

**Instrumentation that would have caught it:** the write-chain error log proposed
above, combined with the reference-integrity check at load time, would have
surfaced the orphan ids on the next page load.

### `diffAndSyncAlarms` — wrong `fireAt` propagated silently

Not a confirmed bug, but `service-worker.ts:273-276` clears and recreates alarms
whenever `fireAt` changes. If the new `fireAt` is computed incorrectly (e.g.,
timezone offset bug), the alarm is silently rescheduled with no log.

**Instrumentation that would have caught it:** logging the `fireAt` value passed
to `chrome.alarms.create()` would have made the wrong timestamp visible
immediately on any alarm change.

---

## 10. Ranked Top-15 Gaps

Priority: **P0** = blocks debugging right now; **P1** = high-value for ongoing
development; **P2** = worth doing but not urgent.
Cost: **S** = < 1 hour, a few lines; **M** = 1–4 hours; **L** = > 4 hours.
Bundle impact: all logging additions are gated on a dev-flag or write to
console only — negligible production bundle cost.

| # | Gap | What's blind today | What instrumentation tells us | Cost | Bundle | Priority |
|---|---|---|---|---|---|---|
| 1 | SW `reconcileAlarms` before/after diff | Which alarms were created, cleared, or missed at each SW restart | Whether missed reminders are a SW-restart issue or a bug | S | ~0 kB | **P0** |
| 2 | Storage write-chain error log | All write failures are silent | Whether quota overflow or serialization errors are occurring | S | ~0 kB | **P0** |
| 3 | Nano session lifecycle (create / destroy / count) | Whether sessions are being leaked across panel open/close | Session leak detection in < 1 minute of testing | S | ~0 kB | **P0** |
| 4 | Per-prompt latency + kind log | How fast Nano responds; what kind of response was produced | Baseline for 20-prompt eval; detects context-window pressure | S | ~0 kB | **P0** |
| 5 | Parse-fail rate log with raw output | Tool-call parse failures render a UI notice but nothing is logged | Aggregate parse-rate without running the eval manually | S | ~0 kB | **P0** |
| 6 | SW quiet-hours and snooze logs | Deferrals and snooze computations are completely invisible | Whether quiet-hours is working as configured | S | ~0 kB | **P1** |
| 7 | `checkStateIntegrity()` at startup | Orphan tag ids, dangling sprint references, bad `activeSprintId` | Reference corruption caught at load time, not at UI interaction | M | ~0 kB | **P1** |
| 8 | `chrome.storage.local.getBytesInUse()` monitor | Storage quota is unknown; silent overflow is a real risk | % of 10 MB cap used; warn before overflow | S | ~0 kB | **P1** |
| 9 | Token usage after each prompt | Context-window pressure is invisible until `contextoverflow` fires | How full the context window is; when trim is coming | S | ~0 kB | **P1** |
| 10 | First-load state summary log | What's on disk when the page opens is unknowable without devtools | Count of todos/reminders/tags/charts at load time for regression comparison | S | ~0 kB | **P1** |
| 11 | Undo success/failure log | `undo()` result is user-visible but never logged | Whether undo storage writes are succeeding | S | ~0 kB | **P1** |
| 12 | Settings save diff log | Which fields changed in a Done press is unknowable | Detect settings drift between snapshot and pending state | S | ~0 kB | **P1** |
| 13 | `flattenTasks()` timing probe | Gantt render cost at scale is unknown | Detect when tree traversal starts hurting frame rate | S | ~0 kB | **P2** |
| 14 | Eval reproducibility hook (`runEval`) | 20-prompt eval is manual, ephemeral, and un-diffable | Automated parse-rate comparison across Nano model updates | L | ~2 kB | **P2** |
| 15 | `rollup-plugin-visualizer` in build | Bundle composition is inspected manually from build stdout | Instant visual diff of chunk sizes per commit | M | 0 kB (devDep only) | **P2** |

---

*End of audit. Cite this document as `plans/observability-audit.md` in the
observability system design doc.*
