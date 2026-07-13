import type {
  FocusRingMode,
  GreetingSchedule,
  ResolvedUserSettings,
  SettingsPaneId,
  UserSettings,
} from "@/types";
import {
  clampCompanionWidth,
  WORKSPACE_COMPANION_DEFAULT_WIDTH,
} from "@/lib/workspaceSizing";

// Re-export so consumers can import from the module that owns it.
export type { SettingsPaneId };

/**
 * Fixed grid size for card-view snap-to-grid.
 * Aligns with --space-2 (8px) in theme.css.
 * Not user-configurable in v1 — per design plan §6.
 */
export const CARD_GRID_SIZE = 8;

/** The single chrome.storage.local / localStorage key for all persisted state. */
export const STORAGE_KEY = "proclivity:state:v1";

/**
 * chrome.storage.local key for the Google Photos picked-photo cache. Kept
 * separate from STORAGE_KEY so its base64 payload (potentially several MB)
 * never gets serialized into the export/import JSON blob or the in-memory
 * React state tree. The Photos lib in `src/lib/googlePhotos/` is the sole
 * read/writer for this key.
 */
export const PHOTOS_STORAGE_KEY = "proclivity:photos:v1";

/**
 * chrome.storage.local key for roadmap ingest config + write-back bookkeeping
 * (Phase G). Kept separate from STORAGE_KEY so the secret it holds (the
 * Obsidian Local REST API bearer token) plus the write-back dedup cursor never
 * get serialized into the export/import JSON blob or the in-memory React state
 * tree. The roadmap lib in `src/lib/roadmap/store.ts` is the sole read/writer
 * for this key.
 */
export const ROADMAP_STORAGE_KEY = "proclivity:roadmap:v1";

/**
 * chrome.storage.local key for pending in-app reminder alerts. Separate from
 * STORAGE_KEY so alert churn (enqueue on alarm fire, remove on dismiss) never
 * rewrites the main state tree and never lands in the export/import envelope.
 * Written by the service worker (enqueue) and the newtab (dismiss/snooze);
 * `src/storage/alerts.ts` is the sole read/writer for this key.
 */
export const ALERTS_STORAGE_KEY = "proclivity:alerts:v1";

/**
 * Alarm-name prefix for toast-initiated snoozes. Lives outside the
 * `proclivity:reminder:` namespace so the reminder reconciler's
 * orphan-detection never clears a pending snooze. On fire, the SW re-enqueues
 * an alert for the reminder WITHOUT touching its stored fireAt/recurrence —
 * snoozing a recurring reminder must not shift its schedule.
 */
export const SNOOZE_ALARM_PREFIX = "proclivity:snooze:";

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
 * Custom-event name for the command-palette "Open Settings" action.
 * Dispatched by CommandPalette (lazy chunk); caught by Header()'s useEffect
 * to call setSettingsOpen(true). Mirrors the NAV_CLOSED_EVENT topology —
 * cross-component event bridge where direct prop-drilling is not available.
 *
 * m11: CommandPalette mounts as a sibling of Header in App() return; since
 * setSettingsOpen lives inside the Header memo scope, a custom event is the
 * lowest-diff bridge. Do not add more cross-component events without
 * evaluating whether lifting state or a React Context is preferable (m11
 * synthesis §7 risk note).
 */
export const OPEN_SETTINGS_EVENT = "proclivity:open-settings";

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
  workspaceCompanionWidthPx: WORKSPACE_COMPANION_DEFAULT_WIDTH,
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
  greetingSchedule: "standard" as GreetingSchedule,
  dayBoundaryHour: 0 as 0 | 3 | 5,
  sectionVisibility: {
    today: true,
    // Sprint + Long-term start hidden (2026-07 phase 0): long-horizon
    // planning moved to the Obsidian-backed roadmap workflow, so the
    // in-extension sprint/goal surfaces are off by default. Re-enable via
    // Settings → General; existing stored visibility overrides win as usual.
    sprint: false,
    longTerm: false,
    gantt: true,
    reminders: true,
    calendar: true,
    // Photos starts hidden — surfaces only after the user connects Google
    // Photos in Settings and picks at least one photo. The Photos pane flips
    // this to true once a successful pick lands.
    photos: false,
  },
  defaultReminderLeadMinutes: 10,
  defaultRecurrence: "none",
  snoozeMinutes: 10,
  quietHours: undefined,
  lastKnownTzOffset: undefined,
  settingsV2Seen: false,
  settingsLastPane: "general" as SettingsPaneId,
  geminiNanoSeen: false,
  geminiNano: {
    chatEnabled: false,
    chatPosition: "right",
  },
  googlePhotos: {
    slideshowIntervalSeconds: 8,
    displayMode: "crop",
    shuffle: false,
  },
  // Roadmap ingest defaults (Phase G). "today" surfaces ingested items
  // immediately (Long-term ships hidden); gantt surfacing on; auto-sync off so
  // there is no fetch on every new-tab open.
  roadmap: {
    defaultScope: "today",
    surfaceInGantt: true,
    autoSyncOnOpen: false,
  },
  layoutMode: "list",
  cardHintSeen: false,
  defaultSprintDays: 14 as 7 | 14 | 21 | 28,
  closedTodoRetentionDays: 30 as 7 | 30 | 90 | null,
  focusRingMode: "auto" as FocusRingMode,
  lastExportAt: undefined,
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
    workspaceCompanionWidthPx: clampCompanionWidth(
      s.workspaceCompanionWidthPx,
    ),
    meshEnabled: s.meshEnabled ?? DEFAULT_SETTINGS.meshEnabled,
    meshIntensity: s.meshIntensity ?? DEFAULT_SETTINGS.meshIntensity,
    meshColorMode: s.meshColorMode ?? DEFAULT_SETTINGS.meshColorMode,
    meshColor: s.meshColor ?? DEFAULT_SETTINGS.meshColor,
    timeFormat: s.timeFormat ?? DEFAULT_SETTINGS.timeFormat,
    relativeDates: s.relativeDates ?? DEFAULT_SETTINGS.relativeDates,
    weekStart: s.weekStart ?? DEFAULT_SETTINGS.weekStart,
    greetingStyle: s.greetingStyle ?? DEFAULT_SETTINGS.greetingStyle,
    greetingSchedule: s.greetingSchedule ?? DEFAULT_SETTINGS.greetingSchedule,
    dayBoundaryHour: s.dayBoundaryHour ?? DEFAULT_SETTINGS.dayBoundaryHour,
    sectionVisibility: {
      today: sv.today ?? DEFAULT_SETTINGS.sectionVisibility.today,
      sprint: sv.sprint ?? DEFAULT_SETTINGS.sectionVisibility.sprint,
      longTerm: sv.longTerm ?? DEFAULT_SETTINGS.sectionVisibility.longTerm,
      gantt: sv.gantt ?? DEFAULT_SETTINGS.sectionVisibility.gantt,
      reminders: sv.reminders ?? DEFAULT_SETTINGS.sectionVisibility.reminders,
      calendar: sv.calendar ?? DEFAULT_SETTINGS.sectionVisibility.calendar,
      photos: sv.photos ?? DEFAULT_SETTINGS.sectionVisibility.photos,
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
    settingsLastPane: s.settingsLastPane ?? DEFAULT_SETTINGS.settingsLastPane,
    geminiNanoSeen: s.geminiNanoSeen ?? DEFAULT_SETTINGS.geminiNanoSeen,
    geminiNano: {
      chatEnabled:
        s.geminiNano?.chatEnabled ??
        DEFAULT_SETTINGS.geminiNano.chatEnabled,
      chatPosition:
        s.geminiNano?.chatPosition ??
        DEFAULT_SETTINGS.geminiNano.chatPosition,
    },
    googlePhotos: {
      slideshowIntervalSeconds:
        s.googlePhotos?.slideshowIntervalSeconds ??
        DEFAULT_SETTINGS.googlePhotos.slideshowIntervalSeconds,
      displayMode:
        s.googlePhotos?.displayMode ?? DEFAULT_SETTINGS.googlePhotos.displayMode,
      shuffle:
        s.googlePhotos?.shuffle ?? DEFAULT_SETTINGS.googlePhotos.shuffle,
    },
    roadmap: {
      defaultScope:
        s.roadmap?.defaultScope ?? DEFAULT_SETTINGS.roadmap.defaultScope,
      surfaceInGantt:
        s.roadmap?.surfaceInGantt ?? DEFAULT_SETTINGS.roadmap.surfaceInGantt,
      autoSyncOnOpen:
        s.roadmap?.autoSyncOnOpen ?? DEFAULT_SETTINGS.roadmap.autoSyncOnOpen,
    },
    layoutMode: s.layoutMode ?? DEFAULT_SETTINGS.layoutMode,
    cardHintSeen: s.cardHintSeen ?? DEFAULT_SETTINGS.cardHintSeen,
    defaultSprintDays:
      s.defaultSprintDays ?? DEFAULT_SETTINGS.defaultSprintDays,
    // closedTodoRetentionDays can be explicitly null ("forever"), so we must
    // distinguish null (user chose forever) from undefined (use default).
    closedTodoRetentionDays:
      s.closedTodoRetentionDays !== undefined
        ? s.closedTodoRetentionDays
        : DEFAULT_SETTINGS.closedTodoRetentionDays,
    focusRingMode: s.focusRingMode ?? DEFAULT_SETTINGS.focusRingMode,
    // lastExportAt has no meaningful default — stays undefined until first export.
    lastExportAt: s.lastExportAt,
    debug: {
      enabled: s.debug?.enabled ?? DEFAULT_SETTINGS.debug.enabled,
      namespaces: s.debug?.namespaces ?? DEFAULT_SETTINGS.debug.namespaces,
    },
  };
}
