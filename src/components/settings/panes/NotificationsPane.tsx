/**
 * NotificationsPane — settings pane for reminders and in-app alert behavior.
 *
 * Reminders surface as in-app alert toasts on the dashboard (plus a toolbar
 * badge count), not OS notifications — see ReminderAlerts.tsx. All settings
 * below govern that in-app pipeline.
 *
 * Owns (all staged — apply on Done):
 *   - Default reminder lead time (defaultReminderLeadMinutes)
 *   - Default recurrence (defaultRecurrence) — latent, surfaced here
 *   - Snooze duration (snoozeMinutes)
 *   - Quiet hours (quietHours)
 *
 * Agent B inserts into this pane:
 *   - 'defaultRecurrence' SegmentedControl (None / Daily / Weekly) between
 *     lead time and snooze duration — fix for the bug-shaped TODO in the
 *     research brief (the field is declared + staged but was never rendered)
 */

import type { ReactNode } from "react";
import { SegmentedControl, ToggleSwitch } from "../SettingsControls";
import type {
  LeadMinutes,
  RecurrenceDefault,
  SnoozeMinutes,
} from "@/types";

function SectionHeader({ children }: { children: ReactNode }) {
  return <h3 className="settings-section-heading">{children}</h3>;
}

export interface NotificationsPaneProps {
  lead: LeadMinutes;
  setLead: (v: LeadMinutes) => void;
  recurrence: RecurrenceDefault;
  setRecurrence: (v: RecurrenceDefault) => void;
  snooze: SnoozeMinutes;
  setSnooze: (v: SnoozeMinutes) => void;
  quietEnabled: boolean;
  setQuietEnabled: (v: boolean) => void;
  quietFrom: string;
  setQuietFrom: (v: string) => void;
  quietTo: string;
  setQuietTo: (v: string) => void;
  crossesMidnight: boolean;
}

export function NotificationsPane({
  lead,
  setLead,
  recurrence,
  setRecurrence,
  snooze,
  setSnooze,
  quietEnabled,
  setQuietEnabled,
  quietFrom,
  setQuietFrom,
  quietTo,
  setQuietTo,
  crossesMidnight,
}: NotificationsPaneProps) {
  return (
    <div
      role="tabpanel"
      id="settings-pane-notifications"
      aria-labelledby="settings-tab-notifications"
      className="settings-pane"
    >
      <section className="settings-section">
        <SectionHeader>Notifications</SectionHeader>

        <SegmentedControl<LeadMinutes>
          name="settings-lead"
          legend="Default reminder lead time"
          options={[
            { value: 0, label: "None" },
            { value: 5, label: "5m" },
            { value: 10, label: "10m" },
            { value: 15, label: "15m" },
            { value: 30, label: "30m" },
            { value: 60, label: "1hr" },
          ]}
          value={lead}
          onChange={setLead}
          hint="Pre-filled when you create a new reminder."
        />

        <SegmentedControl<RecurrenceDefault>
          name="settings-recurrence"
          legend="Default recurrence"
          options={[
            { value: "none", label: "None" },
            { value: "daily", label: "Daily" },
            { value: "weekly", label: "Weekly" },
          ]}
          value={recurrence}
          onChange={setRecurrence}
          hint="Pre-filled when you create a new reminder."
        />

        <SegmentedControl<SnoozeMinutes>
          name="settings-snooze"
          legend="Snooze duration"
          options={[
            { value: 10, label: "10m" },
            { value: 30, label: "30m" },
            { value: 60, label: "1hr" },
          ]}
          value={snooze}
          onChange={setSnooze}
          hint="Duration when you snooze an alert."
        />

        <ToggleSwitch
          label="Quiet hours"
          checked={quietEnabled}
          onChange={setQuietEnabled}
          hint="Silence alerts during set hours. Deferred alerts fire at the end of the quiet period."
        />
        {quietEnabled ? (
          <div className="settings-quiet-hours">
            <div className="settings-quiet-hours-row">
              <label
                htmlFor="settings-quiet-from"
                className="settings-quiet-label"
              >
                From
              </label>
              <input
                id="settings-quiet-from"
                type="time"
                value={quietFrom}
                onChange={(e) => setQuietFrom(e.target.value)}
              />
              <label
                htmlFor="settings-quiet-to"
                className="settings-quiet-label"
              >
                to
              </label>
              <input
                id="settings-quiet-to"
                type="time"
                value={quietTo}
                onChange={(e) => setQuietTo(e.target.value)}
              />
            </div>
            <span
              className={`settings-hint${
                crossesMidnight ? " settings-hint--info" : ""
              }`}
              role={crossesMidnight ? "status" : undefined}
            >
              {crossesMidnight
                ? `Quiet period spans midnight — ends at ${quietTo} the following day.`
                : `Alerts due in this window are deferred to ${quietTo}.`}
            </span>
          </div>
        ) : null}
      </section>
    </div>
  );
}
