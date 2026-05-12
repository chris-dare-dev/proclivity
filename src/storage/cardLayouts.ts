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
  const CARD_H = 130; // estimate; cards are variable-height but this gives reasonable rows
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
