import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDayDetailsModal,
  DayCell,
  type CalendarDayDetails,
} from "./DayCell";
import { SprintBars } from "./SprintBars";
import {
  buildMonthGrid,
  indexDayItems,
  packSegmentLanes,
  weekdayLabels,
  type CalendarEvent,
  type MonthGridCell,
} from "./calendarUtils";
import type {
  Reminder,
  Sprint,
  Tag,
  TimeFormat,
  Todo,
  WeekStart,
} from "@/types";

interface MonthGridProps {
  compact: boolean;
  monthStart: number;
  weekStart: WeekStart;
  /** Live local-midnight timestamp for "today" — kept up-to-date via a
   *  midnight-tick effect in Calendar.tsx so the Today cell never drifts. */
  today: number;
  reminders: Reminder[];
  todos: Todo[];
  sprints: Sprint[];
  tags: Tag[];
  calendarEvents: CalendarEvent[];
  timeFormat: TimeFormat;
  onRequestCreate: (
    dayTimestamp: number,
    returnFocusTo: HTMLElement,
  ) => void;
  activeSprintId?: string | undefined;
  /** Optional tab-navigation callback passed down from App. When provided,
   *  sprint bars become clickable (M3) and empty-state has actionable links (M4). */
  onTabChange?: ((tab: string) => void) | undefined;
}

/**
 * Renders one calendar month as a 6 × 7 grid of `DayCell`s with a
 * `SprintBars` overlay positioned above. All heavy computation —
 * grid layout, per-cell item indexing, tag lookup — is memoized on
 * the input data.
 *
 * Memo stability: `useStore` returns stable array references when data
 * hasn't changed (setState on subscribe only fires when storage actually
 * updates), so the memo barrier is effective for tab-switch churn.
 * The `today` prop updates once per day via a midnight-tick in Calendar.tsx.
 */
export const MonthGrid = memo(function MonthGrid({
  compact,
  monthStart,
  weekStart,
  today,
  reminders,
  todos,
  sprints,
  tags,
  calendarEvents,
  timeFormat,
  onRequestCreate,
  activeSprintId,
  onTabChange,
}: MonthGridProps) {
  const [dayDetails, setDayDetails] = useState<CalendarDayDetails | null>(null);
  const dayDetailsOpenRef = useRef(false);
  const calendarGridRef = useRef<HTMLDivElement | null>(null);
  const [dayDetailsFocusTarget, setDayDetailsFocusTarget] =
    useState<HTMLElement | null>(null);
  const openDayDetails = useCallback(
    (details: CalendarDayDetails, trigger: HTMLButtonElement) => {
      dayDetailsOpenRef.current = true;
      setDayDetailsFocusTarget(trigger);
      setDayDetails(details);
    },
    [],
  );
  const closeDayDetails = useCallback(() => {
    dayDetailsOpenRef.current = false;
    setDayDetails(null);
  }, []);
  const cells: MonthGridCell[] = useMemo(
    () => buildMonthGrid(monthStart, weekStart, today),
    [monthStart, weekStart, today],
  );

  const dayItems = useMemo(
    () => indexDayItems(cells, reminders, todos, today, calendarEvents),
    [cells, reminders, todos, today, calendarEvents],
  );

  // Day details contain display copies. Close them as soon as any underlying
  // source changes so removed work-calendar titles cannot remain on screen.
  useEffect(() => {
    if (!dayDetailsOpenRef.current) return;
    dayDetailsOpenRef.current = false;
    setDayDetailsFocusTarget(calendarGridRef.current);
    setDayDetails(null);
  }, [calendarEvents, compact, monthStart, reminders, timeFormat, today, todos, weekStart]);

  const tagById = useMemo(() => {
    const m = new Map<string, Tag>();
    for (const t of tags) m.set(t.id, t);
    return m;
  }, [tags]);

  const labels = useMemo(() => weekdayLabels(weekStart), [weekStart]);

  // H2: compute per-row lane counts so each cell can set data-lanes,
  // allowing CSS to apply correct padding-top per row rather than globally.
  const lanesByRow = useMemo(
    () => packSegmentLanes(sprints, cells, activeSprintId).lanesByRow,
    [sprints, cells, activeSprintId],
  );

  // L6: detect empty state — no sprints visible and no cell has any items.
  const isEmpty = useMemo(() => {
    if (sprints.some((s) => {
      // Quick check: sprint overlaps the visible grid window.
      if (cells.length === 0) return false;
      const gridStart = cells[0]!.ts;
      const gridEnd = cells[cells.length - 1]!.ts;
      const sStart = s.startsAt;
      const sEnd = s.endsAt;
      return sEnd >= gridStart && sStart <= gridEnd;
    })) return false;
    for (const items of dayItems.values()) {
      if (
        items.calendarEvents.length > 0 ||
        items.reminders.length > 0 ||
        items.longTermDue.length > 0 ||
        items.todayTodos.length > 0
      ) {
        return false;
      }
    }
    return true;
  }, [sprints, cells, dayItems]);

  return (
    <>
      {/* M2: treat the calendar grid as decorative tabular content in v1.
          role="grid" without full keyboard semantics is worse than no role
          because AT users expect arrow-key navigation that isn't implemented.
          Cells carry aria-label for date context. */}
      <div
        ref={calendarGridRef}
        className="calendar-grid"
        role="group"
        aria-label="Calendar month"
        tabIndex={-1}
      >
        <div className="calendar-grid__header">
          {labels.map((label) => (
            <div key={label} className="calendar-grid__weekday">
              {label}
            </div>
          ))}
        </div>

        <div className="calendar-grid__body">
          <div className="calendar-grid__cells">
            {cells.map((cell) => (
              <DayCell
                key={cell.ts}
                cell={cell}
                items={
                  dayItems.get(cell.ts) ?? {
                    calendarEvents: [],
                    reminders: [],
                    longTermDue: [],
                    todayTodos: [],
                  }
                }
                tagById={tagById}
                lanes={lanesByRow[Math.floor(cell.index / 7)] ?? 0}
                compact={compact}
                timeFormat={timeFormat}
                detailsOpen={dayDetails?.cellTs === cell.ts}
                onOpenDetails={openDayDetails}
                onRequestCreate={onRequestCreate}
              />
            ))}
          </div>
          <SprintBars
            cells={cells}
            sprints={sprints}
            todos={todos}
            {...(activeSprintId !== undefined ? { activeSprintId } : {})}
            {...(onTabChange !== undefined
              ? { onSprintClick: (_id: string) => onTabChange("sprint") }
              : {})}
          />
        </div>
      </div>
      <CalendarDayDetailsModal
        details={dayDetails}
        tagById={tagById}
        returnFocusTo={dayDetailsFocusTarget}
        onClose={closeDayDetails}
      />
      {isEmpty && (
        <p className="calendar-empty-hint">
          {onTabChange !== undefined ? (
            <>
              Nothing scheduled this month.{" "}
              <button
                className="calendar-empty-link"
                onClick={() => onTabChange("sprint")}
              >
                Add a sprint
              </button>{" "}
              or{" "}
              <button
                className="calendar-empty-link"
                onClick={() => onTabChange("reminders")}
              >
                set a reminder
              </button>{" "}
              to populate the calendar.
            </>
          ) : (
            "Nothing scheduled this month — visit Reminders or Sprint to add items."
          )}
        </p>
      )}
    </>
  );
});
