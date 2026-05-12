import { useCallback, type KeyboardEvent, type RefObject } from "react";

const FOCUSABLE_SELECTORS = [
  "a[href]",
  "area[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "button:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS),
  );
}

/**
 * Returns an onKeyDown handler that traps Tab focus inside `containerRef`.
 * Non-Tab keys are passed through untouched, so callers can compose their
 * own Escape / Enter handling around it. The hook is a no-op when the ref
 * is null, so it's safe to mount the consumer unconditionally.
 */
export function useFocusTrap<T extends HTMLElement>(
  containerRef: RefObject<T>,
) {
  return useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (e.key !== "Tab" || !containerRef.current) return;
      const focusable = getFocusable(containerRef.current);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) {
        e.preventDefault();
        return;
      }
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [containerRef],
  );
}
