import { addDays, fromDateInput } from "@/lib/dateUtils";
import { listPrimaryCalendarEvents } from "./api";
import type {
  GoogleCalendarEvent,
  GoogleCalendarWindowCache,
} from "./types";

// Calendar's all-day query matching uses the Google calendar timezone, which
// may be as much as 26 hours away from the device timezone. Query a small
// buffer, then clip locally to the exact 42-day grid window.
const QUERY_PADDING_DAYS = 2;

export interface SyncGoogleCalendarWindowOptions {
  token: string;
  windowStart: number;
  windowEnd: number;
  signal?: AbortSignal | undefined;
  now?: (() => number) | undefined;
  fetchImpl?: typeof fetch | undefined;
}

/** Build one atomic, bounded snapshot of the visible Calendar grid window. */
export async function syncGoogleCalendarWindow(
  options: SyncGoogleCalendarWindowOptions,
): Promise<GoogleCalendarWindowCache> {
  const events = await listPrimaryCalendarEvents({
    token: options.token,
    windowStart: addDays(options.windowStart, -QUERY_PADDING_DAYS),
    windowEnd: addDays(options.windowEnd, QUERY_PADDING_DAYS),
    ...(options.signal ? { signal: options.signal } : {}),
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
  });
  return {
    windowStart: options.windowStart,
    windowEnd: options.windowEnd,
    lastSyncedAt: (options.now ?? Date.now)(),
    events: events.filter((event) =>
      eventOverlapsWindow(event, options.windowStart, options.windowEnd),
    ),
  };
}

export function eventOverlapsWindow(
  event: GoogleCalendarEvent,
  windowStart: number,
  windowEnd: number,
): boolean {
  const start = event.allDay ? fromDateInput(event.startDate) : event.start;
  const end = event.allDay ? fromDateInput(event.endDateExclusive) : event.end;
  return end > windowStart && start < windowEnd;
}
