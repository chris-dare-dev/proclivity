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
import { useFocusTrap } from "@/hooks/useFocusTrap";
import "./Modal.css";

// ---------------------------------------------------------------------------
// Base Modal
// ---------------------------------------------------------------------------
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /**
   * Optional extra class on `.modal-panel`. SettingsModal uses this to
   * replace the default padding with its own three-region layout
   * (sticky header / scrollable body / sticky footer).
   */
  panelClassName?: string;
}

export function Modal({ open, onClose, title, children, panelClassName }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  // Unique ID per modal instance so nested modals don't share aria-labelledby (#14)
  const titleId = useId();
  const trapFocus = useFocusTrap(panelRef);

  // Save & restore focus
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      // Focus is handled by consumer autoFocus (#34 — removed setTimeout here)
    } else {
      // Defer restore via rAF so the element isn't focused mid-close-animation (#15)
      const raf = requestAnimationFrame(() => {
        previousFocusRef.current?.focus();
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [open]);

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

  if (!open) return null;

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        // Close when clicking the backdrop (not the panel itself)
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        className={`modal-panel${panelClassName ? ` ${panelClassName}` : ""}`}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 className="modal-title" id={titleId}>
          {title}
        </h2>
        {children}
      </div>
    </div>,
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
