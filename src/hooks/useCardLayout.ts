/**
 * useCardLayout — shared position management for card-view sections.
 *
 * A2 fix: extracted from the ~90 lines of identical boilerplate in
 * TodoCardSection and RemindersCardSection (localPositions, getPosition,
 * handlePositionChange, handleDragEnd, handleResetLayout, canvasMinHeight,
 * computeInitialPositions + useEffect persistence, canvasElRef).
 *
 * Usage:
 *   const layout = useCardLayout({ items, cardLayouts, update });
 *   // then:
 *   layout.getPosition(id)          // live → persisted → 0,0
 *   layout.canvasMinHeight          // expanded to fit placed cards
 *   layout.canvasElRef              // attach to a DOM node for width measurement
 *   layout.handlers.onPositionChange(id, pos)  // live drag
 *   layout.handlers.onDragEnd(id, pos)         // commit + bring-to-front
 *   layout.handlers.onResetLayout()            // wipe section positions
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CardLayoutMap, CardPosition, ProclivityState } from "@/types";
import {
  computeCascadeLayout,
  CASCADE_CARD_H,
  resetCardPositions,
  setCardPositionToFront,
} from "@/storage/cardLayouts";

interface UseCardLayoutOptions<T extends { id: string }> {
  /** All items in this section (used for cascade layout and canvasMinHeight). */
  items: T[];
  /** Persisted position map from state.cardLayouts. */
  cardLayouts: CardLayoutMap | undefined;
  /** Storage update function from useStore(). */
  update: (fn: (s: ProclivityState) => ProclivityState) => Promise<void>;
}

interface UseCardLayoutResult {
  /** Resolved position: live drag → persisted → fallback {x:0,y:0,z:0}. */
  getPosition: (id: string) => CardPosition;
  /** Canvas min-height to show all placed cards without clipping. */
  canvasMinHeight: number;
  /** Attach to a hidden full-size div inside CardCanvas for width measurement. */
  canvasElRef: React.MutableRefObject<HTMLDivElement | null>;
  handlers: {
    /** Update local state during drag (no storage write). */
    onPositionChange: (id: string, pos: CardPosition) => void;
    /** Commit final position to storage with atomic z-bump. */
    onDragEnd: (id: string, pos: CardPosition) => Promise<void>;
    /** Wipe all positions for this section and reset local state. */
    onResetLayout: () => Promise<void>;
  };
}

export function useCardLayout<T extends { id: string }>({
  items,
  cardLayouts,
  update,
}: UseCardLayoutOptions<T>): UseCardLayoutResult {
  const canvasElRef = useRef<HTMLDivElement | null>(null);

  // Build the cascade for un-positioned items (called both for init and useEffect).
  const computeInitialPositions = useCallback((): Record<string, CardPosition> => {
    const unsaved = items.filter((t) => !cardLayouts?.[t.id]);
    if (!unsaved.length) return {};
    const canvasWidth = canvasElRef.current?.offsetWidth ?? 800;
    const cascade = computeCascadeLayout(unsaved.map((t) => t.id), canvasWidth);
    const CARD_ROW_H = CASCADE_CARD_H + 16;
    let offsetY = 0;
    for (const item of items) {
      const pos = cardLayouts?.[item.id];
      if (pos) offsetY = Math.max(offsetY, pos.y + CARD_ROW_H);
    }
    if (offsetY > 0) {
      for (const id of Object.keys(cascade)) {
        const entry = cascade[id];
        if (entry) entry.y += offsetY;
      }
    }
    return cascade;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, cardLayouts]);

  // H1 fix: seed localPositions synchronously so the first paint never shows
  // cards at (0,0). Storage persist happens in useEffect after paint.
  const [localPositions, setLocalPositions] = useState<Record<string, CardPosition>>(
    () => computeInitialPositions(),
  );

  // Persist cascade to storage after first paint.
  const itemKeyStr = items.map((t) => t.id).join(",");
  const layoutsPresent = cardLayouts !== undefined ? "def" : "undef";
  useEffect(() => {
    const unsaved = items.filter((t) => !cardLayouts?.[t.id]);
    if (!unsaved.length) return;
    const cascade = computeInitialPositions();
    if (!Object.keys(cascade).length) return;
    void update((s) => ({
      ...s,
      cardLayouts: { ...(s.cardLayouts ?? {}), ...cascade },
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKeyStr, layoutsPresent]);

  const getPosition = useCallback(
    (id: string): CardPosition =>
      localPositions[id] ?? cardLayouts?.[id] ?? { x: 0, y: 0, z: 0 },
    [localPositions, cardLayouts],
  );

  const canvasMinHeight = useMemo(() => {
    let maxY = 400;
    for (const item of items) {
      const pos = localPositions[item.id] ?? cardLayouts?.[item.id];
      if (pos) maxY = Math.max(maxY, pos.y + 180);
    }
    return maxY;
  }, [items, localPositions, cardLayouts]);

  const onPositionChange = useCallback((id: string, pos: CardPosition) => {
    setLocalPositions((prev) => ({ ...prev, [id]: pos }));
  }, []);

  // C2 fix: z computed atomically inside updater — no stale-closure capture.
  const onDragEnd = useCallback(
    async (id: string, pos: CardPosition) => {
      await update(setCardPositionToFront(id, { x: pos.x, y: pos.y }));
    },
    [update],
  );

  const onResetLayout = useCallback(async () => {
    setLocalPositions({});
    await update(resetCardPositions(items.map((t) => t.id)));
  }, [items, update]);

  return {
    getPosition,
    canvasMinHeight,
    canvasElRef,
    handlers: { onPositionChange, onDragEnd, onResetLayout },
  };
}
