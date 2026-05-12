import { useMemo, useState } from "react";
import { useStore } from "@/storage/useStore";
import { uid } from "@/storage/storage";
import type { Todo, TodoScope } from "@/types";
import { TodoItem } from "@/components/TodoItem";
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

  // Memoize filter+sort so it doesn't run on every render (#25)
  const items = useMemo(
    () =>
      state.todos
        .filter((t) => t.scope === scope)
        .filter((t) => (filter ? filter(t) : true))
        .sort((a, b) => Number(a.done) - Number(b.done) || b.createdAt - a.createdAt),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.todos, scope, filter],
  );

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

      {loading ? null : items.length === 0 ? (
        <div className="section-empty">{emptyHint}</div>
      ) : (
        <ul className="todo-list">
          {items.map((t) => (
            <TodoItem
              key={t.id}
              todo={t}
              onToggle={toggle}
              onDelete={remove}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
