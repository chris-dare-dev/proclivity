export const OUTLOOK_ICS_SOURCE = "outlook-ics" as const;
export const OUTLOOK_ICS_PRIVATE_TITLE = "Private work event" as const;

/** Refuse large snapshots before parsing or reading a selected File. */
export const OUTLOOK_ICS_MAX_BYTES = 5 * 1024 * 1024;
/** Bounds nested calendar components before they can consume unbounded memory. */
export const OUTLOOK_ICS_MAX_COMPONENTS = 10_000;
/** A separate ceiling for raw VEVENT records in one snapshot. */
export const OUTLOOK_ICS_MAX_EVENT_COMPONENTS = 5_000;
/** Keep adversarial recurrence expansion below a noticeable UI-thread stall. */
export const OUTLOOK_ICS_MAX_EXPANSION_ITERATIONS = 20_000;
/** Maximum normalized occurrences persisted in one snapshot. */
export const OUTLOOK_ICS_MAX_EVENTS = 5_000;
/** Maximum normalized display-title length persisted per occurrence. */
export const OUTLOOK_ICS_MAX_TITLE_LENGTH = 300;
/** Defensive ceilings for embedded Outlook VTIMEZONE definitions. */
export const OUTLOOK_ICS_MAX_TIMEZONES = 32;
export const OUTLOOK_ICS_MAX_TIMEZONE_OBSERVANCES = 64;
export const OUTLOOK_ICS_MAX_TIMEZONE_RDATES = 256;
export const OUTLOOK_ICS_WINDOW_PAST_DAYS = 42;
export const OUTLOOK_ICS_WINDOW_FUTURE_DAYS = 366;

interface OutlookIcsEventBase {
  /** SHA-256 of the source UID and recurrence identity; never the raw UID. */
  id: string;
  title: string;
  start: number;
  /** Exclusive event end. */
  end: number;
  source: typeof OUTLOOK_ICS_SOURCE;
  readOnly: true;
}

export interface OutlookIcsAllDayEvent extends OutlookIcsEventBase {
  allDay: true;
  /** Wall-clock dates keep the event on the same day after a timezone change. */
  startDate: string;
  endDateExclusive: string;
}

export interface OutlookIcsTimedEvent extends OutlookIcsEventBase {
  allDay: false;
}

export type OutlookIcsEvent =
  | OutlookIcsAllDayEvent
  | OutlookIcsTimedEvent;

export interface OutlookIcsSnapshot {
  importedAt: number;
  windowStart: number;
  windowEnd: number;
  events: OutlookIcsEvent[];
  skippedCount: number;
  redactedCount: number;
}

export interface OutlookIcsState {
  snapshot: OutlookIcsSnapshot | null;
}

export interface OutlookIcsImportResult {
  snapshot: OutlookIcsSnapshot;
  importedCount: number;
  skippedCount: number;
  redactedCount: number;
  bounds: {
    windowStart: number;
    windowEnd: number;
  };
}

export interface OutlookIcsParseOptions {
  /** Stable clock injection for tests; defaults to Date.now(). */
  now?: number | undefined;
}
