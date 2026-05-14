import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useStore } from "@/storage/useStore";
import { uid } from "@/storage/storage";
import type { Sprint, Tag, Todo } from "@/types";
import { ConfirmDialog } from "@/components/Modal";
import { TodoItem } from "@/components/TodoItem";
import type { TodoEditFields } from "@/components/TodoEditModal";
import { TagFilterToolbar } from "@/components/TagFilterToolbar";

import { filterByTags } from "@/storage/tags";
import { resolvedSettings } from "@/storage/constants";
import { ClosedScopeCounter } from "@/components/ClosedScopeCounter";
import {
  todayMidnight,
  defaultEndsAt,
  isArchived,
  sprintDateRange,
  sprintDayProgress,
  sprintTaskStats,
} from "./sprintUtils";
// removeCardLayouts is no longer needed for the row-level delete path —
// permanentlyDeleteTodos (from closedTodos.ts) wraps the same helper and
// owns the cleanup contract. Kept in the import list only if other paths
// still need it; verified unused → removed.
import {
  closeTodo,
  reopenTodo,
  permanentlyDeleteTodos,
} from "@/storage/closedTodos";
import "../sections.css";
import "./sprint.css";

// A4 fix: SprintCardSection deleted — TodoCardSection used directly for card mode.
// List mode inlined below (was duplicated in SprintCardSection). This removes
// a 115-line dispatcher with no sprint-specific logic.
const TodoCardSection = lazy(() =>
  import("../TodoCardSection").then((m) => ({ default: m.TodoCardSection })),
);

// TodoEditModal only needed when user edits a task. Lazy-loads TagPickerArea
// (and its tag-color picker) out of the initial chunk.
const TodoEditModal = lazy(() =>
  import("@/components/TodoEditModal").then((m) => ({ default: m.TodoEditModal })),
);

/* ─── helpers ──────────────────────────────────────────────────── */

function tsToDateInput(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dateInputToTs(val: string): number {
  // parse YYYY-MM-DD as local midnight
  const parts = val.split("-").map(Number);
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  return new Date(y, m - 1, day).getTime();
}

// TodoItem moved to src/components/TodoItem.tsx (Pattern A)

/* ─── Inline add-task form ─────────────────────────────────────── */

interface AddTaskProps {
  onAdd: (title: string) => void;
  placeholder?: string;
}

function AddTaskForm({ onAdd, placeholder = "New task…" }: AddTaskProps) {
  const [draft, setDraft] = useState("");
  const submit = () => {
    const t = draft.trim();
    if (!t) return;
    setDraft("");
    onAdd(t);
  };
  return (
    <div className="todo-input">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder={placeholder}
      />
      <button onClick={submit}>Add</button>
    </div>
  );
}

/* ─── Shared Sprint form (Pattern B: merges New + Edit) ────────── */

interface SprintFormProps {
  /** Heading label */
  heading: string;
  /** Label for the submit button */
  submitLabel: string;
  initialName?: string;
  initialStart?: number;
  initialEnd?: number;
  /** sprint-backlog-redesign-m3: optional initial goal for EditSprintForm. */
  initialGoal?: string | undefined;
  /** Called when start changes — allows caller to bump end for new sprints */
  onStartChange?: (newStart: number, setEnd: (v: string) => void) => void;
  /**
   * sprint-backlog-redesign-m3: `goal` is optional. Trimmed-empty resolves
   * to `undefined` so callers can use it directly without a re-trim.
   */
  onSave: (name: string, startsAt: number, endsAt: number, goal: string | undefined) => void;
  onCancel: () => void;
}

function SprintForm({
  heading,
  submitLabel,
  initialName = "",
  initialStart,
  initialEnd,
  initialGoal = "",
  onStartChange,
  onSave,
  onCancel,
}: SprintFormProps) {
  const today = todayMidnight();
  const [name, setName] = useState(initialName);
  const [startVal, setStartVal] = useState(
    tsToDateInput(initialStart ?? today),
  );
  const [endVal, setEndVal] = useState(
    tsToDateInput(initialEnd ?? defaultEndsAt(today)),
  );
  // sprint-backlog-redesign-m3: optional goal captured here so a user can
  // set the intent at create-time without needing the inline header editor.
  const [goal, setGoal] = useState(initialGoal ?? "");
  // Inline validation error (#21)
  const [dateError, setDateError] = useState<string | null>(null);

  const startsAt = dateInputToTs(startVal);
  const endsAt = dateInputToTs(endVal);
  const isInvalid = endsAt < startsAt;

  const handleSave = () => {
    if (isInvalid) {
      setDateError("End date must be on or after start date.");
      return;
    }
    setDateError(null);
    const n = name.trim() || heading;
    const trimmedGoal = goal.trim();
    // m3: empty trimmed goal clears the field (distinct from m2's retroNote
    // semantics where empty preserves the existing value).
    onSave(n, startsAt, endsAt, trimmedGoal || undefined);
  };

  return (
    <div className="sprint-form">
      <h4>{heading}</h4>
      <div className="sprint-form-name">
        <label>Name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Sprint name…"
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
        />
      </div>
      {/* sprint-backlog-redesign-m3: optional goal between name and dates. */}
      <div className="sprint-form-goal">
        <label>Goal</label>
        <input
          type="text"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Sprint goal (optional)…"
          maxLength={120}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
        />
      </div>
      <div className="sprint-form-row">
        <label>
          Starts
          <input
            type="date"
            value={startVal}
            onChange={(e) => {
              setStartVal(e.target.value);
              setDateError(null);
              onStartChange?.(dateInputToTs(e.target.value), setEndVal);
            }}
          />
        </label>
        <label>
          Ends
          <input
            type="date"
            value={endVal}
            onChange={(e) => {
              setEndVal(e.target.value);
              setDateError(null);
            }}
          />
        </label>
      </div>
      {dateError && (
        <div className="sprint-form-error" role="alert">
          {dateError}
        </div>
      )}
      <div className="sprint-form-actions">
        <button onClick={handleSave} disabled={isInvalid}>
          {submitLabel}
        </button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

/** Thin wrappers so call-sites don't need to supply all SprintForm props */

function NewSprintForm({
  onSave,
  onCancel,
  defaultSprintDays = 14,
}: {
  onSave: (name: string, startsAt: number, endsAt: number, goal: string | undefined) => void;
  onCancel: () => void;
  defaultSprintDays?: 7 | 14 | 21 | 28;
}) {
  return (
    <SprintForm
      heading="New Sprint"
      submitLabel="Create"
      onStartChange={(newStart, setEnd) =>
        setEnd(tsToDateInput(defaultEndsAt(newStart, defaultSprintDays)))
      }
      onSave={onSave}
      onCancel={onCancel}
    />
  );
}

function EditSprintForm({
  sprint,
  onSave,
  onCancel,
}: {
  sprint: Sprint;
  onSave: (name: string, startsAt: number, endsAt: number, goal: string | undefined) => void;
  onCancel: () => void;
}) {
  return (
    <SprintForm
      heading="Edit Sprint"
      submitLabel="Save"
      initialName={sprint.name}
      initialStart={sprint.startsAt}
      initialEnd={sprint.endsAt}
      initialGoal={sprint.goal}
      onSave={onSave}
      onCancel={onCancel}
    />
  );
}

/* ─── Inline goal editor (sprint-backlog-redesign-m3) ──────────── */

interface GoalEditorProps {
  /** Current persisted goal. Undefined renders the "+ Add goal" placeholder. */
  goal: string | undefined;
  /**
   * Called when the user commits a value (Enter or blur). The trimmed
   * argument is `undefined` when the user clears the field — m3 semantics
   * intentionally allow clearing, unlike m2's `closeSprint` retro that
   * preserves on empty.
   */
  onSave: (goal: string | undefined) => void;
}

/**
 * Click-to-edit single-line goal control.
 *
 * Three rendered states, mutually exclusive:
 *  - empty placeholder ("+ Add goal") when `goal === undefined`
 *  - display chip (single line, ellipsis on overflow) when goal is set
 *  - input (autoFocus, maxLength 120) when `editing === true`
 *
 * Commit triggers: blur OR Enter. Escape reverts without saving. The
 * `useEffect` re-syncs the draft when the persisted goal changes from
 * elsewhere (e.g. EditSprintForm save in another flow) so the inline
 * blur-commit doesn't silently overwrite a concurrent external write.
 */
function GoalEditor({ goal, onSave }: GoalEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(goal ?? "");

  // Re-sync when the persisted goal changes externally (modal save,
  // multi-tab write via chrome.storage subscribe).
  useEffect(() => {
    setDraft(goal ?? "");
  }, [goal]);

  const commit = () => {
    const trimmed = draft.trim();
    const next = trimmed === "" ? undefined : trimmed;
    setEditing(false);
    // Only call onSave when the value actually changed to avoid spurious
    // storage writes on every blur (mostly a tidiness concern; chrome.storage
    // collapses identical writes but the subscribe listeners still fire).
    if (next !== goal) onSave(next);
  };

  if (editing) {
    return (
      <input
        autoFocus
        className="sprint-goal-input"
        type="text"
        maxLength={120}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
          } else if (e.key === "Escape") {
            setDraft(goal ?? "");
            setEditing(false);
          }
        }}
        placeholder="Sprint goal (optional)…"
      />
    );
  }

  if (goal) {
    return (
      <button
        type="button"
        className="sprint-goal-display"
        onClick={() => setEditing(true)}
        aria-label={`Edit sprint goal: ${goal}`}
        title={goal}
      >
        {goal}
      </button>
    );
  }

  return (
    <button
      type="button"
      className="sprint-goal-empty"
      onClick={() => setEditing(true)}
      aria-label="Add sprint goal"
    >
      + Add goal
    </button>
  );
}

/* ─── Active Sprint Header ─────────────────────────────────────── */

interface ActiveSprintHeaderProps {
  sprint: Sprint;
  todos: Todo[];
  onEdit: () => void;
  onDelete: () => void;
  /** sprint-backlog-redesign-m2: flips draft → active. */
  onStart: () => void;
  /** sprint-backlog-redesign-m2: opens the close-sprint dialog. */
  onClose: () => void;
  /**
   * sprint-backlog-redesign-m3: persists the inline-edited goal. `undefined`
   * clears the field (distinct from `closeSprint`'s retroNote semantics).
   */
  onSaveGoal: (goal: string | undefined) => void;
}

function ActiveSprintHeader({
  sprint,
  todos,
  onEdit,
  onDelete,
  onStart,
  onClose,
  onSaveGoal,
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
          {/* sprint-backlog-redesign-m3: inline-editable goal slot. Visible
              for both draft and active sprints — the goal is intrinsic to
              the sprint, not its lifecycle phase. */}
          <GoalEditor goal={sprint.goal} onSave={onSaveGoal} />
        </div>
        <div className="sprint-header-actions">
          {/* sprint-backlog-redesign-m2: lifecycle button swaps based on
              sprint.state. Closed sprints live in the archived rail and
              never render this header, so we only branch draft vs active. */}
          {isDraft ? (
            <button className="sprint-start-btn" onClick={onStart}>
              Start sprint
            </button>
          ) : (
            <button className="sprint-close-btn" onClick={onClose}>
              Close sprint
            </button>
          )}
          <button onClick={onEdit}>Edit</button>
          <button className="btn-danger" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>
      {isDraft ? (
        <div className="sprint-draft-empty">
          Not started yet. Click <strong>Start sprint</strong> when you&rsquo;re ready to begin.
        </div>
      ) : (
        <div className="sprint-progress-row">
          <span className="sprint-day-label">
            Day {day} of {total}
          </span>
          <div
            className="sprint-progress-bar-wrap"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={taskPct}
            aria-label={`${done} of ${taskTotal} tasks done`}
          >
            <div
              className="sprint-progress-bar-fill"
              style={{ width: `${taskPct}%` }}
            />
          </div>
          <span className="sprint-task-label">
            {done}/{taskTotal} tasks done
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * sprint-backlog-redesign-m2 — stale-sprint banner.
 *
 * Renders when the active sprint is in `"active"` and its `endsAt` is more
 * than 24h before today's midnight. Dismissal is persisted per sprint id
 * in `sessionStorage` so an accidental F5 doesn't re-prompt; each newtab
 * tab is its own document and gets its own dismissal state.
 *
 * The literal 86_400_000 ms math is DST-fuzzed by ±1h once a year; that
 * tolerance is acceptable for an "overdue" nudge per brief-2 §3.
 */
const STALE_SPRINT_DISMISS_KEY_PREFIX = "proclivity:sprint-banner-dismissed:";

function isStaleSprint(sprint: Sprint): boolean {
  if (sprint.state !== "active") return false;
  return sprint.endsAt < todayMidnight() - 86_400_000;
}

interface StaleSprintBannerProps {
  sprint: Sprint;
  onClose: () => void;
}

function StaleSprintBanner({ sprint, onClose }: StaleSprintBannerProps) {
  const storageKey = STALE_SPRINT_DISMISS_KEY_PREFIX + sprint.id;
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const daysAgo = Math.max(
    1,
    Math.floor((Date.now() - sprint.endsAt) / 86_400_000),
  );

  const dismiss = () => {
    try {
      sessionStorage.setItem(storageKey, "1");
    } catch {
      // sessionStorage can throw in private-browsing contexts; fall back
      // to in-memory dismissal for this mount.
    }
    setDismissed(true);
  };

  return (
    <div className="sprint-stale-banner" role="status" aria-live="polite">
      <div className="sprint-stale-message">
        This sprint ended {daysAgo} day{daysAgo === 1 ? "" : "s"} ago. Close it?
      </div>
      <div className="sprint-stale-actions">
        <button className="sprint-stale-primary" onClick={onClose}>
          Close sprint
        </button>
        <button className="sprint-stale-dismiss" onClick={dismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}

/* ─── Archived Sprint Row ──────────────────────────────────────── */

interface ArchivedSprintProps {
  sprint: Sprint;
  todos: Todo[];
  /** Tags registry for chip display in archived rows (read-only, no filter). */
  allTags: Tag[];
  onToggleTodo: (id: string) => void;
  onDeleteTodo: (id: string) => void;
}

/**
 * Archived sprint rows show tag chips for display only.
 * No filter toolbar and no edit button in archived rows (cross-plan
 * contradiction #14 resolution: read-mostly archived content stays simple).
 * Drag-reorder: absent from the codebase; no integration needed.
 */
function ArchivedSprintRow({
  sprint,
  todos,
  allTags,
  onToggleTodo,
  onDeleteTodo,
}: ArchivedSprintProps) {
  const [open, setOpen] = useState(false);
  // H3 fix: exclude closed (done) todos so they don't appear in BOTH the
  // archived sprint row AND the Closed tab simultaneously. The Closed tab is
  // the canonical home for done tasks; archived rows are read-only summaries.
  const sprintTodos = todos.filter(
    (t) => t.scope === "sprint" && t.sprintId === sprint.id && !t.done,
  );

  return (
    <div className="sprint-archived-item">
      {/* Use <button> instead of <div onClick> for keyboard accessibility (#18) */}
      <button
        className="sprint-archived-row"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`${sprint.name} – ${sprintDateRange(sprint)}`}
      >
        <div className="sprint-archived-name">{sprint.name}</div>
        <div className="sprint-archived-dates">{sprintDateRange(sprint)}</div>
        <span className={`sprint-archived-caret ${open ? "open" : ""}`}>▾</span>
      </button>
      {/* sprint-backlog-redesign-m3: goal line renders between the row
          button and the expanded task block when present. Italic-muted
          per AC#3; single-line with CSS ellipsis on overflow. */}
      {open && sprint.goal && (
        <div className="sprint-archived-goal" title={sprint.goal}>
          {sprint.goal}
        </div>
      )}
      {open && (
        <div className="sprint-archived-tasks">
          {/* sprint-backlog-redesign-m2: retro note disclosure. Only renders
              when the user actually captured a note on close — empty retros
              don't appear (closeSprint persists trimmed-non-empty only). */}
          {sprint.retroNote && (
            <details className="sprint-retro-disclosure">
              <summary>Retro note</summary>
              <p className="sprint-retro-note">{sprint.retroNote}</p>
            </details>
          )}
          {sprintTodos.length === 0 ? (
            <div className="section-empty" style={{ padding: "12px 0" }}>
              No tasks in this sprint.
            </div>
          ) : (
            <ul className="todo-list">
              {sprintTodos.map((t) => (
                <TodoItem
                  key={t.id}
                  todo={t}
                  allTags={allTags}
                  onToggle={onToggleTodo}
                  onDelete={onDeleteTodo}
                  // No onEdit for archived rows — read-only (cross-plan #14)
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Unassigned sprint todos ──────────────────────────────────── */

interface UnassignedGroupProps {
  todos: Todo[];
  activeSprintId: string;
  onMove: (todoId: string) => void;
}

function UnassignedGroup({ todos, activeSprintId, onMove }: UnassignedGroupProps) {
  if (todos.length === 0) return null;
  return (
    <div className="sprint-unassigned">
      <div className="sprint-unassigned-heading">
        Unassigned ({todos.length})
      </div>
      {todos.map((t) => (
        <div key={t.id} className="sprint-unassigned-item">
          <span className="sprint-unassigned-title">{t.title}</span>
          <button
            className="sprint-move-btn"
            onClick={() => onMove(t.id)}
            title={`Move to active sprint ${activeSprintId}`}
          >
            Move to active sprint
          </button>
        </div>
      ))}
    </div>
  );
}

/* ─── Main SprintManager ──────────────────────────────────────── */

type UIMode = "view" | "new-sprint" | "edit-sprint";

export function SprintManager() {
  const { state, update, loading } = useStore();
  const [mode, setMode] = useState<UIMode>("view");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // sprint-backlog-redesign-m2: close-sprint dialog state (separate from
  // delete so the user can have both modals in muscle-memory paths
  // without collisions). retroDraft holds the textarea's controlled value.
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [retroDraft, setRetroDraft] = useState("");
  // Transient filter for active sprint tasks only (not archived — see ArchivedSprintRow)
  const [activeTagIds, setActiveTagIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { sprints, activeSprintId, todos, tags: allTags } = state;

  // Memoize derived lists so filter+sort don't run on every render (#25).
  // These must run unconditionally — the `if (loading)` guard is below all
  // hooks so React sees a stable hook order across the loading → loaded
  // transition (React error #310).
  const activeSprint = useMemo(
    () => sprints.find((s) => s.id === activeSprintId),
    [sprints, activeSprintId],
  );
  const archivedSprints = useMemo(
    () => sprints.filter(isArchived).sort((a, b) => b.endsAt - a.endsAt),
    [sprints],
  );
  const liveSprints = useMemo(
    () => sprints.filter((s) => !isArchived(s)).sort((a, b) => a.startsAt - b.startsAt),
    [sprints],
  );
  // Closed-todos integration: active sprint list excludes `done` todos —
  // they appear on the Closed tab instead. `sprintTaskStats` (called by
  // <ActiveSprintHeader>) still receives the full `todos` array via prop,
  // so the progress bar correctly reports e.g. "6/8 tasks done" even
  // though the 6 done ones aren't visible in the list. See
  // .claude/notes/closed-todos-research-B.md §4 for the progress-counter
  // accounting decision.
  const activeSprintTodosAll = useMemo(
    () =>
      activeSprintId
        ? todos.filter(
            (t) =>
              t.scope === "sprint" &&
              t.sprintId === activeSprintId &&
              !t.done,
          )
        : [],
    [todos, activeSprintId],
  );

  // Closed sprint tasks count — feeds the closed-counter affordance.
  const closedSprintCount = useMemo(
    () => activeSprintId
      ? todos.filter((t) => t.scope === "sprint" && t.sprintId === activeSprintId && t.done).length
      : 0,
    [todos, activeSprintId],
  );

  // Prune activeTagIds when tags are deleted
  const effectiveActiveTagIds = useMemo(() => {
    const knownIds = new Set(allTags.map((t) => t.id));
    return activeTagIds.filter((id) => knownIds.has(id));
  }, [activeTagIds, allTags]);

  const activeSprintTodos = useMemo(
    () => filterByTags(activeSprintTodosAll, effectiveActiveTagIds),
    [activeSprintTodosAll, effectiveActiveTagIds],
  );

  // Tags used in the active sprint (for filter toolbar)
  const sprintAvailableTags = useMemo(() => {
    const usedIds = new Set(activeSprintTodosAll.flatMap((t) => t.tags));
    return allTags.filter((tag) => usedIds.has(tag.id));
  }, [activeSprintTodosAll, allTags]);

  // Unassigned migration group also excludes closed todos. Surfacing a
  // closed-but-unassigned todo here would be confusing — its destination
  // is the Closed tab, not the "move to active sprint" affordance.
  const unassignedSprintTodos = useMemo(
    () => todos.filter((t) => t.scope === "sprint" && !t.sprintId && !t.done),
    [todos],
  );

  const editingTodo = editingId ? todos.find((t) => t.id === editingId) ?? null : null;

  // D9 fix: use resolvedSettings for consistent layoutMode read (resolvedSettings is
  // already in constants.ts which is in the shared chunk — no bundle cost here).
  const _rs = resolvedSettings(state.settings);
  const layoutMode = _rs.layoutMode;
  const defaultSprintDays = _rs.defaultSprintDays;

  // Sorted active sprint tasks for card mode (list mode uses activeSprintTodos which is already sorted by filterByTags)
  const sortedActiveSprintTodos = useMemo(
    () =>
      layoutMode === "card"
        ? [...activeSprintTodosAll].sort(
            (a, b) => Number(a.done) - Number(b.done) || b.createdAt - a.createdAt,
          )
        : activeSprintTodosAll,
    [activeSprintTodosAll, layoutMode],
  );

  if (loading) return null;

  /* ── actions ── */

  const switchSprint = async (id: string) => {
    await update((s) => ({ ...s, activeSprintId: id }));
  };

  const createSprint = async (
    name: string,
    startsAt: number,
    endsAt: number,
    goal: string | undefined,
  ) => {
    const id = uid();
    await update((s) => ({
      ...s,
      // sprint-backlog-redesign-m2: new sprints start in the pre-start
      // state. The user explicitly transitions to active via the Start
      // sprint affordance on the ActiveSprintHeader.
      // sprint-backlog-redesign-m3: optional goal — the conditional spread
      // omits the field entirely when undefined so a fresh sprint with no
      // goal does NOT carry an explicit `goal: undefined` key.
      sprints: [
        ...s.sprints,
        { id, name, startsAt, endsAt, state: "draft", ...(goal ? { goal } : {}) },
      ],
      activeSprintId: id,
    }));
    setMode("view");
  };

  const editSprint = async (
    name: string,
    startsAt: number,
    endsAt: number,
    goal: string | undefined,
  ) => {
    if (!activeSprintId) return;
    await update((s) => ({
      ...s,
      // sprint-backlog-redesign-m3: goal is part of the editable surface.
      // Clearing the form input results in `goal === undefined` and the
      // assignment below removes any prior value (this is the intended
      // m3 semantics, distinct from m2's retroNote which preserves on empty).
      sprints: s.sprints.map((sp) =>
        sp.id === activeSprintId ? { ...sp, name, startsAt, endsAt, goal } : sp,
      ),
    }));
    setMode("view");
  };

  /**
   * sprint-backlog-redesign-m3: persist a goal change from the inline header
   * editor. Pass `undefined` to clear an existing goal; pass a trimmed
   * non-empty string to set or update it.
   *
   * Distinct from `closeSprint`'s retroNote handling — goal CAN be cleared
   * by the user via the inline editor. See AC#1 in the m3 brief and the
   * synthesis §1 carry-forward note.
   */
  const setSprintGoal = async (goal: string | undefined) => {
    if (!activeSprintId) return;
    await update((s) => ({
      ...s,
      sprints: s.sprints.map((sp) =>
        sp.id === activeSprintId ? { ...sp, goal } : sp,
      ),
    }));
  };

  const deleteSprint = async () => {
    if (!activeSprintId) return;
    // Read sprints from within the update callback to avoid stale closure (#9)
    await update((s) => {
      const nextSprint = s.sprints.find(
        (sp) => sp.id !== activeSprintId && !isArchived(sp),
      );
      return {
        ...s,
        sprints: s.sprints.filter((sp) => sp.id !== activeSprintId),
        todos: s.todos.filter(
          (t) => !(t.scope === "sprint" && t.sprintId === activeSprintId),
        ),
        activeSprintId: nextSprint?.id,
      };
    });
    setMode("view");
  };

  /**
   * sprint-backlog-redesign-m2: flip a draft sprint to active. Idempotent —
   * a sprint already in `"active"` is left untouched (defensive against
   * double-click).
   */
  const startSprint = async () => {
    if (!activeSprintId) return;
    await update((s) => ({
      ...s,
      sprints: s.sprints.map((sp) =>
        sp.id === activeSprintId && sp.state === "draft"
          ? { ...sp, state: "active" }
          : sp,
      ),
    }));
  };

  /**
   * sprint-backlog-redesign-m2: flip an active sprint to closed and persist
   * the optional retro note. Trimmed empty notes resolve to `undefined`
   * (matches the m3 `goal` semantics — empty string is not a valid value).
   * The sprint relocates from the live tabs list to the archived rail in
   * the next render because `isArchived` now keys on `state === "closed"`.
   *
   * rect(m2) — M2: the `sp.state === "active"` guard mirrors `startSprint`'s
   * defensive guard. Protects against a multi-tab race where one tab closes
   * the sprint (persisting its retro) while another tab is mid-dialog —
   * confirming the second dialog would otherwise overwrite the just-saved
   * retroNote with an empty string spread.
   *
   * rect(m2) — M3: the conditional spread only WRITES retroNote when the
   * draft is non-empty. Empty trimmed values intentionally do NOT clear an
   * existing retroNote. This path is UI-unreachable in practice (a closed
   * sprint never renders the active-sprint header so the close-sprint button
   * is unreachable for re-close), but codifying it here documents the
   * intended semantics.
   */
  const closeSprint = async () => {
    if (!activeSprintId) return;
    const trimmed = retroDraft.trim();
    await update((s) => ({
      ...s,
      sprints: s.sprints.map((sp) =>
        sp.id === activeSprintId && sp.state === "active"
          ? {
              ...sp,
              state: "closed",
              ...(trimmed ? { retroNote: trimmed } : {}),
            }
          : sp,
      ),
    }));
    setRetroDraft("");
  };

  const addTask = async (title: string) => {
    if (!activeSprintId) return;
    await update((s) => ({
      ...s,
      todos: [
        ...s.todos,
        {
          id: uid(),
          title,
          scope: "sprint",
          done: false,
          createdAt: Date.now(),
          sprintId: activeSprintId,
          tags: [],
        },
      ],
    }));
  };

  /**
   * Toggle a sprint task's done state. Routes through the closed-todos
   * helpers (matches TodoList.toggle wiring) so the close action captures
   * restore checkpoints (`closedFromScope`, `closedFromSprintId`) and the
   * task lands on the Closed tab atomically.
   *
   * Archived-sprint rows also call this when un-ticking a closed task in an
   * expanded archived row — `reopenTodo` validates the sprint still exists
   * and falls back to long-term scope if it has been deleted, matching the
   * sibling's `reopenTodo` contract.
   */
  const toggleTodo = async (id: string) => {
    const t = todos.find((x) => x.id === id);
    if (!t) return;
    await update(t.done ? reopenTodo(id) : closeTodo(id));
  };

  /**
   * Permanent delete for the row-level X button on sprint tasks. Routes
   * through the closed-todos helper which scrubs cardLayouts for us —
   * same cleanup contract as the previous `removeCardLayouts([id])` path,
   * just centralized.
   */
  const deleteTodo = async (id: string) => {
    await update(permanentlyDeleteTodos([id]));
  };

  const handleEditSave = async (id: string, fields: TodoEditFields) => {
    await update((s) => ({
      ...s,
      todos: s.todos.map((t) => {
        if (t.id !== id) return t;
        return {
          ...t,
          title: fields.title,
          notes: fields.notes || undefined,
          scope: fields.scope,
          sprintId: fields.sprintId,
          tags: fields.tags,
        };
      }),
    }));
  };

  const moveToActiveSprint = async (todoId: string) => {
    if (!activeSprintId) return;
    await update((s) => ({
      ...s,
      todos: s.todos.map((t) =>
        t.id === todoId ? { ...t, sprintId: activeSprintId } : t,
      ),
    }));
  };

  // H2 fix: split active/closed counts so the delete dialog discloses that
  // closed sprint tasks are also permanently removed.
  const taskCountForSprint = (sprintId: string) => {
    let active = 0, closed = 0;
    for (const t of todos)
      if (t.scope === "sprint" && t.sprintId === sprintId)
        t.done ? closed++ : active++;
    return { active, closed };
  };

  /* ── render ── */

  return (
    <div>
      {/* Sprint switcher */}
      <div className="sprint-tabs">
        {liveSprints.map((s) => (
          <button
            key={s.id}
            className={`sprint-tab ${s.id === activeSprintId ? "active" : ""}`}
            onClick={() => {
              switchSprint(s.id);
              setMode("view");
            }}
          >
            {s.name}
          </button>
        ))}
        <button
          className="sprint-tab-new"
          onClick={() => setMode(mode === "new-sprint" ? "view" : "new-sprint")}
        >
          + New sprint
        </button>
      </div>

      {/* New sprint form */}
      {mode === "new-sprint" && (
        <NewSprintForm
          onSave={createSprint}
          onCancel={() => setMode("view")}
          defaultSprintDays={defaultSprintDays}
        />
      )}

      {/* Edit sprint form */}
      {mode === "edit-sprint" && activeSprint && (
        <EditSprintForm
          sprint={activeSprint}
          onSave={editSprint}
          onCancel={() => setMode("view")}
        />
      )}

      {/* Delete confirmation (#31 — shared ConfirmDialog) */}
      {activeSprint && (
        <ConfirmDialog
          open={confirmingDelete}
          onClose={() => setConfirmingDelete(false)}
          title="Delete sprint"
          confirmLabel="Delete"
          message={(() => {
            const { active, closed } = taskCountForSprint(activeSprint.id);
            const total = active + closed;
            const pl = (n: number) => n !== 1 ? "s" : "";
            const note =
              total === 0 ? "This sprint has no tasks." :
              closed === 0 ? `Also deletes ${active} active task${pl(active)}.` :
              active === 0 ? `Also deletes ${closed} closed task${pl(closed)}.` :
              `Also deletes ${active} active + ${closed} closed tasks.`;
            return (
              <>Delete <strong>{activeSprint.name}</strong>? {note}</>
            );
          })()}
          onConfirm={deleteSprint}
        />
      )}

      {/* No sprints at all */}
      {sprints.length === 0 && mode !== "new-sprint" && (
        <div className="section-empty">
          No sprints yet. Create your first sprint above to get started.
        </div>
      )}

      {/* sprint-backlog-redesign-m2: close-sprint dialog. Mirrors the
          delete-sprint dialog structure but injects a retro-note textarea
          via ConfirmDialog's ReactNode `message` prop. */}
      {activeSprint && (
        <ConfirmDialog
          open={confirmingClose}
          onClose={() => {
            setConfirmingClose(false);
            setRetroDraft("");
          }}
          title="Close sprint"
          confirmLabel="Close sprint"
          message={
            <>
              <p>
                Close <strong>{activeSprint.name}</strong>? It will move to the
                archived rail and no new tasks can be added.
              </p>
              <label className="sprint-retro-label">
                Retro note <span className="sprint-retro-hint">(optional)</span>
                <textarea
                  className="sprint-retro-textarea"
                  rows={2}
                  maxLength={280}
                  value={retroDraft}
                  onChange={(e) => setRetroDraft(e.target.value)}
                  placeholder="What stuck? What didn&rsquo;t?"
                />
              </label>
            </>
          }
          onConfirm={closeSprint}
        />
      )}

      {/* Active sprint view */}
      {activeSprint && mode === "view" && (
        <>
          {/* sprint-backlog-redesign-m2: stale-sprint banner. Only renders
              for active sprints expired > 24h ago; dismissed flag is
              per-sprint-id in sessionStorage so accidental F5 doesn't
              re-nag.
              rect(m2) — H1: key={sprint.id} forces remount whenever the
              user switches between stale sprints. Without it, React
              reuses the component instance and `dismissed` state from
              the previous sprint leaks into the new one. */}
          {isStaleSprint(activeSprint) && (
            <StaleSprintBanner
              key={activeSprint.id}
              sprint={activeSprint}
              onClose={() => setConfirmingClose(true)}
            />
          )}

          <ActiveSprintHeader
            sprint={activeSprint}
            todos={todos}
            onEdit={() => setMode("edit-sprint")}
            onDelete={() => setConfirmingDelete(true)}
            onStart={startSprint}
            onClose={() => setConfirmingClose(true)}
            onSaveGoal={setSprintGoal}
          />

          {/* Unassigned (migration) group — m2: hide for draft sprints
              since they have no task surface yet. */}
          {activeSprint.state !== "draft" && unassignedSprintTodos.length > 0 && (
            <UnassignedGroup
              todos={unassignedSprintTodos}
              activeSprintId={activeSprint.id}
              onMove={moveToActiveSprint}
            />
          )}

          {/* sprint-backlog-redesign-m2: the entire task surface (heading,
              add-form, closed-counter, list/card render) is gated on the
              sprint being active. Draft sprints render only the header's
              "Start sprint" placeholder; nothing below until they're
              started. */}
          {activeSprint.state === "active" && (
          <>
          <div className="sprint-section-heading">Tasks</div>
          <AddTaskForm
            onAdd={addTask}
            placeholder="Add a task to this sprint…"
          />

          {/* Closed counter for sprint tasks — same affordance as TodoList,
              scoped to the active sprint. */}
          {closedSprintCount > 0 && (
            <ClosedScopeCounter count={closedSprintCount} suffix=" in this sprint" />
          )}

          {/* A4 fix: card mode uses TodoCardSection directly; list mode inlined. */}
          {layoutMode === "card" ? (
            <Suspense fallback={null}>
              <TodoCardSection
                scope="sprint"
                scopedItems={sortedActiveSprintTodos}
                filteredItems={activeSprintTodos}
                allTags={allTags}
                effectiveActiveTagIds={effectiveActiveTagIds}
                availableTags={sprintAvailableTags}
                cardLayouts={state.cardLayouts}
                emptyHint="No tasks yet. Add one above."
                cardHintSeen={_rs.cardHintSeen}
                onToggle={(id) => void toggleTodo(id)}
                onDelete={deleteTodo}
                onEdit={(id) => setEditingId(id)}
                onToggleFilter={(tagId) => setActiveTagIds((prev) =>
                  prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
                )}
                onClearFilter={() => setActiveTagIds([])}
                onDismissHint={() => {
                  void update((s) => ({
                    ...s,
                    settings: { ...s.settings, cardHintSeen: true },
                  }));
                }}
                update={update}
              />
            </Suspense>
          ) : (
            <>
              <TagFilterToolbar
                availableTags={sprintAvailableTags}
                activeTagIds={effectiveActiveTagIds}
                totalCount={sortedActiveSprintTodos.length}
                filteredCount={activeSprintTodos.length}
                onToggle={(tagId) => setActiveTagIds((prev) =>
                  prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
                )}
                onClearAll={() => setActiveTagIds([])}
              />
              {activeSprintTodos.length === 0 ? (
                <div className="section-empty">
                  {effectiveActiveTagIds.length > 0 ? (
                    <>
                      No tasks in this sprint match the selected tags.{" "}
                      <button
                        type="button"
                        className="inline-clear-link"
                        onClick={() => setActiveTagIds([])}
                      >
                        Clear the filter
                      </button>
                    </>
                  ) : (
                    "No tasks yet. Add one above."
                  )}
                </div>
              ) : (
                <ul className="todo-list">
                  {activeSprintTodos.map((t) => (
                    <TodoItem
                      key={t.id}
                      todo={t}
                      allTags={allTags}
                      onToggle={(id) => void toggleTodo(id)}
                      onDelete={deleteTodo}
                      onEdit={(id) => setEditingId(id)}
                    />
                  ))}
                </ul>
              )}
            </>
          )}
          </>
          )}
        </>
      )}

      {/* Archived sprints */}
      {archivedSprints.length > 0 && (
        <div className="sprint-archived-section">
          <div className="sprint-archived-heading">Archived</div>
          {archivedSprints.map((s) => (
            <ArchivedSprintRow
              key={s.id}
              sprint={s}
              todos={todos}
              allTags={allTags}
              onToggleTodo={toggleTodo}
              onDeleteTodo={deleteTodo}
            />
          ))}
        </div>
      )}

      {editingTodo && (
        <Suspense fallback={null}>
          <TodoEditModal
            open={editingId !== null}
            todo={editingTodo}
            allTags={allTags}
            sprints={sprints}
            onClose={() => setEditingId(null)}
            onSave={handleEditSave}
          />
        </Suspense>
      )}
    </div>
  );
}
