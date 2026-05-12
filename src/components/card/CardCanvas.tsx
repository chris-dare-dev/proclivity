/**
 * CardCanvas — the free-placement surface for a section in card mode.
 *
 * Responsibilities:
 * - position: relative container; min-height keeps it visible even when empty
 * - dot-grid CSS via .card-canvas.is-dragging::before (pure CSS, no JS toggle)
 * - role="application" for screen readers with aria-description
 * - Exposes onCanvasClick for future use (currently unused)
 *
 * The `is-dragging` class is managed by DraggableCard on its closest
 * .card-canvas ancestor.
 */

import { type ReactNode } from "react";
import "./card.css";

interface Props {
  children: ReactNode;
  /** Accessible label for the section this canvas belongs to. */
  ariaLabel?: string | undefined;
  className?: string | undefined;
}

export function CardCanvas({ children, ariaLabel, className }: Props) {
  return (
    <div
      className={`card-canvas${className ? ` ${className}` : ""}`}
      role="application"
      aria-label={ariaLabel}
      aria-description="Use Tab to move between cards, Arrow keys to reposition the focused card."
    >
      {children}
    </div>
  );
}
