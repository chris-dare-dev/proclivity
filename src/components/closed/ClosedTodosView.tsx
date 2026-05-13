/**
 * ClosedTodosView — the dedicated surface for closed (archived) todos.
 *
 * Lazy-loaded from `src/newtab/App.tsx` so the rendering code stays out of
 * the initial newtab chunk. Default users who never open the Closed tab pay
 * zero kB for this view.
 *
 * Design (see `.claude/notes/closed-todos-research-A.md`):
 *
 *  - **Grouping:** by closure recency — Today / Yesterday / This week /
 *    Earlier this month / Older. This is the same mental model Apple
 *    Reminders and Things 3's Logbook use. Within each group, newest first.
 *  - **Restore:** un-checking the row's checkbox calls `reopenTodo(id)`,
 *    which atomically returns the todo to its original scope/sprint (or
 *    promotes a sprint-orphaned todo to long-term — see `closedTodos.ts`).
 *  - **Delete forever:** the row's × button is destructive; gated by a
 *    `ConfirmDialog` so a stray click on the keyboard-focused button can't
 *    silently nuke the row.
 *  - **Bulk:** "Clear all" footer button purges every closed todo (also
 *    gated by ConfirmDialog). No multi-select in v1 — the auto-purge
 *    retention policy handles the bulk-clean use-case; a "Clear all"
 *    escape hatch covers the "I want a fresh start" intent.
 *  - **Retention disclosure:** a small footer line tells the user how the
 *    auto-purge works. Without this the "where did my closed todos go?"
 *    support question is inevitable.
 *
 * Theming: all colors via OKLCH tokens from `theme.css`. The component
 * adapts to light/dark without any inline theme branching.
 */

import { useMemo, useState } from "react";
import type { Tag, Todo, TodoScope } from "@/types";
import { useStore } from "@/storage/useStore";
import {
  clearAllClosed,
  getClosedTodos,
  permanentlyDeleteTodos,
  reopenTodo,
} from "@/storage/closedTodos";
import {
  CLOSED_TODO_MAX,
  CLOSED_TODO_RETENTION_DAYS,
} from "@/storage/constants";
import { ConfirmDialog } from "@/components/Modal";
import { TagChip } from "@/components/TagChip";
import "./ClosedTodosView.css";

const SCOPE_LABELS: Record<TodoScope, string> = {
  today: "Today",
  sprint: "Sprint",
  long: "Long-term",
};

/* ─── Grouping helpers ─────────────────────────────────────────────────── */

type GroupKey =
  | "today"
  | "yesterday"
  | "thisWeek"
  | "thisMonth"
  | "older";

const GROUP_ORDER: GroupKey[] = [
  "today",
  "yesterday",
  "thisWeek",
  "thisMonth",
  "older",
];

const GROUP_LABEL: Record<GroupKey, string> = {
  today: "Today",
  yesterday: "Yesterday",
  thisWeek: "This week",
  thisMonth: "Earlier this month",
  older: "Older",
};

/**
 * Compute the day index of a timestamp relative to "now" (both rounded to
 * local midnight). 0 = same calendar day, 1 = yesterday, etc.
 *
 * Splitting on calendar days (not 24h windows) matches user intuition:
 * something closed at 11:59pm yesterday is "yesterday", not "23 hours ago".
 */
function daysAgo(ts: number, now: Date): number {
  const a = new Date(ts);
  a.setHours(0, 0, 0, 0);
  const b = new Date(now);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function groupOf(ts: number, now: Date): GroupKey {
  const d = daysAgo(ts, now);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  if (d <= 7) return "thisWeek";
  if (d <= 30) return "thisMonth";
  return "older";
}

/* ─── Row format helpers ───────────────────────────────────────────────── */

function formatClosedAt(ts: number, now: Date): string {
  // Same-day → time only ("3:42pm"); within 7 days → weekday + time;
  // older → short date + time. Locale-aware; honors the platform's clock
  // format because we let Intl pick.
  const sameDay = daysAgo(ts, now) === 0;
  const withinWeek = daysAgo(ts, now) < 7;
  const d = new Date(ts);
  if (sameDay) {
    return d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  if (withinWeek) {
    return d.toLocaleString(undefined, {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/* ─── Component ────────────────────────────────────────────────────────── */

export function ClosedTodosView() {
  const { state, update, loading } = useStore();
  // `pendingDelete` is the id of a single row pending confirmation;
  // `pendingClearAll` is the "clear everything" flag. Two separate states so
  // a user mid-clear can't accidentally confirm a stale row delete and vice
  // versa.
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [pendingClearAll, setPendingClearAll] = useState(false);

  const closed = useMemo(() => getClosedTodos(state), [state]);
  const allTags = state.tags;

  // Group rows by closure recency. Computed once per render; cheap O(n)
  // even at the 500-item retention cap.
  const groups = useMemo(() => {
    const now = new Date();
    const buckets: Record<GroupKey, Todo[]> = {
      today: [],
      yesterday: [],
      thisWeek: [],
      thisMonth: [],
      older: [],
    };
    for (const t of closed) {
      const anchor = t.closedAt ?? t.completedAt ?? t.createdAt ?? Date.now();
      buckets[groupOf(anchor, now)].push(t);
    }
    return buckets;
  }, [closed]);

  // Look up the pending-delete row for the confirm dialog message. Bounded
  // by closed.length so this is fine without a Map.
  const pendingDeleteTodo = pendingDelete
    ? closed.find((t) => t.id === pendingDelete) ?? null
    : null;

  if (loading) return null;

  /* ── Actions ── */

  const handleReopen = (id: string) => {
    void update(reopenTodo(id));
  };

  const handleDelete = (id: string) => {
    void update(permanentlyDeleteTodos([id]));
  };

  const handleClearAll = () => {
    void update(clearAllClosed());
  };

  /* ── Render ── */

  if (closed.length === 0) {
    return (
      <div className="closed-view">
        <div className="closed-empty">
          <div className="closed-empty-title">Nothing closed yet.</div>
          <p className="closed-empty-body">
            Checked-off tasks land here, where you can restore them with a
            click or remove them permanently. They auto-clear after{" "}
            {CLOSED_TODO_RETENTION_DAYS} days.
          </p>
        </div>
      </div>
    );
  }

  // Count of newest groups that have content — used to decide whether to
  // render an empty group's heading (we don't).
  const populatedGroups = GROUP_ORDER.filter((k) => groups[k].length > 0);

  return (
    <div className="closed-view">
      <header className="closed-header">
        <div className="closed-header-titles">
          <h2 className="closed-title">Closed</h2>
          <p className="closed-subtitle">
            {closed.length} closed{" "}
            {closed.length === 1 ? "task" : "tasks"} · auto-clears after{" "}
            {CLOSED_TODO_RETENTION_DAYS} days
          </p>
        </div>
        <div className="closed-header-actions">
          <button
            type="button"
            className="closed-clear-btn"
            onClick={() => setPendingClearAll(true)}
            aria-label="Clear all closed tasks"
          >
            Clear all
          </button>
        </div>
      </header>

      <div className="closed-groups">
        {populatedGroups.map((key) => {
          const rows = groups[key];
          return (
            <section key={key} className="closed-group">
              <h3 className="closed-group-heading">
                <span>{GROUP_LABEL[key]}</span>
                <span className="closed-group-count">{rows.length}</span>
              </h3>
              <ul className="closed-list">
                {rows.map((t) => (
                  <ClosedRow
                    key={t.id}
                    todo={t}
                    allTags={allTags}
                    onReopen={handleReopen}
                    onRequestDelete={setPendingDelete}
                  />
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {closed.length >= CLOSED_TODO_MAX * 0.9 && (
        <p className="closed-cap-warning" role="status">
          {closed.length} of {CLOSED_TODO_MAX} closed-task slots in use.
          Oldest closed tasks will be removed first as new ones arrive.
        </p>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Delete forever"
        confirmLabel="Delete"
        message={
          pendingDeleteTodo ? (
            <>
              Permanently delete <strong>{pendingDeleteTodo.title}</strong>?
              This can't be undone.
            </>
          ) : (
            "Permanently delete this task?"
          )
        }
        onConfirm={() => {
          if (pendingDelete) handleDelete(pendingDelete);
          setPendingDelete(null);
        }}
      />

      <ConfirmDialog
        open={pendingClearAll}
        onClose={() => setPendingClearAll(false)}
        title="Clear all closed tasks"
        confirmLabel="Clear all"
        message={
          <>
            Permanently delete all <strong>{closed.length}</strong> closed{" "}
            {closed.length === 1 ? "task" : "tasks"}? This can't be undone.
          </>
        }
        onConfirm={() => {
          handleClearAll();
          setPendingClearAll(false);
        }}
      />
    </div>
  );
}

/* ─── Row ──────────────────────────────────────────────────────────────── */

interface RowProps {
  todo: Todo;
  allTags: Tag[];
  onReopen: (id: string) => void;
  onRequestDelete: (id: string) => void;
}

function ClosedRow({ todo, allTags, onReopen, onRequestDelete }: RowProps) {
  const tags = useMemo(
    () =>
      todo.tags
        .map((id) => allTags.find((t) => t.id === id))
        .filter((t): t is Tag => t !== undefined),
    [todo.tags, allTags],
  );

  const closedAt =
    todo.closedAt ?? todo.completedAt ?? todo.createdAt ?? Date.now();
  // Recompute "now" inside the row so the timestamp label refreshes on
  // re-render (e.g. when the parent re-renders due to a state change). No
  // ticker — the relative-time prose tolerates being a few seconds stale.
  const timeLabel = formatClosedAt(closedAt, new Date());

  // Show the scope the todo will return to on reopen (the close-time
  // checkpoint). Falls back to the current scope for legacy data without a
  // checkpoint.
  const scope: TodoScope = todo.closedFromScope ?? todo.scope;

  return (
    <li className="closed-item">
      <input
        type="checkbox"
        checked={true}
        onChange={(e) => {
          e.stopPropagation();
          onReopen(todo.id);
        }}
        aria-label={`Reopen: ${todo.title}`}
        title="Click to reopen"
        className="closed-item-check"
      />
      <div className="closed-item-body">
        <div className="closed-item-line">
          <span className="closed-item-title">{todo.title}</span>
          {tags.length > 0 && (
            <span className="closed-item-tags">
              {tags.map((tag) => (
                <TagChip key={tag.id} label={tag.label} color={tag.color} />
              ))}
            </span>
          )}
        </div>
        <div className="closed-item-meta">
          <span className="closed-item-scope">{SCOPE_LABELS[scope]}</span>
          <span className="closed-item-dot" aria-hidden="true">
            ·
          </span>
          <span className="closed-item-time">{timeLabel}</span>
        </div>
      </div>
      <button
        type="button"
        className="closed-item-reopen-btn"
        onClick={(e) => {
          e.stopPropagation();
          onReopen(todo.id);
        }}
        title={`Reopen: ${todo.title}`}
        aria-label={`Reopen: ${todo.title}`}
      >
        Reopen
      </button>
      <button
        type="button"
        className="closed-item-delete"
        onClick={(e) => {
          e.stopPropagation();
          onRequestDelete(todo.id);
        }}
        title={`Delete forever: ${todo.title}`}
        aria-label={`Delete forever: ${todo.title}`}
      >
        ✕
      </button>
    </li>
  );
}
