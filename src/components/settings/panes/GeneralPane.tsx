/**
 * GeneralPane — settings pane for general / personal preferences.
 *
 * Owns:
 *   - Your name (staged: pendingName)
 *   - Greeting style (live: greetingStyle)
 *   - Time format (live: timeFormat)
 *   - Week starts on (staged: pendingWeekStart)
 *   - Relative dates (staged: pendingRelativeDates)
 *   - Dashboard visible sections (staged: pendingVisibility)
 *
 * Agent B inserts into this pane:
 *   - Greeting schedule (standard / early-bird / night-owl) adjacent to greeting style
 *   - Today reset hour (day boundary) under time format
 */

import type { ReactNode } from "react";
import { SegmentedControl, ToggleSwitch } from "../SettingsControls";
import type {
  GreetingStyle,
  TimeFormat,
  UserSettings,
  WeekStart,
} from "@/types";

function SectionHeader({ children }: { children: ReactNode }) {
  return <h3 className="settings-section-heading">{children}</h3>;
}

interface LiveUpdater {
  <K extends keyof UserSettings>(key: K, value: UserSettings[K]): void;
}

/** Visibility shape for the dashboard section checkboxes. */
interface SectionVisibility {
  today: boolean;
  sprint: boolean;
  longTerm: boolean;
  gantt: boolean;
  reminders: boolean;
  calendar: boolean;
}

export interface GeneralPaneProps {
  // Staged
  pendingName: string;
  setPendingName: (v: string) => void;
  pendingWeekStart: WeekStart;
  setPendingWeekStart: (v: WeekStart) => void;
  pendingRelativeDates: boolean;
  setPendingRelativeDates: (v: boolean) => void;
  pendingVisibility: SectionVisibility;
  setPendingVisibility: React.Dispatch<React.SetStateAction<SectionVisibility>>;
  // Live
  greetingStyle: GreetingStyle;
  timeFormat: TimeFormat;
  live: LiveUpdater;
  /** Resolved system hour cycle hint for time format. */
  systemHourCycle: "h12" | "h23";
}

export function GeneralPane({
  pendingName,
  setPendingName,
  pendingWeekStart,
  setPendingWeekStart,
  pendingRelativeDates,
  setPendingRelativeDates,
  pendingVisibility,
  setPendingVisibility,
  greetingStyle,
  timeFormat,
  live,
  systemHourCycle,
}: GeneralPaneProps) {
  const ROWS: Array<{ key: keyof SectionVisibility; label: string }> = [
    { key: "today", label: "Today" },
    { key: "sprint", label: "Sprint" },
    { key: "longTerm", label: "Long-term" },
    { key: "gantt", label: "Gantt" },
    { key: "calendar", label: "Calendar" },
    { key: "reminders", label: "Reminders" },
  ];
  const allHidden = ROWS.every((r) => !pendingVisibility[r.key]);

  return (
    <div
      role="tabpanel"
      id="settings-pane-general"
      aria-labelledby="settings-tab-general"
      className="settings-pane"
    >
      {/* ── Your name ──────────────────────────────────────────── */}
      <section className="settings-section">
        <SectionHeader>Identity</SectionHeader>
        <label className="settings-field">
          <span className="settings-label">Your name</span>
          <input
            type="text"
            value={pendingName}
            onChange={(e) => setPendingName(e.target.value)}
            placeholder="What should we call you?"
            maxLength={48}
          />
          <span className="settings-hint">
            Appears in the greeting at the top of the page. Leave blank to omit.
          </span>
        </label>
      </section>

      {/* ── Greeting ───────────────────────────────────────────── */}
      <section className="settings-section">
        <SectionHeader>Greeting</SectionHeader>
        <SegmentedControl<GreetingStyle>
          name="settings-greeting"
          legend="Greeting"
          options={[
            { value: "none", label: "Off" },
            { value: "time-of-day", label: "With time of day" },
          ]}
          value={greetingStyle}
          onChange={(v) => live("greetingStyle", v)}
          hint={`Shows "Good morning, [name]" at the top of each new tab.`}
        />
        {/* Agent B: insert 'greetingSchedule' SegmentedControl here (Standard / Early bird / Night owl), hidden when greetingStyle === "none" */}
      </section>

      {/* ── Date & Time ────────────────────────────────────────── */}
      <section className="settings-section">
        <SectionHeader>Date &amp; Time</SectionHeader>
        <SegmentedControl<TimeFormat>
          name="settings-timeformat"
          legend="Time format"
          options={[
            { value: "auto", label: "System" },
            { value: "12h", label: "12h" },
            { value: "24h", label: "24h" },
          ]}
          value={timeFormat}
          onChange={(v) => live("timeFormat", v)}
          hint={
            timeFormat === "auto"
              ? `System: ${systemHourCycle === "h12" ? "12-hour" : "24-hour"} (from your browser locale)`
              : timeFormat === "12h"
                ? "Forces 12-hour display: 5:30 PM"
                : "Forces 24-hour display: 17:30"
          }
        />
        {/* Agent B: insert 'dayBoundaryHour' SegmentedControl here (12am / 3am / 5am) */}
        <ToggleSwitch
          label="Relative dates"
          checked={pendingRelativeDates}
          onChange={setPendingRelativeDates}
          hint={`Shows "2 days ago" for recent dates. Older dates always show the full date.`}
        />
        <SegmentedControl<WeekStart>
          name="settings-weekstart"
          legend="Week starts on"
          options={[
            { value: "sun", label: "Sun" },
            { value: "mon", label: "Mon" },
            { value: "sat", label: "Sat" },
          ]}
          value={pendingWeekStart}
          onChange={setPendingWeekStart}
          hint="Sets the first day of the week in the Gantt view."
        />
      </section>

      {/* ── Dashboard visibility ───────────────────────────────── */}
      <section className="settings-section">
        <SectionHeader>Dashboard</SectionHeader>
        <fieldset className="settings-field">
          <legend className="settings-label">Visible sections</legend>
          <span className="settings-hint">
            Choose which sections appear on your dashboard.
          </span>
          <div className="settings-check-list">
            {ROWS.map((row) => (
              <label key={row.key} className="settings-check-row">
                <input
                  type="checkbox"
                  checked={pendingVisibility[row.key]}
                  onChange={(e) =>
                    setPendingVisibility((v) => ({
                      ...v,
                      [row.key]: e.target.checked,
                    }))
                  }
                />
                <span>{row.label}</span>
              </label>
            ))}
          </div>
          {allHidden ? (
            <span className="settings-hint settings-hint--info" role="status">
              All sections are hidden. Your dashboard will appear empty.
            </span>
          ) : null}
        </fieldset>
      </section>
    </div>
  );
}
