/**
 * CommandPalette — lazy-loaded Cmd+K command palette.
 *
 * Architecture (m11 synthesis §3):
 * - Uses <Command.Dialog> from cmdk directly (NOT wrapped in proclivity's
 *   <Modal>). Radix Dialog provides focus-trap, Escape dismissal, backdrop
 *   click, and focus-return natively. Nesting in <Modal> would create dual
 *   focus-traps and dual portals.
 * - All cmdk imports are confined to THIS file so cmdk lands in the lazy
 *   CommandPalette-*.js chunk and never in the initial chunk.
 * - Static commands from PALETTE_COMMANDS ("Actions" group): Open Settings,
 *   Open Keyboard Shortcuts.
 * - Dynamic commands from visibleTabs prop ("Navigation" group): Switch to
 *   <each visible tab> — respects the user's sectionVisibility settings.
 */

import { Command } from "cmdk";
import type { Tab } from "@/newtab/App";
import { PALETTE_COMMANDS, type PaletteCommandDeps } from "@/lib/palette-commands";
import "./CommandPalette.css";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onSwitchTab: (tab: Tab) => void;
  onOpenHelp: () => void;
  visibleTabs: { id: Tab; label: string }[];
}

export default function CommandPalette({
  open,
  onClose,
  onSwitchTab,
  onOpenHelp,
  visibleTabs,
}: CommandPaletteProps) {
  const deps: PaletteCommandDeps = {
    openHelp: onOpenHelp,
    closePalette: onClose,
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      label="Command palette"
    >
      <Command.Input placeholder="Type a command..." autoFocus />
      <Command.List>
        <Command.Empty>No results.</Command.Empty>

        <Command.Group heading="Actions">
          {PALETTE_COMMANDS.map((cmd) => (
            <Command.Item
              key={cmd.id}
              value={cmd.id}
              {...(cmd.keywords !== undefined
                ? { keywords: [...cmd.keywords] }
                : {})}
              onSelect={() => cmd.action(deps)}
            >
              {cmd.label}
            </Command.Item>
          ))}
        </Command.Group>

        {visibleTabs.length > 0 && (
          <Command.Group heading="Navigation">
            {visibleTabs.map((tab) => (
              <Command.Item
                key={tab.id}
                value={`switch-${tab.id}`}
                keywords={[tab.label.toLowerCase()]}
                onSelect={() => {
                  onSwitchTab(tab.id);
                  onClose();
                }}
              >
                Switch to {tab.label}
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>
    </Command.Dialog>
  );
}
