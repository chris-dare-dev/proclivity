import { useMemo, useState } from "react";
import { useStore } from "@/storage/useStore";
import { uid } from "@/storage/storage";
import type { Todo, TodoScope } from "@/types";
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
            <li
              key={t.id}
              className={`todo-item ${t.done ? "done" : ""}`}
            >
              <input
                type="checkbox"
                checked={t.done}
                onChange={() => toggle(t.id)}
              />
              <span className="todo-title">{t.title}</span>
              <button
                className="todo-delete"
                onClick={() => remove(t.id)}
                title={`Delete: ${t.title}`}
                aria-label={`Delete: ${t.title}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
