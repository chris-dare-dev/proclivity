# sprint-backlog-redesign-m3 — Research Brief

**Milestone ID:** `sprint-backlog-redesign-m3`  
**Scope:** Inline-editable sprint goal in header and forms  
**Complexity:** S

---

## 1. Affected Files and Their Roles

| Path | Role | Δ LOC Est. |
|------|------|-----------|
| `src/sections/sprint/SprintManager.tsx` | ActiveSprintHeader: add goal line below date range; SprintForm: add optional goal input; editSprint/createSprint: pass goal field | +60 |
| `src/sections/sprint/sprintUtils.ts` | Unchanged (no new utilities needed) | 0 |
| `src/sections/sprint/sprint.css` | New classes for goal display (.sprint-goal-display, .sprint-goal-input, etc.) and archived row goal line (.sprint-archived-goal) | +40 |
| `src/types/index.ts` | Sprint.goal already declared in m1 (line 111); no changes needed | 0 |
| `src/storage/storage.ts` | No changes; m1 normalizer backfills goal as `undefined` for legacy sprints | 0 |

**Total LOC delta estimate:** +60 (SprintManager JSX) + 0 (types) + 40 (CSS) = **+100 LOC** (raw; actual statements ~50 after minification).

---

## 2. Existing Patterns to Follow

### 2.1 Sprint Type with Goal Field (m1)

**File:** `src/types/index.ts:111`

```typescript
export interface Sprint {
  id: string;
  name: string;
  startsAt: number;
  endsAt: number;
  state: "draft" | "active" | "closed";
  /**
   * Schema v2 (sprint-backlog-redesign-m1): optional one-line sprint goal,
   * surfaced in the active-sprint header by m3. Reserved — no reader/writer
   * ships in m1.
   */
  goal?: string | undefined;
  retroNote?: string | undefined;
}
```

**Status:** Field is already typed; m3 is the reader/writer that ships.

---

### 2.2 ActiveSprintHeader Current JSX Shape (m2)

**File:** `src/sections/sprint/SprintManager.tsx:256-323`

```typescript
function ActiveSprintHeader({
  sprint,
  todos,
  onEdit,
  onDelete,
  onStart,
  onClose,
}: ActiveSprintHeaderProps) {
  const { day, total } = sprintDayProgress(sprint);
  const { done, total: taskTotal } = sprintTaskStats(todos, sprint.id);
  const taskPct = taskTotal > 0 ? Math.round((done / taskTotal) * 100) : 0;
  const isDraft = sprint.state === "draft";

  return (
    <div className="sprint-header">
      <div className="sprint-header-top">
        <div>
          <div className="sprint-header-name">{sprint.name}</div>
          <div className="sprint-header-dates">{sprintDateRange(sprint)}</div>
        </div>
        <div className="sprint-header-actions">
          {/* lifecycle button: Start (draft) or Close (active) */}
        </div>
      </div>
      {isDraft ? (
        <div className="sprint-draft-empty">Not started yet...</div>
      ) : (
        <div className="sprint-progress-row">
          {/* progress bar */}
        </div>
      )}
    </div>
  );
}
```

**Where goal line fits:** Between `<div className="sprint-header-dates">` (line 274) and the `{isDraft ? ...}` branch (line 295). After the date range, before the progress-or-draft block. This preserves the existing layout without disrupting the draft/active branching.

**AC#1/AC#2 insertion point:**
```typescript
      <div className="sprint-header-top">
        <div>
          <div className="sprint-header-name">{sprint.name}</div>
          <div className="sprint-header-dates">{sprintDateRange(sprint)}</div>
          {/* NEW: goal line or "+ Add goal" placeholder here */}
        </div>
        {/* actions button group */}
      </div>
```

---

### 2.3 SprintForm Structure (Shared New + Edit)

**File:** `src/sections/sprint/SprintManager.tsx:109-195`

Form layout:
```typescript
function SprintForm({
  heading,
  submitLabel,
  initialName = "",
  initialStart,
  initialEnd,
  onStartChange,
  onSave,
  onCancel,
}: SprintFormProps) {
  const [name, setName] = useState(initialName);
  const [startVal, setStartVal] = useState(...);
  const [endVal, setEndVal] = useState(...);
  const [dateError, setDateError] = useState<string | null>(null);

  return (
    <div className="sprint-form">
      <h4>{heading}</h4>
      <div className="sprint-form-name">
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="sprint-form-row">
        <label>Starts <input type="date" value={startVal} /></label>
        <label>Ends <input type="date" value={endVal} /></label>
      </div>
      {dateError && <div className="sprint-form-error">{dateError}</div>}
      <div className="sprint-form-actions">
        <button>{submitLabel}</button>
        <button>Cancel</button>
      </div>
    </div>
  );
}
```

**AC#4 insertion point:** Between the name field (line 148–155) and the date row (line 157–180). Add:
```typescript
      <div className="sprint-form-goal">
        <label>Goal</label>
        <input
          type="text"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Sprint goal (optional)…"
          maxLength={120}
        />
      </div>
```

Callback: `onSave` signature must change from `(name, startsAt, endsAt)` to `(name, startsAt, endsAt, goal?)`.

---

### 2.4 createSprint and editSprint Call Sites

**File:** `src/sections/sprint/SprintManager.tsx`

#### createSprint (line 619–630)
Current m2 signature (draft default):
```typescript
const createSprint = async (name: string, startsAt: number, endsAt: number) => {
  const id = uid();
  await update((s) => ({
    ...s,
    sprints: [...s.sprints, { id, name, startsAt, endsAt, state: "draft" }],
    activeSprintId: id,
  }));
  setMode("view");
};
```

**M3 change:** Add `goal?: string` parameter and spread it into the sprint object:
```typescript
const createSprint = async (
  name: string,
  startsAt: number,
  endsAt: number,
  goal?: string,
) => {
  const id = uid();
  await update((s) => ({
    ...s,
    sprints: [
      ...s.sprints,
      {
        id,
        name,
        startsAt,
        endsAt,
        state: "draft",
        ...(goal ? { goal } : {}), // only set if non-empty
      },
    ],
    activeSprintId: id,
  }));
  setMode("view");
};
```

#### editSprint (line 632–641)
Current:
```typescript
const editSprint = async (name: string, startsAt: number, endsAt: number) => {
  if (!activeSprintId) return;
  await update((s) => ({
    ...s,
    sprints: s.sprints.map((sp) =>
      sp.id === activeSprintId ? { ...sp, name, startsAt, endsAt } : sp,
    ),
  }));
  setMode("view");
};
```

**M3 change:** Add `goal?: string` parameter:
```typescript
const editSprint = async (
  name: string,
  startsAt: number,
  endsAt: number,
  goal?: string,
) => {
  if (!activeSprintId) return;
  await update((s) => ({
    ...s,
    sprints: s.sprints.map((sp) =>
      sp.id === activeSprintId
        ? { ...sp, name, startsAt, endsAt, ...(goal ? { goal } : {}) }
        : sp,
    ),
  }));
  setMode("view");
};
```

#### Form onSave callbacks (lines 829–830, 839–840)
**NewSprintForm** (line 199–219):
```typescript
function NewSprintForm({
  onSave,
  onCancel,
  defaultSprintDays = 14,
}: {
  onSave: (name: string, startsAt: number, endsAt: number, goal?: string) => void;
  onCancel: () => void;
  defaultSprintDays?: 7 | 14 | 21 | 28;
}) {
```

**EditSprintForm** (line 221–241):
```typescript
function EditSprintForm({
  sprint,
  onSave,
  onCancel,
}: {
  sprint: Sprint;
  onSave: (name: string, startsAt: number, endsAt: number, goal?: string) => void;
  onCancel: () => void;
})
```

**SprintForm onSave prop** (line 105):
```typescript
onSave: (name: string, startsAt: number, endsAt: number, goal?: string) => void;
```

**handleSave in SprintForm** (line 134–142):
```typescript
const handleSave = () => {
  if (isInvalid) {
    setDateError("End date must be on or after start date.");
    return;
  }
  setDateError(null);
  const n = name.trim() || heading;
  onSave(n, startsAt, endsAt, goal?.trim() || undefined); // trim empty to undefined
};
```

---

### 2.5 ArchivedSprintRow — Goal Line Insertion (AC#3)

**File:** `src/sections/sprint/SprintManager.tsx:410–470`

Current structure when row is expanded (`open === true`):
```typescript
{open && (
  <div className="sprint-archived-tasks">
    {/* sprint-backlog-redesign-m2: retro note disclosure */}
    {sprint.retroNote && (
      <details className="sprint-retro-disclosure">
        <summary>Retro note</summary>
        <p className="sprint-retro-note">{sprint.retroNote}</p>
      </details>
    )}
    {sprintTodos.length === 0 ? (
      <div className="section-empty">No tasks...</div>
    ) : (
      <ul className="todo-list">{...}</ul>
    )}
  </div>
)}
```

**M3 insertion point:** Add goal line after the row button (line 428–437) but before/alongside the retro disclosure. Two options:

**Option A (recommended):** Insert as a peer to the retro disclosure, after the `.sprint-archived-row` button closes:
```typescript
      <button className="sprint-archived-row" {...}>...</button>
      {/* NEW: goal line (if present) */}
      {open && sprint.goal && (
        <div className="sprint-archived-goal">{sprint.goal}</div>
      )}
      {open && (
        <div className="sprint-archived-tasks">
          {/* retro disclosure + tasks */}
        </div>
      )}
```

This puts the goal line between the row button and the tasks container, as specified in AC#3.

---

### 2.6 Inline-Editable Pattern — Absence & Recommendation

**Finding:** No click-to-edit pattern exists in the codebase for single-line text fields. TodoItem uses a modal (TodoEditModal) for multi-field editing.

**Recommended shape for header inline-edit (AC#1/AC#2):**

```typescript
// In ActiveSprintHeader:
const [editingGoal, setEditingGoal] = useState(false);
const [goalDraft, setGoalDraft] = useState(sprint.goal ?? "");

const handleGoalBlur = async () => {
  const trimmed = goalDraft.trim();
  // Write to store (requires passing an updateGoal callback from SprintManager)
  await updateGoal(sprint.id, trimmed || undefined);
  setEditingGoal(false);
};

const handleGoalKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === "Enter") {
    e.preventDefault();
    handleGoalBlur();
  } else if (e.key === "Escape") {
    setGoalDraft(sprint.goal ?? "");
    setEditingGoal(false);
  }
};

return (
  <div className="sprint-goal-line">
    {editingGoal ? (
      <input
        type="text"
        value={goalDraft}
        onChange={(e) => setGoalDraft(e.target.value)}
        onBlur={handleGoalBlur}
        onKeyDown={handleGoalKeyDown}
        maxLength={120}
        autoFocus
        className="sprint-goal-input"
      />
    ) : sprint.goal ? (
      <div
        className="sprint-goal-display"
        onClick={() => {
          setGoalDraft(sprint.goal ?? "");
          setEditingGoal(true);
        }}
      >
        {sprint.goal}
      </div>
    ) : (
      <button
        className="sprint-goal-empty"
        onClick={() => {
          setGoalDraft("");
          setEditingGoal(true);
        }}
      >
        + Add goal
      </button>
    )}
  </div>
);
```

**Implementation approach:**
- SprintManager must pass an `updateGoal` callback to ActiveSprintHeader (or the callback is inlined as a local helper within SprintManager's render).
- The callback invokes `update()` with the goal value spread into the active sprint.
- No separate save button; Enter or blur commits the value.
- Empty trimmed value reverts to "+ Add goal" placeholder.

---

### 2.7 EditSprintForm vs Header Inline-Edit Interaction (AC#9)

**Scenario:** User opens EditSprintForm for the active sprint, then (without closing the form) the goal is edited inline in the header on another tab.

**Risk:** Last-writer-wins race.

**Mitigation:**
- EditSprintForm reads `sprint.goal` from props (`sprint: Sprint`) at mount time.
- On Save, it spreads the form's goal into the update, overwriting any concurrent header edits.
- This is acceptable per AC brief: "last-writer-wins is fine."

**No code change needed** beyond the signatures outlined above. The race is benign (both paths write atomically to the same field via `update()`; the second write wins).

---

## 3. CSS Class Name Recommendations

**File:** `src/sections/sprint/sprint.css`

Existing classes for the sprint header and archived row (lines 111–451):
- `.sprint-header` — main container
- `.sprint-header-name` — sprint name
- `.sprint-header-dates` — date range text
- `.sprint-header-top` — flex row containing name + actions
- `.sprint-archived-row` — the button row for archived sprints
- `.sprint-archived-dates` — date range in archived rows
- `.sprint-archived-tasks` — container for task list in expanded rows
- `.sprint-archived-item` — outer wrapper for archived row + tasks

**New classes for m3:**

1. **Header goal line (when displaying)**
   - `.sprint-goal-line` — container for the entire goal section (35px height, roughly)
   - `.sprint-goal-display` — text rendering when editing is off (cursor: pointer on hover)
   - `.sprint-goal-input` — `<input type="text">` when editing (focus state, border)
   - `.sprint-goal-empty` — "+ Add goal" button/placeholder (optional, lower opacity)

2. **Archived row goal line (AC#3)**
   - `.sprint-archived-goal` — italic, muted text, positioned between date range and task list (no additional container needed; can be a peer `<div>` to `.sprint-archived-tasks`)

**Naming rationale:** Consistent prefix `.sprint-*` matches existing classes; `goal` distinguishes from `progress` or other concepts.

---

## 4. Inline-Editable Pattern — Implementation Notes

**Pattern source:** Not present in codebase; innovate as specified in section 2.6.

**Key behaviors (AC#1/AC#2):**
- Click "+ Add goal" → input is shown, autoFocus
- Blur or Enter → trim, persist, revert to display or placeholder
- Escape → revert to previous value without saving
- Click on displayed goal → re-enter edit mode (same input behavior)
- Single-line input only (no multiline)
- CSS `text-overflow: ellipsis` on display (non-edit mode) to handle overflow

**No modal, no separate save button.** Matches the "fast path" spirit of the milestone brief.

---

## 5. Bundle Budget & CSS Impact (AC#5)

**Cumulative baseline per m2 rectify:**
- Post-m1: 199.87 kB raw
- Post-m2 rect: 202.19 kB raw
- **Pre-m3 baseline: 202.19 kB raw**

**AC#5 requirement:** cumulative initial-chunk size delta from pre-m1 baseline ≤ +8 kB.
- Pre-m1 baseline: 199.62 kB
- Pre-m3 allowed: ≤ 207.62 kB
- Current margin: 207.62 − 202.19 = **5.43 kB headroom**

**M3 estimated delta:**
- ActiveSprintHeader goal line JSX (state toggle, inline input, conditional renders): +0.15 kB
- SprintForm goal input field: +0.08 kB
- updateGoal callback wiring: +0.05 kB
- ArchivedSprintRow goal display: +0.04 kB
- CSS for goal classes (.sprint-goal-line, .sprint-goal-display, .sprint-goal-input, .sprint-goal-empty, .sprint-archived-goal): +0.12 kB
- **Total estimated: ~+0.44 kB raw**

**Cumulative post-m3 estimate:** 202.19 + 0.44 = **202.63 kB** (within 207.62 kB limit with 5 kB margin).

---

## 6. Footguns from CLAUDE.md + m1/m2 Summaries

### 6.1 Work on Main Only
Yes. Applies to m3 as all prior milestones.

### 6.2 Strict TypeScript
- `exactOptionalPropertyTypes: true` — `goal?: string | undefined` is correct. Do NOT use `goal: string | undefined` without the optional `?`.
- `noUncheckedIndexedAccess: true` — not relevant for this change.

### 6.3 No New Dependencies
Confirmed. Only React built-ins (`useState`, `useCallback`, conditional rendering).

### 6.4 Conventional Commits
- Scope: `sprint` (matches prior commits)
- Subject line: e.g., "feat(sprint): inline-editable goal in header and forms"
- Co-author trailer required (CLAUDE.md L54–55)

### 6.5 Pre-commit Hooks & Build
- `npm run build` must pass (tsc -b + vite build)
- No `--no-verify` or `--amend` on main.
- Push to origin/main is pre-authorized per CLAUDE.md.

### 6.6 Bundle Budget Strictness
M2's rectify noted the initial chunk is 202.19 kB, exceeding CLAUDE.md's "~200 kB" soft target by 1.3%. M3 must not exceed the hard AC#5 limit (+8 kB from pre-m1 baseline). Current margin is 5.43 kB; m3's +0.44 kB estimate is conservative and safe.

### 6.7 Sprint.goal Already Declared (m1)
No type changes needed. AC#4 is implementation only (forms and header surfaces).

---

## 7. Chrome Storage & Multi-Tab Race (AC#10)

**`chrome.storage.local` syncs across newtab pages.** If two tabs edit the same sprint goal simultaneously:
1. Tab A: inline-edit header goal, blur → updateGoal() → update() → storage write
2. Tab B: EditSprintForm save → editSprint() → update() → storage write
3. Last write wins.

**No race condition in the code:** Both paths use `update()`, which is atomic per `useStore()`'s implementation (`ProclivityState` in storage.ts wraps `chrome.storage.local.set()`). The second write overwrites the first at the storage layer; the UI reflects the final value on next sync.

**Acceptable per brief:** "Last-writer-wins is fine" (§9, multi-tab considerations).

---

## 8. Multi-Sprint Context & EditSprintForm Closure

**Scenario:** User edits Sprint A's goal via the header inline-edit, then switches to Sprint B (clicking its tab). EditSprintForm still shows Sprint A's old data.

**Mitigation:** EditSprintForm's `onCancel` callback in SprintManager (line 840) calls `setMode("view")`, which closes the form. Switching sprints via the tab click handler (line 810–812) also calls `setMode("view")`. No stale form is shown for Sprint B.

**No blocker identified.**

---

## 9. Open Questions for the Implementer

1. **Goal line click-to-edit UX:** Should the goal text have a subtle visual hint (e.g., cursor: pointer, light background on hover) to signal editability? Recommend: Yes, add `.sprint-goal-display:hover` with `opacity: 0.8` or `background-color: color-mix(in srgb, var(--accent) 5%, transparent)` to match the archived row's hover state.

2. **Goal empty-state button styling:** Should "+ Add goal" be styled as a button (with border, padding, hover state) or as a text link (color: var(--accent), cursor: pointer, text-decoration: underline on hover)? Recommend: Button style, matching the "+ New sprint" tab; keeps visual consistency.

3. **Form goal field label and tooltip:** Should the goal field in NewSprintForm/EditSprintForm have a help text or tooltip (e.g., "Summarize what you'll accomplish this sprint")? Recommend: Simple placeholder "Sprint goal (optional)…" is sufficient; defer tooltip/help to m4 if needed.

4. **Archived row goal overflow behavior:** AC#3 specifies italic muted text for archived-row goals. If the goal is very long, should it ellipsis (single line) or wrap? Recommend: Single-line ellipsis (text-overflow: ellipsis) to match the date range styling and keep archived rows compact.

5. **Goal input maxLength validation:** AC#1 specifies `maxLength="120"`. Should there be on-screen char count feedback (e.g., "45/120")? Recommend: No; the form is simple and lightweight. Let the browser's maxLength enforce the limit silently.

---

## 10. Regression Test Anchors (Manual Walkthrough)

Per CLAUDE.md and m2's established pattern, manual walkthrough steps for the commit message:

1. **AC#1 — Click "+ Add goal" on a draft or active sprint header (goal field empty):** Verify the placeholder swaps to an `<input>` with autoFocus, Escape reverts, Enter commits, Blur commits. Verify empty trimmed value hides the input and shows "+ Add goal" again.

2. **AC#2 — Click on a displayed goal to re-edit:** Verify edit mode re-enters, value is restored, Escape and Enter behave correctly.

3. **AC#4 — Create a new sprint with a goal via NewSprintForm:** Goal field between name and date row, optional. Verify goal is persisted in the sprint object.

4. **AC#4 — Edit an active sprint's goal via EditSprintForm:** Verify goal field edits are saved alongside name/date updates.

5. **AC#3 — Expand an archived sprint row with a goal:** Verify goal renders as italic muted text between date range (the row button) and task list. No goal → line is hidden.

6. **Multi-tab race (AC#9):** Open EditSprintForm on Tab A, edit goal inline on Tab B, save form on Tab A. Verify Tab B's inline-edit value is overwritten by the form save (last-writer-wins). Refresh both tabs; verify the form-written value persists.

7. **Sprint switcher (AC#6):** Switch between sprints with and without goals. Verify header goal line updates correctly. No regression in the progress bar, archived rail, or m2 close-sprint flow.

---

## 11. Summary

M3 ships the goal reader/writer for the `Sprint.goal` field declared in m1:

1. **ActiveSprintHeader:** Inline-editable goal line below date range; "+ Add goal" placeholder when empty.
2. **NewSprintForm / EditSprintForm:** Optional goal input between name and date row.
3. **ArchivedSprintRow:** Goal line rendered as italic muted text when sprint is expanded and goal is non-empty.
4. **Type changes:** None; Sprint.goal is already typed in m1.
5. **Bundle delta:** +0.44 kB estimated (well within AC#5's +8 kB cumulative budget from pre-m1 baseline).
6. **No race conditions:** Multi-tab concurrent edits are last-writer-wins per brief; inline-edit + form-edit are atomic via `update()`.
7. **Footguns:** Respect TS strict flags, conventional commits, pre-commit hooks, and bundle budget.

All AC criteria are scoped and achievable without new dependencies or architectural changes.
