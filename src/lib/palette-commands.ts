/**
 * palette-commands.ts — static command registry for the Cmd+K command palette.
 *
 * Pure data module (no JSX, no React imports). CommandPalette.tsx reads from
 * this registry to populate the static "Actions" group. Tab-switch commands
 * are generated dynamically inside CommandPalette from the `visibleTabs` prop
 * (respects user's sectionVisibility settings).
 *
 * m11: v0 contains Open Settings + Open Keyboard Help. "Create todo" is
 * intentionally excluded from v0 — no App-level intent-dispatch path exists
 * for cross-section todo creation (brief-1 §3.7, synthesis §3.4). Deferred to
 * a v1 follow-up milestone where a proper event bridge or context can be
 * evaluated.
 *
 * Action shape: closure that takes a `PaletteCommandDeps` object. This keeps
 * the static array self-contained — CommandPalette passes its local callbacks
 * as the deps object, rather than wiring each action individually.
 */

import { OPEN_SETTINGS_EVENT } from "@/storage/constants";

export interface PaletteCommandDeps {
  openHelp: () => void;
  closePalette: () => void;
}

export interface PaletteCommand {
  id: string;
  label: string;
  /** Alias keywords for fuzzy search — not shown in UI, but scored by cmdk. */
  keywords?: readonly string[];
  action: (deps: PaletteCommandDeps) => void;
}

export const PALETTE_COMMANDS: readonly PaletteCommand[] = [
  {
    id: "settings",
    label: "Open Settings",
    keywords: ["preferences", "config", "gear"],
    action: ({ closePalette }) => {
      window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT));
      closePalette();
    },
  },
  {
    id: "help",
    label: "Open keyboard shortcuts",
    keywords: ["help", "shortcuts", "keys"],
    action: ({ openHelp, closePalette }) => {
      openHelp();
      closePalette();
    },
  },
];
