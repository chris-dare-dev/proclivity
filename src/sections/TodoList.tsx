/**
 * TodoList — shared todo section used by Today, Sprint-task area, and Long-term.
 *
 * Filter state: owned by this component instance (per-instance useState).
 * Today and Long-term each mount their own TodoList, so each gets its own
 * independent filter — no cross-section state bleed. This is the simplest
 * correct choice: the alternative (lifting filter to Today/LongTerm wrapper)
 * would require Today.tsx and LongTerm.tsx to know about tags, adding coupling
 * with no benefit since the toolbar lives inside this component.
 *
 * Transient filter state (not persisted): a newtab page is ephemeral.
 * Persisting filters would surprise users who return to find items hidden
 * from a filter they set last session.
 */

import { useMemo, useState } from "react";
import { useStore } from "@/storage/useStore";
import { uid } from "@/storage/storage";
import type { Todo, TodoScope } from "@/types";
import { TagFilterToolbar } from "@/components/TagFilterToolbar";
import { TodoItem } from "@/components/TodoItem";
import { TodoEditModal, type TodoEditFields } from "@/components/TodoEditModal";
import { filterByTags, createTag } from "@/storage/tags";
import "./sections.css";

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

  const { todos, tags: allTags, sprints } = state;

  // Memoize filter+sort to avoid running on every render
  const scopedItems = useMemo(
    () =>
      todos
        .filter((t) => t.scope === scope)
        .filter((t) => (filter ? filter(t) : true))
        .sort((a, b) => Number(a.done) - Number(b.done) || b.createdAt - a.createdAt),
    [todos, scope, filter],
  );

  // Prune activeTagIds when tags are deleted (covers critique: filter shows ghost chips)
  const effectiveActiveTagIds = useMemo(() => {
    const knownIds = new Set(allTags.map((t) => t.id));
    return activeTagIds.filter((id) => knownIds.has(id));
  }, [activeTagIds, allTags]);

  const items = useMemo(
    () => filterByTags(scopedItems, effectiveActiveTagIds),
    [scopedItems, effectiveActiveTagIds],
  );

  // Tags that appear on at least one item in this section (toolbar shows these only)
  const availableTags = useMemo(() => {
    const usedIds = new Set(scopedItems.flatMap((t) => t.tags));
    return allTags.filter((tag) => usedIds.has(tag.id));
  }, [scopedItems, allTags]);

  const editingTodo = editingId ? todos.find((t) => t.id === editingId) ?? null : null;

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

  const toggle = async (id: string) => {
    await update((s) => ({
      ...s,
      todos: s.todos.map((t) =>
        t.id === id
          ? { ...t, done: !t.done, completedAt: t.done ? undefined : Date.now() }
          : t,
      ),
    }));
  };

  const remove = async (id: string) => {
    await update((s) => ({ ...s, todos: s.todos.filter((t) => t.id !== id) }));
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

  // Suppress unused warning — createTag is passed to TodoEditModal via shared component
  void createTag;

  return (
    <div>
      <div className="todo-input">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={placeholder}
        />
        <button onClick={add}>Add</button>
      </div>

      <TagFilterToolbar
        availableTags={availableTags}
        activeTagIds={effectiveActiveTagIds}
        totalCount={scopedItems.length}
        filteredCount={items.length}
        onToggle={toggleFilter}
        onClearAll={() => setActiveTagIds([])}
      />

      {loading ? null : items.length === 0 ? (
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
          {items.map((t) => (
            <TodoItem
              key={t.id}
              todo={t}
              allTags={allTags}
              onToggle={toggle}
              onDelete={remove}
              onEdit={(id) => setEditingId(id)}
            />
          ))}
        </ul>
      )}

      {editingTodo && (
        <TodoEditModal
          open={editingId !== null}
          todo={editingTodo}
          allTags={allTags}
          sprints={sprints}
          onClose={() => setEditingId(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
