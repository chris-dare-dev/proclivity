import type { Todo } from "@/types";

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

/**
 * Shared row used by TodoList (Today / Long-term) and SprintManager.
 * Renders the checkbox + title + delete button — wrap with the right
 * <ul className="todo-list"> container at the call site.
 */
export function TodoItem({ todo, onToggle, onDelete }: TodoItemProps) {
  return (
    <li className={`todo-item ${todo.done ? "done" : ""}`}>
      <input
        type="checkbox"
        checked={todo.done}
        onChange={() => onToggle(todo.id)}
      />
      <span className="todo-title">{todo.title}</span>
      <button
        className="todo-delete"
        onClick={() => onDelete(todo.id)}
        title={`Delete: ${todo.title}`}
        aria-label={`Delete: ${todo.title}`}
      >
        ✕
      </button>
    </li>
  );
}
