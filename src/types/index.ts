export type TodoScope = "today" | "sprint" | "long";

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
  /** Tag ids referencing ProclivityState.tags. Always present; empty array = untagged. */
  tags: string[];
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

/* ── Card view types ─────────────────────────────────────────────────── */

/**
 * Absolute position of a card on its section canvas.
 * `z` is the stacking order — higher = on top.
 * Written only on drag-end; never on pointer-move.
 */
export interface CardPosition {
  x: number;
  y: number;
  /** Stacking order — bump to maxZ+1 on drag-start for "last-touched on top". */
  z: number;
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
        calendar?: boolean | undefined;
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

  /** Card view layout mode. Default "list" (existing behavior). */
  layoutMode?: LayoutMode | undefined;
  /**
   * D7/L2 fix: whether the card-mode onboarding hint has been dismissed.
   * Persisted per-extension so the hint doesn't reappear on new tabs.
   */
  cardHintSeen?: boolean | undefined;
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
    calendar: boolean;
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
  /** Card view layout mode — always present with default "list". */
  layoutMode: LayoutMode;
  /** Whether the card-mode onboarding hint has been dismissed (per-extension). */
  cardHintSeen: boolean;
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
