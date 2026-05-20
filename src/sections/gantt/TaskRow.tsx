import { useEffect, useRef, useState } from "react";
import type { GanttTask } from "@/types";
import { ChevronRight, ChevronDown, X } from "lucide-react";
import {
  ROW_H,
  checkBounds,
  fromDateInput,
  toDateInput,
  type FlatRow,
} from "./ganttUtils";

interface Props {
  row: FlatRow;
  /**
   * Returns true on commit, false when the central validator rejected the
   * patch. Callers may use the result to revert local UI state.
   */
  onUpdate: (id: string, patch: Partial<GanttTask>) => Promise<boolean>;
  onDelete: (id: string) => void | Promise<void>;
  onToggleCollapse: (id: string) => void | Promise<void>;
  /** Show a chart-level error toast when the user attempts an out-of-bounds edit. */
  onBoundsError: (message: string) => void;
}

export function TaskRow({
  row,
  onUpdate,
  onDelete,
  onToggleCollapse,
  onBoundsError,
}: Props) {
  const { task, depth, hasChildren, parent, childrenSpan } = row;
  const [title, setTitle] = useState(task.title);

  useEffect(() => {
    setTitle(task.title);
  }, [task.title]);

  const commitTitle = async () => {
    const next = title.trim();
    if (!next) {
      setTitle(task.title);
      return;
    }
    if (next !== task.title) await onUpdate(task.id, { title: next });
  };

  // HTML min/max early prevention. The native date picker will refuse to commit
  // values outside this range, which covers most user paths. The JS validate
  // call below remains as a belt-and-suspenders guard for typed/pasted values.
  const startMin = parent ? toDateInput(parent.startsAt) : undefined;
  const startMax = childrenSpan
    ? toDateInput(childrenSpan.startsAt)
    : undefined;
  const endMin = toDateInput(
    childrenSpan
      ? Math.max(task.startsAt, childrenSpan.endsAt)
      : task.startsAt,
  );
  const endMax = parent ? toDateInput(parent.endsAt) : undefined;

  // Refs to imperatively revert the visible input value when the central
  // validator rejects. The prop `value` doesn't change on rejection, so
  // React's controlled-input reconciliation wouldn't otherwise fire and
  // the user-typed (invalid) date would linger in the DOM until the next
  // unrelated re-render.
  const startInputRef = useRef<HTMLInputElement>(null);
  const endInputRef = useRef<HTMLInputElement>(null);

  const handleStartChange = async (raw: string) => {
    const start = fromDateInput(raw);
    // Preserve the existing auto-bump behavior: if start moves past end,
    // drag the end with it. The validation runs against the resulting span.
    const end = start > task.endsAt ? start : task.endsAt;

    // Fast-path: pre-check against the FlatRow's precomputed bounds so we
    // can surface a clean error without a round-trip. The central validator
    // in ChartView's updateTask is the authoritative safety net.
    const violation = checkBounds(
      { startsAt: start, endsAt: end },
      parent,
      childrenSpan,
    );
    if (violation) {
      onBoundsError(violation.message);
      if (startInputRef.current) {
        startInputRef.current.value = toDateInput(task.startsAt);
      }
      return;
    }
    const patch: Partial<GanttTask> = { startsAt: start };
    if (start > task.endsAt) patch.endsAt = start;
    const ok = await onUpdate(task.id, patch);
    if (!ok && startInputRef.current) {
      startInputRef.current.value = toDateInput(task.startsAt);
    }
  };

  const handleEndChange = async (raw: string) => {
    const end = fromDateInput(raw);
    const violation = checkBounds(
      { startsAt: task.startsAt, endsAt: end },
      parent,
      childrenSpan,
    );
    if (violation) {
      onBoundsError(violation.message);
      if (endInputRef.current) {
        endInputRef.current.value = toDateInput(task.endsAt);
      }
      return;
    }
    const ok = await onUpdate(task.id, { endsAt: end });
    if (!ok && endInputRef.current) {
      endInputRef.current.value = toDateInput(task.endsAt);
    }
  };

  return (
    <div
      className="gantt-task-row"
      style={{ height: ROW_H, paddingLeft: 8 + depth * 14 }}
    >
      {hasChildren ? (
        <button
          className="gantt-chevron"
          onClick={() => onToggleCollapse(task.id)}
          title={task.collapsed ? "Expand" : "Collapse"}
          aria-label={task.collapsed ? "Expand" : "Collapse"}
        >
          {task.collapsed ? <ChevronRight size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
        </button>
      ) : (
        <span className="gantt-chevron" />
      )}

      <input
        type="checkbox"
        checked={task.done}
        onChange={(e) =>
          onUpdate(task.id, {
            done: e.target.checked,
            progress: e.target.checked ? 100 : task.progress,
          })
        }
      />

      <input
        className="gantt-task-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={commitTitle}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setTitle(task.title);
            (e.target as HTMLInputElement).blur();
          }
        }}
      />

      <input
        ref={startInputRef}
        type="date"
        className="gantt-task-date"
        value={toDateInput(task.startsAt)}
        min={startMin}
        max={startMax}
        onChange={(e) => handleStartChange(e.target.value)}
      />
      <input
        ref={endInputRef}
        type="date"
        className="gantt-task-date"
        value={toDateInput(task.endsAt)}
        min={endMin}
        max={endMax}
        onChange={(e) => handleEndChange(e.target.value)}
      />

      <button
        className="gantt-task-delete"
        onClick={() => onDelete(task.id)}
        title={`Delete task: ${task.title}`}
        aria-label={`Delete task: ${task.title}`}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
