/**
 * SettingsSidebar — the left-hand nav for the settings modal.
 *
 * Renders 8 pane entries in PANE_ORDER order with:
 *   - Active-pane highlight (aria-current="page" + .is-active class)
 *   - "NEW" badge on the Gemini Nano entry when unseenNano is true
 *   - Keyboard navigation: ArrowUp / ArrowDown move between rows;
 *     Home / End jump to first / last; Enter / Space activate.
 *
 * The sidebar itself is a <nav role="tablist"> so it has proper landmark
 * semantics for screen readers. Each row is role="tab". The content pane
 * rendered by the parent should have role="tabpanel".
 *
 * Props:
 *   paneId        — the currently active pane
 *   onChangePane  — called with the newly selected pane id
 *   unseenNano    — when true, shows a "NEW" dot on the Gemini Nano row
 *   dirty         — passed through for Agent B to wire unsaved-changes
 *                   indication; Agent A leaves it visually unused
 */

import { useCallback, useRef } from "react";
import type { SettingsPaneId } from "@/types";
import { PANE_ORDER } from "./panes/registry";

interface SettingsSidebarProps {
  paneId: SettingsPaneId;
  onChangePane: (id: SettingsPaneId) => void;
  unseenNano: boolean;
  dirty?: boolean | undefined;
}

export function SettingsSidebar({
  paneId,
  onChangePane,
  unseenNano,
}: SettingsSidebarProps) {
  const navRef = useRef<HTMLElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
      const panes = PANE_ORDER;
      let nextIndex: number | undefined;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          nextIndex = (currentIndex + 1) % panes.length;
          break;
        case "ArrowUp":
          e.preventDefault();
          nextIndex = (currentIndex - 1 + panes.length) % panes.length;
          break;
        case "Home":
          e.preventDefault();
          nextIndex = 0;
          break;
        case "End":
          e.preventDefault();
          nextIndex = panes.length - 1;
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          onChangePane(panes[currentIndex]!.id);
          return;
        default:
          return;
      }

      if (nextIndex !== undefined) {
        const entry = panes[nextIndex];
        if (entry) {
          onChangePane(entry.id);
          // Move DOM focus to the newly active button
          const buttons = navRef.current?.querySelectorAll<HTMLButtonElement>(
            "button[role='tab']",
          );
          buttons?.[nextIndex]?.focus();
        }
      }
    },
    [onChangePane],
  );

  return (
    <nav
      ref={navRef}
      className="settings-sidebar"
      role="tablist"
      aria-orientation="vertical"
      aria-label="Settings sections"
    >
      {PANE_ORDER.map((entry, index) => {
        const isActive = entry.id === paneId;
        const showBadge = entry.id === "geminiNano" && unseenNano;

        return (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`settings-pane-${entry.id}`}
            id={`settings-tab-${entry.id}`}
            className={`settings-sidebar-item${isActive ? " is-active" : ""}`}
            onClick={() => onChangePane(entry.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            tabIndex={isActive ? 0 : -1}
          >
            <span className="settings-sidebar-label">{entry.label}</span>
            {showBadge && (
              <span className="settings-sidebar-badge" aria-label="New">
                NEW
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
