export type TodoScope = "today" | "sprint" | "long";

/**
 * The active section/tab in the newtab UI. Hoisted to `src/types/` (m11 rect
 * M2) because the type now has three consumers — App.tsx (state owner),
 * CommandPalette.tsx (consumer via prop), and any future palette/keyboard
 * shell additions. Having a child component import a TYPE from its parent
 * (the previous arrangement) created inverse coupling; the hoist keeps the
 * type close to other domain primitives like TodoScope above.
 */
export type Tab =
  | "osint"
  | "today"
  | "sprint"
  | "long"
  | "gantt"
  | "reminders"
  | "calendar"
  | "finance"
  | "photos"
  | "closed";

/*
 * Note on optional fields: with `exactOptionalPropertyTypes` enabled, the
 * form `foo?: T` forbids `foo: undefined` literals. We use `?: T | undefined`
 * because the code spreads partial patches that may legitimately set fields
 * to `undefined` (e.g., clearing completedAt when un-checking a todo).
 */

/**
 * A reusable label that can be attached to Todos and Reminders.
 * `color` is a CSS hex string (e.g. "#7c9cff"). Using hex matches the
 * existing ACCENT_PRESETS convention and is compatible with both
 * `<input type="color">` and `color-mix(in srgb, …)`.
 * Never use an empty string sentinel here — callers should use a real default
 * hex (e.g. the first ACCENT_PRESET) if no color has been chosen.
 */
export interface Tag {
  id: string;
  label: string;
  /** Hex color, e.g. "#7c9cff". Must be a non-empty valid CSS hex string. */
  color: string;
}

export interface Todo {
  id: string;
  title: string;
  notes?: string | undefined;
  scope: TodoScope;
  done: boolean;
  createdAt: number;
  completedAt?: number | undefined;
  /** Reserved — no UI surface yet. Keep field shape stable for future due-date work. */
  dueAt?: number | undefined;
  sprintId?: string | undefined;
  /**
   * Schema v2 (sprint-backlog-redesign-m1): id of a parent todo this item
   * is a child of. Used by future "promote to sprint" / "pull into today"
   * flows to drive rollup progress chips on the parent. Reserved — no
   * reader/writer ships in m1.
   */
  parentId?: string | undefined;
  /**
   * Schema v2 (sprint-backlog-redesign-m1): optional target date for
   * long-term backlog items. Local-midnight ms timestamp. Reserved — no
   * reader/writer ships in m1.
   */
  targetDate?: number | undefined;
  /** Tag ids referencing ProclivityState.tags. Always present; empty array = untagged. */
  tags: string[];
  /**
   * Local-clock ms when the todo entered the **Closed pile** (i.e. `done` became
   * true via the close action). Distinct from `completedAt` so a closed todo's
   * age (used by the 30-day auto-purge) is not reset by minor re-edits.
   *
   * Backfilled lazily in `storage.get()` for legacy todos that predate the
   * closed-todos feature: any pre-existing `done: true` todo without a
   * `closedAt` is treated as if it closed at `completedAt ?? createdAt`.
   *
   * Cleared on reopen.
   */
  closedAt?: number | undefined;
  /**
   * The scope this todo will return to on reopen. Captured at close time so a
   * later state change (e.g. sprint deletion, scope edit on another item)
   * doesn't poison the restore target. Optional; if absent, reopen falls back
   * to the todo's current `scope`.
   */
  closedFromScope?: TodoScope | undefined;
  /**
   * The sprintId this todo will return to on reopen. Same rationale as
   * `closedFromScope`. Reopen validates this against the current sprint list
   * and drops it if the sprint no longer exists.
   */
  closedFromSprintId?: string | undefined;
}

/**
 * A time-boxed sprint.
 *
 * Interval convention: **closed (inclusive)** — `startsAt` is the first
 * day the sprint is active and `endsAt` is the last day (both inclusive).
 * Two back-to-back sprints where A ends on Tuesday and B starts on Tuesday
 * share that day; the calendar renders them on separate lanes.
 */
export interface Sprint {
  id: string;
  name: string;
  /** Local-midnight timestamp of the sprint's first day (inclusive). */
  startsAt: number;
  /** Local-midnight timestamp of the sprint's last day (inclusive). */
  endsAt: number;
  /**
   * Schema v2 (sprint-backlog-redesign-m1): explicit lifecycle state.
   *
   * - `"draft"` — created but not yet started (introduced in m2).
   * - `"active"` — in progress.
   * - `"closed"` — finished. Replaces the legacy `endsAt < today` archival
   *   heuristic. Backfilled by `storage.ts:normalizeState()` for legacy
   *   v1 data: `endsAt < localMidnight()` → `"closed"`, else `"active"`.
   *
   * Required. New sprints in m1 default to `"active"`; m2 will switch the
   * default to `"draft"` and introduce the "Start sprint" affordance.
   */
  state: "draft" | "active" | "closed";
  /**
   * Schema v2 (sprint-backlog-redesign-m1): optional one-line sprint goal,
   * surfaced in the active-sprint header by m3. Reserved — no reader/writer
   * ships in m1.
   */
  goal?: string | undefined;
  /**
   * Schema v2 (sprint-backlog-redesign-m1): optional retro note captured
   * when the user closes the sprint in m2. Reserved — no reader/writer ships
   * in m1.
   */
  retroNote?: string | undefined;
}

export interface GanttTask {
  id: string;
  chartId: string;
  parentId?: string | undefined;
  title: string;
  startsAt: number;
  endsAt: number;
  /** 0-100 integer. Forced to 100 in the UI when `done` is true. */
  progress: number;
  done: boolean;
  collapsed?: boolean | undefined;
  /** Reserved — no UI surface yet. Keep field shape stable for future per-task color picking. */
  color?: string | undefined;
}

export interface GanttChart {
  id: string;
  name: string;
  createdAt: number;
}

export interface Reminder {
  id: string;
  title: string;
  fireAt: number;
  recurrence?: "daily" | "weekly" | "none" | undefined;
  fired?: boolean | undefined;
  linkedTodoId?: string | undefined;
  /** Tag ids referencing ProclivityState.tags. Always present; empty array = untagged. */
  tags: string[];
}

/**
 * A reminder occurrence awaiting acknowledgement on the dashboard.
 *
 * Alerts are the in-app replacement for `chrome.notifications`: the service
 * worker enqueues one when a reminder alarm fires, the newtab renders it as a
 * persistent toast, and dismiss/snooze removes it. Stored under
 * ALERTS_STORAGE_KEY (not ProclivityState) so alert churn never touches the
 * main state tree or the export/import envelope.
 */
export interface PendingAlert {
  /** Unique per occurrence — a re-fire of the same reminder replaces the entry. */
  id: string;
  reminderId: string;
  /** Reminder title snapshot at fire time. */
  title: string;
  /** Epoch ms when the occurrence actually fired (or was caught up on reconcile). */
  firedAt: number;
  /** True when the occurrence fired while the SW was dead and was caught up late. */
  missed?: boolean | undefined;
}

/* ── Card view types ─────────────────────────────────────────────────── */

/**
 * Absolute position (and optional explicit size) of a card on its section canvas.
 * `z` is the stacking order — higher = on top.
 * `w` / `h` are the user-set dimensions in px, snapped to CARD_GRID_SIZE.
 * When absent the card falls back to its CSS min/auto size.
 * Written only on drag-end / resize-end; never on pointer-move.
 */
export interface CardPosition {
  x: number;
  y: number;
  /** Stacking order — bump to maxZ+1 on drag-start for "last-touched on top". */
  z: number;
  /** Explicit card width in px (snapped to CARD_GRID_SIZE). Absent = CSS default. */
  w?: number | undefined;
  /** Explicit card height in px (snapped to CARD_GRID_SIZE). Absent = CSS default. */
  h?: number | undefined;
}

/** Map from item id (todo.id or reminder.id) to its saved card position. */
export type CardLayoutMap = Record<string, CardPosition>;

/* ── Settings auxiliary unions ──────────────────────────────────────── */

export type ThemeMode = "light" | "dark" | "system";
export type FontSizeScale = "sm" | "md" | "lg";
export type DensityLevel = "compact" | "default" | "spacious";
export type MeshColorMode = "auto" | "manual";
export type TimeFormat = "auto" | "12h" | "24h";
export type WeekStart = "sun" | "mon" | "sat";
export type GreetingStyle = "none" | "time-of-day";
export type LayoutMode = "list" | "card";
export type LeadMinutes = 0 | 5 | 10 | 15 | 30 | 60;
export type SnoozeMinutes = 10 | 30 | 60;
export type RecurrenceDefault = "none" | "daily" | "weekly";
export type GreetingSchedule = "standard" | "earlyBird" | "nightOwl";
export type FocusRingMode = "auto" | "always";

/**
 * Identifies which pane is active in the SettingsModal sidebar.
 * Order matches the sidebar's visual order (General → … → Advanced).
 */
export type SettingsPaneId =
  | "general"
  | "appearance"
  | "notifications"
  | "todos"
  | "geminiNano"
  | "googlePhotos"
  | "googleCalendar"
  | "outlookCalendar"
  | "roadmaps"
  | "tags"
  | "data"
  | "advanced";

/**
 * User-configurable preferences. All fields are optional — an absent field
 * means "use the application default." See `DEFAULT_SETTINGS` and
 * `resolvedSettings()` in `src/storage/constants.ts` for the canonical
 * fallback values.
 */
export interface UserSettings {
  /** Display name appended to the greeting, e.g. "Good evening, Chris". */
  name?: string | undefined;

  // Appearance
  theme?: ThemeMode | undefined;
  accentColor?: string | undefined;
  density?: DensityLevel | undefined;
  fontSize?: FontSizeScale | undefined;
  reducedMotion?: boolean | undefined;
  /** Preferred width of the right-hand workspace companion, in CSS pixels. */
  workspaceCompanionWidthPx?: number | undefined;

  // Background
  meshEnabled?: boolean | undefined;
  meshIntensity?: number | undefined;
  meshColorMode?: MeshColorMode | undefined;
  meshColor?: string | undefined;

  // Locale / formatting
  timeFormat?: TimeFormat | undefined;
  relativeDates?: boolean | undefined;
  weekStart?: WeekStart | undefined;

  // Greeting
  greetingStyle?: GreetingStyle | undefined;
  /**
   * Adjusts the hour cutoffs for "Good morning / afternoon / evening".
   * standard: 5/12/17 (default), earlyBird: 4/11/16, nightOwl: 6/13/18.
   * Hidden in Settings when greetingStyle === "none".
   */
  greetingSchedule?: GreetingSchedule | undefined;
  /**
   * The hour (local) at which "today" resets. 0 = midnight (default),
   * 3 = 3am, 5 = 5am.
   *
   * WIRING SCOPE (audit current as of this commit):
   *   - ClosedTodosView "Today / Yesterday" grouping respects it.
   *   - Calendar's "today" highlight + midnight rollover does NOT.
   *   - Gantt date math does NOT.
   *   - Sprint date utils use raw `startOfDay`.
   * Expanding the scope requires a coordinated audit of every `startOfDay`
   * / `new Date()` callsite for date-of-record computation. Tracked as a
   * follow-up; the current partial wiring is intentional.
   */
  dayBoundaryHour?: 0 | 3 | 5 | undefined;

  // Section visibility (nested, all optional)
  sectionVisibility?:
    | {
        today?: boolean | undefined;
        sprint?: boolean | undefined;
        longTerm?: boolean | undefined;
        gantt?: boolean | undefined;
        reminders?: boolean | undefined;
        calendar?: boolean | undefined;
        photos?: boolean | undefined;
      }
    | undefined;

  // Reminders / notifications
  defaultReminderLeadMinutes?: LeadMinutes | undefined;
  defaultRecurrence?: RecurrenceDefault | undefined;
  snoozeMinutes?: SnoozeMinutes | undefined;
  quietHours?: { from: string; to: string } | undefined;

  /** Internal: UTC offset at last reminder save. Reserved — not surfaced in v1. */
  lastKnownTzOffset?: number | undefined;
  /** Internal: set to true on first open of the v2 Settings modal. Drives the "new" badge. */
  settingsV2Seen?: boolean | undefined;
  /**
   * The last sidebar pane the user visited. Restored on next open so the
   * modal reopens to the same section. Defaults to "general".
   */
  settingsLastPane?: SettingsPaneId | undefined;
  /**
   * Whether the user has visited the Gemini Nano pane at least once.
   * Controls the "NEW" badge on the sidebar entry. Defaults to false.
   */
  geminiNanoSeen?: boolean | undefined;

  /**
   * Gemini Nano (on-device LLM) preferences. Reserved fields pre-declared
   * here so `gemini-nano-m2`'s chat panel can land without a separate
   * type-shape commit. `chatEnabled` defaults to false until m2 ships.
   */
  geminiNano?:
    | {
        chatEnabled?: boolean | undefined;
        chatPosition?: "right" | "bottom" | undefined;
      }
    | undefined;

  /**
   * Google Photos widget preferences. The picked-photo cache itself lives
   * under its own chrome.storage key (PHOTOS_STORAGE_KEY) and is intentionally
   * NOT mirrored into UserSettings so export/import payloads stay slim.
   *
   *   slideshowIntervalSeconds — seconds between slides in the banner.
   *     Default 8. Clamped to [3, 300] in the UI.
   *   displayMode — controls banner height and how the image fits:
   *     "crop"    fixed-height strip, image cropped to fill (default)
   *     "full"    taller banner, image fully visible (letterboxed if portrait)
   *     "compact" short banner with a centered scaled-down image
   *   shuffle — randomise slide order. Default false (chronological).
   */
  googlePhotos?:
    | {
        slideshowIntervalSeconds?: number | undefined;
        displayMode?: "crop" | "full" | "compact" | undefined;
        shuffle?: boolean | undefined;
      }
    | undefined;

  /**
   * Roadmap ingest / write-back preferences (Phase G). NON-SECRET only — the
   * Obsidian host, API key, source list, and write-back cursor live in a
   * dedicated `chrome.storage.local` key (ROADMAP_STORAGE_KEY) via
   * `src/lib/roadmap/store.ts`, intentionally OUT of UserSettings and the
   * export/import blob so the secret never lands in a backup.
   *
   *   defaultScope    — scope for ingested task/spike todos. Default "today"
   *                     because Long-term ships hidden; "today" surfaces them
   *                     immediately.
   *   surfaceInGantt  — when false, skip gantt upsert and prune rm: charts/tasks.
   *   autoSyncOnOpen  — default false (respects a manual cadence + avoids a
   *                     fetch on every new-tab open).
   */
  roadmap?:
    | {
        defaultScope?: TodoScope | undefined;
        surfaceInGantt?: boolean | undefined;
        autoSyncOnOpen?: boolean | undefined;
      }
    | undefined;

  /** Card view layout mode. Default "list" (existing behavior). */
  layoutMode?: LayoutMode | undefined;
  /**
   * D7/L2 fix: whether the card-mode onboarding hint has been dismissed.
   * Persisted per-extension so the hint doesn't reappear on new tabs.
   */
  cardHintSeen?: boolean | undefined;

  /**
   * Default sprint duration in days when creating a new sprint.
   * Maps to 1wk / 2wk / 3wk / 4wk presets.
   */
  defaultSprintDays?: 7 | 14 | 21 | 28 | undefined;
  /**
   * How many days to keep closed todos before purging. null = forever (no
   * age-based purge; the count cap CLOSED_TODO_MAX still applies).
   */
  closedTodoRetentionDays?: 7 | 30 | 90 | null | undefined;
  /**
   * Controls focus-ring visibility. "auto" (default): browser default
   * (:focus-visible only). "always": rings appear on every :focus so
   * hybrid mouse+keyboard users never lose track of focus.
   */
  focusRingMode?: FocusRingMode | undefined;
  /**
   * Epoch ms of the most recent successful export. Written by exportData()
   * in src/storage/exportImport.ts. Intentionally preserved across
   * Clear-all-data so the user's backup recency is always visible.
   */
  lastExportAt?: number | undefined;

  /**
   * Observability / developer debug toggle. Drives the runtime verbosity
   * of `src/observability/logger.ts`. When `enabled` is false, only
   * `info`/`warn`/`error` reach the console — `trace`/`debug` are
   * suppressed. When true, `trace`/`debug` emit for namespaces matching
   * the comma-separated DEBUG-style glob (e.g. `"nano:*,storage:*"`
   * or just `"*"`). Phase 1 of the observability rollout —
   * see plans/observability-plan.md.
   */
  debug?:
    | {
        enabled?: boolean | undefined;
        namespaces?: string | undefined;
      }
    | undefined;
}

/**
 * The fully-resolved form of UserSettings with defaults applied. Returned
 * by `resolvedSettings()`. Every field has a guaranteed value except for
 * `quietHours` and `lastKnownTzOffset`, which are nullable by design
 * (undefined = feature disabled / not yet known).
 */
export interface ResolvedUserSettings {
  name: string;
  theme: ThemeMode;
  accentColor: string;
  density: DensityLevel;
  fontSize: FontSizeScale;
  reducedMotion: boolean;
  /** Preferred right-hand companion width, clamped to the global 280–720px range. */
  workspaceCompanionWidthPx: number;
  meshEnabled: boolean;
  meshIntensity: number;
  meshColorMode: MeshColorMode;
  meshColor: string;
  timeFormat: TimeFormat;
  relativeDates: boolean;
  weekStart: WeekStart;
  greetingStyle: GreetingStyle;
  greetingSchedule: GreetingSchedule;
  dayBoundaryHour: 0 | 3 | 5;
  sectionVisibility: {
    today: boolean;
    sprint: boolean;
    longTerm: boolean;
    gantt: boolean;
    reminders: boolean;
    calendar: boolean;
    photos: boolean;
  };
  defaultReminderLeadMinutes: LeadMinutes;
  defaultRecurrence: RecurrenceDefault;
  snoozeMinutes: SnoozeMinutes;
  quietHours: { from: string; to: string } | undefined;
  lastKnownTzOffset: number | undefined;
  settingsV2Seen: boolean;
  /** Last visited settings pane; restored on next modal open. Default "general". */
  settingsLastPane: SettingsPaneId;
  /** Whether the user has visited the Gemini Nano pane. Drives the sidebar "NEW" badge. */
  geminiNanoSeen: boolean;
  /** Google Photos widget settings — always present with defaults in resolved form. */
  googlePhotos: {
    slideshowIntervalSeconds: number;
    displayMode: "crop" | "full" | "compact";
    shuffle: boolean;
  };
  /** Gemini Nano chat panel settings — always present with defaults in resolved form. */
  geminiNano: {
    chatEnabled: boolean;
    chatPosition: "right" | "bottom";
  };
  /** Roadmap ingest prefs — always present with defaults in resolved form. */
  roadmap: {
    defaultScope: TodoScope;
    surfaceInGantt: boolean;
    autoSyncOnOpen: boolean;
  };
  /** Card view layout mode — always present with default "list". */
  layoutMode: LayoutMode;
  /** Whether the card-mode onboarding hint has been dismissed (per-extension). */
  cardHintSeen: boolean;
  /** Default sprint length in days (7/14/21/28). Default 14. */
  defaultSprintDays: 7 | 14 | 21 | 28;
  /** Closed-todo retention days. null = forever. Default 30. */
  closedTodoRetentionDays: 7 | 30 | 90 | null;
  /** Focus-ring mode. "auto" = browser default, "always" = always visible. */
  focusRingMode: FocusRingMode;
  /**
   * Epoch ms of the last successful export. Remains undefined until the
   * user exports at least once (preserved across Clear-all).
   */
  lastExportAt: number | undefined;
  /** Observability config — always present with defaults `{ enabled: false, namespaces: "*" }`. */
  debug: {
    enabled: boolean;
    namespaces: string;
  };
}

export interface ProclivityState {
  todos: Todo[];
  sprints: Sprint[];
  activeSprintId?: string | undefined;
  ganttCharts: GanttChart[];
  ganttTasks: GanttTask[];
  reminders: Reminder[];
  settings: UserSettings;
  /** Global tag registry. Items reference entries here by id. */
  tags: Tag[];
  /**
   * Saved card positions keyed by item id (todo.id or reminder.id).
   * Absent means no positions saved yet (list mode or first-ever card-mode
   * activation). Lazily populated the first time a section renders in card mode.
   */
  cardLayouts?: CardLayoutMap | undefined;
}

export const EMPTY_STATE: ProclivityState = {
  todos: [],
  sprints: [],
  ganttCharts: [],
  ganttTasks: [],
  reminders: [],
  settings: {},
  tags: [],
};
