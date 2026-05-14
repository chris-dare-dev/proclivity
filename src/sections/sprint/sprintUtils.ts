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

/**
 * Default end: start + (days - 1) calendar days (inclusive convention).
 * A 14-day sprint starting Monday ends on Sunday (+13 days).
 * Defaults to 14 days when not specified, matching the historic hardcoded value.
 */
export function defaultEndsAt(
  startsAt: number,
  days: 7 | 14 | 21 | 28 = 14,
): number {
  return addCalendarDays(startsAt, days - 1);
}

/**
 * Sprint is archived when its lifecycle state is `"closed"`
 * (sprint-backlog-redesign-m2). Replaces the legacy `endsAt < today`
 * heuristic — the m1 normalizer in `src/storage/storage.ts` backfills
 * legacy v1 data so this predicate keeps producing the same partition for
 * pre-v2 sprints, but a user-created sprint past its end date that is
 * still in `"active"` stays in the live tabs list (the stale-sprint banner
 * is the nudge to close it).
 */
export function isArchived(sprint: Sprint): boolean {
  return sprint.state === "closed";
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
