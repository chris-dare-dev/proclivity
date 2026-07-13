/**
 * SettingsSidebar — the left-hand nav for the settings modal.
 *
 * Renders 8 pane entries in PANE_ORDER order with:
 *   - Active-pane highlight (aria-current="page" + .is-active class)
 *   - "NEW" badge on the Gemini Nano entry when unseenNano is true
 *   - Keyboard navigation matches the WAI-ARIA tablist pattern:
 *       ArrowUp / ArrowDown / Home / End move FOCUS only (no activation)
 *       Enter / Space activates the focused tab
 *     This split is important: when the modal has unsaved changes, a user
 *     browsing panes via arrow keys would otherwise trigger the discard-
 *     confirm dialog on every keypress. Moving focus without activating
 *     lets the user line up the target tab and confirm with Enter/Space.
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

import { useCallback, useEffect, useRef, useState } from "react";
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
  dirty = false,
}: SettingsSidebarProps) {
  const navRef = useRef<HTMLElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 639px)").matches
      : false,
  );

  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const update = () => setIsNarrow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    activeTabRef.current?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [isNarrow, paneId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
      const panes = PANE_ORDER;
      let nextIndex: number | undefined;

      switch (e.key) {
        case "ArrowDown":
          if (isNarrow) return;
          e.preventDefault();
          nextIndex = (currentIndex + 1) % panes.length;
          break;
        case "ArrowRight":
          if (!isNarrow) return;
          e.preventDefault();
          nextIndex = (currentIndex + 1) % panes.length;
          break;
        case "ArrowUp":
          if (isNarrow) return;
          e.preventDefault();
          nextIndex = (currentIndex - 1 + panes.length) % panes.length;
          break;
        case "ArrowLeft":
          if (!isNarrow) return;
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
        // WAI-ARIA tablist: arrow keys move FOCUS only, never activate.
        // This avoids triggering the dirty-check discard dialog on every
        // keypress when the user is browsing panes mid-edit. The user
        // confirms with Enter/Space (handled by the case above).
        const buttons = navRef.current?.querySelectorAll<HTMLButtonElement>(
          "button[role='tab']",
        );
        buttons?.[nextIndex]?.focus();
      }
    },
    [isNarrow, onChangePane],
  );

  return (
    <nav
      ref={navRef}
      className="settings-sidebar"
      role="tablist"
      aria-orientation={isNarrow ? "horizontal" : "vertical"}
      aria-label="Settings sections"
    >
      {PANE_ORDER.map((entry, index) => {
        const isActive = entry.id === paneId;
        const showBadge = entry.id === "geminiNano" && unseenNano;

        const showDirtyDot = isActive && dirty;

        return (
          <button
            key={entry.id}
            ref={isActive ? activeTabRef : undefined}
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
            {showDirtyDot && (
              <span
                className="settings-sidebar-dirty"
                aria-label="Unsaved changes"
              />
            )}
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
