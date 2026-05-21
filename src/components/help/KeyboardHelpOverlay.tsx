import { Modal } from "@/components/Modal";
import { SHORTCUTS, type Shortcut } from "@/lib/shortcuts";
import "./KeyboardHelpOverlay.css";

/**
 * Returns true when running on macOS.
 * react-hotkeys-hook defines isMacOS() internally but does not export it.
 * We replicate the same navigator.userAgent check here.
 */
function isMacOS(): boolean {
  return /mac/i.test(navigator.userAgent) && !/iphone|ipad/i.test(navigator.userAgent);
}

/**
 * KeyboardHelpOverlay — lazy-loaded modal listing all keyboard shortcuts.
 *
 * Reuses the m7 Modal scaffold: AnimatePresence scale-in, focus-trap,
 * Escape-to-close, and inert-on-exit are all handled by Modal.tsx.
 *
 * isMacOS() (from react-hotkeys-hook) maps "mod" → ⌘ on Mac and Ctrl on
 * other platforms so users see OS-native labels instead of the literal
 * "mod+/" string.
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
        <span key={token}>
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
            {shortcuts.map((shortcut) => (
              <div key={shortcut.keys} className="keyboard-help-row">
                <span className="keyboard-help-label">{shortcut.label}</span>
                <KeyChips keys={shortcut.keys} />
              </div>
            ))}
          </section>
        ))}
      </div>
    </Modal>
  );
}
