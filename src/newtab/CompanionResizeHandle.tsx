import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useId,
  useRef,
} from "react";
import { companionWidthFromDividerDelta } from "@/lib/workspaceSizing";

interface Props {
  width: number;
  min: number;
  max: number;
  defaultWidth: number;
  workspaceInlineSize: number | undefined;
  companionLabel: string;
  controlsId: string;
  onPreview: (width: number) => void;
  onCommit: (width: number) => void;
  onDraggingChange: (dragging: boolean) => void;
}

interface PointerDrag {
  pointerId: number;
  startClientX: number;
  startWidth: number;
}

const KEYBOARD_STEP = 16;
const KEYBOARD_LARGE_STEP = 48;

function clamp(width: number, min: number, max: number): number {
  return Math.round(Math.min(max, Math.max(min, width)));
}

export function CompanionResizeHandle({
  width,
  min,
  max,
  defaultWidth,
  workspaceInlineSize,
  companionLabel,
  controlsId,
  onPreview,
  onCommit,
  onDraggingChange,
}: Props) {
  const instructionsId = useId();
  const handleRef = useRef<HTMLDivElement | null>(null);
  const valueRef = useRef<HTMLSpanElement | null>(null);
  const boundsRef = useRef({ min, max });
  const latestWidthRef = useRef(clamp(width, min, max));
  const pointerDragRef = useRef<PointerDrag | null>(null);
  const pendingClientXRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const keyboardStartWidthRef = useRef<number | null>(null);
  const previousUserSelectRef = useRef("");
  const escapeListenerRef = useRef<
    ((event: globalThis.KeyboardEvent) => void) | null
  >(null);
  const callbacksRef = useRef({ onPreview, onCommit, onDraggingChange });

  callbacksRef.current = { onPreview, onCommit, onDraggingChange };

  const valueText = (nextWidth: number) => {
    if (!workspaceInlineSize || workspaceInlineSize <= 0) {
      return `${nextWidth} pixels`;
    }
    const percentage = Math.round((nextWidth / workspaceInlineSize) * 100);
    return `${nextWidth} pixels, ${percentage} percent of workspace`;
  };

  const updateValueDom = (nextWidth: number) => {
    const handle = handleRef.current;
    if (handle) {
      handle.setAttribute("aria-valuenow", String(nextWidth));
      handle.setAttribute("aria-valuetext", valueText(nextWidth));
    }
    if (valueRef.current) valueRef.current.textContent = `${nextWidth}px`;
  };

  const preview = (nextWidth: number) => {
    const bounds = boundsRef.current;
    const clamped = clamp(nextWidth, bounds.min, bounds.max);
    latestWidthRef.current = clamped;
    updateValueDom(clamped);
    callbacksRef.current.onPreview(clamped);
    return clamped;
  };

  const clearAnimationFrame = () => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  const clearEscapeListener = () => {
    const listener = escapeListenerRef.current;
    if (listener) {
      window.removeEventListener("keydown", listener);
      escapeListenerRef.current = null;
    }
  };

  const endPointerInteraction = () => {
    clearAnimationFrame();
    pendingClientXRef.current = null;
    clearEscapeListener();
    document.body.style.userSelect = previousUserSelectRef.current;
    handleRef.current?.removeAttribute("data-dragging");
    callbacksRef.current.onDraggingChange(false);
  };

  const cancelPointerDrag = () => {
    const drag = pointerDragRef.current;
    if (!drag) return;
    pointerDragRef.current = null;
    preview(drag.startWidth);
    endPointerInteraction();
    const handle = handleRef.current;
    if (handle?.hasPointerCapture(drag.pointerId)) {
      handle.releasePointerCapture(drag.pointerId);
    }
  };

  const flushPointerPreview = (clientX?: number) => {
    const drag = pointerDragRef.current;
    if (!drag) return latestWidthRef.current;
    const nextClientX = clientX ?? pendingClientXRef.current;
    if (nextClientX === null || nextClientX === undefined) {
      return latestWidthRef.current;
    }
    clearAnimationFrame();
    pendingClientXRef.current = null;
    return preview(
      companionWidthFromDividerDelta(
        drag.startWidth,
        drag.startClientX,
        nextClientX,
        workspaceInlineSize,
      ),
    );
  };

  const commitKeyboardChange = () => {
    if (keyboardStartWidthRef.current === null) return;
    const startWidth = keyboardStartWidthRef.current;
    keyboardStartWidthRef.current = null;
    if (latestWidthRef.current !== startWidth) {
      callbacksRef.current.onCommit(latestWidthRef.current);
    }
  };

  useEffect(() => {
    boundsRef.current = { min, max };
    const nextWidth = clamp(width, min, max);
    if (
      pointerDragRef.current === null &&
      keyboardStartWidthRef.current === null
    ) {
      latestWidthRef.current = nextWidth;
      updateValueDom(nextWidth);
      return;
    }
    if (latestWidthRef.current !== clamp(latestWidthRef.current, min, max)) {
      preview(latestWidthRef.current);
    } else {
      updateValueDom(latestWidthRef.current);
    }
  }, [max, min, width, workspaceInlineSize]);

  useEffect(
    () => () => {
      clearAnimationFrame();
      clearEscapeListener();
      const drag = pointerDragRef.current;
      if (drag) {
        pointerDragRef.current = null;
        callbacksRef.current.onPreview(drag.startWidth);
        document.body.style.userSelect = previousUserSelectRef.current;
        callbacksRef.current.onDraggingChange(false);
      }
      const keyboardStartWidth = keyboardStartWidthRef.current;
      if (keyboardStartWidth !== null) {
        keyboardStartWidthRef.current = null;
        callbacksRef.current.onPreview(keyboardStartWidth);
      }
    },
    [],
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    commitKeyboardChange();

    const handle = event.currentTarget;
    handle.focus();
    handle.setPointerCapture(event.pointerId);
    handle.dataset["dragging"] = "true";
    pointerDragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startWidth: latestWidthRef.current,
    };
    previousUserSelectRef.current = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    callbacksRef.current.onDraggingChange(true);

    const escapeListener = (keyboardEvent: globalThis.KeyboardEvent) => {
      if (keyboardEvent.key !== "Escape") return;
      keyboardEvent.preventDefault();
      cancelPointerDrag();
    };
    escapeListenerRef.current = escapeListener;
    window.addEventListener("keydown", escapeListener);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = pointerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    pendingClientXRef.current = event.clientX;
    if (animationFrameRef.current !== null) return;
    animationFrameRef.current = window.requestAnimationFrame(() => {
      animationFrameRef.current = null;
      flushPointerPreview();
    });
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = pointerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const nextWidth = flushPointerPreview(event.clientX);
    pointerDragRef.current = null;
    endPointerInteraction();
    if (nextWidth !== drag.startWidth) callbacksRef.current.onCommit(nextWidth);
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerDragRef.current?.pointerId !== event.pointerId) return;
    cancelPointerDrag();
  };

  const handleLostPointerCapture = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const drag = pointerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const nextWidth = flushPointerPreview();
    pointerDragRef.current = null;
    endPointerInteraction();
    if (nextWidth !== drag.startWidth) callbacksRef.current.onCommit(nextWidth);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (pointerDragRef.current) {
      if (event.key === "Escape") cancelPointerDrag();
      return;
    }

    if (event.key === "Escape" && keyboardStartWidthRef.current !== null) {
      event.preventDefault();
      const startWidth = keyboardStartWidthRef.current;
      keyboardStartWidthRef.current = null;
      preview(startWidth);
      return;
    }

    const step = event.shiftKey ? KEYBOARD_LARGE_STEP : KEYBOARD_STEP;
    let nextWidth: number | null = null;
    switch (event.key) {
      case "ArrowLeft":
        nextWidth = latestWidthRef.current + step;
        break;
      case "ArrowRight":
        nextWidth = latestWidthRef.current - step;
        break;
      case "Home":
        nextWidth = boundsRef.current.min;
        break;
      case "End":
        nextWidth = boundsRef.current.max;
        break;
      case "Enter":
        nextWidth = defaultWidth;
        break;
    }
    if (nextWidth === null) return;
    event.preventDefault();
    keyboardStartWidthRef.current ??= latestWidthRef.current;
    preview(nextWidth);
  };

  const handleKeyUp = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (
      event.key === "ArrowLeft" ||
      event.key === "ArrowRight" ||
      event.key === "Home" ||
      event.key === "End" ||
      event.key === "Enter"
    ) {
      commitKeyboardChange();
    }
  };

  const handleDoubleClick = () => {
    commitKeyboardChange();
    const previousWidth = latestWidthRef.current;
    const resetWidth = preview(defaultWidth);
    if (resetWidth !== previousWidth) callbacksRef.current.onCommit(resetWidth);
  };

  const initialWidth = clamp(width, min, max);
  return (
    <div
      ref={handleRef}
      className="workspace-resize-handle"
      role="separator"
      tabIndex={0}
      aria-label={`Resize ${companionLabel} companion`}
      aria-orientation="vertical"
      aria-controls={controlsId}
      aria-describedby={instructionsId}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={initialWidth}
      aria-valuetext={valueText(initialWidth)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={handleLostPointerCapture}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onBlur={commitKeyboardChange}
      onDoubleClick={handleDoubleClick}
    >
      <span ref={valueRef} className="workspace-resize-value" aria-hidden="true">
        {initialWidth}px
      </span>
      <span id={instructionsId} className="sr-only">
        Drag to resize. Left arrow widens the companion; right arrow narrows it.
        Hold Shift for larger steps. Home selects the minimum, End the maximum,
        and Enter or double-click resets the width. Escape cancels an active
        change.
      </span>
    </div>
  );
}
