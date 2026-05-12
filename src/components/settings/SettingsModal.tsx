import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Modal } from "@/components/Modal";
import { useStore } from "@/storage/useStore";
import { resolvedSettings } from "@/storage/constants";
import type {
  GreetingStyle,
  LeadMinutes,
  ProclivityState,
  RecurrenceDefault,
  SnoozeMinutes,
  ThemeMode,
  TimeFormat,
  UserSettings,
  WeekStart,
} from "@/types";
import { exportData, importData } from "@/storage/exportImport";
import { SegmentedControl, ToggleSwitch } from "./SettingsControls";
import { NanoSection } from "./NanoSection";
import "./SettingsModal.css";

interface Props {
  open: boolean;
  onClose: () => void;
}

/* ─── Accent color presets ─────────────────────────────────── */

const ACCENT_PRESETS: ReadonlyArray<{ name: string; value: string }> = [
  { name: "Indigo", value: "#7c9cff" },
  { name: "Teal", value: "#5be3c3" },
  { name: "Rose", value: "#ff6b9d" },
  { name: "Amber", value: "#ffb86b" },
  { name: "Violet", value: "#a78bfa" },
  { name: "Sky", value: "#38bdf8" },
  { name: "Lime", value: "#86efac" },
  { name: "Orange", value: "#fb923c" },
];

/* ─── debounce ─────────────────────────────────────────────── */

function debounce<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  ms: number,
): (...args: TArgs) => void {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...args: TArgs) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/* ─── Detect locale defaults for hints ─────────────────────── */

function resolveSystemHourCycle(): "h12" | "h23" {
  try {
    const parts = new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
    }).formatToParts(new Date());
    const dayPeriod = parts.find((p) => p.type === "dayPeriod");
    return dayPeriod ? "h12" : "h23";
  } catch {
    return "h12";
  }
}

/* ─── SettingsModal ────────────────────────────────────────── */

export function SettingsModal({ open, onClose }: Props) {
  const { state, update } = useStore();
  const rs = useMemo(
    () => resolvedSettings(state.settings),
    [state.settings],
  );

  // Snapshot taken at open so Cancel/Escape/backdrop can revert.
  const snapshotRef = useRef<UserSettings | null>(null);

  // Apply-on-Done local state. Initialized at open from resolvedSettings.
  const [pendingName, setPendingName] = useState(rs.name);
  const [pendingWeekStart, setPendingWeekStart] = useState<WeekStart>(
    rs.weekStart,
  );
  const [pendingRelativeDates, setPendingRelativeDates] = useState(
    rs.relativeDates,
  );
  const [pendingLead, setPendingLead] = useState<LeadMinutes>(
    rs.defaultReminderLeadMinutes,
  );
  const [pendingRecurrence, setPendingRecurrence] = useState<RecurrenceDefault>(
    rs.defaultRecurrence,
  );
  const [pendingSnooze, setPendingSnooze] = useState<SnoozeMinutes>(
    rs.snoozeMinutes,
  );
  const [pendingQuietEnabled, setPendingQuietEnabled] = useState(
    rs.quietHours !== undefined,
  );
  const [pendingQuietFrom, setPendingQuietFrom] = useState(
    rs.quietHours?.from ?? "22:00",
  );
  const [pendingQuietTo, setPendingQuietTo] = useState(
    rs.quietHours?.to ?? "07:00",
  );
  const [pendingVisibility, setPendingVisibility] = useState(
    rs.sectionVisibility,
  );

  // Transient UI state
  const [exportFlash, setExportFlash] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [clearStage, setClearStage] = useState<"rest" | "confirm">("rest");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // On open: take snapshot, reset pending locals from current state,
  // and mark the V2 badge as seen.
  useEffect(() => {
    if (!open) return;
    snapshotRef.current = structuredClone(state.settings);
    setPendingName(rs.name);
    setPendingWeekStart(rs.weekStart);
    setPendingRelativeDates(rs.relativeDates);
    setPendingLead(rs.defaultReminderLeadMinutes);
    setPendingRecurrence(rs.defaultRecurrence);
    setPendingSnooze(rs.snoozeMinutes);
    setPendingQuietEnabled(rs.quietHours !== undefined);
    setPendingQuietFrom(rs.quietHours?.from ?? "22:00");
    setPendingQuietTo(rs.quietHours?.to ?? "07:00");
    setPendingVisibility(rs.sectionVisibility);
    setExportFlash(false);
    setImportError(null);
    setClearStage("rest");
    if (!rs.settingsV2Seen) {
      void update((s) => ({
        ...s,
        settings: { ...s.settings, settingsV2Seen: true },
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* ── Live-preview updaters ──────────────────────────────── */

  const live = useCallback(
    <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
      void update((s) => ({
        ...s,
        settings: { ...s.settings, [key]: value },
      }));
    },
    [update],
  );

  const liveDebounced = useMemo(
    () => debounce(live as (k: keyof UserSettings, v: unknown) => void, 150),
    [live],
  );

  /* ── Done / Cancel ──────────────────────────────────────── */

  const handleDone = async () => {
    const visibility = {
      today: pendingVisibility.today,
      sprint: pendingVisibility.sprint,
      longTerm: pendingVisibility.longTerm,
      gantt: pendingVisibility.gantt,
      reminders: pendingVisibility.reminders,
    };
    const trimmedName = pendingName.trim();
    const quietHours = pendingQuietEnabled
      ? { from: pendingQuietFrom, to: pendingQuietTo }
      : undefined;
    await update((s) => ({
      ...s,
      settings: {
        ...s.settings,
        name: trimmedName || undefined,
        weekStart: pendingWeekStart,
        relativeDates: pendingRelativeDates,
        defaultReminderLeadMinutes: pendingLead,
        defaultRecurrence: pendingRecurrence,
        snoozeMinutes: pendingSnooze,
        quietHours,
        sectionVisibility: visibility,
        settingsV2Seen: true,
      },
    }));
    onClose();
  };

  const handleCancel = async () => {
    const snap = snapshotRef.current;
    if (snap) {
      await update((s) => ({
        ...s,
        settings: { ...snap, settingsV2Seen: true },
      }));
    }
    onClose();
  };

  const crossesMidnight = pendingQuietFrom > pendingQuietTo;

  /* ── Export / Import / Clear ─────────────────────────────── */

  const handleExport = async () => {
    await exportData();
    setExportFlash(true);
    window.setTimeout(() => setExportFlash(false), 2500);
  };

  const handleImportClick = () => {
    setImportError(null);
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await importData(file);
    e.target.value = "";
    if (!result.ok) {
      setImportError(result.error);
      return;
    }
    onClose();
  };

  const handleClearAll = async () => {
    await update((): ProclivityState => ({
      todos: [],
      sprints: [],
      ganttCharts: [],
      ganttTasks: [],
      reminders: [],
      settings: { settingsV2Seen: true },
    }));
    onClose();
  };

  /* ── Render ───────────────────────────────────────────────── */

  return (
    <Modal
      open={open}
      onClose={handleCancel}
      title="Settings"
      panelClassName="settings-modal-panel"
    >
      <div className="settings-body">
        <AppearanceSection
          theme={rs.theme}
          accentColor={rs.accentColor}
          fontSize={rs.fontSize}
          density={rs.density}
          reducedMotion={rs.reducedMotion}
          live={live}
          liveDebounced={liveDebounced}
        />
        <BackgroundSection
          meshEnabled={rs.meshEnabled}
          meshIntensity={rs.meshIntensity}
          live={live}
          liveDebounced={liveDebounced}
        />
        <DateTimeSection
          timeFormat={rs.timeFormat}
          relativeDates={pendingRelativeDates}
          weekStart={pendingWeekStart}
          live={live}
          setPendingRelativeDates={setPendingRelativeDates}
          setPendingWeekStart={setPendingWeekStart}
        />
        <DisplaySection
          greetingStyle={rs.greetingStyle}
          live={live}
        />
        <NotificationsSection
          lead={pendingLead}
          snooze={pendingSnooze}
          quietEnabled={pendingQuietEnabled}
          quietFrom={pendingQuietFrom}
          quietTo={pendingQuietTo}
          crossesMidnight={crossesMidnight}
          setLead={setPendingLead}
          setSnooze={setPendingSnooze}
          setQuietEnabled={setPendingQuietEnabled}
          setQuietFrom={setPendingQuietFrom}
          setQuietTo={setPendingQuietTo}
        />
        <DashboardSection
          visibility={pendingVisibility}
          setVisibility={setPendingVisibility}
        />
        <AccountSection name={pendingName} setName={setPendingName} />
        <NanoSection />
        <DataSection
          exportFlash={exportFlash}
          importError={importError}
          clearStage={clearStage}
          setClearStage={setClearStage}
          onExport={handleExport}
          onImportClick={handleImportClick}
          onClearConfirm={handleClearAll}
          fileInputRef={fileInputRef}
          onFileSelected={handleFileSelected}
        />
      </div>
      <div className="settings-footer">
        <button type="button" onClick={handleCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="modal-btn-primary"
          onClick={handleDone}
        >
          Done
        </button>
      </div>
    </Modal>
  );
}

/* ═══ Sections ═════════════════════════════════════════════════ */

function SectionHeader({ children }: { children: ReactNode }) {
  return <h3 className="settings-section-heading">{children}</h3>;
}

/* ─── Appearance ─────────────────────────────────────────── */

interface LiveUpdater {
  <K extends keyof UserSettings>(key: K, value: UserSettings[K]): void;
}

function AppearanceSection({
  theme,
  accentColor,
  fontSize,
  density,
  reducedMotion,
  live,
  liveDebounced,
}: {
  theme: ThemeMode;
  accentColor: string;
  fontSize: "sm" | "md" | "lg";
  density: "compact" | "default" | "spacious";
  reducedMotion: boolean;
  live: LiveUpdater;
  liveDebounced: (k: keyof UserSettings, v: unknown) => void;
}) {
  const osReducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const isCustomAccent = !ACCENT_PRESETS.some(
    (p) => p.value.toLowerCase() === accentColor.toLowerCase(),
  );
  return (
    <section className="settings-section">
      <SectionHeader>Appearance</SectionHeader>

      <SegmentedControl<ThemeMode>
        name="settings-theme"
        legend="Theme"
        options={[
          { value: "system", label: "System" },
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
        ]}
        value={theme}
        onChange={(v) => live("theme", v)}
        hint="Follows your OS appearance when set to System."
      />

      <fieldset className="settings-field">
        <legend className="settings-label">Accent color</legend>
        <div
          className="accent-swatch-grid"
          role="radiogroup"
          aria-label="Accent color presets"
        >
          {ACCENT_PRESETS.map((color) => {
            const checked =
              color.value.toLowerCase() === accentColor.toLowerCase();
            return (
              <label
                key={color.value}
                className={`accent-swatch-label${
                  checked ? " is-active" : ""
                }`}
                title={color.name}
              >
                <input
                  type="radio"
                  name="accent-color"
                  value={color.value}
                  checked={checked}
                  onChange={() => live("accentColor", color.value)}
                  className="accent-swatch-input"
                  aria-label={color.name}
                />
                <span
                  className="accent-swatch"
                  style={
                    {
                      "--swatch-color": color.value,
                    } as React.CSSProperties
                  }
                  aria-hidden="true"
                />
              </label>
            );
          })}
          <label
            className={`accent-swatch-label accent-swatch-label--custom${
              isCustomAccent ? " is-active" : ""
            }`}
            title="Custom color"
          >
            <input
              type="color"
              value={isCustomAccent ? accentColor : "#7c9cff"}
              onChange={(e) => liveDebounced("accentColor", e.target.value)}
              className="accent-color-input"
              aria-label="Custom accent color"
            />
            <span className="accent-swatch accent-swatch--custom" aria-hidden="true" />
          </label>
        </div>
        <span className="settings-hint">
          Sets the highlight color for buttons, focus rings, and active elements.
        </span>
      </fieldset>

      <SegmentedControl
        name="settings-fontsize"
        legend="Font size"
        options={[
          { value: "sm", label: "S" },
          { value: "md", label: "M" },
          { value: "lg", label: "L" },
        ]}
        value={fontSize}
        onChange={(v) => live("fontSize", v)}
        hint="Adjusts text size across the entire page."
      />

      <SegmentedControl
        name="settings-density"
        legend="Density"
        options={[
          { value: "compact", label: "Compact" },
          { value: "default", label: "Default" },
          { value: "spacious", label: "Spacious" },
        ]}
        value={density}
        onChange={(v) => live("density", v)}
        hint="Controls row heights and spacing between elements."
      />

      <ToggleSwitch
        label="Reduce motion"
        checked={reducedMotion}
        onChange={(v) => live("reducedMotion", v)}
        systemForced={
          osReducedMotion && !reducedMotion
            ? "(on — your OS prefers reduced motion)"
            : undefined
        }
        hint="Pauses the mesh animation and disables UI transitions."
      />
    </section>
  );
}

/* ─── Background ─────────────────────────────────────────── */

function BackgroundSection({
  meshEnabled,
  meshIntensity,
  live,
  liveDebounced,
}: {
  meshEnabled: boolean;
  meshIntensity: number;
  live: LiveUpdater;
  liveDebounced: (k: keyof UserSettings, v: unknown) => void;
}) {
  return (
    <section className="settings-section">
      <SectionHeader>Background</SectionHeader>
      <ToggleSwitch
        label="Mesh background"
        checked={meshEnabled}
        onChange={(v) => live("meshEnabled", v)}
        hint="Animated 3D wireframe behind the page. Disable on older hardware."
      />
      <div
        className={`settings-field${meshEnabled ? "" : " is-disabled"}`}
      >
        <label className="settings-label" htmlFor="settings-mesh-intensity">
          Intensity
        </label>
        <div className="settings-range-row">
          <input
            id="settings-mesh-intensity"
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(meshIntensity * 100)}
            disabled={!meshEnabled}
            onChange={(e) =>
              liveDebounced("meshIntensity", Number(e.target.value) / 100)
            }
            aria-label="Mesh intensity"
          />
          <output className="settings-range-value">
            {Math.round(meshIntensity * 100)}%
          </output>
        </div>
        <span className="settings-hint">Opacity of the mesh wires.</span>
      </div>
    </section>
  );
}

/* ─── Date & Time ────────────────────────────────────────── */

function DateTimeSection({
  timeFormat,
  relativeDates,
  weekStart,
  live,
  setPendingRelativeDates,
  setPendingWeekStart,
}: {
  timeFormat: TimeFormat;
  relativeDates: boolean;
  weekStart: WeekStart;
  live: LiveUpdater;
  setPendingRelativeDates: (v: boolean) => void;
  setPendingWeekStart: (v: WeekStart) => void;
}) {
  const systemHourCycle = useMemo(() => resolveSystemHourCycle(), []);
  return (
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
      <ToggleSwitch
        label="Relative dates"
        checked={relativeDates}
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
        value={weekStart}
        onChange={setPendingWeekStart}
        hint="Sets the first day of the week in the Gantt view."
      />
    </section>
  );
}

/* ─── Display (greeting) ─────────────────────────────────── */

function DisplaySection({
  greetingStyle,
  live,
}: {
  greetingStyle: GreetingStyle;
  live: LiveUpdater;
}) {
  return (
    <section className="settings-section">
      <SectionHeader>Display</SectionHeader>
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
    </section>
  );
}

/* ─── Notifications ──────────────────────────────────────── */

function NotificationsSection({
  lead,
  snooze,
  quietEnabled,
  quietFrom,
  quietTo,
  crossesMidnight,
  setLead,
  setSnooze,
  setQuietEnabled,
  setQuietFrom,
  setQuietTo,
}: {
  lead: LeadMinutes;
  snooze: SnoozeMinutes;
  quietEnabled: boolean;
  quietFrom: string;
  quietTo: string;
  crossesMidnight: boolean;
  setLead: (v: LeadMinutes) => void;
  setSnooze: (v: SnoozeMinutes) => void;
  setQuietEnabled: (v: boolean) => void;
  setQuietFrom: (v: string) => void;
  setQuietTo: (v: string) => void;
}) {
  return (
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
        hint="Duration when you snooze a notification."
      />
      <ToggleSwitch
        label="Quiet hours"
        checked={quietEnabled}
        onChange={setQuietEnabled}
        hint="Silence notifications during set hours. Deferred notifications fire at the end of the quiet period."
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
              : `Notifications due in this window are deferred to ${quietTo}.`}
          </span>
        </div>
      ) : null}
    </section>
  );
}

/* ─── Dashboard (section visibility) ─────────────────────── */

function DashboardSection({
  visibility,
  setVisibility,
}: {
  visibility: {
    today: boolean;
    sprint: boolean;
    longTerm: boolean;
    gantt: boolean;
    reminders: boolean;
  };
  setVisibility: React.Dispatch<
    React.SetStateAction<{
      today: boolean;
      sprint: boolean;
      longTerm: boolean;
      gantt: boolean;
      reminders: boolean;
    }>
  >;
}) {
  const ROWS: Array<{
    key: keyof typeof visibility;
    label: string;
  }> = [
    { key: "today", label: "Today" },
    { key: "sprint", label: "Sprint" },
    { key: "longTerm", label: "Long-term" },
    { key: "gantt", label: "Gantt" },
    { key: "reminders", label: "Reminders" },
  ];
  const allHidden = ROWS.every((r) => !visibility[r.key]);
  return (
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
                checked={visibility[row.key]}
                onChange={(e) =>
                  setVisibility((v) => ({
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
  );
}

/* ─── Account (name) ─────────────────────────────────────── */

function AccountSection({
  name,
  setName,
}: {
  name: string;
  setName: (v: string) => void;
}) {
  return (
    <section className="settings-section">
      <SectionHeader>Account</SectionHeader>
      <label className="settings-field">
        <span className="settings-label">Your name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="What should we call you?"
          maxLength={48}
        />
        <span className="settings-hint">
          Appears in the greeting at the top of the page. Leave blank to omit.
        </span>
      </label>
    </section>
  );
}

/* ─── Data (export / import / clear) ─────────────────────── */

function DataSection({
  exportFlash,
  importError,
  clearStage,
  setClearStage,
  onExport,
  onImportClick,
  onClearConfirm,
  fileInputRef,
  onFileSelected,
}: {
  exportFlash: boolean;
  importError: string | null;
  clearStage: "rest" | "confirm";
  setClearStage: (v: "rest" | "confirm") => void;
  onExport: () => void;
  onImportClick: () => void;
  onClearConfirm: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <section className="settings-section settings-danger-zone">
      <SectionHeader>Data</SectionHeader>

      <div className="settings-action-row">
        <button
          type="button"
          className="settings-action-btn"
          onClick={onExport}
        >
          Export data
        </button>
        <button
          type="button"
          className="settings-action-btn"
          onClick={onImportClick}
        >
          Import data
        </button>
        {exportFlash ? (
          <span className="settings-action-flash" role="status">
            Exported
          </span>
        ) : null}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: "none" }}
        onChange={onFileSelected}
      />
      {importError ? (
        <span className="settings-hint settings-hint--error" role="alert">
          {importError}
        </span>
      ) : (
        <span className="settings-hint">
          Export downloads all your todos, sprints, Gantt charts, and reminders
          as a JSON file. Import replaces your current data.
        </span>
      )}

      <div className="settings-clear-zone">
        {clearStage === "rest" ? (
          <button
            type="button"
            className="btn-danger"
            onClick={() => setClearStage("confirm")}
          >
            Clear all data
          </button>
        ) : (
          <div className="settings-clear-confirm">
            <p>
              This will permanently delete all your todos, sprints, Gantt
              charts, and reminders. This action cannot be undone.
            </p>
            <div className="settings-clear-buttons">
              <button type="button" onClick={() => setClearStage("rest")}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={onClearConfirm}
              >
                Delete everything
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
