import type { Sprint, Todo } from "@/types";

/** Midnight of today in local time, as a timestamp */
export function todayMidnight(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Default end: start + 13 days (inclusive, so 14 days total) */
export function defaultEndsAt(startsAt: number): number {
  return startsAt + 13 * 24 * 60 * 60 * 1000;
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

/** "Day X of N" — clamped so it never goes negative or beyond N */
export function sprintDayProgress(sprint: Sprint): { day: number; total: number } {
  const now = Date.now();
  const total = Math.round((sprint.endsAt - sprint.startsAt) / (24 * 60 * 60 * 1000)) + 1;
  const day = Math.min(
    total,
    Math.max(1, Math.floor((now - sprint.startsAt) / (24 * 60 * 60 * 1000)) + 1),
  );
  return { day, total };
}

export function sprintTaskStats(todos: Todo[], sprintId: string): { done: number; total: number } {
  const sprintTodos = todos.filter(
    (t) => t.scope === "sprint" && t.sprintId === sprintId,
  );
  return { done: sprintTodos.filter((t) => t.done).length, total: sprintTodos.length };
}
