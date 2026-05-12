/**
 * DraggableCard — position primitive for the card-view canvas.
 *
 * Implements free-form drag via Pointer Events (the same pattern used by
 * ChartView.tsx for Gantt bar dragging). Zero new npm dependencies.
 *
 * CONTRACT:
 * - During drag: updates live position via direct style mutation on the
 *   element (no React state on every pointer-move → O(1) per event).
 * - On pointer-up: snaps to CARD_GRID_SIZE, writes final position to parent
 *   via onDragEnd, which is responsible for storage.update().
 * - Keyboard: arrow keys nudge by gridSize; Escape cancels drag in progress.
 * - z-order: parent increments pos.z to maxZ+1 on drag-start via onDragStart.
 *
 * The component is wrapped in React.memo so siblings don't re-render while
 * one card is being dragged.
 */

import {
  memo,
  useRef,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import type { CardPosition } from "@/types";
import { CARD_GRID_SIZE } from "@/storage/constants";

interface DragState {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  origX: number;
  origY: number;
}

interface Props {
  itemId: string;
  position: CardPosition;
  onPositionChange: (id: string, pos: CardPosition) => void;
  /** Called when drag starts — used by parent to bump z-order. */
  onDragStart?: ((id: string) => void) | undefined;
  /** Called on pointer-up with the final snapped position — write to storage here. */
  onDragEnd?: ((id: string, pos: CardPosition) => void) | undefined;
  /** Whether this card should be visually hidden (filtered out) but stay in DOM. */
  filteredOut?: boolean | undefined;
  children: ReactNode;
  className?: string | undefined;
}

function snapTo(value: number, grid: number): number {
  return Math.round(value / grid) * grid;
}

export const DraggableCard = memo(function DraggableCard({
  itemId,
  position,
  onPositionChange,
  onDragStart,
  onDragEnd,
  filteredOut,
  children,
  className,
}: Props) {
  const dragRef = useRef<DragState | null>(null);
  const elRef = useRef<HTMLDivElement | null>(null);

  // Apply position via style (not state) during drag for perf.
  // The parent's `position` prop drives initial render; live updates during drag
  // go direct to the DOM element. On pointer-up the parent state updates once.
  function applyPosition(x: number, y: number) {
    const el = elRef.current;
    if (!el) return;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // left-button only
    // Don't start drag if user clicked on a button/input child
    const target = e.target as HTMLElement;
    if (target.closest("button, input, a, select, textarea")) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();

    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: position.x,
      origY: position.y,
    };

    onDragStart?.(itemId);
    document.body.style.userSelect = "none";

    // Add is-dragging class to card and to parent canvas
    const el = elRef.current;
    if (el) {
      el.classList.add("is-dragging");
      const canvas = el.closest(".card-canvas");
      if (canvas) canvas.classList.add("is-dragging");
    }
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;

    // Direct DOM update — no React state during move (O(1) regardless of card count)
    const rawX = drag.origX + (e.clientX - drag.startClientX);
    const rawY = drag.origY + (e.clientY - drag.startClientY);
    const clampedX = Math.max(0, rawX);
    const clampedY = Math.max(0, rawY);
    applyPosition(clampedX, clampedY);
  };

  const commitDrag = (e: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    document.body.style.userSelect = "";

    const el = elRef.current;
    if (el) {
      el.classList.remove("is-dragging");
      const canvas = el.closest(".card-canvas");
      if (canvas) canvas.classList.remove("is-dragging");
    }

    const rawX = drag.origX + (e.clientX - drag.startClientX);
    const rawY = drag.origY + (e.clientY - drag.startClientY);
    const snapped: CardPosition = {
      x: Math.max(0, snapTo(rawX, CARD_GRID_SIZE)),
      y: Math.max(0, snapTo(rawY, CARD_GRID_SIZE)),
      z: position.z,
    };

    // Apply snapped position to DOM before React reconciles
    applyPosition(snapped.x, snapped.y);
    // Notify parent — parent writes to storage and updates React state
    onPositionChange(itemId, snapped);
    onDragEnd?.(itemId, snapped);
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => commitDrag(e);
  const handlePointerCancel = (e: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    // Revert to original position on cancel
    dragRef.current = null;
    document.body.style.userSelect = "";

    const el = elRef.current;
    if (el) {
      el.classList.remove("is-dragging");
      const canvas = el.closest(".card-canvas");
      if (canvas) canvas.classList.remove("is-dragging");
    }

    applyPosition(drag.origX, drag.origY);
    onPositionChange(itemId, { x: drag.origX, y: drag.origY, z: position.z });
    // Don't call onDragEnd on cancel — no storage write
    void e;
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      if (e.key === "Escape") {
        const drag = dragRef.current;
        dragRef.current = null;
        document.body.style.userSelect = "";

        const el = elRef.current;
        if (el) {
          el.classList.remove("is-dragging");
          try { elRef.current?.releasePointerCapture(drag.pointerId); } catch { /* ok */ }
          const canvas = el.closest(".card-canvas");
          if (canvas) canvas.classList.remove("is-dragging");
        }

        applyPosition(drag.origX, drag.origY);
        onPositionChange(itemId, { x: drag.origX, y: drag.origY, z: position.z });
      }
      return;
    }

    // Keyboard nudge — one grid unit per press, 10 grid units with Shift
    const nudge = e.shiftKey ? CARD_GRID_SIZE * 10 : CARD_GRID_SIZE;
    let newX = position.x;
    let newY = position.y;

    if (e.key === "ArrowLeft") { e.preventDefault(); newX = Math.max(0, position.x - nudge); }
    else if (e.key === "ArrowRight") { e.preventDefault(); newX = position.x + nudge; }
    else if (e.key === "ArrowUp") { e.preventDefault(); newY = Math.max(0, position.y - nudge); }
    else if (e.key === "ArrowDown") { e.preventDefault(); newY = position.y + nudge; }
    else return;

    const newPos: CardPosition = { x: newX, y: newY, z: position.z };
    applyPosition(newX, newY);
    onPositionChange(itemId, newPos);
    onDragEnd?.(itemId, newPos);
  };

  const style: React.CSSProperties = {
    position: "absolute",
    left: position.x,
    top: position.y,
    zIndex: position.z,
    touchAction: "none", // required for pointer capture on touch
  };

  if (filteredOut) {
    style.opacity = 0;
    style.pointerEvents = "none";
  }

  return (
    <div
      ref={elRef}
      className={`draggable-card${className ? ` ${className}` : ""}`}
      style={style}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
});
