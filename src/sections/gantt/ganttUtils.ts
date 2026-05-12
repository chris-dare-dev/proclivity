import type { GanttTask } from "@/types";
import {
  DAY_MS,
  addDays,
  daysBetween,
  fromDateInput,
  startOfDay,
  toDateInput,
} from "@/lib/dateUtils";

// Re-export the shared helpers under their historic module path so
// existing callers (ChartView, TaskRow, etc.) keep compiling without
// edits while Calendar imports them from `@/lib/dateUtils` directly.
export { DAY_MS, addDays, daysBetween, fromDateInput, startOfDay, toDateInput };

export const DAY_PX = 28;
export const ROW_H = 36;
export const HEADER_H = 48;

export interface TaskSpan {
  startsAt: number;
  endsAt: number;
}

export interface FlatRow {
  task: GanttTask;
  depth: number;
  hasChildren: boolean;
  /** Parent task if this is a sub-task. Used to clamp/validate date edits. */
  parent: GanttTask | undefined;
  /** Tight union of direct children's [start,end]. Used so a parent edit
   *  cannot shrink the parent below the range its children already span. */
  childrenSpan: TaskSpan | undefined;
}

export function flattenTasks(tasks: GanttTask[]): FlatRow[] {
  const byId = new Map<string, GanttTask>();
  for (const t of tasks) byId.set(t.id, t);

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
      const hasChildren = kids.length > 0;
      let childrenSpan: TaskSpan | undefined;
      if (hasChildren) {
        let min = Infinity;
        let max = -Infinity;
        for (const k of kids) {
          if (k.startsAt < min) min = k.startsAt;
          if (k.endsAt > max) max = k.endsAt;
        }
        childrenSpan = { startsAt: min, endsAt: max };
      }
      const parent = t.parentId ? byId.get(t.parentId) : undefined;
      out.push({ task: t, depth, hasChildren, parent, childrenSpan });
      if (!t.collapsed) walk(t.id, depth + 1);
    }
  };
  walk(undefined, 0);
  return out;
}

/**
 * Parent / child date-containment invariant. For every parent P and direct
 * child C: P.startsAt ≤ C.startsAt AND C.endsAt ≤ P.endsAt.
 *
 * checkBounds evaluates a candidate span against its parent (must contain
 * candidate) and its existing children (candidate must contain them). Returns
 * a human-readable violation or null if the candidate is valid.
 */
export interface BoundsViolation {
  message: string;
}

export function checkBounds(
  candidate: TaskSpan,
  parent: GanttTask | undefined,
  childrenSpan: TaskSpan | undefined,
): BoundsViolation | null {
  if (parent) {
    if (candidate.startsAt < parent.startsAt) {
      return {
        message: `Sub-task cannot start before parent "${parent.title}" (${toDateInput(parent.startsAt)}).`,
      };
    }
    if (candidate.endsAt > parent.endsAt) {
      return {
        message: `Sub-task cannot end after parent "${parent.title}" (${toDateInput(parent.endsAt)}).`,
      };
    }
  }
  if (childrenSpan) {
    if (candidate.startsAt > childrenSpan.startsAt) {
      return {
        message: `Cannot start after the earliest sub-task (${toDateInput(childrenSpan.startsAt)}). Adjust the sub-task first.`,
      };
    }
    if (candidate.endsAt < childrenSpan.endsAt) {
      return {
        message: `Cannot end before the latest sub-task (${toDateInput(childrenSpan.endsAt)}). Adjust the sub-task first.`,
      };
    }
  }
  return null;
}

/**
 * Lookup the direct-children span for a given parent id from a tasks array.
 * Returns undefined when the parent has no children. Used by addTask and the
 * drag handler — both of which don't have a precomputed FlatRow at hand.
 */
export function directChildrenSpan(
  tasks: GanttTask[],
  parentId: string,
): TaskSpan | undefined {
  let min = Infinity;
  let max = -Infinity;
  let any = false;
  for (const t of tasks) {
    if (t.parentId !== parentId) continue;
    any = true;
    if (t.startsAt < min) min = t.startsAt;
    if (t.endsAt > max) max = t.endsAt;
  }
  return any ? { startsAt: min, endsAt: max } : undefined;
}

/**
 * Look up parent and direct-children-span from a tasks list, then evaluate
 * the parent/child date-containment invariant for a candidate edit.
 *
 * This is the single chokepoint for the invariant — callers in ChartView
 * run it INSIDE the storage updater so the parent/children read is atomic
 * with the write. Drag clamping and HTML min/max attributes are UX-level
 * fast paths; if either is buggy or bypassed (typed values, programmatic
 * mutation), this central check still rejects.
 *
 * Pass `candidate.id` so the function can locate the candidate's own
 * children. Pass `candidate.parentId` so it can locate the parent. Either
 * may be omitted for new tasks (which have no children yet) or top-level
 * tasks (which have no parent).
 */
export function findBoundsViolation(
  tasks: GanttTask[],
  candidate: {
    id?: string | undefined;
    parentId?: string | undefined;
    startsAt: number;
    endsAt: number;
  },
): BoundsViolation | null {
  const parent = candidate.parentId
    ? tasks.find((t) => t.id === candidate.parentId)
    : undefined;
  const childrenSpan = candidate.id
    ? directChildrenSpan(tasks, candidate.id)
    : undefined;
  return checkBounds(
    { startsAt: candidate.startsAt, endsAt: candidate.endsAt },
    parent,
    childrenSpan,
  );
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
