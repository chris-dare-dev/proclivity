/**
 * useCardLayout — shared position management for card-view sections.
 *
 * A2 fix: extracted from the ~90 lines of identical boilerplate in
 * TodoCardSection and RemindersCardSection (localPositions, getPosition,
 * handlePositionChange, handleDragEnd, handleResetLayout, canvasMinHeight,
 * computeInitialPositions + useEffect persistence, canvasElRef).
 *
 * resize-m1: added commitSize / getSize and updated canvasMinHeight to
 * account for user-set card heights so the canvas bottom never clips a
 * resized card.
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
 *   layout.handlers.commitSize(id, {w, h})     // commit resize to storage
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CardLayoutMap, CardPosition, ProclivityState } from "@/types";
import {
  computeCascadeLayout,
  CASCADE_CARD_H,
  resetCardPositions,
  setCardPositionToFront,
} from "@/storage/cardLayouts";

/** Fallback card height for canvas-height computation when no h is stored. */
const CARD_DEFAULT_HEIGHT = 180;
const CARD_DEFAULT_WIDTH = 240;

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
    /** Commit resize dimensions to storage (called on pointer-up / keyboard). */
    commitSize: (id: string, size: { w: number; h: number }) => Promise<void>;
  };
}

export function useCardLayout<T extends { id: string }>({
  items,
  cardLayouts,
  update,
}: UseCardLayoutOptions<T>): UseCardLayoutResult {
  const canvasElRef = useRef<HTMLDivElement | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(0);

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
    (id: string): CardPosition => {
      const position =
        localPositions[id] ?? cardLayouts?.[id] ?? { x: 0, y: 0, z: 0 };
      if (canvasWidth <= 0) return position;
      const width = Math.min(position.w ?? CARD_DEFAULT_WIDTH, canvasWidth);
      const x = Math.min(
        Math.max(0, position.x),
        Math.max(0, canvasWidth - width),
      );
      return {
        ...position,
        x,
        ...(position.w !== undefined ? { w: width } : {}),
      };
    },
    [canvasWidth, localPositions, cardLayouts],
  );

  // Card coordinates are persisted in pixels. Measure the containing panel so
  // getPosition can clamp its *rendered* geometry after a window/split resize
  // without destructively overwriting the user's wider saved arrangement.
  useEffect(() => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    const updateWidth = (width: number) => setCanvasWidth(Math.floor(width));
    updateWidth(canvas.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) updateWidth(entry.contentRect.width);
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // Canvas height accounts for explicit card h (from resize) so the bottom of
  // a tall resized card is never clipped.
  const canvasMinHeight = useMemo(() => {
    let maxY = 400;
    for (const item of items) {
      const pos = localPositions[item.id] ?? cardLayouts?.[item.id];
      if (pos) {
        const cardH = pos.h ?? CARD_DEFAULT_HEIGHT;
        maxY = Math.max(maxY, pos.y + cardH);
      }
    }
    return maxY;
  }, [items, localPositions, cardLayouts]);

  const onPositionChange = useCallback((id: string, pos: CardPosition) => {
    setLocalPositions((prev) => ({ ...prev, [id]: pos }));
  }, []);

  // C2 fix: z computed atomically inside updater — no stale-closure capture.
  const onDragEnd = useCallback(
    async (id: string, pos: CardPosition) => {
      // CRITICAL fix: pass w/h so a drag never silently wipes user-set resize dims.
      await update(
        setCardPositionToFront(id, {
          x: pos.x,
          y: pos.y,
          w: pos.w,
          h: pos.h,
        }),
      );
    },
    [update],
  );

  const onResetLayout = useCallback(async () => {
    setLocalPositions({});
    await update(resetCardPositions(items.map((t) => t.id)));
  }, [items, update]);

  const commitSize = useCallback(
    async (id: string, size: { w: number; h: number }) => {
      // Update local state so canvasMinHeight recalculates immediately.
      setLocalPositions((prev) => {
        const existing = prev[id] ?? cardLayouts?.[id] ?? { x: 0, y: 0, z: 0 };
        return { ...prev, [id]: { ...existing, w: size.w, h: size.h } };
      });
      // M4 fix: bump z to front on resize-end so "last touched = on top" model
      // is consistent with drag-end. Uses setCardPositionToFront which reads the
      // stored x/y and the new w/h, computing maxZ atomically.
      await update((s) => {
        const layouts = s.cardLayouts ?? {};
        const existing = layouts[id] ?? { x: 0, y: 0, z: 0 };
        return setCardPositionToFront(id, {
          x: existing.x,
          y: existing.y,
          w: size.w,
          h: size.h,
        })(s);
      });
    },
    [update, cardLayouts],
  );

  return {
    getPosition,
    canvasMinHeight,
    canvasElRef,
    handlers: { onPositionChange, onDragEnd, onResetLayout, commitSize },
  };
}
