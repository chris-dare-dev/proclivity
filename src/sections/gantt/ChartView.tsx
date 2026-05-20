import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  findBoundsViolation,
  flattenTasks,
  fromDateInput,
  monthSpans,
  startOfDay,
  toDateInput,
  type FlatRow,
  type TaskSpan,
} from "./ganttUtils";
import { TaskRow } from "./TaskRow";
import { TextInputModal } from "@/components/Modal";

interface Props {
  chartId: string;
  onDeleteChart: () => void;
  onRenameChart: (name: string) => void;
}

type DragMode = "move" | "resize-start" | "resize-end";

interface DragState {
  taskId: string;
  mode: DragMode;
  startX: number;
  origStartsAt: number;
  origEndsAt: number;
  /** The pointerId captured via setPointerCapture (finding #4) */
  pointerId: number;
  /** Parent span (if any) — clamps so the task cannot leave its parent. */
  parentSpan: TaskSpan | undefined;
  /** Existing direct-children span (if any) — clamps so the task continues
   *  to contain its own children after the drag commits. */
  childrenSpan: TaskSpan | undefined;
}

/** Delta in full days given pixel movement */
function pxToDays(px: number): number {
  return Math.round(px / DAY_PX);
}

/**
 * Width of the drag handle zone on each edge in pixels.
 * Must match .gantt-bar-handle width in gantt.css (finding #30).
 */
export const EDGE_HIT_PX = 6;

export function ChartView({ chartId, onDeleteChart, onRenameChart }: Props) {
  const { state, update } = useStore();
  const chart = state.ganttCharts.find((c) => c.id === chartId);
  const tasks = state.ganttTasks.filter((t) => t.chartId === chartId);
  const rows = flattenTasks(tasks);
  const bounds = useMemo(() => chartBounds(tasks), [tasks]);
  const months = useMemo(() => monthSpans(bounds), [bounds]);
  const today = startOfDay(Date.now());
  const todayOffset = daysBetween(bounds.start, today);

  const [newTitle, setNewTitle] = useState("");
  const [newStart, setNewStart] = useState(toDateInput(today));
  const [newEnd, setNewEnd] = useState(toDateInput(addDays(today, 7)));
  const [newParent, setNewParent] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  /** Chart-level error toast from row edits or drag clamps. Auto-clears. */
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (!editError) return;
    const id = window.setTimeout(() => setEditError(null), 4500);
    return () => window.clearTimeout(id);
  }, [editError]);

  // Rename modal state
  const [showRename, setShowRename] = useState(false);

  // Live drag preview: maps taskId -> { startsAt, endsAt }
  const [dragPreview, setDragPreview] = useState<
    Record<string, { startsAt: number; endsAt: number }>
  >({});
  const dragRef = useRef<DragState | null>(null);

  // Central enforcement point for the parent/child date-containment invariant.
  //
  // Validation runs INSIDE the storage updater so the parent/children read is
  // atomic with the candidate write — no race, no stale closure, no way for
  // a caller to bypass by sending bad dates. Drag clamping, HTML min/max,
  // and the per-row JS guard in TaskRow are UX fast paths layered on top;
  // this is the safety net that guarantees correctness.
  //
  // Non-date patches (title, done, collapsed, etc.) skip the bounds check so
  // an existing-but-already-invalid state (created before validation existed)
  // can still have its title edited without being held hostage.
  const updateTask = useCallback(async (id: string, patch: Partial<GanttTask>) => {
    let violationMsg: string | null = null;
    await update((s) => {
      const current = s.ganttTasks.find((t) => t.id === id);
      if (!current) return s;
      const datesChanging =
        patch.startsAt !== undefined || patch.endsAt !== undefined;
      if (datesChanging) {
        const violation = findBoundsViolation(s.ganttTasks, {
          id: current.id,
          parentId: current.parentId,
          startsAt: patch.startsAt ?? current.startsAt,
          endsAt: patch.endsAt ?? current.endsAt,
        });
        if (violation) {
          violationMsg = violation.message;
          return s;
        }
      }
      return {
        ...s,
        ganttTasks: s.ganttTasks.map((t) =>
          t.id === id ? { ...t, ...patch } : t,
        ),
      };
    });
    if (violationMsg !== null) {
      setEditError(violationMsg);
      return false as const;
    }
    return true as const;
  }, [update]);

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
      // Inline validation instead of alert() (finding #10)
      setAddError("End date must be on or after start date.");
      return;
    }
    // Parent-containment validated atomically inside the updater so the read
    // is never stale (mirrors updateTask). New tasks have no children yet.
    const parentId = newParent || undefined;
    let violationMsg: string | null = null;
    await update((s) => {
      if (parentId) {
        const violation = findBoundsViolation(s.ganttTasks, {
          parentId,
          startsAt: start,
          endsAt: end,
        });
        if (violation) {
          violationMsg = violation.message;
          return s;
        }
      }
      return {
        ...s,
        ganttTasks: [
          ...s.ganttTasks,
          {
            id: uid(),
            chartId,
            parentId,
            title,
            startsAt: start,
            endsAt: end,
            progress: 0,
            done: false,
          },
        ],
      };
    });
    if (violationMsg !== null) {
      setAddError(violationMsg);
      return;
    }
    setAddError(null);
    setNewTitle("");
    // Reset newParent so subsequent tasks aren't silently parented (finding #13)
    setNewParent("");
  };

  const renameChart = () => {
    setShowRename(true);
  };

  // ---- Drag handlers ----

  // The FlatRow carries parent and childrenSpan computed from this render's
  // tasks list, so passing `row` (not just `task`) keeps drag bounds in sync
  // with current state even though this callback is memoized with empty deps.
  const onBarPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, row: FlatRow) => {
      // Don't initiate drag on right-click
      if (e.button !== 0) return;

      const { task, parent, childrenSpan } = row;

      const rect = e.currentTarget.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const barWidth = rect.width;

      let mode: DragMode;
      if (localX <= EDGE_HIT_PX) {
        mode = "resize-start";
      } else if (localX >= barWidth - EDGE_HIT_PX) {
        mode = "resize-end";
      } else {
        mode = "move";
      }

      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();

      const parentSpan: TaskSpan | undefined = parent
        ? { startsAt: parent.startsAt, endsAt: parent.endsAt }
        : undefined;

      dragRef.current = {
        taskId: task.id,
        mode,
        startX: e.clientX,
        origStartsAt: task.startsAt,
        origEndsAt: task.endsAt,
        pointerId: e.pointerId, // store for releasePointerCapture (finding #4)
        parentSpan,
        childrenSpan,
      };

      // Initialize preview to current values
      setDragPreview((prev) => ({
        ...prev,
        [task.id]: { startsAt: task.startsAt, endsAt: task.endsAt },
      }));

      // Hide text selection cursor globally during drag
      document.body.style.userSelect = "none";
    },
    [],
  );

  const onBarPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;

      const deltaPx = e.clientX - drag.startX;
      const deltaDays = pxToDays(deltaPx);

      // Bounds expressed as day-deltas from the originals. ±Infinity means
      // "no constraint from this side." Math.max / Math.min collapses them.
      const parentStartDelta = drag.parentSpan
        ? daysBetween(drag.origStartsAt, drag.parentSpan.startsAt)
        : -Infinity;
      const parentEndDelta = drag.parentSpan
        ? daysBetween(drag.origEndsAt, drag.parentSpan.endsAt)
        : Infinity;
      const childStartDelta = drag.childrenSpan
        ? daysBetween(drag.origStartsAt, drag.childrenSpan.startsAt)
        : Infinity;
      const childEndDelta = drag.childrenSpan
        ? daysBetween(drag.origEndsAt, drag.childrenSpan.endsAt)
        : -Infinity;

      let newStartsAt = drag.origStartsAt;
      let newEndsAt = drag.origEndsAt;

      if (drag.mode === "move") {
        // A single delta shifts both ends. The four constraints fold to:
        //   delta ≥ parentStartDelta   (don't slide left of parent.start)
        //   delta ≤ parentEndDelta     (don't slide right of parent.end)
        //   delta ≤ childStartDelta    (don't slide past earliest child)
        //   delta ≥ childEndDelta      (don't slide before latest child end)
        const minDelta = Math.max(parentStartDelta, childEndDelta);
        const maxDelta = Math.min(parentEndDelta, childStartDelta);
        const clamped = Math.max(minDelta, Math.min(maxDelta, deltaDays));
        newStartsAt = addDays(drag.origStartsAt, clamped);
        newEndsAt = addDays(drag.origEndsAt, clamped);
      } else if (drag.mode === "resize-start") {
        // Only start moves. Upper bound is the lesser of (origEnd - 1day)
        // and the earliest child start. Lower bound is the parent start.
        //
        // Span constraint: origStart + delta ≤ origEnd − 1, so
        //   delta ≤ (origEnd − origStart) − 1 = durationDays − 1.
        const durationDays = daysBetween(drag.origStartsAt, drag.origEndsAt);
        const minDelta = parentStartDelta;
        const maxDelta = Math.min(durationDays - 1, childStartDelta);
        const clamped = Math.max(minDelta, Math.min(maxDelta, deltaDays));
        newStartsAt = addDays(drag.origStartsAt, clamped);
        newEndsAt = drag.origEndsAt;
      } else {
        // resize-end — only end moves.
        // Span constraint: origEnd + delta ≥ origStart + 1, so
        //   delta ≥ (origStart + 1) − origEnd = 1 − durationDays.
        const durationDays = daysBetween(drag.origStartsAt, drag.origEndsAt);
        const minDelta = Math.max(1 - durationDays, childEndDelta);
        const maxDelta = parentEndDelta;
        const clamped = Math.max(minDelta, Math.min(maxDelta, deltaDays));
        newEndsAt = addDays(drag.origEndsAt, clamped);
        newStartsAt = drag.origStartsAt;
      }

      setDragPreview((prev) => ({
        ...prev,
        [drag.taskId]: { startsAt: newStartsAt, endsAt: newEndsAt },
      }));
    },
    [],
  );

  // Include updateTask in deps so it never goes stale (finding #8)
  const onBarPointerUp = useCallback(
    async (_e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      document.body.style.userSelect = "";

      const preview = dragPreview[drag.taskId];
      if (preview) {
        // Persist the final position
        await updateTask(drag.taskId, {
          startsAt: preview.startsAt,
          endsAt: preview.endsAt,
        });
        // Clear preview
        setDragPreview((prev) => {
          const next = { ...prev };
          delete next[drag.taskId];
          return next;
        });
      }
    },
    [dragPreview, updateTask],
  );

  const onBarKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape" && dragRef.current) {
        const drag = dragRef.current;
        dragRef.current = null;
        document.body.style.userSelect = "";
        // Revert preview
        setDragPreview((prev) => {
          const next = { ...prev };
          delete next[drag.taskId];
          return next;
        });
        // Release pointer capture using the stored pointerId (finding #4)
        try {
          (e.currentTarget as HTMLDivElement).releasePointerCapture(
            drag.pointerId,
          );
        } catch {
          // ignore – capture may already be released
        }
      }
    },
    [],
  );

  // Cursor based on position within bar
  const getBarCursor = (barWidth: number, localX: number): string => {
    if (localX <= EDGE_HIT_PX) return "ew-resize";
    if (localX >= barWidth - EDGE_HIT_PX) return "col-resize";
    return "grab";
  };

  const totalWidth = bounds.days * DAY_PX;

  // Memoize the two O(days) render arrays (findings #43, #24)
  const dayHeaderCells = useMemo(
    () =>
      Array.from({ length: bounds.days }, (_, i) => {
        const d = new Date(addDays(bounds.start, i));
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
        const isToday = i === todayOffset;
        return { i, date: d.getDate(), isWeekend, isToday };
      }),
    [bounds.days, bounds.start, todayOffset],
  );

  const dayBgCols = useMemo(
    () =>
      Array.from({ length: bounds.days }, (_, i) => {
        const d = new Date(addDays(bounds.start, i));
        return { i, isWeekend: d.getDay() === 0 || d.getDay() === 6 };
      }),
    [bounds.days, bounds.start],
  );

  // Early return if chart not found (finding #22) — placed after all hooks
  // so hook order remains stable across renders.
  if (!chart) return null;

  return (
    <>
      {/* Rename chart modal */}
      <TextInputModal
        open={showRename}
        onClose={() => setShowRename(false)}
        title="Rename chart"
        placeholder="Chart name…"
        initialValue={chart.name}
        submitLabel="Rename"
        onSubmit={(name) => onRenameChart(name)}
      />

      <div className="gantt-chart">
        <div className="gantt-chart-header">
          <h2 onDoubleClick={renameChart} title="Double-click to rename">
            {chart.name}
          </h2>
          <div className="gantt-chart-actions">
            <button onClick={renameChart}>Rename</button>
            <button className="btn-danger" onClick={onDeleteChart}>
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
            aria-label="Start date"
            value={newStart}
            onChange={(e) => setNewStart(e.target.value)}
          />
          <input
            type="date"
            aria-label="End date"
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
              // Unicode ↳ retained: SVG cannot render inside <option>.
              // See frontend-uplift-2026q2-m3 (icon-system migration carve-out).
              <option key={t.id} value={t.id}>
                {"↳"} {t.title}
              </option>
            ))}
          </select>
          <button onClick={addTask}>Add task</button>
        </div>
        {addError && (
          <div className="gantt-add-error" role="alert">
            {addError}
          </div>
        )}
        {editError && (
          <div className="gantt-add-error gantt-edit-error" role="alert">
            {editError}
          </div>
        )}

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
                  onBoundsError={setEditError}
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
                    {dayHeaderCells.map(({ i, date, isWeekend, isToday }) => (
                      <div
                        key={i}
                        className={`gantt-day${isWeekend ? " weekend" : ""}${isToday ? " today" : ""}`}
                        style={{ width: DAY_PX }}
                      >
                        {date}
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  className="gantt-timeline-body"
                  style={{ height: rows.length * ROW_H }}
                >
                  <div className="gantt-grid-bg">
                    {dayBgCols.map(({ i, isWeekend }) => (
                      <div
                        key={i}
                        className={`gantt-bg-col${isWeekend ? " weekend" : ""}`}
                        style={{ width: DAY_PX }}
                      />
                    ))}
                  </div>

                  {todayOffset >= 0 && todayOffset < bounds.days && (
                    <div
                      className="gantt-today-line"
                      style={{ left: todayOffset * DAY_PX + DAY_PX / 2 }}
                    />
                  )}

                  {rows.map((r, idx) => {
                    const preview = dragPreview[r.task.id];
                    const startsAt = preview ? preview.startsAt : r.task.startsAt;
                    const endsAt = preview ? preview.endsAt : r.task.endsAt;
                    const offset = daysBetween(bounds.start, startsAt);
                    const span = daysBetween(startsAt, endsAt) + 1;
                    const progress = r.task.done ? 100 : r.task.progress;
                    const isDragging = !!preview;
                    return (
                      <div
                        key={r.task.id}
                        className={`gantt-bar${r.task.done ? " done" : ""}${r.depth > 0 ? " child" : ""}${isDragging ? " dragging" : ""}`}
                        style={{
                          top: idx * ROW_H + 6,
                          left: offset * DAY_PX + 2,
                          width: Math.max(span * DAY_PX - 4, 4),
                          height: ROW_H - 12,
                          cursor: isDragging
                            ? dragRef.current?.mode === "move"
                              ? "grabbing"
                              : "ew-resize"
                            : undefined,
                        }}
                        title={`${r.task.title} (${toDateInput(startsAt)} → ${toDateInput(endsAt)})`}
                        // Keyboard-accessible drag target (finding #5)
                        tabIndex={0}
                        role="button"
                        aria-label={`Task: ${r.task.title}, drag to reschedule`}
                        // Pointer events for drag
                        onPointerDown={(e) => onBarPointerDown(e, r)}
                        onPointerMove={onBarPointerMove}
                        onPointerUp={onBarPointerUp}
                        onKeyDown={onBarKeyDown}
                        // Dynamic cursor based on hover position
                        onMouseMove={(e) => {
                          if (dragRef.current) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const localX = e.clientX - rect.left;
                          e.currentTarget.style.cursor = getBarCursor(
                            rect.width,
                            localX,
                          );
                        }}
                        onMouseLeave={(e) => {
                          if (!dragRef.current) {
                            e.currentTarget.style.cursor = "";
                          }
                        }}
                      >
                        {/* Left resize handle */}
                        <div className="gantt-bar-handle gantt-bar-handle-left" />
                        <div
                          className="gantt-bar-progress"
                          style={{ width: `${progress}%` }}
                        />
                        <span className="gantt-bar-label">{r.task.title}</span>
                        {/* Right resize handle */}
                        <div className="gantt-bar-handle gantt-bar-handle-right" />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
