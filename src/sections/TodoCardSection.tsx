/**
 * TodoCardSection — lazy-loaded card-mode render for TodoList sections.
 *
 * This file is ONLY loaded when layoutMode === "card". It imports DraggableCard,
 * CardCanvas, TaskCard, card.css, and the cardLayouts helpers. All of that stays
 * out of the initial newtab bundle when the user is in the default list mode.
 *
 * A1 fix: uses shared <TaskCard> primitive instead of duplicated card JSX.
 * A2 fix: uses useCardLayout hook for position management instead of ~90
 *   lines of duplicated state/callbacks.
 * A3 fix: DraggableCard onDragStart removed — z managed in useCardLayout
 *   hook via setCardPositionToFront inside the updater (C2 fix).
 * D3 fix: cards rendered as <article> with aria-label via TaskCard.
 *
 * Props mirror the slice of TodoList state/handlers that card mode needs.
 */

import { CardCanvas } from "@/components/card/CardCanvas";
import { DraggableCard } from "@/components/card/DraggableCard";
import { TaskCard } from "@/components/card/TaskCard";
import { useCardLayout } from "@/hooks/useCardLayout";
import type { CardLayoutMap, Tag, Todo } from "@/types";
import { TodoItem } from "@/components/TodoItem";
import { RotateCcw } from "lucide-react";
import { TagFilterToolbar } from "@/components/TagFilterToolbar";

interface Props {
  scope: string;
  scopedItems: Todo[];
  filteredItems: Todo[];
  allTags: Tag[];
  effectiveActiveTagIds: string[];
  availableTags: Tag[];
  cardLayouts: CardLayoutMap | undefined;
  emptyHint: string;
  /** D7/L2: whether the drag hint was already dismissed (persisted per-extension). */
  cardHintSeen: boolean;
  onToggle: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onEdit: (id: string) => void;
  onToggleFilter: (tagId: string) => void;
  onClearFilter: () => void;
  /** D7/L2: called when user dismisses the onboarding hint. */
  onDismissHint: () => void;
  update: (fn: (s: import("@/types").ProclivityState) => import("@/types").ProclivityState) => Promise<void>;
}

export function TodoCardSection({
  scope,
  scopedItems,
  filteredItems,
  allTags,
  effectiveActiveTagIds,
  availableTags,
  cardLayouts,
  emptyHint,
  cardHintSeen,
  onToggle,
  onDelete,
  onEdit,
  onToggleFilter,
  onClearFilter,
  onDismissHint,
  update,
}: Props) {
  // A2: all position management in one hook
  const { getPosition, canvasMinHeight, canvasElRef, handlers } = useCardLayout({
    items: scopedItems,
    cardLayouts,
    update,
  });

  const showHint = !cardHintSeen;

  // ── Per-card render ────────────────────────────────────────────
  const renderCard = (t: Todo) => {
    const resolvedTags = t.tags
      .map((id) => allTags.find((tag) => tag.id === id))
      .filter((tag): tag is Tag => tag !== undefined);
    const isFilteredOut =
      effectiveActiveTagIds.length > 0 && !filteredItems.some((fi) => fi.id === t.id);

    return (
      <DraggableCard
        key={t.id}
        itemId={t.id}
        position={getPosition(t.id)}
        onPositionChange={handlers.onPositionChange}
        onDragEnd={handlers.onDragEnd}
        onResize={(id, size) => void handlers.commitSize(id, size)}
        filteredOut={isFilteredOut}
      >
        {/* A1+D3: shared TaskCard primitive with role="article" + aria-label */}
        <TaskCard
          title={t.title}
          done={t.done}
          notes={t.notes}
          tags={resolvedTags}
          itemId={t.id}
          ariaLabel={`${t.title}${t.done ? " (done)" : ""}`}
          checkboxProps={{
            checked: t.done,
            onChange: () => onToggle(t.id),
            ariaLabel: t.done ? `Mark incomplete: ${t.title}` : `Mark complete: ${t.title}`,
          }}
          onEdit={() => onEdit(t.id)}
          onDelete={() => void onDelete(t.id)}
        />
      </DraggableCard>
    );
  };

  return (
    <>
      {/* Toolbar row: filter + reset button */}
      <div className="card-toolbar-row">
        <TagFilterToolbar
          availableTags={availableTags}
          activeTagIds={effectiveActiveTagIds}
          totalCount={scopedItems.length}
          filteredCount={filteredItems.length}
          onToggle={onToggleFilter}
          onClearAll={onClearFilter}
        />
        <button
          type="button"
          className="card-reset-btn"
          onClick={() => void handlers.onResetLayout()}
          title="Reset card positions to default (preserves card sizes)"
        >
          <RotateCcw size={13} aria-hidden="true" /> Reset layout
        </button>
      </div>

      {/* Canvas */}
      <CardCanvas ariaLabel={`${scope} tasks canvas`}>
        {/* Canvas width measurement ref */}
        <div
          ref={(el) => {
            canvasElRef.current = el?.parentElement as HTMLDivElement | null;
          }}
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        />
        {/* Canvas height sentinel */}
        <div style={{ height: canvasMinHeight, pointerEvents: "none" }} />

        {scopedItems.length === 0 ? (
          <div
            className="section-empty"
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
              whiteSpace: "nowrap",
            }}
          >
            {emptyHint}
          </div>
        ) : (
          scopedItems.map(renderCard)
        )}

        {showHint && scopedItems.length > 0 && (
          <div className="card-onboarding-hint">
            Drag to rearrange · drag bottom-right corner to resize · Shift+Arrow resizes by one step.
            <button type="button" onClick={onDismissHint}>
              Got it
            </button>
          </div>
        )}
      </CardCanvas>

      {/* Narrow-viewport fallback list (shown at <600px via CSS) */}
      <ul className="todo-list card-fallback-list">
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
    </>
  );
}
