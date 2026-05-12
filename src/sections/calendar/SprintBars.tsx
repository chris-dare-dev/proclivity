import { memo, useMemo } from "react";
import {
  DAYS_PER_WEEK,
  MAX_SPRINT_LANES,
  WEEKS_PER_GRID,
  packSegmentLanes,
  type MonthGridCell,
  type PlacedSegment,
} from "./calendarUtils";
import { toDateInput } from "@/lib/dateUtils";
import type { Sprint, Todo } from "@/types";

// Re-export so callers can import the type from here without reaching into
// calendarUtils (keeps the public surface minimal).
export type { PlacedSegment };

interface SprintBarsProps {
  cells: MonthGridCell[];
  sprints: Sprint[];
  todos: Todo[];
  /** Which sprint id (if any) is currently active in the Sprint tab —
   *  rendered with extra emphasis so the user can spot it at a glance. */
  activeSprintId?: string | undefined;
}

/**
 * Overlay layer that draws multi-day sprint bars on top of the month grid.
 *
 * Layout strategy: each sprint that intersects the grid is assigned a
 * fixed "lane" inside its week-rows so two sprints running in parallel
 * don't visually overlap. Lanes are packed greedily — earliest start
 * wins the lowest lane within each week. Lane packing lives in
 * `calendarUtils.packSegmentLanes` for testability.
 *
 * Lane cap: at most `MAX_SPRINT_LANES` lanes are rendered; additional
 * sprints collapse into a "+N sprints" overflow chip per row.
 *
 * Geometry: bar segments are positioned as percentages of the grid
 * dimensions so the overlay aligns with the underlying CSS-Grid month
 * regardless of viewport width. No JS-driven width measurement is
 * needed, which keeps this component cheap to render.
 *
 * Accessibility: each bar carries `role="img"` with a descriptive
 * `aria-label` so screen-reader users can perceive sprint information.
 */
export const SprintBars = memo(function SprintBars({
  cells,
  sprints,
  todos,
  activeSprintId,
}: SprintBarsProps) {
  // H7: build a Map<id, Sprint> once via useMemo to avoid O(n) .find per segment.
  const sprintById = useMemo(() => {
    const m = new Map<string, Sprint>();
    for (const s of sprints) m.set(s.id, s);
    return m;
  }, [sprints]);

  const todoCountBySprint = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of todos) {
      if (t.sprintId !== undefined) {
        counts.set(t.sprintId, (counts.get(t.sprintId) ?? 0) + 1);
      }
    }
    return counts;
  }, [todos]);

  const { segments } = useMemo(
    () => packSegmentLanes(sprints, cells, activeSprintId),
    [sprints, cells, activeSprintId],
  );

  if (segments.length === 0) return null;

  const colPct = 100 / DAYS_PER_WEEK;
  const rowPct = 100 / WEEKS_PER_GRID;

  return (
    <div className="calendar-bars">
      {segments.map((seg, i) => {
        const left = seg.colStart * colPct;
        const width = seg.colSpan * colPct;
        const top = seg.weekRow * rowPct;
        const isActive = seg.isActive;

        if (seg.overflow) {
          // Overflow chip: "+N sprints" at lane MAX_SPRINT_LANES-1.
          const overflowSeg = seg as PlacedSegment & { overflowNames?: string[] };
          const tooltip = overflowSeg.overflowNames?.join(", ") ?? seg.sprintName;
          return (
            <div
              key={`overflow-${seg.weekRow}-${i}`}
              className="calendar-bar calendar-bar--overflow"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                top: `calc(${top}% + var(--calendar-bar-row-offset, 0px) + ${MAX_SPRINT_LANES - 1} * var(--calendar-bar-stride, 18px))`,
              }}
              title={tooltip}
              role="img"
              aria-label={`${seg.sprintName} hidden in this week`}
            >
              <span className="calendar-bar__label">{seg.sprintName}</span>
            </div>
          );
        }

        const sprint = sprintById.get(seg.sprintId);
        if (!sprint) return null;

        const todoCount = todoCountBySprint.get(sprint.id) ?? 0;
        const dateRange = `${toDateInput(sprint.startsAt)} to ${toDateInput(sprint.endsAt)}`;
        const ariaLabel = `${sprint.name} sprint, ${dateRange}, ${todoCount} ${todoCount === 1 ? "todo" : "todos"}${isActive ? ", active" : ""}`;

        return (
          <div
            key={`${seg.sprintId}-${seg.weekRow}-${i}`}
            className={[
              "calendar-bar",
              isActive ? "calendar-bar--active" : "",
              seg.isStart ? "calendar-bar--start" : "",
              seg.isEnd ? "calendar-bar--end" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{
              left: `${left}%`,
              width: `${width}%`,
              top: `calc(${top}% + var(--calendar-bar-row-offset, 0px) + ${seg.lane} * var(--calendar-bar-stride, 18px))`,
            }}
            title={`${sprint.name} (${todoCount} ${todoCount === 1 ? "todo" : "todos"})`}
            role="img"
            aria-label={ariaLabel}
          >
            {seg.isStart ? (
              <span className="calendar-bar__label">
                {sprint.name}
                {todoCount > 0 ? (
                  <span className="calendar-bar__count">{todoCount}</span>
                ) : null}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
});

