import { useState } from "react";
import { useStore } from "@/storage/useStore";
import { uid } from "@/storage/storage";
import type { Sprint, Todo } from "@/types";
import {
  todayMidnight,
  defaultEndsAt,
  isArchived,
  sprintDateRange,
  sprintDayProgress,
  sprintTaskStats,
} from "./sprintUtils";
import "../sections.css";
import "./sprint.css";

/* ─── helpers ──────────────────────────────────────────────────── */

function tsToDateInput(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dateInputToTs(val: string): number {
  // parse YYYY-MM-DD as local midnight
  const [y, m, day] = val.split("-").map(Number);
  const d = new Date(y, m - 1, day);
  return d.getTime();
}

/* ─── Inline todo item (shared by active + archived views) ─────── */

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

function TodoItem({ todo, onToggle, onDelete }: TodoItemProps) {
  return (
    <li className={`todo-item ${todo.done ? "done" : ""}`}>
      <input
        type="checkbox"
        checked={todo.done}
        onChange={() => onToggle(todo.id)}
      />
      <span className="todo-title">{todo.title}</span>
      <button
        className="todo-delete"
        onClick={() => onDelete(todo.id)}
        title="Delete"
      >
        ✕
      </button>
    </li>
  );
}

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

/* ─── New Sprint form ──────────────────────────────────────────── */

interface NewSprintFormProps {
  onSave: (name: string, startsAt: number, endsAt: number) => void;
  onCancel: () => void;
}

function NewSprintForm({ onSave, onCancel }: NewSprintFormProps) {
  const today = todayMidnight();
  const [name, setName] = useState("");
  const [startVal, setStartVal] = useState(tsToDateInput(today));
  const [endVal, setEndVal] = useState(
    tsToDateInput(defaultEndsAt(today)),
  );

  const handleSave = () => {
    const n = name.trim() || "Sprint";
    const startsAt = dateInputToTs(startVal);
    const endsAt = dateInputToTs(endVal);
    onSave(n, startsAt, endsAt);
  };

  return (
    <div className="sprint-new-form">
      <h4>New Sprint</h4>
      <div className="sprint-new-form-name">
        <label>Name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Sprint name…"
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
        />
      </div>
      <div className="sprint-new-form-row">
        <label>
          Starts
          <input
            type="date"
            value={startVal}
            onChange={(e) => {
              setStartVal(e.target.value);
              // update end if it's still the default
              const newStart = dateInputToTs(e.target.value);
              setEndVal(tsToDateInput(defaultEndsAt(newStart)));
            }}
          />
        </label>
        <label>
          Ends
          <input
            type="date"
            value={endVal}
            onChange={(e) => setEndVal(e.target.value)}
          />
        </label>
      </div>
      <div className="sprint-new-form-actions">
        <button onClick={handleSave}>Create</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

/* ─── Edit Sprint form ─────────────────────────────────────────── */

interface EditSprintFormProps {
  sprint: Sprint;
  onSave: (name: string, startsAt: number, endsAt: number) => void;
  onCancel: () => void;
}

function EditSprintForm({ sprint, onSave, onCancel }: EditSprintFormProps) {
  const [name, setName] = useState(sprint.name);
  const [startVal, setStartVal] = useState(tsToDateInput(sprint.startsAt));
  const [endVal, setEndVal] = useState(tsToDateInput(sprint.endsAt));

  const handleSave = () => {
    const n = name.trim() || sprint.name;
    onSave(n, dateInputToTs(startVal), dateInputToTs(endVal));
  };

  return (
    <div className="sprint-edit-form">
      <h4>Edit Sprint</h4>
      <div className="sprint-new-form-name">
        <label>Name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
        />
      </div>
      <div className="sprint-edit-form-row">
        <label>
          Starts
          <input
            type="date"
            value={startVal}
            onChange={(e) => setStartVal(e.target.value)}
          />
        </label>
        <label>
          Ends
          <input
            type="date"
            value={endVal}
            onChange={(e) => setEndVal(e.target.value)}
          />
        </label>
      </div>
      <div className="sprint-edit-form-actions">
        <button onClick={handleSave}>Save</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

/* ─── Delete confirmation ──────────────────────────────────────── */

interface DeleteConfirmProps {
  sprintName: string;
  taskCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirm({ sprintName, taskCount, onConfirm, onCancel }: DeleteConfirmProps) {
  return (
    <div className="sprint-confirm">
      <p>
        Delete <strong>{sprintName}</strong>?{" "}
        {taskCount > 0
          ? `This will also delete ${taskCount} task${taskCount !== 1 ? "s" : ""}.`
          : "This sprint has no tasks."}
      </p>
      <div className="sprint-confirm-actions">
        <button className="btn-danger" onClick={onConfirm}>
          Delete
        </button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
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
          <button className="danger" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>
      <div className="sprint-progress-row">
        <span className="sprint-day-label">
          Day {day} of {total}
        </span>
        <div className="sprint-progress-bar-wrap">
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
  onToggleTodo: (id: string) => void;
  onDeleteTodo: (id: string) => void;
}

function ArchivedSprintRow({
  sprint,
  todos,
  onToggleTodo,
  onDeleteTodo,
}: ArchivedSprintProps) {
  const [open, setOpen] = useState(false);
  const sprintTodos = todos.filter(
    (t) => t.scope === "sprint" && t.sprintId === sprint.id,
  );

  return (
    <div className="sprint-archived-item">
      <div className="sprint-archived-row" onClick={() => setOpen((v) => !v)}>
        <div className="sprint-archived-name">{sprint.name}</div>
        <div className="sprint-archived-dates">{sprintDateRange(sprint)}</div>
        <span className={`sprint-archived-caret ${open ? "open" : ""}`}>▾</span>
      </div>
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
                  onToggle={onToggleTodo}
                  onDelete={onDeleteTodo}
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

type UIMode = "view" | "new-sprint" | "edit-sprint" | "confirm-delete";

export function SprintManager() {
  const { state, update, loading } = useStore();
  const [mode, setMode] = useState<UIMode>("view");

  if (loading) return null;

  const { sprints, activeSprintId, todos } = state;

  const activeSprint = sprints.find((s) => s.id === activeSprintId);
  const archivedSprints = sprints
    .filter(isArchived)
    .sort((a, b) => b.endsAt - a.endsAt);
  const liveSprints = sprints
    .filter((s) => !isArchived(s))
    .sort((a, b) => a.startsAt - b.startsAt);

  // Todos belonging to the active sprint
  const activeSprintTodos = activeSprintId
    ? todos.filter(
        (t) => t.scope === "sprint" && t.sprintId === activeSprintId,
      )
    : [];

  // Sprint todos with no sprintId (migration group)
  const unassignedSprintTodos = todos.filter(
    (t) => t.scope === "sprint" && !t.sprintId,
  );

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
    await update((s) => ({ ...s, todos: s.todos.filter((t) => t.id !== id) }));
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

      {/* Delete confirmation */}
      {mode === "confirm-delete" && activeSprint && (
        <DeleteConfirm
          sprintName={activeSprint.name}
          taskCount={taskCountForSprint(activeSprint.id)}
          onConfirm={deleteSprint}
          onCancel={() => setMode("view")}
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
            onDelete={() => setMode("confirm-delete")}
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
          {activeSprintTodos.length === 0 ? (
            <div className="section-empty">
              No tasks yet. Add one above.
            </div>
          ) : (
            <ul className="todo-list">
              {activeSprintTodos
                .sort(
                  (a, b) =>
                    Number(a.done) - Number(b.done) || b.createdAt - a.createdAt,
                )
                .map((t) => (
                  <TodoItem
                    key={t.id}
                    todo={t}
                    onToggle={toggleTodo}
                    onDelete={deleteTodo}
                  />
                ))}
            </ul>
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
              onToggleTodo={toggleTodo}
              onDeleteTodo={deleteTodo}
            />
          ))}
        </div>
      )}
    </div>
  );
}
