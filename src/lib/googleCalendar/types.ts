export const GOOGLE_CALENDAR_ID = "primary" as const;
/** Hard storage ceiling across all retained visible-window snapshots. */
export const GOOGLE_CALENDAR_MAX_EVENTS = 5_000;
/** Retain a small month-navigation history without allowing unbounded growth. */
export const GOOGLE_CALENDAR_MAX_WINDOWS = 6;

interface GoogleCalendarEventBase {
  id: string;
  calendarId: typeof GOOGLE_CALENDAR_ID;
  title: string;
  start: number;
  /** Exclusive event end, matching Google Calendar's interval convention. */
  end: number;
  source: "google-calendar";
  readOnly: true;
  htmlLink?: string | undefined;
}

export interface GoogleCalendarAllDayEvent extends GoogleCalendarEventBase {
  allDay: true;
  /** Wall-clock dates are retained so a timezone change cannot shift the day. */
  startDate: string;
  endDateExclusive: string;
}

export interface GoogleCalendarTimedEvent extends GoogleCalendarEventBase {
  allDay: false;
}

export type GoogleCalendarEvent =
  | GoogleCalendarAllDayEvent
  | GoogleCalendarTimedEvent;

export interface GoogleCalendarWindowCache {
  windowStart: number;
  windowEnd: number;
  lastSyncedAt: number;
  events: GoogleCalendarEvent[];
}

export interface GoogleCalendarState {
  /** Local switch only. It never changes anything in Google Calendar. */
  enabled: boolean;
  caches: GoogleCalendarWindowCache[];
}
