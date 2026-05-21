import LongTermEmpty from "@/components/illustrations/LongTermEmpty";
import { TodoList } from "./TodoList";

export function LongTerm() {
  return (
    <TodoList
      scope="long"
      placeholder="A goal or initiative…"
      emptyHint="No long-term goals yet. Capture the big stuff here."
      emptyIllustration={(focusInput) => (
        <LongTermEmpty onAddTask={focusInput} />
      )}
    />
  );
}
