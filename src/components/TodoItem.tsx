/**
 * TodoItem — shared row used by TodoList (Today / Long-term) and SprintManager.
 *
 * Edit affordance: pencil button is always in the DOM and tab order.
 * It is visually hidden at rest via opacity:0 + pointer-events:none
 * (NOT visibility:hidden — that removes from a11y tree and tab order,
 * per CRITICAL fix #9 from the critique). Visible on :hover/:focus-within
 * of the parent <li>.
 *
 * Click propagation: the checkbox and delete button call e.stopPropagation()
 * defensively so a future row-level click handler won't double-fire.
 */

import type { CSSProperties } from "react";
import type { Tag, Todo } from "@/types";
import { Pencil, X } from "lucide-react";
import { TagChip } from "./TagChip";

interface TodoItemProps {
  todo: Todo;
  /** Global tags registry for resolving tag ids to labels/colors. */
  allTags: Tag[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  /** When provided, the pencil edit button is rendered. */
  onEdit?: ((id: string) => void) | undefined;
  /**
   * Zero-based position in the parent .todo-list. When set, the row gets
   * a CSS custom property `--stagger-idx` (capped at 9) so the section's
   * stagger-fade-up animation (sections.css) computes its per-item delay.
   * Capped at 9 means lists with 11+ items collapse to a single final
   * delay step rather than producing a slow tail — m5-s9 / UPL-3.
   */
  index?: number | undefined;
}

/**
 * Shared row used by TodoList (Today / Long-term) and SprintManager.
 * Renders checkbox + title + tag chips + optional edit button + delete button.
 * Wrap with <ul className="todo-list"> at the call site.
 */
export function TodoItem({ todo, allTags, onToggle, onDelete, onEdit, index }: TodoItemProps) {
  // Resolve tag objects — skip orphan ids silently (handles stale refs after
  // tag deletion if the cascade hasn't propagated to local state yet)
  const tags = todo.tags
    .map((id) => allTags.find((t) => t.id === id))
    .filter((t): t is Tag => t !== undefined);

  // Stagger-reveal style — only emitted when `index` is provided (avoids
  // an empty `style={}` prop and keeps the inline-style payload minimal).
  // The cast is required because React.CSSProperties does not include
  // CSS custom properties in its type signature.
  const staggerStyle: CSSProperties | undefined =
    index !== undefined
      ? ({ "--stagger-idx": Math.min(index, 9) } as CSSProperties)
      : undefined;

  return (
    <li
      className={`todo-item ${todo.done ? "done" : ""}`}
      style={staggerStyle}
    >
      <input
        type="checkbox"
        checked={todo.done}
        onChange={(e) => {
          e.stopPropagation();
          onToggle(todo.id);
        }}
      />
      <span className="todo-title">{todo.title}</span>
      {tags.length > 0 && (
        <span className="todo-item-tags">
          {tags.map((tag) => (
            <TagChip key={tag.id} label={tag.label} color={tag.color} />
          ))}
        </span>
      )}
      {onEdit && (
        <button
          className="todo-edit"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(todo.id);
          }}
          aria-label={`Edit: ${todo.title}`}
          title={`Edit: ${todo.title}`}
          tabIndex={0}
        >
          <Pencil size={14} aria-hidden="true" />
        </button>
      )}
      <button
        className="todo-delete"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(todo.id);
        }}
        title={`Delete: ${todo.title}`}
        aria-label={`Delete: ${todo.title}`}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </li>
  );
}
