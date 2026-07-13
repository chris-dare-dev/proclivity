/*
 * calendarUtils — pure helpers for the Calendar tab.
 *
 * The Calendar renders a fixed-shape month grid (always 6 week-rows ×
 * 7 day-columns = 42 cells, including leading/trailing days from the
 * adjacent months). All layout positions for multi-day sprint bars are
 * computed here so the React components remain dumb renderers.
 *
 * No external dependencies — date math goes through `@/lib/dateUtils`
 * to keep a single source of truth for local-midnight semantics.
 */

import {
  DAY_MS,
  addDays,
  daysBetween,
  fromDateInput,
  startOfDay,
} from "@/lib/dateUtils";
import type { Reminder, Sprint, Todo, WeekStart } from "@/types";
import type { GoogleCalendarEvent } from "@/lib/googleCalendar/types";

/** Total cells rendered per month grid. Stable 6 × 7 layout so the
 *  surrounding chrome never reflows when the month changes. */
export const GRID_CELLS = 42;
export const DAYS_PER_WEEK = 7;
export const WEEKS_PER_GRID = GRID_CELLS / DAYS_PER_WEEK;

/** 0 = Sunday … 6 = Saturday — matches JS `Date.getDay()`. */
export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const WEEKSTART_OFFSET: Record<WeekStart, DayIndex> = {
  sun: 0,
  mon: 1,
  sat: 6,
};

/** Convert a user weekStart preference into the column offset used to
 *  re-align `Date.getDay()` so the chosen day lands at column 0. */
export function weekStartOffset(ws: WeekStart): DayIndex {
  return WEEKSTART_OFFSET[ws];
}

/** Local-midnight first-of-month for the month containing `ts`. */
export function startOfMonth(ts: number): number {
  const d = new Date(ts);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Local-midnight first-of-next-month for the month containing `ts`.
 *  Useful as a half-open `[monthStart, monthEnd)` upper bound. */
export function startOfNextMonth(ts: number): number {
  const d = new Date(ts);
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Whole month-step delta — positive moves forward, negative backward. */
export function addMonths(ts: number, n: number): number {
  const d = new Date(ts);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Compute the local-midnight timestamp of the first grid cell — i.e.
 *  the most recent occurrence of the user's chosen week-start day
 *  on-or-before the first-of-month. */
export function gridStart(monthStart: number, ws: WeekStart): number {
  const offset = weekStartOffset(ws);
  const dow = new Date(monthStart).getDay();
  // Days to subtract so that gridStart's weekday == ws.
  const back = (dow - offset + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  return addDays(monthStart, -back);
}

/** Half-open range covered by the fixed 42-cell month grid. */
export function calendarGridWindow(
  monthStart: number,
  ws: WeekStart,
): { windowStart: number; windowEnd: number } {
  const windowStart = gridStart(monthStart, ws);
  return { windowStart, windowEnd: addDays(windowStart, GRID_CELLS) };
}

export interface MonthGridCell {
  /** Local-midnight timestamp for the cell's day. */
  ts: number;
  /** True for days in the focused month; false for leading/trailing fillers. */
  inMonth: boolean;
  /** True iff this cell represents the device's current local day. */
  isToday: boolean;
  /** 0-41 index in the 6×7 grid. */
  index: number;
}

/**
 * Build the 42-cell month grid for a given month and week-start preference.
 *
 * @param monthStart  Local-midnight first-of-month timestamp.
 * @param ws          User's week-start preference.
 * @param today       Local-midnight timestamp for "today" — passed explicitly
 *                    so the caller can keep it live via a midnight-tick effect
 *                    (rather than sampling Date.now() once on render).
 */
export function buildMonthGrid(
  monthStart: number,
  ws: WeekStart,
  today: number,
): MonthGridCell[] {
  const gs = gridStart(monthStart, ws);
  const nextMonth = startOfNextMonth(monthStart);
  const cells: MonthGridCell[] = [];
  for (let i = 0; i < GRID_CELLS; i++) {
    const ts = addDays(gs, i);
    cells.push({
      ts,
      inMonth: ts >= monthStart && ts < nextMonth,
      isToday: ts === today,
      index: i,
    });
  }
  return cells;
}

/** Localized short weekday labels (e.g. "Mon", "Tue") in the chosen order. */
export function weekdayLabels(ws: WeekStart): string[] {
  const offset = weekStartOffset(ws);
  // Reference week containing a known Sunday (1970-01-04). Add (offset + i)
  // days to step through the week in the user's chosen rotation.
  // 1970-01-04 was a Sunday — anchor the weekday rotation here.
  const refSunday = new Date(1970, 0, 4).getTime();
  const out: string[] = [];
  for (let i = 0; i < DAYS_PER_WEEK; i++) {
    const d = new Date(refSunday + (offset + i) * DAY_MS);
    out.push(d.toLocaleDateString(undefined, { weekday: "short" }));
  }
  return out;
}

/* ───────────────────────── Reminder expansion ─────────────────────── */

/**
 * Expand a reminder's recurrence rule into the set of local-midnight
 * timestamps it fires on within the half-open window `[from, to)`.
 *
 * Recurrence semantics (matches `Reminder.recurrence`):
 *   - "none" / undefined → fires once, on `startOfDay(fireAt)` only.
 *   - "daily"  → fires every day at-or-after `startOfDay(fireAt)`.
 *   - "weekly" → fires on the same weekday as `fireAt`, every 7 days.
 *
 * The window is bounded: callers (Calendar) pass the visible month grid,
 * so cost stays O(weeks-in-window) for weekly and O(days-in-window) for
 * daily — at most 42 days per render.
 */
export function expandReminderDates(
  reminder: Reminder,
  from: number,
  to: number,
): number[] {
  const out: number[] = [];
  const seed = startOfDay(reminder.fireAt);
  const recurrence = reminder.recurrence ?? "none";

  if (recurrence === "none") {
    if (seed >= from && seed < to) out.push(seed);
    return out;
  }

  const stride = recurrence === "weekly" ? 7 : 1;
  // Walk forward from seed in `stride`-day steps until we enter the window,
  // then collect until we leave it. If seed is past the window we yield none.
  // DST-safe: use a while-loop via addDays (calendar-day arithmetic) rather
  // than raw-ms closed-form skip, which diverges by ±1 step across DST transitions.
  let cursor = seed;
  while (cursor < from) cursor = addDays(cursor, stride);
  while (cursor < to) {
    out.push(cursor);
    cursor = addDays(cursor, stride);
  }
  return out;
}

/* ───────────────────────── Sprint bars ────────────────────────────── */

/**
 * One segment of a sprint bar — bars that cross a week boundary are
 * split into multiple segments (one per week-row) so each segment can
 * be absolutely positioned inside its containing week.
 *
 * Interval convention: Sprint intervals are **closed (inclusive)** —
 * `startsAt` is the first day the sprint is active and `endsAt` is the
 * last day (both inclusive). Two back-to-back sprints where sprint A ends
 * on Tuesday and sprint B starts on Tuesday share that day and will be
 * placed on separate lanes by the lane-packer (defensive collision
 * avoidance — `s.colStart <= occupied` treats same-day touch as overlap).
 */
export interface SprintBarSegment {
  sprintId: string;
  /** Which week-row of the 6-row grid this segment belongs to (0-5). */
  weekRow: number;
  /** 0-6 — column index of the segment's first day within its week. */
  colStart: number;
  /** 1-7 — number of day-columns the segment covers. */
  colSpan: number;
  /** True iff this segment starts on the sprint's actual start day
   *  (vs. continuing from the previous week-row). Used to round corners. */
  isStart: boolean;
  /** True iff this segment ends on the sprint's actual end day. */
  isEnd: boolean;
}

/**
 * Compute the segments needed to render a sprint across a month grid.
 *
 * Interval convention: closed (inclusive) — `sprint.startsAt` is the first
 * active day and `sprint.endsAt` is the last active day (both included in
 * the rendered bar). See `SprintBarSegment` for the full semantics note.
 */
export function sprintBarSegments(
  sprint: Sprint,
  cells: MonthGridCell[],
): SprintBarSegment[] {
  if (cells.length === 0) return [];
  const gridStartTs = cells[0]!.ts;
  const gridEndTs = cells[cells.length - 1]!.ts;
  const sprintStart = startOfDay(sprint.startsAt);
  const sprintEnd = startOfDay(sprint.endsAt);

  // Sprint completely outside the grid window — nothing to render.
  if (sprintEnd < gridStartTs || sprintStart > gridEndTs) return [];

  const clippedStart = sprintStart < gridStartTs ? gridStartTs : sprintStart;
  const clippedEnd = sprintEnd > gridEndTs ? gridEndTs : sprintEnd;

  const startIdx = daysBetween(gridStartTs, clippedStart);
  const endIdx = daysBetween(gridStartTs, clippedEnd);

  const segs: SprintBarSegment[] = [];
  let cursor = startIdx;
  while (cursor <= endIdx) {
    const weekRow = Math.floor(cursor / DAYS_PER_WEEK);
    const colStart = cursor % DAYS_PER_WEEK;
    const weekRowEnd = (weekRow + 1) * DAYS_PER_WEEK - 1;
    const segmentEnd = Math.min(endIdx, weekRowEnd);
    const colSpan = segmentEnd - cursor + 1;
    segs.push({
      sprintId: sprint.id,
      weekRow,
      colStart,
      colSpan,
      isStart: cursor === startIdx && sprintStart >= gridStartTs,
      isEnd: segmentEnd === endIdx && sprintEnd <= gridEndTs,
    });
    cursor = segmentEnd + 1;
  }
  return segs;
}

/* ─────────────────────── Lane packing ─────────────────────────────── */

/** Maximum number of lanes rendered before an overflow chip appears. */
export const MAX_SPRINT_LANES = 3;

/** A `SprintBarSegment` with an assigned vertical lane index. */
export interface PlacedSegment extends SprintBarSegment {
  /** 0-based lane index within the week-row. */
  lane: number;
  /** True when this segment is replaced by an overflow "+N sprints" chip. */
  overflow?: boolean | undefined;
  /** Sprint name — duplicated here so renderers don't need a map lookup. */
  sprintName: string;
  /** True iff this sprint is the currently active sprint. */
  isActive: boolean;
}

/**
 * Assign each segment a non-overlapping lane within its week-row using
 * a greedy first-fit. Sprints are ordered by start so the topmost lane
 * is always the earliest-starting sprint visible in the grid.
 *
 * Same-lane-across-rows invariant: a sprint that spans multiple week-rows
 * occupies the *same* lane number in every row it touches, so the bar
 * appears visually continuous. This is enforced by scanning all rows a
 * sprint covers before committing to a lane.
 *
 * Lane cap: when `laneCount` would exceed `MAX_SPRINT_LANES`, additional
 * sprints are replaced by an overflow `PlacedSegment` (one per week-row)
 * at lane `MAX_SPRINT_LANES - 1`. The caller renders these as "+N sprints"
 * chips.
 *
 * Returns:
 *   - `segments`    — placed segments ready for rendering.
 *   - `laneCount`   — total lanes used (capped at MAX_SPRINT_LANES).
 *   - `lanesByRow`  — per-week-row lane count (0-5 index → lane count),
 *                     used by DayCell to set `data-lanes` for correct
 *                     padding (H2 fix).
 */
export function packSegmentLanes(
  sprints: Sprint[],
  cells: MonthGridCell[],
  activeSprintId?: string | undefined,
): {
  segments: PlacedSegment[];
  laneCount: number;
  lanesByRow: number[];
} {
  const sorted = [...sprints].sort((a, b) => a.startsAt - b.startsAt);

  // For each week-row, track which (lane, colEnd) is currently occupied.
  const laneEndsByRow: Map<number, number[]> = new Map();
  // Track how many sprints overflow per week-row so the overflow chip knows
  // how many to announce.
  const overflowCountByRow: Map<number, number> = new Map();
  const overflowSprintNamesByRow: Map<number, string[]> = new Map();
  const out: PlacedSegment[] = [];
  let maxLane = 0;

  for (const sprint of sorted) {
    const segs = sprintBarSegments(sprint, cells);
    if (segs.length === 0) continue;

    // Find the lowest lane free across every row this sprint touches.
    let lane = 0;
    while (true) {
      const conflict = segs.some((s) => {
        const ends = laneEndsByRow.get(s.weekRow) ?? [];
        const occupied = ends[lane];
        if (occupied === undefined) return false;
        // s.colStart <= occupied: adjacent-day touch is treated as overlap
        // (defensive collision avoidance — see SprintBarSegment JSDoc).
        return s.colStart <= occupied;
      });
      if (!conflict) break;
      lane++;
    }

    if (lane >= MAX_SPRINT_LANES) {
      // This sprint overflows — record it per row for the overflow chip.
      for (const s of segs) {
        overflowCountByRow.set(s.weekRow, (overflowCountByRow.get(s.weekRow) ?? 0) + 1);
        const names = overflowSprintNamesByRow.get(s.weekRow) ?? [];
        names.push(sprint.name);
        overflowSprintNamesByRow.set(s.weekRow, names);
      }
      continue;
    }

    for (const s of segs) {
      const ends = laneEndsByRow.get(s.weekRow) ?? [];
      ends[lane] = s.colStart + s.colSpan - 1;
      laneEndsByRow.set(s.weekRow, ends);
      out.push({ ...s, lane, sprintName: sprint.name, isActive: sprint.id === activeSprintId });
    }
    if (lane > maxLane) maxLane = lane;
  }

  // Emit one overflow chip per week-row that has overflow sprints.
  for (const [weekRow, count] of overflowCountByRow) {
    const names = overflowSprintNamesByRow.get(weekRow) ?? [];
    out.push({
      sprintId: `__overflow_${weekRow}`,
      weekRow,
      colStart: 0,
      colSpan: DAYS_PER_WEEK,
      isStart: true,
      isEnd: true,
      lane: MAX_SPRINT_LANES - 1,
      overflow: true,
      sprintName: `+${count} sprints`,
      isActive: false,
      // Store hidden names in a way the renderer can use for tooltip.
      // We encode them as a JSON array in sprintId suffix — the renderer
      // reads them directly from the overflowNames field below.
    } as PlacedSegment & { overflowNames: string[] });
    // TypeScript: cast is safe because the renderer checks `overflow`.
    const last = out[out.length - 1] as PlacedSegment & { overflowNames: string[] };
    last.overflowNames = names;
  }

  // Build lanesByRow: for each of the 6 week-rows, how many lanes are used.
  const lanesByRow: number[] = Array.from({ length: WEEKS_PER_GRID }, (_, row) => {
    const ends = laneEndsByRow.get(row);
    if (!ends) return 0;
    // Count non-undefined entries (= number of occupied lanes in this row).
    return ends.filter((v) => v !== undefined).length;
  });

  return { segments: out, laneCount: maxLane + 1, lanesByRow };
}

/**
 * Convenience wrapper: returns only `lanesByRow` from `packSegmentLanes`.
 * Used when only the per-row padding is needed without placing segments.
 */
export function lanesPerWeekRow(sprints: Sprint[], cells: MonthGridCell[]): number[] {
  return packSegmentLanes(sprints, cells).lanesByRow;
}

/* ─────────────────────── Per-day item indexing ────────────────────── */

/**
 * The set of items that should render inside a single day cell.
 * Sprints intentionally aren't here — they're laid out as overlay
 * bars, not cell content.
 */
export interface DayItems {
  /** Read-only Google Calendar events intersecting this local day. */
  googleEvents: GoogleCalendarEvent[];
  /** Reminders firing on this day (recurrence already expanded). */
  reminders: Reminder[];
  /** Long-term todos whose `dueAt` falls on this day. */
  longTermDue: Todo[];
  /** Today-scope todos — only populated for the cell that equals
   *  today's local date, since the Today scope doesn't carry a date. */
  todayTodos: Todo[];
}

/**
 * Pre-compute, for every cell in the grid, which reminders / long-term
 * todos / today todos should appear inside it. Doing this once per
 * render is cheaper than each DayCell scanning the whole array.
 *
 * @param today  Local-midnight timestamp for "today" — passed explicitly so
 *               the caller keeps it live (H3 midnight-tick). Must match the
 *               value used in `buildMonthGrid`.
 */
export function indexDayItems(
  cells: MonthGridCell[],
  reminders: Reminder[],
  todos: Todo[],
  today: number,
  googleEvents: GoogleCalendarEvent[],
): Map<number, DayItems> {
  const byCellTs = new Map<number, DayItems>();
  for (const c of cells) {
    byCellTs.set(c.ts, {
      googleEvents: [],
      reminders: [],
      longTermDue: [],
      todayTodos: [],
    });
  }
  if (cells.length === 0) return byCellTs;
  const from = cells[0]!.ts;
  const to = addDays(cells[cells.length - 1]!.ts, 1);

  // Google uses half-open intervals. `end - 1ms` prevents an event ending
  // exactly at midnight from leaking into the following day. Multi-day events
  // are repeated into every intersecting visible cell.
  for (const event of googleEvents) {
    let cursor = event.allDay
      ? fromDateInput(event.startDate)
      : startOfDay(event.start);
    const lastDay = event.allDay
      ? addDays(fromDateInput(event.endDateExclusive), -1)
      : startOfDay(event.end - 1);
    if (cursor < from) cursor = from;
    while (cursor <= lastDay && cursor < to) {
      byCellTs.get(cursor)?.googleEvents.push(event);
      cursor = addDays(cursor, 1);
    }
  }
  for (const items of byCellTs.values()) {
    items.googleEvents.sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return a.start - b.start;
    });
  }

  // Reminders — expand recurrence into the window once per reminder.
  for (const r of reminders) {
    for (const ts of expandReminderDates(r, from, to)) {
      byCellTs.get(ts)?.reminders.push(r);
    }
  }

  // Long-term todos — bucket by dueAt's local day (skip completed ones to
  // mirror the today-scope behavior; completed items vanish from the grid).
  // Today-scope todos — pile onto today's cell only.
  for (const t of todos) {
    if (t.scope === "long" && t.dueAt !== undefined && !t.done) {
      const day = startOfDay(t.dueAt);
      byCellTs.get(day)?.longTermDue.push(t);
    } else if (t.scope === "today" && !t.done) {
      // Without a per-todo date, Today tasks always belong on today.
      if (byCellTs.has(today)) {
        byCellTs.get(today)!.todayTodos.push(t);
      }
    }
  }

  return byCellTs;
}

/* ───────────────────────── Misc formatting ────────────────────────── */

/** Localized "May 2026" header for the month. */
export function monthLabel(monthStart: number): string {
  return new Date(monthStart).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

/** True iff `monthStart` is the same month as the device's current date. */
export function isCurrentMonth(monthStart: number): boolean {
  const now = new Date();
  const m = new Date(monthStart);
  return now.getFullYear() === m.getFullYear() && now.getMonth() === m.getMonth();
}
