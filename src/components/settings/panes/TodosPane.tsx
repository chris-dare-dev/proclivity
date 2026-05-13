/**
 * TodosPane — settings pane for todo layout and sprint preferences.
 *
 * Owns (all live-preview):
 *   - Todo layout mode (list / card)
 *
 * Agent B inserts into this pane:
 *   - 'defaultSprintDays' SegmentedControl (1wk / 2wk / 3wk / 4wk)
 *     adjacent to layout mode (staged, apply on Done)
 *   - 'closedTodoRetentionDays' SegmentedControl (7 / 30 / 90 / Forever)
 *     below sprint default (staged, with inline warning when decreasing)
 */

import type { ReactNode } from "react";
import { SegmentedControl } from "../SettingsControls";
import type { LayoutMode, UserSettings } from "@/types";

function SectionHeader({ children }: { children: ReactNode }) {
  return <h3 className="settings-section-heading">{children}</h3>;
}

interface LiveUpdater {
  <K extends keyof UserSettings>(key: K, value: UserSettings[K]): void;
}

export interface TodosPaneProps {
  layoutMode: LayoutMode;
  live: LiveUpdater;
}

export function TodosPane({ layoutMode, live }: TodosPaneProps) {
  return (
    <div
      role="tabpanel"
      id="settings-pane-todos"
      aria-labelledby="settings-tab-todos"
      className="settings-pane"
    >
      <section className="settings-section">
        <SectionHeader>Todos</SectionHeader>

        <SegmentedControl<LayoutMode>
          name="settings-layout-mode"
          legend="Todo layout"
          options={[
            { value: "list", label: "List" },
            { value: "card", label: "Cards" },
          ]}
          value={layoutMode}
          onChange={(v) => live("layoutMode", v)}
          hint="Cards let you drag items freely across the section and snap them to a grid."
        />

        {/* Agent B: insert 'defaultSprintDays' SegmentedControl here (1wk / 2wk / 3wk / 4wk) */}
        {/* Agent B: insert 'closedTodoRetentionDays' SegmentedControl here (7 / 30 / 90 / Forever) */}
        {/* Include an inline warning when the user selects a shorter retention than current. */}
      </section>
    </div>
  );
}
