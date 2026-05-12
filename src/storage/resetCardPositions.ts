/**
 * resetCardPositions — lightweight re-export for consumers that only need
 * the reset helper (e.g. SprintManager deletion handler).
 *
 * Importing from this module instead of the full cardLayouts.ts keeps
 * SprintManager's bundle slice free of resize-specific helpers (setCardSize,
 * computeCascadeLayout, etc.) that belong in the lazy card-mode chunk.
 *
 * bundle fix: decouples SprintManager from cardLayouts.ts so the initial
 * newtab bundle stays under 200 kB.
 */

import type { ProclivityState } from "@/types";

/**
 * Returns a state updater that resets the x/y/z position of the given cards
 * but PRESERVES their w/h (user-set resize dims). Used by the "Reset layout"
 * button (per-section).
 *
 * M3 fix: previously deleted the entire entry, silently wiping user-set sizes.
 * Now entries with w/h are kept with x/y/z cleared; entries with no w/h are
 * removed entirely (same compaction behaviour as before).
 *
 * When no card layouts remain, `cardLayouts` is set to `undefined` to keep
 * storage compact.
 */
export function resetCardPositions(
  itemIds: string[],
): (s: ProclivityState) => ProclivityState {
  return (s) => {
    if (!s.cardLayouts) return s;
    const next = { ...s.cardLayouts };
    const idSet = new Set(itemIds);
    for (const id of idSet) {
      const entry = next[id];
      if (!entry) continue;
      if (entry.w !== undefined || entry.h !== undefined) {
        // Preserve resize dims; reset only position/z.
        next[id] = { x: 0, y: 0, z: 0, w: entry.w, h: entry.h };
      } else {
        delete next[id];
      }
    }
    const hasEntries = Object.keys(next).length > 0;
    return { ...s, cardLayouts: hasEntries ? next : undefined };
  };
}

/**
 * Returns a state updater that removes all card layout entries for the given
 * item ids entirely (including w/h). Used by deletion handlers to clean up
 * orphan entries when an item is deleted.
 */
export function removeCardLayouts(
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
