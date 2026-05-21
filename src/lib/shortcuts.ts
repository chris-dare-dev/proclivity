/**
 * shortcuts.ts — source-of-truth registry for keyboard shortcuts.
 *
 * Option 1 (flat const array) chosen for m10: shortcut count is tiny
 * (two entries); the React-context auto-registry (Option 3) can be
 * retrofitted when the count grows (Cmd+K palette in a future milestone).
 *
 * Consumers:
 *   - KeyboardHelpOverlay reads SHORTCUTS to render the grouped list.
 *   - Each useHotkeys() call carries a matching `description` option
 *     for lightweight consistency without full Option-3 machinery.
 */

export interface Shortcut {
  /** Key combination string accepted by react-hotkeys-hook (e.g. "mod+slash"). */
  keys: string;
  /** Human-readable label shown in the help overlay. */
  label: string;
  /** Grouping category header in the overlay (e.g. "App", "Navigation"). */
  category: string;
}

export const SHORTCUTS: readonly Shortcut[] = [
  {
    keys: "mod+slash",
    label: "Show keyboard shortcuts",
    category: "App",
  },
  {
    keys: "mod+k",
    label: "Open command palette",
    category: "App",
  },
  {
    keys: "escape",
    label: "Close panel / modal",
    category: "App",
  },
];
