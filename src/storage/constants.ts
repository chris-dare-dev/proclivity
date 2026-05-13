import type {
  ResolvedUserSettings,
  UserSettings,
} from "@/types";

/**
 * Fixed grid size for card-view snap-to-grid.
 * Aligns with --space-2 (8px) in theme.css.
 * Not user-configurable in v1 — per design plan §6.
 */
export const CARD_GRID_SIZE = 8;

/** The single chrome.storage.local / localStorage key for all persisted state. */
export const STORAGE_KEY = "proclivity:state:v1";

/**
 * Observability ring-buffer key. Stores up to ~500 LogEntry records
 * appended by the logger when persisted levels (warn/error always,
 * info when debug is on) fire. Separate from STORAGE_KEY so the app's
 * import / export / clear-all flows never touch it. Phase 3 of the
 * observability rollout — see plans/observability-plan.md.
 */
export const LOG_STORAGE_KEY = "proclivity:logs:v1";

/**
 * Closed-todos retention — auto-purge any closed todo whose `closedAt` is
 * older than this many days. Mirrors Linear's 28-day default for the
 * "completed" category, rounded to a calendar month for user
 * recognisability. See `.claude/notes/closed-todos-research-A.md` §2.3 for
 * the trade-off discussion.
 */
export const CLOSED_TODO_RETENTION_DAYS = 30;

/**
 * Hard cap on the total number of closed todos kept in storage. Past this
 * count, the oldest-by-`closedAt` items are evicted on the next purge run.
 *
 * At ~200 bytes per todo (id + title + tags + 4 timestamps + scope) this
 * caps closed-pile growth at roughly ~100 kB — under 1% of the 10 MB
 * chrome.storage.local cap. In practice the 30-day window is the operative
 * limit; the count cap is a safety net for high-churn users.
 */
export const CLOSED_TODO_MAX = 500;

/**
 * Chrome alarm name for the periodic closed-todos purge job. Owned by the
 * service worker; lives outside the reminder alarm namespace so the
 * reconciler in service-worker.ts never confuses the two.
 */
export const CLOSED_PURGE_ALARM = "proclivity:closed:purge";

/**
 * How often the service worker re-runs the closed-todos purge job. Once per
 * day is enough — the retention window is 30 days so a worst-case 24h drift
 * is invisible to the user. The newtab page also runs the purge on every
 * open (free; the user is interacting anyway), so this alarm exists purely
 * for long-idle profiles where the newtab hasn't been opened in days.
 */
export const CLOSED_PURGE_INTERVAL_MINUTES = 60 * 24; // 24h

/**
 * Custom-event name for the cross-section "jump to Closed tab" affordance.
 * Dispatched by ClosedScopeCounter (TodoList / SprintManager); caught by
 * App.tsx's useEffect to switch the active tab.
 *
 * L3 fix: extracted from App.tsx to this shared constants module so the three
 * callsites (App, TodoList, SprintManager) share a single source of truth
 * rather than duplicating the string literal.
 */
export const NAV_CLOSED_EVENT = "proclivity:nav-closed";

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
  // Matches the legacy CSS opacity of 0.18 (≈ 20%). Controls .mesh-background
  // opacity directly via the --mesh-intensity CSS custom property; the shader
  // uAlpha is kept at 1.0 so this is the sole brightness control.
  meshIntensity: 0.2,
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
    calendar: true,
  },
  defaultReminderLeadMinutes: 10,
  defaultRecurrence: "none",
  snoozeMinutes: 10,
  quietHours: undefined,
  lastKnownTzOffset: undefined,
  settingsV2Seen: false,
  geminiNano: {
    chatEnabled: false,
    chatPosition: "right",
  },
  layoutMode: "list",
  cardHintSeen: false,
  // Observability defaults: off by default; namespaces wide-open when on.
  // See plans/observability-plan.md (phase 1).
  debug: {
    enabled: false,
    namespaces: "*",
  },
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
      calendar: sv.calendar ?? DEFAULT_SETTINGS.sectionVisibility.calendar,
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
    geminiNano: {
      chatEnabled:
        s.geminiNano?.chatEnabled ??
        DEFAULT_SETTINGS.geminiNano.chatEnabled,
      chatPosition:
        s.geminiNano?.chatPosition ??
        DEFAULT_SETTINGS.geminiNano.chatPosition,
    },
    layoutMode: s.layoutMode ?? DEFAULT_SETTINGS.layoutMode,
    cardHintSeen: s.cardHintSeen ?? DEFAULT_SETTINGS.cardHintSeen,
    debug: {
      enabled: s.debug?.enabled ?? DEFAULT_SETTINGS.debug.enabled,
      namespaces: s.debug?.namespaces ?? DEFAULT_SETTINGS.debug.namespaces,
    },
  };
}
