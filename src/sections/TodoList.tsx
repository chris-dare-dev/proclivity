/**
 * TodoList — shared todo section used by Today, Sprint-task area, and Long-term.
 *
 * Filter state: owned by this component instance (per-instance useState).
 * Today and Long-term each mount their own TodoList, so each gets its own
 * independent filter — no cross-section state bleed.
 *
 * Transient filter state (not persisted): a newtab page is ephemeral.
 *
 * Card mode: when resolvedSettings(state.settings).layoutMode === "card",
 * the component lazy-loads TodoCardSection which owns all card-mode logic
 * (DraggableCard, CardCanvas, cardLayouts helpers, cascade layout).
 * Default list-mode users pay zero kB for card code at initial paint.
 */

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/storage/useStore";
import { uid } from "@/storage/storage";
import { resolvedSettings } from "@/storage/constants";
import type { Todo, TodoScope } from "@/types";
import type { TodoEditFields } from "@/components/TodoEditModal";
import { TagFilterToolbar } from "@/components/TagFilterToolbar";
import { TodoItem } from "@/components/TodoItem";
import { ClosedScopeCounter } from "@/components/ClosedScopeCounter";

// TodoEditModal is only needed when the user opens the edit dialog — lazy-load
// to keep TagPickerArea (and its tag-color picker) out of the initial chunk.
const TodoEditModal = lazy(() =>
  import("@/components/TodoEditModal").then((m) => ({ default: m.TodoEditModal })),
);
import { filterByTags } from "@/storage/tags";
import {
  closeTodo,
  reopenTodo,
  permanentlyDeleteTodos,
} from "@/storage/closedTodos";
import "./sections.css";

/* ─── Lazy card section — loaded only when layoutMode === "card" ──── */
const TodoCardSection = lazy(() =>
  import("./TodoCardSection").then((m) => ({ default: m.TodoCardSection })),
);

interface Props {
  scope: TodoScope;
  emptyHint: string;
  placeholder: string;
  filter?: (t: Todo) => boolean;
}

export function TodoList({ scope, emptyHint, placeholder, filter }: Props) {
  const { state, update, loading } = useStore();
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  // Transient per-instance filter state — see module docblock
  const [activeTagIds, setActiveTagIds] = useState<string[]>([]);

  const { todos, tags: allTags, sprints, cardLayouts } = state;
  const rs = useMemo(() => resolvedSettings(state.settings), [state.settings]);
  const layoutMode = rs.layoutMode;

  // Memoize filter+sort to avoid running on every render.
  // M3 note: intentionally uses `!t.done` inline rather than the getActiveTodos
  // selector to avoid pulling the selector into the initial chunk budget. The
  // contract is equivalent; see closedTodos.ts for the authoritative definition.
  const scopedItems = useMemo(
    () =>
      todos
        .filter((t) => t.scope === scope && !t.done)
        .filter((t) => (filter ? filter(t) : true))
        .sort((a, b) => b.createdAt - a.createdAt),
    [todos, scope, filter],
  );

  // Count of closed todos in this scope — drives the "N closed →" counter
  // affordance below the input. Cheap linear scan, bounded by retention cap.
  const closedInScopeCount = useMemo(
    () => todos.filter((t) => t.scope === scope && t.done).length,
    [todos, scope],
  );

  // Prune activeTagIds when tags are deleted (covers critique: filter shows ghost chips)
  const effectiveActiveTagIds = useMemo(() => {
    const knownIds = new Set(allTags.map((t) => t.id));
    return activeTagIds.filter((id) => knownIds.has(id));
  }, [activeTagIds, allTags]);

  const filteredItems = useMemo(
    () => filterByTags(scopedItems, effectiveActiveTagIds),
    [scopedItems, effectiveActiveTagIds],
  );

  // Tags that appear on at least one item in this section (toolbar shows these only)
  const availableTags = useMemo(() => {
    const usedIds = new Set(scopedItems.flatMap((t) => t.tags));
    return allTags.filter((tag) => usedIds.has(tag.id));
  }, [scopedItems, allTags]);

  const editingTodo = editingId ? todos.find((t) => t.id === editingId) ?? null : null;

  // m7-s13: hold the last seen editingTodo alive during the modal's exit
  // animation window. When the user closes the modal, editingId flips to
  // null and editingTodo becomes null in the same render — but Modal's
  // AnimatePresence (m7) needs the TodoEditModal subtree to stay mounted
  // for ~180 ms so it can play the exit. `displayEditingTodo` falls back
  // to the ref when editingTodo is null, keeping the render gate truthy.
  // The stale todo is never shown — Modal renders nothing inside the
  // portal while open=false (the AnimatePresence child evaluates to null).
  const lastEditingTodoRef = useRef<Todo | null>(null);
  useEffect(() => {
    if (editingTodo) lastEditingTodoRef.current = editingTodo;
  }, [editingTodo]);
  const displayEditingTodo = editingTodo ?? lastEditingTodoRef.current;

  const add = async () => {
    const title = draft.trim();
    if (!title) return;
    setDraft("");
    await update((s) => ({
      ...s,
      todos: [
        ...s.todos,
        {
          id: uid(),
          title,
          scope,
          done: false,
          createdAt: Date.now(),
          tags: [],
        },
      ],
    }));
  };

  /**
   * Toggle a todo's done state. Routes through the closed-todos helpers so
   * the close → Closed-tab transition is atomic and captures restore
   * checkpoints. See `src/storage/closedTodos.ts` for the closeTodo /
   * reopenTodo semantics.
   *
   * Note: a user typically never sees a done todo in this list (they're
   * filtered out by `scopedItems`). The `reopenTodo` branch covers two
   * edge cases:
   *   1. A race between flipping `done: true` and the next paint.
   *   2. A debug / accessibility surface that displays a done todo for
   *      one frame.
   */
  const toggle = async (id: string) => {
    const t = todos.find((x) => x.id === id);
    if (!t) return;
    await update(t.done ? reopenTodo(id) : closeTodo(id));
  };

  /**
   * Permanent delete from the active section's row-level affordance. Uses
   * the sibling's `permanentlyDeleteTodos` helper which scrubs the
   * associated cardLayouts entry — matches the legacy behavior of this
   * function while keeping the cleanup path centralized.
   */
  const remove = async (id: string) => {
    await update(permanentlyDeleteTodos([id]));
  };

  const handleSave = async (id: string, fields: TodoEditFields) => {
    await update((s) => ({
      ...s,
      todos: s.todos.map((t) => {
        if (t.id !== id) return t;
        return {
          ...t,
          title: fields.title,
          notes: fields.notes || undefined,
          scope: fields.scope,
          sprintId: fields.sprintId,
          tags: fields.tags,
        };
      }),
    }));
  };

  const toggleFilter = (tagId: string) => {
    setActiveTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  };

  return (
    <div>
      <div className="todo-input">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void add()}
          placeholder={placeholder}
        />
        <button onClick={() => void add()}>Add</button>
      </div>

      {/* Closed counter affordance — visible only when there are closed todos
          in this scope. Clicking dispatches the cross-section nav event that
          App.tsx catches to switch to the Closed tab. Suppressed when the
          count is zero so empty sections stay clean. */}
      {closedInScopeCount > 0 && (
        <ClosedScopeCounter count={closedInScopeCount} />
      )}

      {loading ? null : layoutMode === "card" ? (
        /* ── Card mode — lazy-loaded ─────────────────────────────── */
        <Suspense fallback={null}>
          <TodoCardSection
            scope={scope}
            scopedItems={scopedItems}
            filteredItems={filteredItems}
            allTags={allTags}
            effectiveActiveTagIds={effectiveActiveTagIds}
            availableTags={availableTags}
            cardLayouts={cardLayouts}
            emptyHint={emptyHint}
            cardHintSeen={rs.cardHintSeen}
            onToggle={(id) => void toggle(id)}
            onDelete={remove}
            onEdit={(id) => setEditingId(id)}
            onToggleFilter={toggleFilter}
            onClearFilter={() => setActiveTagIds([])}
            onDismissHint={() => {
              void update((s) => ({
                ...s,
                settings: { ...s.settings, cardHintSeen: true },
              }));
            }}
            update={update}
          />
        </Suspense>
      ) : (
        /* ── List mode (default) ─────────────────────────────────── */
        <>
          <TagFilterToolbar
            availableTags={availableTags}
            activeTagIds={effectiveActiveTagIds}
            totalCount={scopedItems.length}
            filteredCount={filteredItems.length}
            onToggle={toggleFilter}
            onClearAll={() => setActiveTagIds([])}
          />

          {filteredItems.length === 0 ? (
            <div className="section-empty">
              {effectiveActiveTagIds.length > 0
                ? (
                  <>
                    No tasks match the selected tags.{" "}
                    <button
                      type="button"
                      className="inline-clear-link"
                      onClick={() => setActiveTagIds([])}
                    >
                      Clear the filter
                    </button>{" "}
                    to see everything.
                  </>
                )
                : emptyHint}
            </div>
          ) : (
            <ul className="todo-list">
              {filteredItems.map((t, idx) => (
                <TodoItem
                  key={t.id}
                  todo={t}
                  allTags={allTags}
                  onToggle={toggle}
                  onDelete={remove}
                  onEdit={(id) => setEditingId(id)}
                  index={idx}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {/* m7-s13 (UPL-4): keep the Suspense + TodoEditModal mounted during
          the exit animation window. Without this, when `editingId` flips
          null, `editingTodo` would derive undefined, the outer guard would
          unmount the Suspense, and AnimatePresence inside Modal would never
          get a chance to play the exit animation. The ref keeps the last-
          seen todo alive; once any item has been edited, the Suspense
          stays mounted for the session (lazy chunk preserves first-open
          deferral; subsequent renders with open=false are cheap — Modal's
          AnimatePresence sees no children and renders nothing). */}
      {displayEditingTodo && (
        <Suspense fallback={null}>
          <TodoEditModal
            open={editingId !== null}
            todo={displayEditingTodo}
            allTags={allTags}
            sprints={sprints}
            onClose={() => setEditingId(null)}
            onSave={handleSave}
          />
        </Suspense>
      )}
    </div>
  );
}

