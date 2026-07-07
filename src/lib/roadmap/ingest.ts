/**
 * Pure mapping + the single idempotent reconcile updater for roadmap ingest.
 *
 * No I/O. Everything here is a pure `(ProclivityState) => ProclivityState`
 * transform (or a pure helper), so it is unit-testable in isolation and lands
 * as one atomic `storage.update` write on the caller's side (`sync.syncNow`).
 *
 * Mirror-id scheme (collision-safe vs native `uid()`, which is base36 and never
 * contains `:` or `#`):
 *   - Todo / GanttTask id:  `rm:${srcKey}#${item.id}`
 *   - GanttChart id:        `rm:${srcKey}`            (no `#` → distinguishable)
 *   where `srcKey = ${repo}/${slug}` (contains `/`, never `#`/`:`).
 *
 * Reconcile invariants (design §5):
 *   1. Upsert task/spike todos, overwriting ONLY ingest-owned fields
 *      (title, scope, notes). Never touch user-owned fields (done, tags,
 *      sprintId, completedAt, closedAt, close checkpoints).
 *   2. Dropped items → close their mirror (re-create-then-re-close, since a
 *      closed mirror is not a permanent tombstone: `purgeOldClosed` may evict
 *      it, so reconcile must be able to rebuild it from source).
 *   3. Gantt is replaced wholesale per srcKey with fully-formed GanttTasks
 *      (there is no gantt normalize backfill), with child→parent containment
 *      clamped so later user drags aren't rejected by `findBoundsViolation`.
 *
 * Determinism + field-scoped patches ⇒ re-ingesting identical input yields
 * identical objects (idempotent).
 */

import type {
  GanttChart,
  GanttTask,
  ProclivityState,
  Todo,
} from "@/types";
import { startOfDay } from "@/lib/dateUtils";
import { closeTodo } from "@/storage/closedTodos";
import type { CollectedRoadmap, CompiledItem } from "./types";

/* ─── Mirror-id scheme ──────────────────────────────────────────────────── */

const RM_PREFIX = "rm:";

/** Todo / GanttTask mirror id for a compiled item. */
export function mkTodoId(srcKey: string, itemId: string): string {
  return `${RM_PREFIX}${srcKey}#${itemId}`;
}

/** GanttChart mirror id for a source (no `#`). */
export function mkChartId(srcKey: string): string {
  return `${RM_PREFIX}${srcKey}`;
}

/** True for any roadmap-owned mirror record (todo, task, or chart). */
export function isMirrorId(id: string): boolean {
  return id.startsWith(RM_PREFIX);
}

/**
 * Parse a TASK/todo mirror id back into `{ srcKey, itemId }`. Returns `null`
 * for a chart id (no `#`) or any non-mirror id. Uses `indexOf` (not `split`)
 * so an itemId is never truncated even if it somehow contained a later `#`.
 */
export function parseMirrorId(
  id: string,
): { srcKey: string; itemId: string } | null {
  if (!id.startsWith(RM_PREFIX)) return null;
  const rest = id.slice(RM_PREFIX.length);
  const hash = rest.indexOf("#");
  if (hash < 0) return null; // chart id, not a task/todo
  const srcKey = rest.slice(0, hash);
  const itemId = rest.slice(hash + 1);
  if (!srcKey || !itemId) return null;
  return { srcKey, itemId };
}

/* ─── Item classification ───────────────────────────────────────────────── */

/** Actionable leaves become todos; epics/milestones are structural (gantt-only). */
function isActionable(item: CompiledItem): boolean {
  return item.kind === "task" || item.kind === "spike";
}

/** The valid `TodoScope` values, mirrored here so ingest stays dependency-free. */
const VALID_SCOPES: ReadonlySet<string> = new Set(["today", "sprint", "long"]);

/**
 * The compiled per-item scope override, but ONLY when it is a valid `TodoScope`.
 * The JSON is external/untrusted, so an unrecognized scope falls back to the
 * caller's `defaultScope` rather than producing an invalid todo bucket.
 */
function itemScope(item: CompiledItem): Todo["scope"] | undefined {
  const s = item.proclivity?.scope;
  return s !== undefined && VALID_SCOPES.has(s) ? (s as Todo["scope"]) : undefined;
}

/**
 * An item is mirrored as a Todo unless it explicitly opts out with
 * `proclivity.surface === false`. (It may still become a Gantt bar.)
 */
function surfacesAsTodo(item: CompiledItem): boolean {
  return item.proclivity?.surface !== false;
}

/** A gantt bar needs BOTH endpoints present. */
function isDated(item: CompiledItem): item is CompiledItem & {
  targetStart: number;
  targetEnd: number;
} {
  return (
    typeof item.targetStart === "number" &&
    typeof item.targetEnd === "number"
  );
}

function clampProgress(p: number | undefined): number {
  if (typeof p !== "number" || !Number.isFinite(p)) return 0;
  return Math.max(0, Math.min(100, Math.round(p)));
}

/* ─── Todo upsert (field-scoped, no clobber) ────────────────────────────── */

/**
 * Build a fresh mirror todo. `now` is threaded so the whole reconcile lands in
 * one coherent frame.
 */
function buildTodo(
  mkId: string,
  item: CompiledItem,
  scope: Todo["scope"],
  now: number,
): Todo {
  const t: Todo = {
    id: mkId,
    title: item.title,
    scope,
    done: false,
    createdAt: now,
    tags: [],
  };
  if (item.summary) t.notes = item.summary;
  return t;
}

/**
 * Overwrite ONLY the ingest-owned fields that are safe to overwrite on
 * re-ingest: `title` always, and `notes` **only when the compiler supplies a
 * `summary`**. Everything else is preserved verbatim:
 *   - `scope`/`sprintId` — user re-scoping is honored (a re-ingest must not
 *     force `defaultScope` back and strand a stale `sprintId`); scope is set
 *     from the per-item / default scope on CREATE only.
 *   - user `notes` — never destroyed when `summary` is absent (a summary-less
 *     re-ingest keeps whatever notes the user typed).
 *   - `done`, `tags`, `completedAt`, `closedAt`, close checkpoints, `dueAt`,
 *     `parentId`, `targetDate` — user-owned. We do NOT sync `done` from roadmap
 *     status here (that would fight write-back and clobber a user tick).
 */
function patchTodo(prev: Todo, item: CompiledItem): Todo {
  const next: Todo = { ...prev, title: item.title };
  if (item.summary) next.notes = item.summary;
  return next;
}

/* ─── Gantt build ───────────────────────────────────────────────────────── */

interface PriorTaskFields {
  collapsed?: boolean | undefined;
  color?: string | undefined;
}

/**
 * Replace this srcKey's gantt chart + tasks wholesale. Preserves an existing
 * chart's `createdAt` and existing tasks' `collapsed`/`color`. Emits
 * fully-formed GanttTasks (no gantt normalize backfill exists) and clamps each
 * child into its parent's bounds top-down so `findBoundsViolation` accepts
 * later user drags.
 */
function buildGantt(
  srcKey: string,
  collected: CollectedRoadmap,
  priorCharts: GanttChart[],
  priorTasks: GanttTask[],
  now: number,
): { chart: GanttChart; tasks: GanttTask[] } {
  const chartId = mkChartId(srcKey);
  const priorChart = priorCharts.find((c) => c.id === chartId);
  const priorFields = new Map<string, PriorTaskFields>();
  for (const pt of priorTasks) {
    if (pt.chartId === chartId) {
      priorFields.set(pt.id, { collapsed: pt.collapsed, color: pt.color });
    }
  }

  const chart: GanttChart = {
    id: chartId,
    name: collected.compiled.title || collected.compiled.slug || srcKey,
    createdAt: priorChart?.createdAt ?? now,
  };

  const dated = collected.compiled.items.filter(isDated);
  const datedIds = new Set(dated.map((it) => it.id));

  // Build unclamped tasks first.
  const tasks = new Map<string, GanttTask>();
  for (const item of dated) {
    const id = mkTodoId(srcKey, item.id);
    const startsAt = startOfDay(item.targetStart);
    const endsAt = Math.max(startsAt, startOfDay(item.targetEnd));
    const task: GanttTask = {
      id,
      chartId,
      title: item.title,
      startsAt,
      endsAt,
      progress: clampProgress(item.progress),
      done: item.status === "done",
    };
    // parentId only when the parent is itself dated & mirrored in this chart.
    if (item.parent && datedIds.has(item.parent)) {
      task.parentId = mkTodoId(srcKey, item.parent);
    }
    const prior = priorFields.get(id);
    if (prior?.collapsed !== undefined) task.collapsed = prior.collapsed;
    if (prior?.color !== undefined) task.color = prior.color;
    tasks.set(id, task);
  }

  // Containment clamp, top-down (parents before children) so a child clamps
  // into its already-clamped parent. Depth is the parent-chain length.
  const depthOf = (id: string): number => {
    let d = 0;
    let cur = tasks.get(id);
    const seen = new Set<string>();
    while (cur?.parentId && !seen.has(cur.id)) {
      seen.add(cur.id);
      const parent = tasks.get(cur.parentId);
      if (!parent) break;
      d += 1;
      cur = parent;
    }
    return d;
  };
  const ordered = [...tasks.values()].sort(
    (a, b) => depthOf(a.id) - depthOf(b.id),
  );
  for (const task of ordered) {
    if (!task.parentId) continue;
    const parent = tasks.get(task.parentId);
    if (!parent) continue;
    // Clamp start into [parent.start, parent.end] — the extra `min(_, end)`
    // guards the child-entirely-after-parent case: without it, `start` could
    // snap past `parent.end` and the subsequent `end = max(end, start)` would
    // push `end` past the parent too, tripping `findBoundsViolation`.
    const start = Math.min(
      Math.max(task.startsAt, parent.startsAt),
      parent.endsAt,
    );
    const end = Math.max(Math.min(task.endsAt, parent.endsAt), start);
    task.startsAt = start;
    task.endsAt = end;
  }

  return { chart, tasks: [...tasks.values()] };
}

/* ─── Single-roadmap reconcile ──────────────────────────────────────────── */

function ingestOne(
  collected: CollectedRoadmap,
  now: number,
): (s: ProclivityState) => ProclivityState {
  return (s) => {
    const { srcKey, compiled, prefs } = collected;

    // 1. Upsert task/spike todos (field-scoped). Map preserves order; new
    //    todos append at the end, existing keep their position.
    const byId = new Map<string, Todo>(s.todos.map((t) => [t.id, t] as const));
    for (const item of compiled.items) {
      if (!isActionable(item)) continue;
      // surface===false → never create/refresh a Todo mirror (the item can
      // still be a Gantt bar below); a pre-existing mirror is left untouched.
      if (!surfacesAsTodo(item)) continue;
      const mkId = mkTodoId(srcKey, item.id);
      const prev = byId.get(mkId);
      byId.set(
        mkId,
        prev
          ? patchTodo(prev, item)
          : buildTodo(mkId, item, itemScope(item) ?? prefs.defaultScope, now),
      );
    }
    let next: ProclivityState = { ...s, todos: [...byId.values()] };

    // 2. Dropped → close. The upsert above guarantees the mirror exists first,
    //    so a purged-then-dropped item is re-created and re-closed. closeTodo
    //    is idempotent and preserves existing checkpoints.
    for (const item of compiled.items) {
      if (!isActionable(item) || item.status !== "dropped") continue;
      next = closeTodo(mkTodoId(srcKey, item.id))(next);
    }

    // 3. Gantt replace (or prune when surfacing is off).
    const chartId = mkChartId(srcKey);
    const taskPrefix = `${chartId}#`;
    const keptCharts = next.ganttCharts.filter((c) => c.id !== chartId);
    const keptTasks = next.ganttTasks.filter(
      (t) => t.chartId !== chartId && !t.id.startsWith(taskPrefix),
    );
    if (prefs.surfaceInGantt) {
      const { chart, tasks } = buildGantt(
        srcKey,
        collected,
        next.ganttCharts,
        next.ganttTasks,
        now,
      );
      next = {
        ...next,
        ganttCharts: [...keptCharts, chart],
        ganttTasks: [...keptTasks, ...tasks],
      };
    } else {
      next = { ...next, ganttCharts: keptCharts, ganttTasks: keptTasks };
    }

    return next;
  };
}

/* ─── Public entry ──────────────────────────────────────────────────────── */

/**
 * Fold every collected roadmap's reconcile over the state. Each roadmap only
 * touches its own `srcKey` mirrors (plus appends new todos), so they compose
 * cleanly and land as one atomic write on the `storage.update` side.
 */
export function ingestRoadmaps(
  collected: CollectedRoadmap[],
): (s: ProclivityState) => ProclivityState {
  const now = Date.now();
  return (s) => {
    let next = s;
    for (const roadmap of collected) {
      next = ingestOne(roadmap, now)(next);
    }
    return next;
  };
}
