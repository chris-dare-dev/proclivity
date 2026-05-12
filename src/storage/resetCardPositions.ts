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
 * Returns a state updater that removes all card positions for the given item
 * ids. Used by the "Reset layout" button (per-section) and by deletion
 * handlers to clean up orphan entries.
 *
 * When no positions remain after the wipe, `cardLayouts` is set to `undefined`
 * to keep storage compact.
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
