/**
 * TodoCardSection — lazy-loaded card-mode render for TodoList sections.
 *
 * This file is ONLY loaded when layoutMode === "card". It imports DraggableCard,
 * CardCanvas, card.css, and the cardLayouts helpers. All of that stays out of
 * the initial newtab bundle when the user is in the default list mode.
 *
 * Props mirror the slice of TodoList state/handlers that card mode needs.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { CardCanvas } from "@/components/card/CardCanvas";
import { DraggableCard } from "@/components/card/DraggableCard";
import {
  setCardPosition,
  resetCardPositions,
  computeCascadeLayout,
} from "@/storage/cardLayouts";
import type { CardPosition, CardLayoutMap, Tag, Todo } from "@/types";
import { TagChip } from "@/components/TagChip";
import { TodoItem } from "@/components/TodoItem";
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
  onToggle: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onEdit: (id: string) => void;
  onToggleFilter: (tagId: string) => void;
  onClearFilter: () => void;
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
  onToggle,
  onDelete,
  onEdit,
  onToggleFilter,
  onClearFilter,
  update,
}: Props) {
  // Live drag positions — pure local state, no storage writes during drag
  const [localPositions, setLocalPositions] = useState<Record<string, CardPosition>>({});
  // Onboarding hint: shown once per mount (session)
  const [hintDismissed, setHintDismissed] = useState(false);
  const hintShownRef = useRef(false);
  // Canvas ref for width-based layout computation
  const canvasElRef = useRef<HTMLDivElement | null>(null);

  // Max z-index across all cards
  const maxZ = useMemo(() => {
    let max = 0;
    for (const t of scopedItems) {
      const pos = localPositions[t.id] ?? cardLayouts?.[t.id];
      if (pos && pos.z > max) max = pos.z;
    }
    return max;
  }, [scopedItems, localPositions, cardLayouts]);

  // Position resolver: live drag → persisted → fallback 0,0
  const getPosition = useCallback(
    (id: string): CardPosition =>
      localPositions[id] ?? cardLayouts?.[id] ?? { x: 0, y: 0, z: 0 },
    [localPositions, cardLayouts],
  );

  // Ensure initial cascade layout for unsaved items (idempotent — skips already-placed)
  const ensureInitialLayout = useCallback(async () => {
    if (!scopedItems.length) return;
    const unsaved = scopedItems.filter((t) => !cardLayouts?.[t.id]);
    if (!unsaved.length) return;

    const canvasWidth = canvasElRef.current?.offsetWidth ?? 800;
    const cascade = computeCascadeLayout(
      unsaved.map((t) => t.id),
      canvasWidth,
    );

    // Offset below already-placed cards so new items don't overlap
    let offsetY = 0;
    for (const t of scopedItems) {
      const pos = cardLayouts?.[t.id];
      if (pos) offsetY = Math.max(offsetY, pos.y + 150);
    }
    if (offsetY > 0) {
      for (const id of Object.keys(cascade)) {
        const entry = cascade[id];
        if (entry) entry.y += offsetY;
      }
    }

    await update((s) => ({
      ...s,
      cardLayouts: { ...(s.cardLayouts ?? {}), ...cascade },
    }));
  }, [scopedItems, cardLayouts, update]);

  // Canvas height: expand to fit the tallest placed card
  const canvasMinHeight = useMemo(() => {
    let maxY = 400;
    for (const t of scopedItems) {
      const pos = localPositions[t.id] ?? cardLayouts?.[t.id];
      if (pos) maxY = Math.max(maxY, pos.y + 180);
    }
    return maxY;
  }, [scopedItems, localPositions, cardLayouts]);

  // ── Drag handlers ──────────────────────────────────────────────

  const handlePositionChange = useCallback(
    (id: string, pos: CardPosition) => {
      setLocalPositions((prev) => ({ ...prev, [id]: pos }));
    },
    [],
  );

  const handleDragStart = useCallback(
    (id: string) => {
      const newZ = maxZ + 1;
      const current = localPositions[id] ?? cardLayouts?.[id] ?? { x: 0, y: 0, z: 0 };
      setLocalPositions((prev) => ({ ...prev, [id]: { ...current, z: newZ } }));
    },
    [maxZ, localPositions, cardLayouts],
  );

  const handleDragEnd = useCallback(
    async (id: string, pos: CardPosition) => {
      const zPos: CardPosition = { ...pos, z: (localPositions[id]?.z ?? pos.z) };
      await update(setCardPosition(id, zPos));
    },
    [update, localPositions],
  );

  const handleResetLayout = useCallback(async () => {
    const ids = scopedItems.map((t) => t.id);
    setLocalPositions({});
    await update(resetCardPositions(ids));
  }, [scopedItems, update]);

  // ── Onboarding hint ────────────────────────────────────────────
  if (!hintShownRef.current) hintShownRef.current = true;
  const showHint = !hintDismissed;

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
        onPositionChange={handlePositionChange}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        filteredOut={isFilteredOut}
      >
        <div
          className={`task-card${t.done ? " is-done" : ""}`}
          data-item-id={t.id}
        >
          <div className="task-card-header">
            <input
              type="checkbox"
              className="task-card-checkbox"
              checked={t.done}
              onChange={(e) => { e.stopPropagation(); onToggle(t.id); }}
              aria-label={t.done ? `Mark incomplete: ${t.title}` : `Mark complete: ${t.title}`}
            />
            <span className="task-card-title">{t.title}</span>
            <button
              className="task-card-edit"
              onClick={(e) => { e.stopPropagation(); onEdit(t.id); }}
              aria-label={`Edit: ${t.title}`}
              tabIndex={0}
            >
              ✎
            </button>
          </div>
          {t.notes && (
            <p className="task-card-notes" title={t.notes}>
              {t.notes}
            </p>
          )}
          {resolvedTags.length > 0 && (
            <div className="task-card-tags">
              {resolvedTags.slice(0, 3).map((tag) => (
                <TagChip key={tag.id} label={tag.label} color={tag.color} />
              ))}
              {resolvedTags.length > 3 && (
                <span className="task-card-tags-overflow">
                  +{resolvedTags.length - 3}
                </span>
              )}
            </div>
          )}
          <button
            className="task-card-delete"
            onClick={(e) => { e.stopPropagation(); void onDelete(t.id); }}
            aria-label={`Delete: ${t.title}`}
            tabIndex={0}
          >
            ✕
          </button>
        </div>
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
          onClick={() => void handleResetLayout()}
          title="Reset card positions to default"
        >
          ↺ Reset layout
        </button>
      </div>

      {/* Canvas */}
      <CardCanvas ariaLabel={`${scope} tasks canvas`}>
        {/* Ref div to measure canvas width + trigger initial layout */}
        <div
          ref={(el) => {
            canvasElRef.current = el?.parentElement as HTMLDivElement | null;
            if (el && scopedItems.some((t) => !cardLayouts?.[t.id])) {
              void ensureInitialLayout();
            }
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
            Drag cards to rearrange. They snap to a grid.
            <button type="button" onClick={() => setHintDismissed(true)}>
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
