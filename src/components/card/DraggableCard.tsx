/**
 * DraggableCard — position primitive for the card-view canvas.
 *
 * Implements free-form drag via Pointer Events (the same pattern used by
 * ChartView.tsx for Gantt bar dragging). Zero new npm dependencies.
 *
 * CONTRACT:
 * - During drag: updates live position via direct style mutation on the
 *   element (no React state on every pointer-move → O(1) per event).
 * - On pointer-up: snaps to CARD_GRID_SIZE, calls onPositionChange with
 *   the snapped position (live preview update), then calls onDragEnd with
 *   the same position for the parent to persist.
 * - Keyboard: arrow keys nudge by gridSize; Shift+Arrow resizes by one
 *   grid unit; Escape cancels drag in progress.
 *   Note: Shift+Arrow for resize was chosen over Alt+Arrow to keep the
 *   convention consistent with "modifier = larger action". It can conflict
 *   with text-selection shortcuts in system inputs, but cards contain no
 *   editable text — buttons and checkboxes only — so the conflict is
 *   theoretical.
 * - Resize handle: bottom-right 14×14 px wedge. Its onPointerDown sets
 *   pointer capture on the handle element itself and sets resizeRef. The
 *   card body's onPointerDown guard (`target.closest("button, input…")`)
 *   does NOT cover the handle — the handle calls e.stopPropagation() to
 *   prevent the card drag from also starting.
 * - z-order: managed by the parent (useCardLayout) via setCardPositionToFront
 *   inside the storage updater — no z bump needed here.
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

interface ResizeState {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  origW: number;
  origH: number;
}

// HIGH fix: raised from 140 to match task-card CSS min-width: 200px.
// At 140–199px the draggable wrapper overrides min-width:0 on task-card,
// making titles wrap character-by-character at ~10px wide.
const MIN_W = 200;
// MIN_H aligned with the bottom of the `md` bucket (170) so the resize
// handle can never put a card into the `sm`/`xs` buckets where the
// fire-at row (and notes) get hidden. Previously MIN_H=136 sat inside
// `xs`: a reminder card whose natural rendered height was below 170
// would snap UP to 136 on first resize and the bucket flipped to "xs",
// instantly hiding the "In 12h" relative-time label even though the
// card grew. The `sm`/`xs` CSS rules stay as defensive coverage for
// stored heights below 170 (e.g. legacy state from before this fix).
const MIN_H = 170;

/**
 * Map a card pixel-height to one of four size buckets. Drives the
 * progressive-degradation CSS rules (notes hide first, fire-at next,
 * title 1-line at the smallest). The attribute is set imperatively on
 * the wrapper during resize so the visual response is instant — no
 * round-trip through React state on every pointer-move tick.
 *
 *   lg  h ≥ 200  full layout (title up to 2 lines, notes, fire-at, tags)
 *   md  170–199  notes hidden — fire-at + 2-line title + tags
 *   sm  152–169  notes + fire-at hidden — 2-line title + tags
 *   xs  < 152    notes + fire-at hidden — 1-line title (ellipsis) + tags
 */
function bucketForHeight(h: number | undefined): "lg" | "md" | "sm" | "xs" {
  if (h === undefined || h >= 200) return "lg";
  if (h >= 170) return "md";
  if (h >= 152) return "sm";
  return "xs";
}
const MAX_W = 600;
const MAX_H = 500;

interface Props {
  itemId: string;
  position: CardPosition;
  onPositionChange: (id: string, pos: CardPosition) => void;
  /**
   * Called on pointer-up with the final snapped position — write to storage here.
   */
  onDragEnd?: ((id: string, pos: CardPosition) => void) | undefined;
  /**
   * Called on resize-end with the final snapped { w, h } — write to storage here.
   */
  onResize?: ((id: string, size: { w: number; h: number }) => void) | undefined;
  /** Whether this card should be visually hidden (filtered out) but stay in DOM. */
  filteredOut?: boolean | undefined;
  children: ReactNode;
  className?: string | undefined;
}

function snapTo(value: number, grid: number): number {
  return Math.round(value / grid) * grid;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export const DraggableCard = memo(function DraggableCard({
  itemId,
  position,
  onPositionChange,
  onDragEnd,
  onResize,
  filteredOut,
  children,
  className,
}: Props) {
  const dragRef = useRef<DragState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);
  const elRef = useRef<HTMLDivElement | null>(null);
  const resizeHandleRef = useRef<HTMLDivElement | null>(null);

  // Apply position via style (not state) during drag for perf.
  function applyPosition(x: number, y: number) {
    const el = elRef.current;
    if (!el) return;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }

  // Apply size via style during resize for perf.
  function applySize(w: number, h: number) {
    const el = elRef.current;
    if (!el) return;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    el.dataset["cardBucket"] = bucketForHeight(h);
  }

  // Read current rendered size of the card element (for resize origin).
  function currentSize(): { w: number; h: number } {
    const el = elRef.current;
    if (!el) return { w: position.w ?? MIN_W, h: position.h ?? MIN_H };
    return { w: el.offsetWidth, h: el.offsetHeight };
  }

  function clampToCanvas(x: number, y: number): { x: number; y: number } {
    const el = elRef.current;
    const canvas = el?.closest<HTMLElement>(".card-canvas");
    if (!el || !canvas) return { x: Math.max(0, x), y: Math.max(0, y) };
    return {
      x: clamp(x, 0, Math.max(0, canvas.clientWidth - el.offsetWidth)),
      y: Math.max(0, y),
    };
  }

  function maxWidthAtCurrentPosition(): number {
    const canvas = elRef.current?.closest<HTMLElement>(".card-canvas");
    if (!canvas) return MAX_W;
    return Math.max(MIN_W, Math.min(MAX_W, canvas.clientWidth - position.x));
  }

  // ── Position drag ────────────────────────────────────────────────

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // left-button only
    // Don't start drag if user clicked on a button/input child
    const target = e.target as HTMLElement;
    if (target.closest("button, input, a, select, textarea, .card-resize-handle")) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();

    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: position.x,
      origY: position.y,
    };

    document.body.style.userSelect = "none";

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

    const rawX = drag.origX + (e.clientX - drag.startClientX);
    const rawY = drag.origY + (e.clientY - drag.startClientY);
    const clamped = clampToCanvas(rawX, rawY);
    applyPosition(clamped.x, clamped.y);
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
    const clamped = clampToCanvas(
      snapTo(rawX, CARD_GRID_SIZE),
      snapTo(rawY, CARD_GRID_SIZE),
    );
    const snapped: CardPosition = {
      x: clamped.x,
      y: clamped.y,
      z: position.z,
      w: position.w,
      h: position.h,
    };

    applyPosition(snapped.x, snapped.y);
    onPositionChange(itemId, snapped);
    onDragEnd?.(itemId, snapped);
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => commitDrag(e);
  const handlePointerCancel = (e: PointerEvent<HTMLDivElement>) => {
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

    applyPosition(drag.origX, drag.origY);
    onPositionChange(itemId, {
      x: drag.origX,
      y: drag.origY,
      z: position.z,
      w: position.w,
      h: position.h,
    });
    void e;
  };

  // ── Resize handle pointer events ─────────────────────────────────

  const handleResizePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation(); // prevent card drag from also firing
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    const { w, h } = currentSize();
    resizeRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origW: w,
      origH: h,
    };

    document.body.style.userSelect = "none";

    const el = elRef.current;
    if (el) el.classList.add("is-resizing");
  };

  const handleResizePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const rs = resizeRef.current;
    if (!rs) return;

    const rawW = rs.origW + (e.clientX - rs.startClientX);
    const rawH = rs.origH + (e.clientY - rs.startClientY);
    applySize(
      clamp(rawW, MIN_W, maxWidthAtCurrentPosition()),
      clamp(rawH, MIN_H, MAX_H),
    );
  };

  const commitResize = (e: PointerEvent<HTMLDivElement>) => {
    const rs = resizeRef.current;
    if (!rs) return;
    resizeRef.current = null;
    document.body.style.userSelect = "";

    const el = elRef.current;
    if (el) el.classList.remove("is-resizing");

    const rawW = rs.origW + (e.clientX - rs.startClientX);
    const rawH = rs.origH + (e.clientY - rs.startClientY);
    const snappedW = clamp(
      snapTo(rawW, CARD_GRID_SIZE),
      MIN_W,
      maxWidthAtCurrentPosition(),
    );
    const snappedH = clamp(snapTo(rawH, CARD_GRID_SIZE), MIN_H, MAX_H);

    applySize(snappedW, snappedH);
    // M1 fix: skip storage write on zero-delta (plain click on handle with no drag).
    if (snappedW === rs.origW && snappedH === rs.origH) return;
    onResize?.(itemId, { w: snappedW, h: snappedH });
  };

  const handleResizePointerUp = (e: PointerEvent<HTMLDivElement>) => commitResize(e);
  const handleResizePointerCancel = (e: PointerEvent<HTMLDivElement>) => {
    const rs = resizeRef.current;
    if (!rs) return;
    resizeRef.current = null;
    document.body.style.userSelect = "";

    const el = elRef.current;
    if (el) el.classList.remove("is-resizing");

    // Revert to original size
    applySize(rs.origW, rs.origH);
    void e;
  };

  // ── Keyboard handling ────────────────────────────────────────────

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      if (e.key === "Escape") {
        const drag = dragRef.current;
        dragRef.current = null;
        document.body.style.userSelect = "";

        const el = elRef.current;
        if (el) {
          el.classList.remove("is-dragging");
          try {
            elRef.current?.releasePointerCapture(drag.pointerId);
          } catch {
            // The pointer may already have been released by the browser.
          }
          const canvas = el.closest(".card-canvas");
          if (canvas) canvas.classList.remove("is-dragging");
        }

        applyPosition(drag.origX, drag.origY);
        onPositionChange(itemId, {
          x: drag.origX,
          y: drag.origY,
          z: position.z,
          w: position.w,
          h: position.h,
        });
      }
      return;
    }

    // Shift+Arrow: resize by one grid unit.
    // Arrow alone: nudge position by one grid unit (10 with Ctrl).
    if (
      e.shiftKey &&
      (e.key === "ArrowLeft" ||
        e.key === "ArrowRight" ||
        e.key === "ArrowUp" ||
        e.key === "ArrowDown")
    ) {
      e.preventDefault();
      const { w: curW, h: curH } = currentSize();
      let newW = curW;
      let newH = curH;

      if (e.key === "ArrowRight") {
        newW = clamp(
          curW + CARD_GRID_SIZE,
          MIN_W,
          maxWidthAtCurrentPosition(),
        );
      } else if (e.key === "ArrowLeft") {
        newW = clamp(
          curW - CARD_GRID_SIZE,
          MIN_W,
          maxWidthAtCurrentPosition(),
        );
      } else if (e.key === "ArrowDown") {
        newH = clamp(curH + CARD_GRID_SIZE, MIN_H, MAX_H);
      } else if (e.key === "ArrowUp") {
        newH = clamp(curH - CARD_GRID_SIZE, MIN_H, MAX_H);
      }

      applySize(newW, newH);
      onResize?.(itemId, { w: newW, h: newH });
      return;
    }

    // Plain Arrow: nudge position
    const nudge = CARD_GRID_SIZE;
    let newX = position.x;
    let newY = position.y;

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      newX = position.x - nudge;
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      newX = position.x + nudge;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      newY = Math.max(0, position.y - nudge);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      newY = position.y + nudge;
    } else {
      return;
    }

    const clamped = clampToCanvas(newX, newY);
    const newPos: CardPosition = {
      x: clamped.x,
      y: clamped.y,
      z: position.z,
      w: position.w,
      h: position.h,
    };
    applyPosition(clamped.x, clamped.y);
    onPositionChange(itemId, newPos);
    onDragEnd?.(itemId, newPos);
  };

  // ── Styles ───────────────────────────────────────────────────────

  const style: React.CSSProperties = {
    position: "absolute",
    left: position.x,
    top: position.y,
    zIndex: position.z,
    touchAction: "none",
  };

  // Apply persisted size when present
  if (position.w !== undefined) style.width = position.w;
  if (position.h !== undefined) style.height = position.h;

  if (filteredOut) {
    style.opacity = 0;
    style.pointerEvents = "none";
  }

  // L2 fix: data-user-sized replaces the fragile [style*="width"] CSS selector.
  // If any other inline style property ever contains "width" as a substring
  // (e.g. border-width) the old selector would falsely match.
  const userSized = position.w !== undefined || position.h !== undefined;

  // Bucket from committed height. applySize() overwrites this imperatively
  // during live resize so the visual update doesn't wait for React state.
  const initialBucket = userSized ? bucketForHeight(position.h) : "lg";

  return (
    <div
      ref={elRef}
      className={`draggable-card${className ? ` ${className}` : ""}`}
      style={style}
      data-user-sized={userSized ? "true" : undefined}
      data-card-bucket={initialBucket}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onKeyDown={handleKeyDown}
    >
      {children}
      {/* Resize handle — bottom-right wedge.
          role="button": interactive widget (was "separator" which is non-interactive).
          tabIndex={-1}: not in Tab order; keyboard resize is via Shift+Arrow on the card. */}
      <div
        ref={resizeHandleRef}
        className="card-resize-handle"
        role="button"
        aria-label="Drag to resize"
        title="Drag to resize"
        tabIndex={-1}
        onPointerDown={handleResizePointerDown}
        onPointerMove={handleResizePointerMove}
        onPointerUp={handleResizePointerUp}
        onPointerCancel={handleResizePointerCancel}
      />
    </div>
  );
});
