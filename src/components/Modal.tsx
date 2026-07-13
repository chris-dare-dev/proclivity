import {
  useEffect,
  useId,
  useRef,
  useCallback,
  useState,
  type ReactNode,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useStore } from "@/storage/useStore";
import { resolvedSettings } from "@/storage/constants";
import "./Modal.css";

// ---------------------------------------------------------------------------
// Base Modal
// ---------------------------------------------------------------------------
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Explicit opener for consumers whose autoFocus runs before this modal's effect. */
  returnFocusTo?: HTMLElement | null;
  /**
   * Optional extra class on `.modal-panel`. SettingsModal uses this to
   * replace the default padding with its own three-region layout
   * (sticky header / scrollable body / sticky footer).
   */
  panelClassName?: string;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  returnFocusTo,
  panelClassName,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  // Unique ID per modal instance so nested modals don't share aria-labelledby (#14)
  const titleId = useId();
  const trapFocus = useFocusTrap(panelRef);

  // m7-s13 (UPL-4): reduced-motion combines BOTH signals — motion's
  // useReducedMotion() reads the OS-level prefers-reduced-motion media
  // query, AND the in-app rs.reducedMotion toggle (AppearancePane). If
  // either is on, the open/close animations collapse to instant
  // (duration 0, no interpolation). resolvedSettings is a small pure
  // function; useMemo around it is unjustified for a single-boolean read
  // (m7 rect M3) — inlined.
  const osReduced = useReducedMotion();
  const { state } = useStore();
  const rs = resolvedSettings(state.settings);
  const shouldReduceMotion = osReduced || rs.reducedMotion;
  // Two-tier timing (m7 rect M4 / synthesis §3.10): backdrop fades 33%
  // faster than the panel scales in. Reads as "environment appears,
  // then dialog materializes." Both collapse to 0 under reduced-motion.
  const backdropDuration = shouldReduceMotion ? 0 : 0.12;
  const panelDuration = shouldReduceMotion ? 0 : 0.18;

  // Save & restore focus + manage inert during exit animation (m7 rect H1)
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      // Focus is handled by consumer autoFocus (#34 — removed setTimeout here)
      // Re-enable interaction on the panel in case the previous close-cycle
      // set inert (re-open of the same Modal instance held by AnimatePresence).
      panelRef.current?.removeAttribute("inert");
    } else {
      // m7 rect H1: AnimatePresence holds the panel in DOM for ~180 ms
      // during the exit animation. The useFocusTrap hook is still wired
      // to panelRef. If the user presses Tab in that window, trapFocus
      // would yank focus BACK into the closing modal — Tab-escape regression
      // shape the m4-s11 work already taught us. Setting `inert` on the
      // panel here (synchronously when open flips false) removes the panel
      // and all its descendants from focus order + the a11y tree atomically,
      // so the rAF focus-restoration below lands cleanly on the trigger
      // and any subsequent Tab routes to the next normal focusable.
      // pointer-events:none is already implicit via the panel's animated
      // opacity:0 exit state, but inert is the load-bearing a11y guard.
      panelRef.current?.setAttribute("inert", "");

      // Defer restore via rAF so the element isn't focused mid-close-animation (#15)
      const focusTarget = returnFocusTo ?? previousFocusRef.current;
      const raf = requestAnimationFrame(() => {
        focusTarget?.focus();
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [open, returnFocusTo]);

  // Escape closes; Tab is delegated to the shared focus-trap hook.
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      trapFocus(e);
    },
    [onClose, trapFocus],
  );

  // m7-s13: render the portal unconditionally; AnimatePresence handles the
  // conditional presence via children. When `open` flips false, the m.div
  // tree stays alive for the 180 ms exit animation, then unmounts. The
  // earlier `if (!open) return null` early-return was removed — it
  // short-circuited the exit animation by destroying the DOM immediately.
  // m.div (NOT motion.div) is mandatory per the LazyMotion `strict` mode
  // in App.tsx (m2 foundation). React context flows through portals so
  // m.div inside createPortal correctly receives the LazyMotion context.
  return createPortal(
    // mode omitted → default "sync" (m7 rect L3): single-child presence,
    // no overlapping open/close possible in normal use. mode="wait" would
    // add 180 ms latency on rapid reopen. brief-2 §3.1 noted mode="wait"
    // as one safe option; synthesis §3.4 prescribed default sync because
    // the modal is a single conditional slot — no sibling switching where
    // wait-mode's queueing matters.
    <AnimatePresence>
      {open && (
        <m.div
          key="modal"
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: backdropDuration }}
          onMouseDown={(e) => {
            // Close when clicking the backdrop (not the panel itself)
            if (e.target === e.currentTarget) onClose();
          }}
          onKeyDown={handleKeyDown}
        >
          <m.div
            className={`modal-panel${panelClassName ? ` ${panelClassName}` : ""}`}
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: panelDuration, ease: "easeOut" }}
          >
            <h2 className="modal-title" id={titleId}>
              {title}
            </h2>
            {children}
          </m.div>
        </m.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// TextInputModal — for rename / create flows
// ---------------------------------------------------------------------------
interface TextInputModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  placeholder?: string;
  initialValue?: string;
  submitLabel?: string;
  onSubmit: (value: string) => void;
}

export function TextInputModal({
  open,
  onClose,
  title,
  placeholder = "",
  initialValue = "",
  submitLabel = "Save",
  onSubmit,
}: TextInputModalProps) {
  const [value, setValue] = useState(initialValue);

  // Reset value when modal opens with a new initialValue
  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <input
        className="modal-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
        }}
        autoFocus
      />
      <div className="modal-footer">
        <button onClick={onClose}>Cancel</button>
        <button
          className="modal-btn-primary"
          onClick={handleSubmit}
          disabled={!value.trim()}
        >
          {submitLabel}
        </button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// ConfirmDialog — for destructive confirmations
// ---------------------------------------------------------------------------
interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onClose,
  title,
  message,
  confirmLabel = "Confirm",
  onConfirm,
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="modal-body">
        {typeof message === "string" ? <p>{message}</p> : message}
      </div>
      <div className="modal-footer">
        <button onClick={onClose}>Cancel</button>
        <button className="modal-btn-danger" onClick={handleConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
