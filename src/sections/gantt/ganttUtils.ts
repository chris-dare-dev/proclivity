import type { GanttTask } from "@/types";

export const DAY_MS = 24 * 60 * 60 * 1000;
export const DAY_PX = 28;
export const ROW_H = 36;
export const HEADER_H = 48;

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function toDateInput(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromDateInput(s: string): number {
  const parts = s.split("-").map(Number);
  // Defensive: <input type="date"> always produces YYYY-MM-DD, but
  // noUncheckedIndexedAccess wants us to prove it.
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return new Date(y, m - 1, d).getTime();
}

export function addDays(ts: number, n: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

export function daysBetween(a: number, b: number): number {
  return Math.round((startOfDay(b) - startOfDay(a)) / DAY_MS);
}

export interface FlatRow {
  task: GanttTask;
  depth: number;
  hasChildren: boolean;
}

export function flattenTasks(tasks: GanttTask[]): FlatRow[] {
  const byParent = new Map<string | undefined, GanttTask[]>();
  for (const t of tasks) {
    const key = t.parentId;
    const list = byParent.get(key) ?? [];
    list.push(t);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.startsAt - b.startsAt);
  }
  const out: FlatRow[] = [];
  const walk = (parentId: string | undefined, depth: number) => {
    const children = byParent.get(parentId) ?? [];
    for (const t of children) {
      const kids = byParent.get(t.id) ?? [];
      out.push({ task: t, depth, hasChildren: kids.length > 0 });
      if (!t.collapsed) walk(t.id, depth + 1);
    }
  };
  walk(undefined, 0);
  return out;
}

export interface ChartBounds {
  start: number;
  end: number;
  days: number;
}

export function chartBounds(tasks: GanttTask[]): ChartBounds {
  const today = startOfDay(Date.now());
  if (tasks.length === 0) {
    return { start: today, end: addDays(today, 14), days: 15 };
  }
  let min = Infinity;
  let max = -Infinity;
  for (const t of tasks) {
    if (t.startsAt < min) min = t.startsAt;
    if (t.endsAt > max) max = t.endsAt;
  }
  const start = startOfDay(addDays(min, -2));
  const end = startOfDay(addDays(max, 2));
  return { start, end, days: daysBetween(start, end) + 1 };
}

export interface MonthSpan {
  label: string;
  startDay: number;
  days: number;
}

export function monthSpans(bounds: ChartBounds): MonthSpan[] {
  const spans: MonthSpan[] = [];
  for (let i = 0; i < bounds.days; i++) {
    const d = new Date(addDays(bounds.start, i));
    const label = d.toLocaleDateString(undefined, {
      month: "short",
      year: "numeric",
    });
    const last = spans[spans.length - 1];
    if (last && last.label === label) last.days += 1;
    else spans.push({ label, startDay: i, days: 1 });
  }
  return spans;
}

/**
 * Collect rootId and all its descendants via DFS.
 * O(n) — builds a children-index map once, then walks it (#42).
 */
export function collectDescendants(
  tasks: GanttTask[],
  rootId: string,
): Set<string> {
  // Build parent → children map once
  const children = new Map<string, string[]>();
  for (const t of tasks) {
    if (t.parentId) {
      const list = children.get(t.parentId) ?? [];
      list.push(t.id);
      children.set(t.parentId, list);
    }
  }
  // DFS from root
  const out = new Set<string>();
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    out.add(id);
    const kids = children.get(id);
    if (kids) stack.push(...kids);
  }
  return out;
}
