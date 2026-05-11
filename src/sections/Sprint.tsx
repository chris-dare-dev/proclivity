import { TodoList } from "./TodoList";

export function Sprint() {
  return (
    <TodoList
      scope="sprint"
      placeholder="Sprint backlog item…"
      emptyHint="No sprint items yet. Sprints default to a rolling 2-week window — multi-sprint management is on the roadmap."
    />
  );
}
