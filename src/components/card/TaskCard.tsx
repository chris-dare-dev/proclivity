/**
 * TaskCard — shared visual primitive for card-view items.
 *
 * A1 fix: extracted from the duplicated renderCard() functions in
 * TodoCardSection and RemindersCardSection. All three previous duplication
 * sites (todo cards, reminder cards, list-mode reminder items) now compose
 * this single component. Section-specific content (fire-at row, recurrence
 * badge, linked todo) goes in the `extra` slot.
 *
 * Does NOT include DraggableCard wrapping — callers place TaskCard inside
 * whatever positioning primitive they need (DraggableCard, plain div, etc.).
 */

import type { ReactNode } from "react";
import type { Tag } from "@/types";
import { TagChip } from "@/components/TagChip";

export interface TaskCardProps {
  /** Visual title shown in the card header. */
  title: string;
  /** Whether the item is done/fired — adds .is-done class. */
  done?: boolean | undefined;
  /** Optional multi-line notes displayed below the header. */
  notes?: string | undefined;
  /** Resolved Tag objects (not ids) — shows up to 3 + overflow chip. */
  tags: Tag[];
  /** Optional checkbox to the left of the title (todos have one; reminders don't). */
  checkboxProps?: {
    checked: boolean;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    ariaLabel: string;
  } | undefined;
  /** Slot for type-specific metadata rows (fire-at for reminders, etc.). */
  extra?: ReactNode | undefined;
  /** aria-label for the card article element — should describe the item. */
  ariaLabel: string;
  onEdit?: (() => void) | undefined;
  onDelete?: (() => void) | undefined;
  /** data-item-id attribute value for testing / automation. */
  itemId?: string | undefined;
}

export function TaskCard({
  title,
  done,
  notes,
  tags,
  checkboxProps,
  extra,
  ariaLabel,
  onEdit,
  onDelete,
  itemId,
}: TaskCardProps) {
  const hasActions = onEdit !== undefined || onDelete !== undefined;
  return (
    <article
      className={`task-card${done ? " is-done" : ""}`}
      data-item-id={itemId}
      aria-label={ariaLabel}
    >
      <div className="task-card-header">
        {checkboxProps && (
          <input
            type="checkbox"
            className="task-card-checkbox"
            checked={checkboxProps.checked}
            onChange={(e) => { e.stopPropagation(); checkboxProps.onChange(e); }}
            aria-label={checkboxProps.ariaLabel}
          />
        )}
        <span className="task-card-title">{title}</span>
        {hasActions && (
          <div className="task-card-actions">
            {onEdit && (
              <button
                className="task-card-edit"
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                aria-label={`Edit: ${title}`}
                tabIndex={0}
              >
                ✎
              </button>
            )}
            {onDelete && (
              <button
                className="task-card-delete"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                aria-label={`Delete: ${title}`}
                tabIndex={0}
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>
      {extra}
      {notes && (
        <p className="task-card-notes" title={notes}>
          {notes}
        </p>
      )}
      {tags.length > 0 && (
        <div className="task-card-tags">
          {tags.slice(0, 3).map((tag) => (
            <TagChip key={tag.id} label={tag.label} color={tag.color} />
          ))}
          {tags.length > 3 && (
            <span className="task-card-tags-overflow">+{tags.length - 3}</span>
          )}
        </div>
      )}
    </article>
  );
}
