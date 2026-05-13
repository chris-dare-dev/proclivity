/**
 * closedTodos.ts — selectors and atomic state updaters for the Closed pile.
 *
 * The Closed pile is **not** a separate array. It is the subset of
 * `state.todos` with `done === true`. This module is the single canonical
 * boundary between that fact and the rest of the app — every consumer should
 * route through these selectors and updaters so the data shape can evolve
 * without further refactors.
 *
 * Design notes (see `.claude/notes/closed-todos-research-A.md` for the full
 * rationale):
 *
 *  - Closing is reversible and non-destructive. `closeTodo(id)` only flips
 *    `done`, records `closedAt`, and captures `closedFromScope` / `closedFromSprintId`
 *    so reopen can restore the original placement.
 *  - Reopen is a flag flip + scope/sprint validation. Card layout entries
 *    (`state.cardLayouts[id]`) are **preserved** so the user's spatial memory
 *    survives a close/reopen round-trip.
 *  - Permanent delete (the only destructive path) scrubs `cardLayouts[id]`
 *    via `removeCardLayouts` from `resetCardPositions.ts` — keeping the same
 *    lightweight import surface used by SprintManager so this module stays
 *    out of the lazy card-mode chunk.
 *  - `purgeOldClosed()` is idempotent. Running it twice in a row is a no-op
 *    on the second call, which lets us call it freely on every newtab open
 *    AND from the service-worker daily alarm without coordination.
 *
 * Bundle: the selectors and helpers in this file land in the shared chunk
 * (since `TodoList.tsx` will import them). The actual `ClosedTodosView`
 * component lives in `src/components/closed/` and stays out of the initial
 * chunk via Agent B's lazy import.
 */

import type { ProclivityState, Todo, TodoScope } from "@/types";
import {
  CLOSED_TODO_MAX,
  CLOSED_TODO_RETENTION_DAYS,
} from "./constants";
import { removeCardLayouts } from "./resetCardPositions";

const DAY_MS = 24 * 60 * 60 * 1000;

/* ─── Selectors ────────────────────────────────────────────────────────── */

/**
 * Active (non-closed) todos. `state.todos` filtered to `done === false`.
 *
 * Returns a new array (no mutation). Callers usually layer further filters
 * (scope, tag, sprint) on top; doing those first inside this function would
 * just complicate the signature without saving allocations.
 */
export function getActiveTodos(state: ProclivityState): Todo[] {
  return state.todos.filter((t) => !t.done);
}

/**
 * Closed todos, sorted newest-first by `closedAt`.
 *
 * Items without a `closedAt` (defensive; the storage backfill makes this
 * unreachable in normal flow) are sorted to the end so a corrupted state
 * doesn't crash the consumer.
 */
export function getClosedTodos(state: ProclivityState): Todo[] {
  const closed = state.todos.filter((t) => t.done);
  return closed.sort((a, b) => {
    const ax = a.closedAt ?? a.completedAt ?? a.createdAt ?? 0;
    const bx = b.closedAt ?? b.completedAt ?? b.createdAt ?? 0;
    return bx - ax;
  });
}

/**
 * Number of closed todos. Cheap; intended for tab-badge use.
 *
 * Cost note: a single linear scan over `state.todos`. Bounded by the
 * `CLOSED_TODO_MAX` retention cap (500) plus the active todos the user has,
 * so this is effectively O(n) on n ≤ low-thousands.
 */
export function countClosedTodos(state: ProclivityState): number {
  let n = 0;
  for (const t of state.todos) if (t.done) n++;
  return n;
}

/* ─── Updaters ─────────────────────────────────────────────────────────── */

/**
 * Returns an atomic updater that moves a todo into the Closed pile.
 *
 * Idempotent: if the todo is already `done === true`, the updater is a no-op
 * on the closed-ness, but it will still refresh `closedAt`/`completedAt` to
 * the current clock. (Toggling a check-on-then-immediately-off via this helper
 * is not the path the UI takes; that flow uses `reopenTodo`.)
 *
 * Pulls `now` at call time so the timestamps land in a single coherent
 * frame regardless of when the write queue flushes.
 */
export function closeTodo(id: string): (s: ProclivityState) => ProclivityState {
  const now = Date.now();
  return (s) => ({
    ...s,
    todos: s.todos.map((t) => {
      if (t.id !== id) return t;
      const next: Todo = {
        ...t,
        done: true,
        closedAt: now,
        completedAt: t.completedAt ?? now,
      };
      // Capture restore checkpoints **only on the active→closed transition**.
      // Idempotent re-close preserves existing checkpoints (so reopen still
      // restores the pre-close placement, not the post-close fields).
      if (!t.done) {
        next.closedFromScope = t.scope;
        if (t.sprintId !== undefined) next.closedFromSprintId = t.sprintId;
        else delete next.closedFromSprintId;
      }
      return next;
    }),
  });
}

/**
 * Returns an atomic updater that brings a closed todo back to the active pile.
 *
 * Restore semantics:
 *  - Clears `done`, `closedAt`, `completedAt`.
 *  - Restores `scope` from `closedFromScope` if present; falls back to the
 *    current `scope` otherwise (covers legacy data backfilled by `storage.get()`
 *    which doesn't have a checkpoint).
 *  - Restores `sprintId` from `closedFromSprintId` if present AND the sprint
 *    still exists in `state.sprints`. If the sprint was deleted while the todo
 *    was closed, the binding drops; if the original scope was `"sprint"` it
 *    falls back to `"long"` so the todo lands somewhere the user can actually
 *    see it (rather than disappearing into an unassigned-sprint void).
 *  - The matching `cardLayouts[id]` entry, if any, is preserved untouched —
 *    reopening should restore spatial memory.
 *
 * Idempotent on `done === false`: re-running the updater is a no-op besides
 * the harmless removal of (now absent) checkpoint fields.
 */
export function reopenTodo(
  id: string,
): (s: ProclivityState) => ProclivityState {
  return (s) => ({
    ...s,
    todos: s.todos.map((t) => {
      if (t.id !== id) return t;
      let scope: TodoScope = t.closedFromScope ?? t.scope;
      // Resolve target sprint:
      //   1. Prefer the closure checkpoint when its sprint still exists.
      //   2. Else if scope is "sprint" the sprint is gone — promote to long
      //      so the todo doesn't strand in an unreachable bucket.
      //   3. Else keep whatever sprintId the todo carried (covers legacy data
      //      with no checkpoint and a still-valid scope).
      let sprintId: string | undefined;
      if (
        t.closedFromSprintId &&
        s.sprints.some((sp) => sp.id === t.closedFromSprintId)
      ) {
        sprintId = t.closedFromSprintId;
      } else if (scope === "sprint") {
        scope = "long";
      } else {
        sprintId = t.sprintId;
      }
      // Build next defensively (exactOptionalPropertyTypes): start from `t`,
      // overwrite the flipped fields, and explicitly delete the closure
      // checkpoints so a future re-close re-captures fresh values.
      const next: Todo = { ...t, scope, done: false, tags: t.tags };
      if (sprintId !== undefined) next.sprintId = sprintId;
      else delete next.sprintId;
      delete next.closedAt;
      delete next.completedAt;
      delete next.closedFromScope;
      delete next.closedFromSprintId;
      return next;
    }),
  });
}

/**
 * Returns an atomic updater that permanently deletes the given todos and
 * scrubs their card-layout entries. This is the only **destructive** path
 * exposed by this module.
 *
 * Used by:
 *   - The "Delete forever" affordance in `ClosedTodosView`.
 *   - `clearAllClosed()` (which composes this helper internally).
 *   - The `purgeOldClosed()` retention job (same).
 *
 * `cardLayouts` cleanup uses `removeCardLayouts` (full wipe of x/y/z + w/h)
 * to match the existing delete-todo paths in SprintManager / TodoList that
 * already use the same helper.
 */
export function permanentlyDeleteTodos(
  ids: string[],
): (s: ProclivityState) => ProclivityState {
  if (ids.length === 0) return (s) => s;
  const idSet = new Set(ids);
  return (s) => {
    const nextTodos = s.todos.filter((t) => !idSet.has(t.id));
    return removeCardLayouts(ids)({ ...s, todos: nextTodos });
  };
}

/**
 * Returns an atomic updater that permanently deletes **every** closed todo.
 *
 * Mirrors `permanentlyDeleteTodos` in destructiveness — UI callers should
 * gate behind a confirmation dialog (`ConfirmDialog` from `Modal.tsx`).
 */
export function clearAllClosed(): (
  s: ProclivityState,
) => ProclivityState {
  return (s) => {
    const closedIds = s.todos.filter((t) => t.done).map((t) => t.id);
    if (closedIds.length === 0) return s;
    return permanentlyDeleteTodos(closedIds)(s);
  };
}

/* ─── Retention policy ─────────────────────────────────────────────────── */

/**
 * Returns an atomic updater that purges closed todos older than
 * `CLOSED_TODO_RETENTION_DAYS` AND evicts the oldest-by-`closedAt` items past
 * `CLOSED_TODO_MAX`.
 *
 * **Idempotent.** A second consecutive call within the same window is a
 * no-op. This is what lets us safely call it from both the newtab page (on
 * every open) and the service worker (daily alarm) without coordination.
 *
 * Active todos (`done === false`) are never touched. Closed todos missing a
 * `closedAt` are treated as anchored to `completedAt ?? createdAt ?? now`
 * — defensive belt-and-braces against any state that escaped the
 * `storage.get()` backfill (e.g. an in-flight `closeTodo` whose updater
 * ran before the migration could).
 *
 * Pulls `now` at call time so the cutoff reflects when the purge fired,
 * not when the updater was built.
 */
export function purgeOldClosed(): (
  s: ProclivityState,
) => ProclivityState {
  const now = Date.now();
  const cutoff = now - CLOSED_TODO_RETENTION_DAYS * DAY_MS;
  return (s) => {
    const closed = s.todos.filter((t) => t.done);
    if (closed.length === 0) return s;

    // Compute the closed-todo `age anchor` once; reuse for both filters.
    const anchorOf = (t: Todo): number =>
      t.closedAt ?? t.completedAt ?? t.createdAt ?? now;

    // First pass: age-based purge.
    const survivors = closed.filter((t) => anchorOf(t) > cutoff);

    // Second pass: count-cap eviction. Sort newest-first; keep first MAX.
    let kept = survivors;
    if (kept.length > CLOSED_TODO_MAX) {
      kept = [...survivors]
        .sort((a, b) => anchorOf(b) - anchorOf(a))
        .slice(0, CLOSED_TODO_MAX);
    }

    if (kept.length === closed.length) return s; // nothing to do

    const keepIds = new Set(kept.map((t) => t.id));
    const deleteIds: string[] = [];
    for (const t of closed) if (!keepIds.has(t.id)) deleteIds.push(t.id);

    return permanentlyDeleteTodos(deleteIds)(s);
  };
}
