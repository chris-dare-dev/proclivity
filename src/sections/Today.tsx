import { TodoList } from "./TodoList";

export function Today() {
  return (
    <TodoList
      scope="today"
      placeholder="What's on for today?"
      emptyHint="No tasks for today yet. Add one above."
    />
  );
}
