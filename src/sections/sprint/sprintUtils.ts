import type { Sprint, Todo } from "@/types";

/** Add `n` calendar days to a local-midnight timestamp (DST-safe). */
function addCalendarDays(ts: number, n: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

/**
 * Count whole calendar days between two local-midnight timestamps (DST-safe).
 * Rounds to nearest day so a 23-hour DST gap counts as 1 day, not 0.
 */
function calendarDaysBetween(a: number, b: number): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((b - a) / msPerDay);
}

/** Midnight of today in local time, as a timestamp */
export function todayMidnight(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Default end: start + 13 days (inclusive, so 14 days total) */
export function defaultEndsAt(startsAt: number): number {
  return addCalendarDays(startsAt, 13);
}

export function isArchived(sprint: Sprint): boolean {
  return sprint.endsAt < todayMidnight();
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function sprintDateRange(sprint: Sprint): string {
  return `${formatDate(sprint.startsAt)} – ${formatDate(sprint.endsAt)}`;
}

/** "Day X of N" — clamped so it never goes negative or beyond N (DST-safe via #12) */
export function sprintDayProgress(sprint: Sprint): { day: number; total: number } {
  const nowMidnight = todayMidnight();
  // Use calendar-day subtraction so DST transitions don't shift counts (#12)
  const total = calendarDaysBetween(sprint.startsAt, sprint.endsAt) + 1;
  const elapsed = calendarDaysBetween(sprint.startsAt, nowMidnight) + 1;
  const day = Math.min(total, Math.max(1, elapsed));
  return { day, total };
}

export function sprintTaskStats(todos: Todo[], sprintId: string): { done: number; total: number } {
  const sprintTodos = todos.filter(
    (t) => t.scope === "sprint" && t.sprintId === sprintId,
  );
  return { done: sprintTodos.filter((t) => t.done).length, total: sprintTodos.length };
}
