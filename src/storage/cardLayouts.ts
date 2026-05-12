/**
 * cardLayouts.ts — atomic state updaters for card-view position data.
 *
 * These functions return updater functions suitable for `storage.update()` /
 * the `update()` hook returned by `useStore()`. All position data lives in
 * `ProclivityState.cardLayouts` — a separate map keyed by item id. This keeps
 * the `Todo` and `Reminder` shapes clean and requires zero migration when
 * items were created before card-mode existed.
 *
 * The CARD_GRID_SIZE constant (8 px) is in constants.ts and shared with
 * DraggableCard. Snap math is done in DraggableCard on pointer-up; only
 * the final snapped values flow through these helpers.
 */

import type { CardPosition, ProclivityState } from "@/types";

/**
 * Returns a state updater that writes (or overwrites) a single card position.
 * Called on drag-end with the final snapped x/y/z values.
 *
 * Usage:
 *   await update(setCardPosition(itemId, { x, y, z }));
 */
export function setCardPosition(
  itemId: string,
  pos: CardPosition,
): (s: ProclivityState) => ProclivityState {
  return (s) => ({
    ...s,
    cardLayouts: { ...(s.cardLayouts ?? {}), [itemId]: pos },
  });
}

/**
 * Returns a state updater that writes a card position AND atomically bumps its
 * z to `max(all other z values) + 1` (bring-to-front). By computing maxZ
 * inside the updater the z value is always correct even if React batched the
 * drag-start setLocalPositions call before this commit fires.
 *
 * C2 fix: replaces the 3-callback z-order pattern (onDragStart bumps z in
 * localPositions, onDragEnd reads it back from a stale closure) with a
 * race-free atomic updater.
 *
 * Usage:
 *   await update(setCardPositionToFront(itemId, { x, y }));
 */
export function setCardPositionToFront(
  itemId: string,
  pos: Omit<CardPosition, "z">,
): (s: ProclivityState) => ProclivityState {
  return (s) => {
    const layouts = s.cardLayouts ?? {};
    const maxZ = Object.values(layouts).reduce(
      (m, p) => (p.z > m ? p.z : m),
      0,
    );
    return {
      ...s,
      cardLayouts: { ...layouts, [itemId]: { ...pos, z: maxZ + 1 } },
    };
  };
}

/**
 * Returns a state updater that writes (or updates) just the w/h dimensions for
 * a card, preserving the existing x/y/z. Called on resize-end with the final
 * snapped width and height.
 *
 * Snapping to CARD_GRID_SIZE is done in DraggableCard on pointer-up; only the
 * final snapped values flow here.
 *
 * Usage:
 *   await update(setCardSize(itemId, { w, h }));
 */
export function setCardSize(
  itemId: string,
  size: { w: number; h: number },
): (s: ProclivityState) => ProclivityState {
  return (s) => {
    const layouts = s.cardLayouts ?? {};
    const existing = layouts[itemId] ?? { x: 0, y: 0, z: 0 };
    return {
      ...s,
      cardLayouts: {
        ...layouts,
        [itemId]: { ...existing, w: size.w, h: size.h },
      },
    };
  };
}

/**
 * Returns a state updater that removes all card positions for the given item
 * ids. Used by the "Reset layout" button (per-section) and by deletion
 * handlers to clean up orphan entries.
 *
 * When no positions remain after the wipe, `cardLayouts` is set to `undefined`
 * to keep storage compact.
 *
 * Usage:
 *   await update(resetCardPositions(sectionItems.map(t => t.id)));
 *   await update(resetCardPositions([deletedItemId]));   // deletion cleanup
 */
export function resetCardPositions(
  itemIds: string[],
): (s: ProclivityState) => ProclivityState {
  return (s) => {
    if (!s.cardLayouts) return s;
    const next = { ...s.cardLayouts };
    for (const id of itemIds) delete next[id];
    const hasEntries = Object.keys(next).length > 0;
    return { ...s, cardLayouts: hasEntries ? next : undefined };
  };
}

/**
 * Estimated card height used for cascade-layout row spacing and new-item offset.
 * Matches .task-card min-height in card.css (which can grow with content, but
 * this is the single source of truth for the grid math).
 * If .task-card min-height changes, update this constant to match.
 */
export const CASCADE_CARD_H = 130;

/**
 * Compute a cascade (waterfall) initial layout for a list of items.
 * Called the first time a section renders in card mode and some items have
 * no saved position. The result should be written to storage in one shot
 * so subsequent renders read from `cardLayouts` immediately.
 *
 * `canvasWidth` defaults to 800 if not yet known (e.g., before first paint).
 * Cards are 240 px wide (matches .task-card width in task-card.css).
 */
export function computeCascadeLayout(
  itemIds: string[],
  canvasWidth = 800,
): Record<string, CardPosition> {
  const CARD_W = 240;
  const CARD_H = CASCADE_CARD_H;
  const GAP = 16;
  const START_X = 20;
  const START_Y = 20;

  const cols = Math.max(1, Math.floor((canvasWidth - START_X) / (CARD_W + GAP)));
  const result: Record<string, CardPosition> = {};

  itemIds.forEach((id, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    result[id] = {
      x: START_X + col * (CARD_W + GAP),
      y: START_Y + row * (CARD_H + GAP),
      z: 0,
    };
  });

  return result;
}
