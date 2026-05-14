import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ConfirmDialog, Modal } from "@/components/Modal";
import { useStore } from "@/storage/useStore";
import { resolvedSettings } from "@/storage/constants";
import type {
  FocusRingMode,
  GreetingSchedule,
  LeadMinutes,
  ProclivityState,
  RecurrenceDefault,
  SettingsPaneId,
  SnoozeMinutes,
  UserSettings,
  WeekStart,
} from "@/types";
import { exportData, importData } from "@/storage/exportImport";
import { SettingsSidebar } from "./SettingsSidebar";
import { GeneralPane } from "./panes/GeneralPane";
import { AppearancePane } from "./panes/AppearancePane";
import { NotificationsPane } from "./panes/NotificationsPane";
import { TodosPane } from "./panes/TodosPane";
import { GeminiNanoPane } from "./panes/GeminiNanoPane";
import { GooglePhotosPane } from "./panes/GooglePhotosPane";
import { TagsPane } from "./panes/TagsPane";
import { DataPane } from "./panes/DataPane";
import { AdvancedPane } from "./panes/AdvancedPane";
import "./SettingsModal.css";

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

/* ─── Props ────────────────────────────────────────────────── */

interface Props {
  open: boolean;
  onClose: () => void;
  /**
   * Deep-link: open the modal directly to this pane.
   * Caller (App.tsx) can read the `?settings=<paneId>` URL param and pass
   * it here. Agent A does NOT wire up the URL parse — that is a follow-up
   * for the caller to implement. When provided, takes precedence over the
   * persisted settingsLastPane on first open.
   */
  initialPane?: SettingsPaneId | undefined;
}

/* ─── SettingsModal ────────────────────────────────────────── */

export function SettingsModal({ open, onClose, initialPane }: Props) {
  const { state, update } = useStore();
  const rs = useMemo(
    () => resolvedSettings(state.settings),
    [state.settings],
  );

  // Snapshot taken at open so Cancel/Escape/backdrop can revert.
  // Includes cardLayouts so dragging cards while settings is open
  // doesn't survive a Cancel (H4 fix preserved from previous impl).
  const snapshotRef = useRef<{
    settings: UserSettings;
    cardLayouts: ProclivityState["cardLayouts"];
  } | null>(null);

  /* ── Active pane ─────────────────────────────────────────── */

  // Initialized from: initialPane prop → persisted lastPane → "general"
  const [paneId, setPaneId] = useState<SettingsPaneId>(
    () => initialPane ?? rs.settingsLastPane,
  );

  /* ── Staged (apply-on-Done) local state ──────────────────── */

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
  const [pendingGreetingSchedule, setPendingGreetingSchedule] =
    useState<GreetingSchedule>(rs.greetingSchedule);
  const [pendingDayBoundaryHour, setPendingDayBoundaryHour] = useState<
    0 | 3 | 5
  >(rs.dayBoundaryHour);
  const [pendingDefaultSprintDays, setPendingDefaultSprintDays] = useState<
    7 | 14 | 21 | 28
  >(rs.defaultSprintDays);
  const [pendingClosedRetention, setPendingClosedRetention] = useState<
    7 | 30 | 90 | null
  >(rs.closedTodoRetentionDays);
  const [pendingFocusRingMode, setPendingFocusRingMode] =
    useState<FocusRingMode>(rs.focusRingMode);
  const [pendingChatPosition, setPendingChatPosition] = useState<
    "right" | "bottom"
  >(rs.geminiNano.chatPosition);

  /* ── Dirty tracking ─────────────────────────────────────── */

  // `dirty` is true when any staged field has been changed since the last
  // open / Done / Cancel. Used to gate the "Discard unsaved changes?" dialog.
  const [dirty, setDirty] = useState(false);
  // When the user tries to switch panes while dirty, we stash the target pane
  // here and show the discard dialog before committing the switch.
  const [pendingPaneSwitch, setPendingPaneSwitch] =
    useState<SettingsPaneId | null>(null);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  // Wrap each staged setter to flip dirty on change.
  function makeDirty<T>(setter: (v: T) => void): (v: T) => void {
    return (v: T) => {
      setter(v);
      setDirty(true);
    };
  }

  /* ── Transient UI state ──────────────────────────────────── */

  const [exportFlash, setExportFlash] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [clearStage, setClearStage] = useState<"rest" | "confirm">("rest");
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Open effect: snapshot + reset pending + V2 badge ──────── */

  useEffect(() => {
    if (!open) return;
    snapshotRef.current = {
      settings: structuredClone(state.settings),
      cardLayouts: structuredClone(state.cardLayouts),
    };
    // Reset pane: deep-link prop wins, then persisted last-pane, then "general"
    setPaneId(initialPane ?? rs.settingsLastPane);
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
    setPendingGreetingSchedule(rs.greetingSchedule);
    setPendingDayBoundaryHour(rs.dayBoundaryHour);
    setPendingDefaultSprintDays(rs.defaultSprintDays);
    setPendingClosedRetention(rs.closedTodoRetentionDays);
    setPendingFocusRingMode(rs.focusRingMode);
    setPendingChatPosition(rs.geminiNano.chatPosition);
    setExportFlash(false);
    setImportError(null);
    setClearStage("rest");
    setDirty(false);
    setPendingPaneSwitch(null);
    setShowDiscardDialog(false);
    // Mark v2 settings as seen (existing badge behavior)
    if (!rs.settingsV2Seen) {
      void update((s) => ({
        ...s,
        settings: { ...s.settings, settingsV2Seen: true },
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* ── Sidebar pane change ──────────────────────────────────── */

  const handleChangePane = useCallback(
    (id: SettingsPaneId) => {
      if (id === paneId) return; // no-op if already on this pane
      if (dirty) {
        // Stash the target pane and show the discard dialog.
        setPendingPaneSwitch(id);
        setShowDiscardDialog(true);
        return;
      }
      setPaneId(id);
      // Persist last-visited pane immediately (UI affordance, not a settings value —
      // does not need to wait for Done, not included in snapshot/revert).
      void update((s) => ({
        ...s,
        settings: { ...s.settings, settingsLastPane: id },
      }));
      // Mark Gemini Nano as seen on first visit
      if (id === "geminiNano" && !rs.geminiNanoSeen) {
        void update((s) => ({
          ...s,
          settings: { ...s.settings, geminiNanoSeen: true },
        }));
      }
    },
    [update, rs.geminiNanoSeen, paneId, dirty],
  );

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

  /* ── System hour cycle (memoized once) ───────────────────── */

  const systemHourCycle = useMemo(() => resolveSystemHourCycle(), []);

  /* ── Done / Cancel ──────────────────────────────────────── */

  const handleDone = async () => {
    const visibility = {
      today: pendingVisibility.today,
      sprint: pendingVisibility.sprint,
      longTerm: pendingVisibility.longTerm,
      gantt: pendingVisibility.gantt,
      reminders: pendingVisibility.reminders,
      calendar: pendingVisibility.calendar,
      photos: pendingVisibility.photos,
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
        greetingSchedule: pendingGreetingSchedule,
        dayBoundaryHour: pendingDayBoundaryHour,
        defaultSprintDays: pendingDefaultSprintDays,
        // closedTodoRetentionDays may be null ("forever") — preserve that.
        ...(pendingClosedRetention !== null
          ? { closedTodoRetentionDays: pendingClosedRetention }
          : { closedTodoRetentionDays: null as null }),
        focusRingMode: pendingFocusRingMode,
        geminiNano: {
          ...s.settings.geminiNano,
          chatPosition: pendingChatPosition,
        },
        settingsV2Seen: true,
      },
    }));
    setDirty(false);
    onClose();
  };

  const handleCancel = async () => {
    const snap = snapshotRef.current;
    if (snap) {
      await update((s) => ({
        ...s,
        settings: { ...snap.settings, settingsV2Seen: true },
        // H4 fix: restore cardLayouts so positions dragged during settings preview
        // are reverted when the user cancels.
        cardLayouts: snap.cardLayouts,
      }));
    }
    setDirty(false);
    onClose();
  };

  /**
   * Called when the user dismisses the "Discard unsaved changes?" dialog
   * by clicking "Discard". Runs the full cancel path then executes any
   * pending pane switch (if the discard was triggered by a pane-switch attempt).
   */
  const handleDiscardConfirm = useCallback(async () => {
    const targetPane = pendingPaneSwitch;
    setPendingPaneSwitch(null);
    setShowDiscardDialog(false);
    if (targetPane !== null) {
      // User clicked a different pane — discard + switch
      const snap = snapshotRef.current;
      if (snap) {
        await update((s) => ({
          ...s,
          settings: { ...snap.settings, settingsV2Seen: true },
          cardLayouts: snap.cardLayouts,
        }));
      }
      setDirty(false);
      setPaneId(targetPane);
      void update((s) => ({
        ...s,
        settings: { ...s.settings, settingsLastPane: targetPane },
      }));
      if (targetPane === "geminiNano" && !rs.geminiNanoSeen) {
        void update((s) => ({
          ...s,
          settings: { ...s.settings, geminiNanoSeen: true },
        }));
      }
    } else {
      // User clicked Cancel/Escape/backdrop — discard + close
      await handleCancel();
    }
  }, [pendingPaneSwitch, update, rs.geminiNanoSeen, handleCancel]);

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
    await update((s): ProclivityState => ({
      todos: [],
      sprints: [],
      ganttCharts: [],
      ganttTasks: [],
      reminders: [],
      // Preserve lastExportAt across Clear-all so backup recency always shows
      // accurate data (the user cleared their content, not their export history).
      settings: {
        settingsV2Seen: true,
        ...(s.settings.lastExportAt !== undefined
          ? { lastExportAt: s.settings.lastExportAt }
          : undefined),
      },
      tags: [],
    }));
    onClose();
  };

  /* ── Active pane renderer ─────────────────────────────────── */

  const renderPane = () => {
    switch (paneId) {
      case "general":
        return (
          <GeneralPane
            pendingName={pendingName}
            setPendingName={makeDirty(setPendingName)}
            pendingWeekStart={pendingWeekStart}
            setPendingWeekStart={makeDirty(setPendingWeekStart)}
            pendingRelativeDates={pendingRelativeDates}
            setPendingRelativeDates={makeDirty(setPendingRelativeDates)}
            pendingVisibility={pendingVisibility}
            setPendingVisibility={makeDirty(setPendingVisibility)}
            pendingGreetingSchedule={pendingGreetingSchedule}
            setPendingGreetingSchedule={makeDirty(setPendingGreetingSchedule)}
            pendingDayBoundaryHour={pendingDayBoundaryHour}
            setPendingDayBoundaryHour={makeDirty(setPendingDayBoundaryHour)}
            greetingStyle={rs.greetingStyle}
            timeFormat={rs.timeFormat}
            live={live}
            systemHourCycle={systemHourCycle}
          />
        );
      case "appearance":
        return (
          <AppearancePane
            theme={rs.theme}
            accentColor={rs.accentColor}
            fontSize={rs.fontSize}
            density={rs.density}
            reducedMotion={rs.reducedMotion}
            meshEnabled={rs.meshEnabled}
            meshIntensity={rs.meshIntensity}
            live={live}
            liveDebounced={liveDebounced}
          />
        );
      case "notifications":
        return (
          <NotificationsPane
            lead={pendingLead}
            setLead={makeDirty(setPendingLead)}
            recurrence={pendingRecurrence}
            setRecurrence={makeDirty(setPendingRecurrence)}
            snooze={pendingSnooze}
            setSnooze={makeDirty(setPendingSnooze)}
            quietEnabled={pendingQuietEnabled}
            setQuietEnabled={makeDirty(setPendingQuietEnabled)}
            quietFrom={pendingQuietFrom}
            setQuietFrom={makeDirty(setPendingQuietFrom)}
            quietTo={pendingQuietTo}
            setQuietTo={makeDirty(setPendingQuietTo)}
            crossesMidnight={crossesMidnight}
          />
        );
      case "todos":
        return (
          <TodosPane
            layoutMode={rs.layoutMode}
            live={live}
            pendingDefaultSprintDays={pendingDefaultSprintDays}
            setPendingDefaultSprintDays={makeDirty(setPendingDefaultSprintDays)}
            pendingClosedRetention={pendingClosedRetention}
            setPendingClosedRetention={makeDirty(setPendingClosedRetention)}
            savedClosedRetention={rs.closedTodoRetentionDays}
          />
        );
      case "geminiNano":
        return (
          <GeminiNanoPane
            pendingChatPosition={pendingChatPosition}
            setPendingChatPosition={makeDirty(setPendingChatPosition)}
          />
        );
      case "googlePhotos":
        return (
          <GooglePhotosPane
            slideshowIntervalSeconds={rs.googlePhotos.slideshowIntervalSeconds}
            displayMode={rs.googlePhotos.displayMode}
            shuffle={rs.googlePhotos.shuffle}
            pendingPhotosVisible={pendingVisibility.photos}
            setPendingPhotosVisible={(v) => {
              const next = { ...pendingVisibility, photos: v };
              makeDirty(setPendingVisibility)(next);
            }}
            live={live}
          />
        );
      case "tags":
        return <TagsPane tags={state.tags} />;
      case "data":
        return (
          <DataPane
            exportFlash={exportFlash}
            importError={importError}
            clearStage={clearStage}
            setClearStage={setClearStage}
            onExport={handleExport}
            onImportClick={handleImportClick}
            onClearConfirm={handleClearAll}
            fileInputRef={fileInputRef}
            onFileSelected={handleFileSelected}
            lastExportAt={rs.lastExportAt}
          />
        );
      case "advanced":
        return (
          <AdvancedPane
            debugEnabled={rs.debug.enabled}
            debugNamespaces={rs.debug.namespaces}
            live={live}
            pendingFocusRingMode={pendingFocusRingMode}
            setPendingFocusRingMode={makeDirty(setPendingFocusRingMode)}
          />
        );
    }
  };

  /* ── Render ───────────────────────────────────────────────── */

  // When the user presses Escape or clicks the backdrop while dirty,
  // intercept the close and show the discard dialog instead.
  const handleRequestClose = useCallback(() => {
    if (dirty) {
      setPendingPaneSwitch(null); // no pane switch — just close
      setShowDiscardDialog(true);
    } else {
      void handleCancel();
    }
  }, [dirty, handleCancel]);

  return (
    <>
    <Modal
      open={open}
      onClose={handleRequestClose}
      title="Settings"
      panelClassName="settings-modal-panel"
    >
      <div className="settings-layout">
        <SettingsSidebar
          paneId={paneId}
          onChangePane={handleChangePane}
          unseenNano={!rs.geminiNanoSeen}
          dirty={dirty}
        />
        <div className="settings-content">
          <div className="settings-pane-scroll">
            {renderPane()}
          </div>
          <div className="settings-footer">
            <button type="button" onClick={handleRequestClose}>
              Cancel
            </button>
            <button
              type="button"
              className="modal-btn-primary"
              onClick={() => void handleDone()}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </Modal>
    <ConfirmDialog
      open={showDiscardDialog}
      title="Discard unsaved changes?"
      message="You have unsaved changes. Discard them and continue, or go back to keep editing."
      confirmLabel="Discard"
      onConfirm={() => void handleDiscardConfirm()}
      onClose={() => {
        setShowDiscardDialog(false);
        setPendingPaneSwitch(null);
      }}
    />
    </>
  );
}
