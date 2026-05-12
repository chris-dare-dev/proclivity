import type {
  ResolvedUserSettings,
  UserSettings,
} from "@/types";

/** The single chrome.storage.local / localStorage key for all persisted state. */
export const STORAGE_KEY = "proclivity:state:v1";

/**
 * Canonical default values for every user-configurable preference. The
 * UI reads from `resolvedSettings(state.settings)` so that absent fields
 * fall back to these values without scattering `?? fallback` across the
 * codebase.
 */
export const DEFAULT_SETTINGS: ResolvedUserSettings = {
  name: "",
  theme: "system",
  // Matches the legacy --accent (#7c9cff). Hex is valid CSS for the --accent
  // custom property; OKLCH conversion is unnecessary at the value layer.
  accentColor: "#7c9cff",
  density: "default",
  fontSize: "md",
  reducedMotion: false,
  meshEnabled: true,
  meshIntensity: 0.9,
  meshColorMode: "auto",
  meshColor: "#7c9cff",
  timeFormat: "auto",
  relativeDates: true,
  weekStart: "mon",
  greetingStyle: "time-of-day",
  sectionVisibility: {
    today: true,
    sprint: true,
    longTerm: true,
    gantt: true,
    reminders: true,
  },
  defaultReminderLeadMinutes: 10,
  defaultRecurrence: "none",
  snoozeMinutes: 10,
  quietHours: undefined,
  lastKnownTzOffset: undefined,
  settingsV2Seen: false,
};

/**
 * Resolve a (possibly sparse) UserSettings into a fully-defaulted form.
 * Pick<X, undefined> values fall back to DEFAULT_SETTINGS. The nested
 * `sectionVisibility` object is merged one level deep so that a stored
 * partial override (e.g. only `gantt: false`) keeps the other defaults.
 *
 * The two genuinely-nullable fields (`quietHours`, `lastKnownTzOffset`)
 * stay undefined when the user hasn't set them.
 */
export function resolvedSettings(s: UserSettings): ResolvedUserSettings {
  const sv = s.sectionVisibility ?? {};
  return {
    name: s.name ?? DEFAULT_SETTINGS.name,
    theme: s.theme ?? DEFAULT_SETTINGS.theme,
    accentColor: s.accentColor ?? DEFAULT_SETTINGS.accentColor,
    density: s.density ?? DEFAULT_SETTINGS.density,
    fontSize: s.fontSize ?? DEFAULT_SETTINGS.fontSize,
    reducedMotion: s.reducedMotion ?? DEFAULT_SETTINGS.reducedMotion,
    meshEnabled: s.meshEnabled ?? DEFAULT_SETTINGS.meshEnabled,
    meshIntensity: s.meshIntensity ?? DEFAULT_SETTINGS.meshIntensity,
    meshColorMode: s.meshColorMode ?? DEFAULT_SETTINGS.meshColorMode,
    meshColor: s.meshColor ?? DEFAULT_SETTINGS.meshColor,
    timeFormat: s.timeFormat ?? DEFAULT_SETTINGS.timeFormat,
    relativeDates: s.relativeDates ?? DEFAULT_SETTINGS.relativeDates,
    weekStart: s.weekStart ?? DEFAULT_SETTINGS.weekStart,
    greetingStyle: s.greetingStyle ?? DEFAULT_SETTINGS.greetingStyle,
    sectionVisibility: {
      today: sv.today ?? DEFAULT_SETTINGS.sectionVisibility.today,
      sprint: sv.sprint ?? DEFAULT_SETTINGS.sectionVisibility.sprint,
      longTerm: sv.longTerm ?? DEFAULT_SETTINGS.sectionVisibility.longTerm,
      gantt: sv.gantt ?? DEFAULT_SETTINGS.sectionVisibility.gantt,
      reminders: sv.reminders ?? DEFAULT_SETTINGS.sectionVisibility.reminders,
    },
    defaultReminderLeadMinutes:
      s.defaultReminderLeadMinutes ??
      DEFAULT_SETTINGS.defaultReminderLeadMinutes,
    defaultRecurrence:
      s.defaultRecurrence ?? DEFAULT_SETTINGS.defaultRecurrence,
    snoozeMinutes: s.snoozeMinutes ?? DEFAULT_SETTINGS.snoozeMinutes,
    quietHours: s.quietHours ?? DEFAULT_SETTINGS.quietHours,
    lastKnownTzOffset:
      s.lastKnownTzOffset ?? DEFAULT_SETTINGS.lastKnownTzOffset,
    settingsV2Seen: s.settingsV2Seen ?? DEFAULT_SETTINGS.settingsV2Seen,
  };
}
