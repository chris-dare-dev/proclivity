import { useState } from "react";
import { useStore } from "@/storage/useStore";
import { uid } from "@/storage/storage";
import type { GanttTask } from "@/types";
import {
  DAY_PX,
  HEADER_H,
  ROW_H,
  addDays,
  chartBounds,
  collectDescendants,
  daysBetween,
  flattenTasks,
  fromDateInput,
  monthSpans,
  startOfDay,
  toDateInput,
} from "./ganttUtils";
import { TaskRow } from "./TaskRow";

interface Props {
  chartId: string;
  onDeleteChart: () => void;
  onRenameChart: (name: string) => void;
}

export function ChartView({ chartId, onDeleteChart, onRenameChart }: Props) {
  const { state, update } = useStore();
  const chart = state.ganttCharts.find((c) => c.id === chartId);
  const tasks = state.ganttTasks.filter((t) => t.chartId === chartId);
  const rows = flattenTasks(tasks);
  const bounds = chartBounds(tasks);
  const months = monthSpans(bounds);
  const today = startOfDay(Date.now());
  const todayOffset = daysBetween(bounds.start, today);

  const [newTitle, setNewTitle] = useState("");
  const [newStart, setNewStart] = useState(toDateInput(today));
  const [newEnd, setNewEnd] = useState(toDateInput(addDays(today, 7)));
  const [newParent, setNewParent] = useState("");

  const updateTask = async (id: string, patch: Partial<GanttTask>) => {
    await update((s) => ({
      ...s,
      ganttTasks: s.ganttTasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  };

  const deleteTask = async (id: string) => {
    const all = collectDescendants(tasks, id);
    await update((s) => ({
      ...s,
      ganttTasks: s.ganttTasks.filter((t) => !all.has(t.id)),
    }));
  };

  const toggleCollapse = async (id: string) => {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    await updateTask(id, { collapsed: !t.collapsed });
  };

  const addTask = async () => {
    const title = newTitle.trim();
    if (!title) return;
    const start = fromDateInput(newStart);
    const end = fromDateInput(newEnd);
    if (end < start) {
      alert("End date must be on or after start date.");
      return;
    }
    setNewTitle("");
    await update((s) => ({
      ...s,
      ganttTasks: [
        ...s.ganttTasks,
        {
          id: uid(),
          chartId,
          parentId: newParent || undefined,
          title,
          startsAt: start,
          endsAt: end,
          progress: 0,
          done: false,
        },
      ],
    }));
  };

  const renameChart = () => {
    const next = window.prompt("Rename chart", chart?.name ?? "")?.trim();
    if (next) onRenameChart(next);
  };

  const totalWidth = bounds.days * DAY_PX;

  return (
    <div className="gantt-chart">
      <div className="gantt-chart-header">
        <h2 onDoubleClick={renameChart} title="Double-click to rename">
          {chart?.name ?? "Chart"}
        </h2>
        <div className="gantt-chart-actions">
          <button onClick={renameChart}>Rename</button>
          <button className="gantt-delete" onClick={onDeleteChart}>
            Delete chart
          </button>
        </div>
      </div>

      <div className="gantt-add-row">
        <input
          placeholder="New task…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTask()}
        />
        <input
          type="date"
          value={newStart}
          onChange={(e) => setNewStart(e.target.value)}
        />
        <input
          type="date"
          value={newEnd}
          min={newStart}
          onChange={(e) => setNewEnd(e.target.value)}
        />
        <select
          value={newParent}
          onChange={(e) => setNewParent(e.target.value)}
        >
          <option value="">(top-level)</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              ↳ {t.title}
            </option>
          ))}
        </select>
        <button onClick={addTask}>Add task</button>
      </div>

      {rows.length === 0 ? (
        <div className="section-empty">
          No tasks yet. Add one above to populate the timeline.
        </div>
      ) : (
        <div className="gantt-grid">
          <div className="gantt-grid-left">
            <div className="gantt-headcell" style={{ height: HEADER_H }}>
              Task
            </div>
            {rows.map((r) => (
              <TaskRow
                key={r.task.id}
                row={r}
                onUpdate={updateTask}
                onDelete={deleteTask}
                onToggleCollapse={toggleCollapse}
              />
            ))}
          </div>

          <div className="gantt-grid-right">
            <div className="gantt-timeline" style={{ width: totalWidth }}>
              <div
                className="gantt-timeline-header"
                style={{ height: HEADER_H }}
              >
                <div className="gantt-month-row">
                  {months.map((m, i) => (
                    <div
                      key={i}
                      className="gantt-month"
                      style={{
                        left: m.startDay * DAY_PX,
                        width: m.days * DAY_PX,
                      }}
                    >
                      {m.label}
                    </div>
                  ))}
                </div>
                <div className="gantt-day-row">
                  {Array.from({ length: bounds.days }).map((_, i) => {
                    const d = new Date(addDays(bounds.start, i));
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    const isToday = i === todayOffset;
                    return (
                      <div
                        key={i}
                        className={`gantt-day ${isWeekend ? "weekend" : ""} ${
                          isToday ? "today" : ""
                        }`}
                        style={{ width: DAY_PX }}
                      >
                        {d.getDate()}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div
                className="gantt-timeline-body"
                style={{ height: rows.length * ROW_H }}
              >
                <div className="gantt-grid-bg">
                  {Array.from({ length: bounds.days }).map((_, i) => {
                    const d = new Date(addDays(bounds.start, i));
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <div
                        key={i}
                        className={`gantt-bg-col ${
                          isWeekend ? "weekend" : ""
                        }`}
                        style={{ width: DAY_PX }}
                      />
                    );
                  })}
                </div>

                {todayOffset >= 0 && todayOffset < bounds.days && (
                  <div
                    className="gantt-today-line"
                    style={{ left: todayOffset * DAY_PX + DAY_PX / 2 }}
                  />
                )}

                {rows.map((r, idx) => {
                  const offset = daysBetween(bounds.start, r.task.startsAt);
                  const span = daysBetween(r.task.startsAt, r.task.endsAt) + 1;
                  const progress = r.task.done ? 100 : r.task.progress;
                  return (
                    <div
                      key={r.task.id}
                      className={`gantt-bar ${r.task.done ? "done" : ""} ${
                        r.depth > 0 ? "child" : ""
                      }`}
                      style={{
                        top: idx * ROW_H + 6,
                        left: offset * DAY_PX + 2,
                        width: Math.max(span * DAY_PX - 4, 4),
                        height: ROW_H - 12,
                      }}
                      title={`${r.task.title} (${toDateInput(
                        r.task.startsAt,
                      )} → ${toDateInput(r.task.endsAt)})`}
                    >
                      <div
                        className="gantt-bar-progress"
                        style={{ width: `${progress}%` }}
                      />
                      <span className="gantt-bar-label">{r.task.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
