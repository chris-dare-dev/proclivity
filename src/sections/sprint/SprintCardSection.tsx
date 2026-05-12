/**
 * SprintCardSection — lazy-loaded active-sprint task render.
 *
 * Handles both card mode and list mode so the entire active-sprint task
 * render is behind a lazy boundary. This keeps SprintManager lean in the
 * initial bundle — SprintManager only renders the sprint header, unassigned
 * group, and this lazy boundary; no card/list branching logic in the hot path.
 *
 * Loaded only on first render of the active sprint section.
 */

import { TodoItem } from "@/components/TodoItem";
import { TagFilterToolbar } from "@/components/TagFilterToolbar";
import { TodoCardSection } from "@/sections/TodoCardSection";
import type { CardLayoutMap, Tag, Todo } from "@/types";
import type { ProclivityState } from "@/types";

interface Props {
  layoutMode: "list" | "card";
  sortedItems: Todo[];
  filteredItems: Todo[];
  allTags: Tag[];
  effectiveActiveTagIds: string[];
  availableTags: Tag[];
  cardLayouts: CardLayoutMap | undefined;
  onToggle: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onEdit: (id: string) => void;
  onToggleFilter: (tagId: string) => void;
  onClearFilter: () => void;
  update: (fn: (s: ProclivityState) => ProclivityState) => Promise<void>;
}

export function SprintCardSection({
  layoutMode,
  sortedItems,
  filteredItems,
  allTags,
  effectiveActiveTagIds,
  availableTags,
  cardLayouts,
  onToggle,
  onDelete,
  onEdit,
  onToggleFilter,
  onClearFilter,
  update,
}: Props) {
  if (layoutMode === "card") {
    return (
      <TodoCardSection
        scope="sprint"
        scopedItems={sortedItems}
        filteredItems={filteredItems}
        allTags={allTags}
        effectiveActiveTagIds={effectiveActiveTagIds}
        availableTags={availableTags}
        cardLayouts={cardLayouts}
        emptyHint="No tasks yet. Add one above."
        onToggle={onToggle}
        onDelete={onDelete}
        onEdit={onEdit}
        onToggleFilter={onToggleFilter}
        onClearFilter={onClearFilter}
        update={update}
      />
    );
  }

  // List mode
  return (
    <>
      <TagFilterToolbar
        availableTags={availableTags}
        activeTagIds={effectiveActiveTagIds}
        totalCount={sortedItems.length}
        filteredCount={filteredItems.length}
        onToggle={onToggleFilter}
        onClearAll={onClearFilter}
      />
      {filteredItems.length === 0 ? (
        <div className="section-empty">
          {effectiveActiveTagIds.length > 0 ? (
            <>
              No tasks in this sprint match the selected tags.{" "}
              <button
                type="button"
                className="inline-clear-link"
                onClick={onClearFilter}
              >
                Clear the filter
              </button>
            </>
          ) : (
            "No tasks yet. Add one above."
          )}
        </div>
      ) : (
        <ul className="todo-list">
          {filteredItems.map((t) => (
            <TodoItem
              key={t.id}
              todo={t}
              allTags={allTags}
              onToggle={onToggle}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          ))}
        </ul>
      )}
    </>
  );
}
