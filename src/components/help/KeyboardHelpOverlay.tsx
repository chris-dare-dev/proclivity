import { Modal } from "@/components/Modal";
import { SHORTCUTS, type Shortcut } from "@/lib/shortcuts";
import "./KeyboardHelpOverlay.css";

/**
 * Returns true when running on macOS.
 * react-hotkeys-hook defines isMacOS() internally but does not export it
 * from its v5.3.2 public API (m10 rect L5). We replicate the same
 * navigator.userAgent check here, including the `ipod` exclusion the
 * library uses internally (m10 rect M2) — iPod Touch is discontinued
 * since 2022 but matching the upstream check exactly avoids the
 * "claimed parity that isn't actually parity" doc-drift trap.
 */
function isMacOS(): boolean {
  return /mac/i.test(navigator.userAgent) && !/iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * KeyboardHelpOverlay — lazy-loaded modal listing all keyboard shortcuts.
 *
 * Reuses the m7 Modal scaffold: AnimatePresence scale-in, focus-trap,
 * Escape-to-close, and inert-on-exit are all handled by Modal.tsx.
 *
 * Local isMacOS() (above) maps "mod" → ⌘ on Mac and Ctrl on other
 * platforms so users see OS-native labels instead of the literal
 * "mod+/" string. The library's internal helper is not exported (m10
 * rect L6 corrects an earlier mis-attribution).
 */

interface KeyboardHelpOverlayProps {
  open: boolean;
  onClose: () => void;
}

/** Render a keys string (e.g. "mod+slash") as an array of <kbd> chips. */
function KeyChips({ keys }: { keys: string }) {
  const mac = isMacOS();

  // Normalize each token into a display label.
  function tokenLabel(token: string): string {
    switch (token.toLowerCase()) {
      case "mod":
        return mac ? "⌘" : "Ctrl";
      case "meta":
        return "⌘";
      case "ctrl":
        return "Ctrl";
      case "alt":
        return mac ? "⌥" : "Alt";
      case "shift":
        return "⇧";
      case "slash":
        return "/";
      case "escape":
        return "Esc";
      case "enter":
        return "↵";
      case "backspace":
        return "⌫";
      case "arrowup":
        return "↑";
      case "arrowdown":
        return "↓";
      case "arrowleft":
        return "←";
      case "arrowright":
        return "→";
      default:
        // Capitalize single-letter keys; pass through others as-is.
        return token.length === 1 ? token.toUpperCase() : token;
    }
  }

  // Split on "+" (the splitKey default in react-hotkeys-hook).
  const tokens = keys.split("+").map((t) => t.trim()).filter(Boolean);

  return (
    <span className="keyboard-help-keys">
      {tokens.map((token, i) => (
        // Use index as key — token strings can legitimately repeat within a
        // keys string (e.g. a future "shift+shift" double-tap convention)
        // and React strict-mode would drop one of the duplicates. Index is
        // render-stable here because the parent `keys` prop only changes
        // when the SHORTCUTS entry changes (m10 rect L2).
        <span key={i}>
          {i > 0 && (
            <span className="keyboard-help-key-sep" aria-hidden="true">
              +
            </span>
          )}
          <kbd className="keyboard-help-key">{tokenLabel(token)}</kbd>
        </span>
      ))}
    </span>
  );
}

/** Group shortcuts by category, preserving insertion order. */
function groupByCategory(shortcuts: readonly Shortcut[]): Map<string, Shortcut[]> {
  const map = new Map<string, Shortcut[]>();
  for (const shortcut of shortcuts) {
    const existing = map.get(shortcut.category);
    if (existing !== undefined) {
      existing.push(shortcut);
    } else {
      map.set(shortcut.category, [shortcut]);
    }
  }
  return map;
}

export default function KeyboardHelpOverlay({
  open,
  onClose,
}: KeyboardHelpOverlayProps) {
  const grouped = groupByCategory(SHORTCUTS);

  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts">
      <div className="keyboard-help-overlay">
        {Array.from(grouped.entries()).map(([category, shortcuts]) => (
          <section key={category} className="keyboard-help-category">
            <h3>{category}</h3>
            {shortcuts.map((shortcut, rowIndex) => (
              // Composite key: a future registry might register the same
              // `keys` string in different categories (e.g. "mod+enter" for
              // "Submit form" in App and "Send message" in Chat). React
              // strict-mode would drop one of the rows otherwise. Adding
              // category + rowIndex makes the key globally unique
              // (m10 rect L3).
              <div
                key={`${category}-${shortcut.keys}-${rowIndex}`}
                className="keyboard-help-row"
              >
                <span className="keyboard-help-label">{shortcut.label}</span>
                <KeyChips keys={shortcut.keys} />
              </div>
            ))}
          </section>
        ))}
      </div>
      {/* m10 rect M3: the overlay's content is non-interactive (just <kbd>
          chips and labels), so the m7 Modal focus-trap has no focusable
          descendants and degenerates to a no-op. A Close button gives Tab
          something to land on, lets keyboard users explicitly dismiss the
          modal, and satisfies WCAG 2.1 SC 2.4.3 (Focus Order) + the ARIA
          dialog-modal APG. autoFocus moves focus into the dialog on open
          so screen readers announce the dialog state correctly. */}
      <div className="modal-footer">
        <button
          type="button"
          className="modal-btn-primary"
          onClick={onClose}
          autoFocus
        >
          Close
        </button>
      </div>
    </Modal>
  );
}
