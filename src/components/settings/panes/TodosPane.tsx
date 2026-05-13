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
  // Staged
  pendingDefaultSprintDays: 7 | 14 | 21 | 28;
  setPendingDefaultSprintDays: (v: 7 | 14 | 21 | 28) => void;
  pendingClosedRetention: 7 | 30 | 90 | null;
  setPendingClosedRetention: (v: 7 | 30 | 90 | null) => void;
  /** The currently saved retention value — used to show the lowering warning. */
  savedClosedRetention: 7 | 30 | 90 | null;
}

export function TodosPane({
  layoutMode,
  live,
  pendingDefaultSprintDays,
  setPendingDefaultSprintDays,
  pendingClosedRetention,
  setPendingClosedRetention,
  savedClosedRetention,
}: TodosPaneProps) {
  // Warn when the user is about to shorten the retention window — existing
  // closed todos older than the new value will be removed on next purge.
  const isLowering =
    pendingClosedRetention !== null &&
    savedClosedRetention !== null &&
    pendingClosedRetention < savedClosedRetention;
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

        <SegmentedControl<7 | 14 | 21 | 28>
          name="settings-sprint-days"
          legend="Default sprint length"
          options={[
            { value: 7, label: "1wk" },
            { value: 14, label: "2wk" },
            { value: 21, label: "3wk" },
            { value: 28, label: "4wk" },
          ]}
          value={pendingDefaultSprintDays}
          onChange={setPendingDefaultSprintDays}
          hint="Pre-filled when you create a new sprint."
        />

        <SegmentedControl<7 | 30 | 90 | 0>
          name="settings-closed-retention"
          legend="Keep closed todos for"
          options={[
            { value: 7, label: "7 days" },
            { value: 30, label: "30 days" },
            { value: 90, label: "90 days" },
            { value: 0, label: "Forever" },
          ]}
          value={pendingClosedRetention ?? 0}
          onChange={(v) => setPendingClosedRetention(v === 0 ? null : v)}
          hint="Closed todos older than this are automatically removed. Forever keeps all closed todos (count cap still applies)."
        />
        {isLowering ? (
          <span
            className="settings-hint settings-hint--info"
            role="status"
          >
            Closed todos older than {pendingClosedRetention} days will be
            removed on next purge. Export your data first if you want to
            keep them.
          </span>
        ) : null}
      </section>
    </div>
  );
}
