import { lazy, Suspense, useMemo, useState } from "react";
import { useStore } from "@/storage/useStore";
import { uid } from "@/storage/storage";
import type { Sprint, Tag, Todo } from "@/types";
import { ConfirmDialog } from "@/components/Modal";
import { TodoItem } from "@/components/TodoItem";
import { TodoEditModal, type TodoEditFields } from "@/components/TodoEditModal";
import { TagFilterToolbar } from "@/components/TagFilterToolbar";

import { filterByTags } from "@/storage/tags";
import { resolvedSettings } from "@/storage/constants";
import {
  todayMidnight,
  defaultEndsAt,
  isArchived,
  sprintDateRange,
  sprintDayProgress,
  sprintTaskStats,
} from "./sprintUtils";
import { resetCardPositions } from "@/storage/cardLayouts";
import "../sections.css";
import "./sprint.css";

// A4 fix: SprintCardSection deleted — TodoCardSection used directly for card mode.
// List mode inlined below (was duplicated in SprintCardSection). This removes
// a 115-line dispatcher with no sprint-specific logic.
const TodoCardSection = lazy(() =>
  import("../TodoCardSection").then((m) => ({ default: m.TodoCardSection })),
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
  /** Called when start changes — allows caller to bump end for new sprints */
  onStartChange?: (newStart: number, setEnd: (v: string) => void) => void;
  onSave: (name: string, startsAt: number, endsAt: number) => void;
  onCancel: () => void;
}

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
  const today = todayMidnight();
  const [name, setName] = useState(initialName);
  const [startVal, setStartVal] = useState(
    tsToDateInput(initialStart ?? today),
  );
  const [endVal, setEndVal] = useState(
    tsToDateInput(initialEnd ?? defaultEndsAt(today)),
  );
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
    onSave(n, startsAt, endsAt);
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
}: {
  onSave: (name: string, startsAt: number, endsAt: number) => void;
  onCancel: () => void;
}) {
  return (
    <SprintForm
      heading="New Sprint"
      submitLabel="Create"
      onStartChange={(newStart, setEnd) =>
        setEnd(tsToDateInput(defaultEndsAt(newStart)))
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
  onSave: (name: string, startsAt: number, endsAt: number) => void;
  onCancel: () => void;
}) {
  return (
    <SprintForm
      heading="Edit Sprint"
      submitLabel="Save"
      initialName={sprint.name}
      initialStart={sprint.startsAt}
      initialEnd={sprint.endsAt}
      onSave={onSave}
      onCancel={onCancel}
    />
  );
}

/* ─── Active Sprint Header ─────────────────────────────────────── */

interface ActiveSprintHeaderProps {
  sprint: Sprint;
  todos: Todo[];
  onEdit: () => void;
  onDelete: () => void;
}

function ActiveSprintHeader({
  sprint,
  todos,
  onEdit,
  onDelete,
}: ActiveSprintHeaderProps) {
  const { day, total } = sprintDayProgress(sprint);
  const { done, total: taskTotal } = sprintTaskStats(todos, sprint.id);
  const taskPct = taskTotal > 0 ? Math.round((done / taskTotal) * 100) : 0;

  return (
    <div className="sprint-header">
      <div className="sprint-header-top">
        <div>
          <div className="sprint-header-name">{sprint.name}</div>
          <div className="sprint-header-dates">{sprintDateRange(sprint)}</div>
        </div>
        <div className="sprint-header-actions">
          <button onClick={onEdit}>Edit</button>
          <button className="btn-danger" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>
      <div className="sprint-progress-row">
        {/* #20: label now tracks task completion; day-of-N is a secondary label */}
        <span className="sprint-day-label">
          Day {day} of {total}
        </span>
        {/* #19: progressbar role with numeric ARIA attributes */}
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
  const sprintTodos = todos.filter(
    (t) => t.scope === "sprint" && t.sprintId === sprint.id,
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
      {open && (
        <div className="sprint-archived-tasks">
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
  const activeSprintTodosAll = useMemo(
    () =>
      activeSprintId
        ? todos.filter((t) => t.scope === "sprint" && t.sprintId === activeSprintId)
        : [],
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

  const unassignedSprintTodos = useMemo(
    () => todos.filter((t) => t.scope === "sprint" && !t.sprintId),
    [todos],
  );

  const editingTodo = editingId ? todos.find((t) => t.id === editingId) ?? null : null;

  // D9 fix: use resolvedSettings for consistent layoutMode read (resolvedSettings is
  // already in constants.ts which is in the shared chunk — no bundle cost here).
  const layoutMode = resolvedSettings(state.settings).layoutMode;

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

  const createSprint = async (name: string, startsAt: number, endsAt: number) => {
    const id = uid();
    await update((s) => ({
      ...s,
      sprints: [...s.sprints, { id, name, startsAt, endsAt }],
      activeSprintId: id,
    }));
    setMode("view");
  };

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

  const toggleTodo = async (id: string) => {
    await update((s) => ({
      ...s,
      todos: s.todos.map((t) =>
        t.id === id
          ? {
              ...t,
              done: !t.done,
              completedAt: t.done ? undefined : Date.now(),
            }
          : t,
      ),
    }));
  };

  const deleteTodo = async (id: string) => {
    // Clean up orphan card position on deletion (C1/H3 fix: matches TodoList.remove and
    // RemindersManager.deleteReminder). Applies for both active-sprint and archived-sprint
    // task deletion since the same helper is called from both paths.
    await update((s) =>
      resetCardPositions([id])({
        ...s,
        todos: s.todos.filter((t) => t.id !== id),
      }),
    );
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

  const taskCountForSprint = (sprintId: string) =>
    todos.filter((t) => t.scope === "sprint" && t.sprintId === sprintId).length;

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
            const count = taskCountForSprint(activeSprint.id);
            return (
              <>
                Delete <strong>{activeSprint.name}</strong>?{" "}
                {count > 0
                  ? `This will also delete ${count} task${count !== 1 ? "s" : ""}.`
                  : "This sprint has no tasks."}
              </>
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

      {/* Active sprint view */}
      {activeSprint && mode === "view" && (
        <>
          <ActiveSprintHeader
            sprint={activeSprint}
            todos={todos}
            onEdit={() => setMode("edit-sprint")}
            onDelete={() => setConfirmingDelete(true)}
          />

          {/* Unassigned (migration) group */}
          {unassignedSprintTodos.length > 0 && (
            <UnassignedGroup
              todos={unassignedSprintTodos}
              activeSprintId={activeSprint.id}
              onMove={moveToActiveSprint}
            />
          )}

          {/* Active sprint tasks */}
          <div className="sprint-section-heading">Tasks</div>
          <AddTaskForm
            onAdd={addTask}
            placeholder="Add a task to this sprint…"
          />

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
                cardHintSeen={resolvedSettings(state.settings).cardHintSeen}
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
        <TodoEditModal
          open={editingId !== null}
          todo={editingTodo}
          allTags={allTags}
          sprints={sprints}
          onClose={() => setEditingId(null)}
          onSave={handleEditSave}
        />
      )}
    </div>
  );
}
