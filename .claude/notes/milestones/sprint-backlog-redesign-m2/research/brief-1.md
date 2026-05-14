# sprint-backlog-redesign-m2 — Research Brief

**Milestone ID:** `sprint-backlog-redesign-m2`  
**Scope:** Explicit sprint lifecycle UI (draft → active → closed) + stale-sprint banner  
**Complexity:** M

---

## 1. Affected Files and Their Roles

| Path | Role | Δ LOC Est. |
|------|------|-----------|
| `src/sections/sprint/SprintManager.tsx` | Render "Start sprint" (draft) and "Close sprint" (active) buttons; close-flow with retro textarea; partition sprints into live/archived | +80 |
| `src/sections/sprint/sprintUtils.ts` | Rewrite `isArchived()` to check `state === "closed"` instead of date heuristic | −5 |
| `src/components/Modal.tsx` | ConfirmDialog sufficient as-is; close-sprint flow mirrors deleteSprint pattern | 0 |
| `src/types/index.ts` | No changes needed (Sprint.state and Sprint.retroNote already added in m1) | 0 |
| `src/storage/storage.ts` | No changes; m1 normalizer already backfills state | 0 |
| `src/sections/Sprint/index.ts` | Entry point; may need to wrap SprintManager with stale-sprint banner context | +10 |
| `src/sections/calendar/calendarUtils.ts` | No changes (sprint rendering is date-based, not state-based) | 0 |
| `src/sections/calendar/MonthGrid.tsx` | No changes; passes all sprints to SprintBars regardless of state | 0 |
| `src/sections/calendar/SprintBars.tsx` | No changes; renders via sprints array, no isArchived filtering | 0 |
| `test/fixtures/v1-state-*.json` | Existing fixtures render correctly post-m2; consider new draft-sprint fixture | +1 fixture |

---

## 2. Existing Patterns to Follow

### 2.1 Sprint State Backfill (m1 — already live)

**File:** `src/storage/storage.ts:79-105`

M1 added the normalizer that backfills `Sprint.state` from the legacy date heuristic:
```typescript
sprints: base.sprints.map((s) => {
  const v2 = s as Sprint & { state?: unknown };
  if (v2.state === "draft" || v2.state === "active" || v2.state === "closed") {
    return v2 as Sprint;
  }
  const next: Sprint = { ...v2, state: v2.endsAt < midnight ? "closed" : "active" };
  return next;
}),
```

**M2 commitment:** The normalizer never produces `"draft"` — that state is **only** created by the new-sprint form. Existing data starts as `"active"` (if before today) or `"closed"` (if endsAt < today). This is intentional: legacy data skips the draft stage.

---

### 2.2 Current `isArchived()` Implementation

**File:** `src/sections/sprint/sprintUtils.ts:38-40`

```typescript
export function isArchived(sprint: Sprint): boolean {
  return sprint.endsAt < todayMidnight();
}
```

**Callsites verified in m1 brief-1:**
- `SprintManager.tsx:428` — archivedSprints memo
- `SprintManager.tsx:432` — liveSprints memo
- `SprintManager.tsx:544` — deleteSprint's nextSprint selection

**M2 rewrite:**
```typescript
export function isArchived(sprint: Sprint): boolean {
  return sprint.state === "closed";
}
```

**Impact:** The date check is removed entirely. All three callsites compile without changes and correctly partition by state. Calendar rendering is unaffected (MonthGrid/SprintBars pass all sprints regardless of state, so the visual range is unchanged).

---

### 2.3 ActiveSprintHeader — Current Structure

**File:** `src/sections/sprint/SprintManager.tsx:245-301`

Props and affordances:
```typescript
interface ActiveSprintHeaderProps {
  sprint: Sprint;
  todos: Todo[];
  onEdit: () => void;
  onDelete: () => void;
}
```

Renders:
- Sprint name and date range
- Day-of-N progress and task completion % in progress bar
- Edit and Delete buttons

**M2 wiring:** When `sprint.state === "draft"`, hide the task input and progress bar; show a primary "Start sprint" button instead of Delete. The Edit button stays visible (user may want to adjust dates). When `state === "active"`, show the task input and "Close sprint" button instead of Delete.

---

### 2.4 ConfirmDialog Pattern for Close-Sprint Flow

**File:** `src/components/Modal.tsx:156-192`

Props interface:
```typescript
interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
}
```

**Existing use (deleteSprint):**
```typescript
<ConfirmDialog
  open={confirmingDelete}
  onClose={() => setConfirmingDelete(false)}
  title="Delete sprint"
  confirmLabel="Delete"
  message={(() => { ... })()}
  onConfirm={deleteSprint}
/>
```

**M2 decision:** ConfirmDialog's `message` prop accepts `ReactNode`, so a retro-note textarea can be injected inline as JSX. However, the m2 implementer must:
1. Manage textarea draft state (e.g., `[retroDraft, setRetroDraft]`) separate from the dialog open state.
2. Pass it to the onConfirm callback so closeSprint receives the retro note.
3. Preserve the dialog open/close semantics (onConfirm closes it automatically via the current handler pattern).

**Minimal-cost shape:** Extend the close-sprint callback to capture the textarea value, OR keep the textarea state local to SprintManager and read it on confirm. Both strategies keep ConfirmDialog unchanged.

---

### 2.5 ArchivedSprintRow — Retro Note Display

**File:** `src/sections/sprint/SprintManager.tsx:320-372`

Current output when `open` is true:
```typescript
{open && (
  <div className="sprint-archived-tasks">
    {sprintTodos.length === 0 ? (
      <div className="section-empty">No tasks...</div>
    ) : (
      <ul className="todo-list">...</ul>
    )}
  </div>
)}
```

**M2 location for retro note:** Insert a retro-note display (if `sprint.retroNote` is truthy) as the first child of `.sprint-archived-tasks`, before the empty-state or task list. E.g.:
```typescript
{sprint.retroNote && (
  <details>
    <summary>Retro note</summary>
    <p className="sprint-retro-note">{sprint.retroNote}</p>
  </details>
)}
```

This pairs with the close-sprint flow's textarea input.

---

### 2.6 createSprint — Current State Default (m1)

**File:** `src/sections/sprint/SprintManager.tsx:515-526`

Current m1 state:
```typescript
const createSprint = async (name: string, startsAt: number, endsAt: number) => {
  const id = uid();
  await update((s) => ({
    ...s,
    sprints: [...s.sprints, { id, name, startsAt, endsAt, state: "active" }],
    activeSprintId: id,
  }));
  setMode("view");
};
```

**M2 change:** Set `state: "draft"` instead of `"active"`. The user must click "Start sprint" to flip it.

---

### 2.7 NewSprintForm Behavior (m1)

**File:** `src/sections/sprint/SprintManager.tsx:199-219`

Form onSave calls `createSprint` directly. **M2 note:** The form UI remains unchanged; the state flip happens in the header affordance. Form submission should:
1. Show the sprint in the tabs list with state `"draft"`.
2. Render the ActiveSprintHeader with the "Start sprint" button (no task input).

---

## 3. Stale-Sprint Banner — Pattern Research

### 3.1 Session Storage Usage

**Finding:** No prior sessionStorage usage in the codebase. The pattern must be invented.

**Recommended approach:** Use React `useState` scoped to SprintManager. When a banner is dismissed, set a flag like `[staleBannerDismissed, setStaleBannerDismissed] = useState(false)`. This is session-scoped by design (new tab = new component mount = new state).

**Rationale:**
- No external dependency on sessionStorage (cleaner TS types).
- Dismissal is per-tab (user closes the stale banner on one tab; other tabs still show it).
- No persistence layer is needed — on tab refresh, the banner reappears (acceptable UX).

### 3.2 No Existing Banner Component

**Finding:** `src/components/` has no Banner or Toast component. QuickPrompt (dismissible chat area) and ClosedScopeCounter (a button) exist, but no generic banner abstraction.

**Recommended approach:** Inline a minimal banner in SprintManager.tsx (30–50 lines) rather than extract a new component. It's a one-off feature specific to stale-sprint detection, and premature extraction increases surface area.

**Shape:**
```typescript
{staleSprint && !staleBannerDismissed && (
  <div className="sprint-stale-banner">
    <div className="sprint-stale-message">
      This sprint ended {daysSinceEnd} days ago. Close it?
    </div>
    <div className="sprint-stale-actions">
      <button onClick={closeSprint}>Close Sprint</button>
      <button onClick={() => setStaleBannerDismissed(true)}>Dismiss</button>
    </div>
  </div>
)}
```

Mount it above the ActiveSprintHeader (inside the `{activeSprint && mode === "view"}` guard).

### 3.3 Stale-Sprint Detection Logic

**AC #4 threshold:** `endsAt < todayMidnight() - 86_400_000` (one full day ago).

**Implementation location:** A helper in SprintManager (not in sprintUtils, to keep it UI-specific):
```typescript
function isStaleSprint(sprint: Sprint): boolean {
  const oneDayMs = 86_400_000;
  return sprint.endsAt < todayMidnight() - oneDayMs;
}
```

Call this in the render condition: `{activeSprint && isStaleSprint(activeSprint) && !staleBannerDismissed && (...)}`.

---

## 4. Test Fixtures — Legacy Data Compatibility

### 4.1 Existing Fixtures

**File:** `test/fixtures/v1-state-{empty,mixed,with-closed-todos,corrupted}.json`

Current state: v1-state-mixed.json has two sprints (sprint-expired with `endsAt: 1700000000000` and sprint-future). After m1's normalizer:
- sprint-expired gets `state: "closed"` (endsAt < today)
- sprint-future gets `state: "active"` (endsAt is far future)

**AC #6 requirement:** After m2's `isArchived() === "closed"`, the partition must match. Verify:
- archivedSprints filters by `s.state === "closed"` → includes sprint-expired ✓
- liveSprints filters by `!isArchived(s)` → excludes sprint-expired ✓

### 4.2 New Fixture Consideration

**Recommendation:** Add a `v1-state-with-draft-sprint.json` fixture to cover the new draft state. Example:
```json
{
  "todos": [...],
  "sprints": [
    {
      "id": "sprint-draft",
      "name": "Not started yet",
      "startsAt": <future>,
      "endsAt": <future>,
      "state": "draft"
    },
    {
      "id": "sprint-active",
      "name": "In progress",
      "startsAt": <today>,
      "endsAt": <future>,
      "state": "active"
    }
  ],
  ...
}
```

This fixture verifies:
- Draft sprints appear in liveSprints (not archived).
- Draft sprints render the "Start sprint" button.
- No unintended side effects on partitioning.

---

## 5. TS Strictness & Bundle Budget

### 5.1 Strict Type Flags (from CLAUDE.md)

**File:** `tsconfig.json`

Active flags:
- `exact OptionalPropertyTypes: true` — `foo?: T` forbids `foo: undefined` literals; use `?: T | undefined` instead.
- `noUncheckedIndexedAccess: true` — computed property access requires bounds checks.

**M2 implications:**
- `Sprint.retroNote?: string | undefined` is already correct in m1's types.
- Textarea controlled value (`[retroDraft, setRetroDraft]`) is a plain `string`, no guard needed.
- Session-scoped flag `[staleBannerDismissed, setStaleBannerDismissed]` is a boolean, no guard needed.

No new TS errors expected.

### 5.2 Bundle Size Tracking

**File:** `.github/scripts/check-bundle-size.mjs` (referenced in CLAUDE.md)

M1 added Sprint.state fields: +0.25 kB raw (per m1 brief-1).  
**AC #7 cumulative budget:** ≤ +6 kB from pre-m1 baseline (199.62 kB raw → ≤ 205.62 kB).

**M2 estimated delta:**
- New buttons and state branching in ActiveSprintHeader: +0.3 kB
- Stale-sprint banner logic and JSX: +0.2 kB
- isArchived rewrite (no net change, same number of instructions): 0 kB
- Total: +0.5 kB

**Cumulative:** 0.25 + 0.5 = **0.75 kB**, well within budget.

---

## 6. Photos Integration — No Collision Risk

**Finding:** Photos feature is lazy-loaded in App.tsx (lines 96–101). M1 and M2 work is in SprintManager, which doesn't import or reference Photos. No collision risk.

---

## 7. UserSettings Interface — No New Field Needed

**File:** `src/types/index.ts:212-367`

**Finding:** AC #4 specifies "session-scoped flag" for stale-banner dismissal. This means in-memory only (useState), NOT persisted.

**Decision:** Do NOT add a field to `UserSettings`. The dismissal state is:
- Per-tab (sessionStorage would be cross-tab, unsuitable).
- Per-session (forgotten on refresh, acceptable).
- Simple boolean flag managed by SprintManager's useState.

---

## 8. Open Questions for the Implementer

1. **Close-sprint textarea placement:** Should the retro textarea live in a custom modal extending ConfirmDialog, or can we inline it as JSX in the message prop? Prefer the latter for simplicity, but confirm TS/accessibility are clean.

2. **"Start sprint" affordance location:** Should "Start sprint" replace the Delete button (one primary + Edit) or live alongside it? Brief says "start-sprint header renders the existing task input" — unclear if Delete also appears. Recommend: Show Start + Edit, hide Delete for draft sprints (defensive: user can always delete via Edit mode).

3. **Stale-sprint banner auto-close:** When the user clicks "Close Sprint" from the banner, should the banner auto-dismiss? (AC doesn't specify.) Recommend: Yes, close the sprint, flip state to closed, banner disappears (isStaleSprint + state check both become false).

4. **Retro-note emoji/formatting:** AC shows "one-line retro-note textarea". Should we validate line count or character length? Recommend: No validation, keep it simple; trust the user. Optional truncation on display (visual only).

5. **Calendar sprint rendering:** Confirm that calendar still shows all sprints (draft, active, closed) in the month grid regardless of state. M2's change to `isArchived()` is UI-only (SprintManager partitioning); calendar uses date ranges, not state. Verify no breakage in calendar tests or manual calendar use.

---

## 9. Footguns from CLAUDE.md

### 9.1 Work on Main Only
**Applies:** Yes. This is a single-milestone, direct-to-main task. No feature branch.

### 9.2 GPG Signing
**Applies:** Yes. All commits must include the co-author trailer (already in CLAUDE.md L54–55).

### 9.3 Pre-commit Hooks
**Applies:** Yes. `npm run build` and `tsc -b` must pass before pushing. Never use `--no-verify`.

### 9.4 No New Dependencies
**Applies:** Yes. The stale-sprint banner uses only React built-ins (useState, useMemo) and existing helper functions.

---

## Summary

M2 rewires the sprint lifecycle into the UI by:
1. Changing `isArchived()` from date-based to state-based (+5 lines deleted, net −5 LOC in sprintUtils.ts).
2. Adding "Start sprint" and "Close sprint" affordances to ActiveSprintHeader (+80 LOC in SprintManager).
3. Adding a stale-sprint banner that dismisses per-session (+30 LOC in SprintManager).
4. No new types or settings fields needed; m1's sprint.state and sprint.retroNote are already typed.
5. Calendar rendering is unaffected; test fixtures pass through post-m2.
6. Cumulative bundle delta: +0.75 kB (well under +6 kB budget).

All three m1 fixtures render correctly post-m2. A new draft-sprint fixture is recommended but not required for AC.

