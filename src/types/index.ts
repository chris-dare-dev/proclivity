export type TodoScope = "today" | "sprint" | "long";

/*
 * Note on optional fields: with `exactOptionalPropertyTypes` enabled, the
 * form `foo?: T` forbids `foo: undefined` literals. We use `?: T | undefined`
 * because the code spreads partial patches that may legitimately set fields
 * to `undefined` (e.g., clearing completedAt when un-checking a todo).
 */

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
}

export interface Sprint {
  id: string;
  name: string;
  startsAt: number;
  endsAt: number;
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
}

/* ── Settings auxiliary unions ──────────────────────────────────────── */

export type ThemeMode = "light" | "dark" | "system";
export type FontSizeScale = "sm" | "md" | "lg";
export type DensityLevel = "compact" | "default" | "spacious";
export type MeshColorMode = "auto" | "manual";
export type TimeFormat = "auto" | "12h" | "24h";
export type WeekStart = "sun" | "mon" | "sat";
export type GreetingStyle = "none" | "time-of-day";
export type LeadMinutes = 0 | 5 | 10 | 15 | 30 | 60;
export type SnoozeMinutes = 10 | 30 | 60;
export type RecurrenceDefault = "none" | "daily" | "weekly";

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

  // Section visibility (nested, all optional)
  sectionVisibility?:
    | {
        today?: boolean | undefined;
        sprint?: boolean | undefined;
        longTerm?: boolean | undefined;
        gantt?: boolean | undefined;
        reminders?: boolean | undefined;
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
  meshEnabled: boolean;
  meshIntensity: number;
  meshColorMode: MeshColorMode;
  meshColor: string;
  timeFormat: TimeFormat;
  relativeDates: boolean;
  weekStart: WeekStart;
  greetingStyle: GreetingStyle;
  sectionVisibility: {
    today: boolean;
    sprint: boolean;
    longTerm: boolean;
    gantt: boolean;
    reminders: boolean;
  };
  defaultReminderLeadMinutes: LeadMinutes;
  defaultRecurrence: RecurrenceDefault;
  snoozeMinutes: SnoozeMinutes;
  quietHours: { from: string; to: string } | undefined;
  lastKnownTzOffset: number | undefined;
  settingsV2Seen: boolean;
  /** Gemini Nano chat panel settings — always present with defaults in resolved form. */
  geminiNano: {
    chatEnabled: boolean;
    chatPosition: "right" | "bottom";
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
}

export const EMPTY_STATE: ProclivityState = {
  todos: [],
  sprints: [],
  ganttCharts: [],
  ganttTasks: [],
  reminders: [],
  settings: {},
};
