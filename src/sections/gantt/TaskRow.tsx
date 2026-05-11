import { useEffect, useState } from "react";
import type { GanttTask } from "@/types";
import {
  ROW_H,
  fromDateInput,
  toDateInput,
  type FlatRow,
} from "./ganttUtils";

interface Props {
  row: FlatRow;
  onUpdate: (id: string, patch: Partial<GanttTask>) => Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onToggleCollapse: (id: string) => void | Promise<void>;
}

export function TaskRow({ row, onUpdate, onDelete, onToggleCollapse }: Props) {
  const { task, depth, hasChildren } = row;
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
        >
          {task.collapsed ? "▸" : "▾"}
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
        type="date"
        className="gantt-task-date"
        value={toDateInput(task.startsAt)}
        onChange={(e) => {
          const start = fromDateInput(e.target.value);
          const patch: Partial<GanttTask> = { startsAt: start };
          if (start > task.endsAt) patch.endsAt = start;
          onUpdate(task.id, patch);
        }}
      />
      <input
        type="date"
        className="gantt-task-date"
        value={toDateInput(task.endsAt)}
        min={toDateInput(task.startsAt)}
        onChange={(e) =>
          onUpdate(task.id, { endsAt: fromDateInput(e.target.value) })
        }
      />

      <button
        className="gantt-task-delete"
        onClick={() => onDelete(task.id)}
        title="Delete task"
      >
        ✕
      </button>
    </div>
  );
}
