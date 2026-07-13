import { fromDateInput, toDateInput } from "@/lib/dateUtils";
import {
  GOOGLE_CALENDAR_ID,
  GOOGLE_CALENDAR_MAX_EVENTS,
  type GoogleCalendarEvent,
} from "./types";

const EVENTS_ENDPOINT =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const RETRYABLE_STATUS = new Set([403, 429, 500, 502, 503, 504]);

type FetchLike = typeof fetch;

export class GoogleCalendarApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GoogleCalendarApiError";
  }
}

export interface ListPrimaryEventsOptions {
  token: string;
  windowStart: number;
  windowEnd: number;
  signal?: AbortSignal | undefined;
  fetchImpl?: FetchLike | undefined;
}

/**
 * GET-only Calendar adapter. There are deliberately no insert/update/delete
 * exports in this module, and the OAuth scope would reject them anyway.
 */
export async function listPrimaryCalendarEvents(
  options: ListPrimaryEventsOptions,
): Promise<GoogleCalendarEvent[]> {
  if (!(options.windowEnd > options.windowStart)) {
    throw new Error("Google Calendar windowEnd must be after windowStart.");
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const eventsById = new Map<string, GoogleCalendarEvent>();
  const seenPageTokens = new Set<string>();
  let pageToken: string | undefined;

  for (;;) {
    const url = buildEventsUrl(
      options.windowStart,
      options.windowEnd,
      pageToken,
    );
    const response = await fetchWithRetry(
      fetchImpl,
      url,
      options.token,
      options.signal,
    );
    if (!response.ok) {
      throw await apiError(response);
    }

    const body = asRecord(await response.json());
    const items = Array.isArray(body?.items) ? body.items : [];
    for (const item of items) {
      const normalized = normalizeGoogleCalendarEvent(item);
      if (normalized) eventsById.set(normalized.id, normalized);
    }
    if (eventsById.size > GOOGLE_CALENDAR_MAX_EVENTS) {
      throw tooManyEventsError();
    }

    const next =
      typeof body?.nextPageToken === "string" ? body.nextPageToken : undefined;
    if (!next) return sortEvents(eventsById.values());
    if (eventsById.size >= GOOGLE_CALENDAR_MAX_EVENTS) {
      throw tooManyEventsError();
    }
    if (seenPageTokens.has(next)) {
      throw new Error("Google Calendar returned a repeated page token.");
    }
    seenPageTokens.add(next);
    pageToken = next;
  }
}

export function buildEventsUrl(
  windowStart: number,
  windowEnd: number,
  pageToken?: string | undefined,
): string {
  const url = new URL(EVENTS_ENDPOINT);
  url.searchParams.set("timeMin", new Date(windowStart).toISOString());
  url.searchParams.set("timeMax", new Date(windowEnd).toISOString());
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("showDeleted", "false");
  url.searchParams.set("maxResults", "2500");
  // Ask Google to render any timezone-relative response values as UTC. A
  // defensive parser below still rejects offset-less dateTime strings.
  url.searchParams.set("timeZone", "UTC");
  url.searchParams.set(
    "fields",
    "nextPageToken,items(id,status,summary,start,end,htmlLink)",
  );
  if (pageToken) url.searchParams.set("pageToken", pageToken);
  return url.toString();
}

export function normalizeGoogleCalendarEvent(
  value: unknown,
): GoogleCalendarEvent | null {
  const event = asRecord(value);
  if (!event || event.status === "cancelled" || typeof event.id !== "string") {
    return null;
  }
  const start = asRecord(event.start);
  const end = asRecord(event.end);
  if (!start || !end) return null;

  const title =
    typeof event.summary === "string" && event.summary.trim()
      ? event.summary.trim()
      : "Untitled event";
  const htmlLink = safeGoogleLink(event.htmlLink);
  const common = {
    id: `gcal:${GOOGLE_CALENDAR_ID}:${event.id}`,
    calendarId: GOOGLE_CALENDAR_ID,
    title,
    source: "google-calendar" as const,
    readOnly: true as const,
    ...(htmlLink ? { htmlLink } : {}),
  };

  if (typeof start.date === "string" && typeof end.date === "string") {
    const startMs = parseLocalDate(start.date);
    const endMs = parseLocalDate(end.date);
    if (startMs === null || endMs === null || endMs <= startMs) return null;
    return {
      ...common,
      allDay: true,
      start: startMs,
      end: endMs,
      startDate: start.date,
      endDateExclusive: end.date,
    };
  }

  if (
    typeof start.dateTime !== "string" ||
    typeof end.dateTime !== "string"
  ) {
    return null;
  }
  const startMs = parseRfc3339Instant(start.dateTime);
  const endMs = parseRfc3339Instant(end.dateTime);
  if (startMs === null || endMs === null || endMs <= startMs) {
    return null;
  }
  return {
    ...common,
    allDay: false,
    start: startMs,
    end: endMs,
  };
}

function parseLocalDate(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = fromDateInput(value);
  return toDateInput(parsed) === value ? parsed : null;
}

function safeGoogleLink(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      (url.hostname === "calendar.google.com" ||
        url.hostname === "www.google.com")
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function parseRfc3339Instant(value: string): number | null {
  if (!/(?:z|[+-]\d{2}:?\d{2})$/i.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sortEvents(
  events: Iterable<GoogleCalendarEvent>,
): GoogleCalendarEvent[] {
  return [...events].sort((a, b) => a.start - b.start);
}

function tooManyEventsError(): Error {
  return new Error(
    `Google Calendar returned more than ${GOOGLE_CALENDAR_MAX_EVENTS.toLocaleString()} events for this calendar window.`,
  );
}

async function fetchWithRetry(
  fetchImpl: FetchLike,
  url: string,
  token: string,
  signal?: AbortSignal | undefined,
): Promise<Response> {
  const delays = [250, 750];
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      ...(signal ? { signal } : {}),
    });
    if (!RETRYABLE_STATUS.has(response.status) || attempt >= delays.length) {
      return response;
    }
    await abortableDelay(delays[attempt]!, signal);
  }
}

async function abortableDelay(
  ms: number,
  signal?: AbortSignal | undefined,
): Promise<void> {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  await new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function apiError(response: Response): Promise<GoogleCalendarApiError> {
  let detail = "";
  try {
    const body = asRecord(await response.json());
    const error = asRecord(body?.error);
    if (typeof error?.message === "string") detail = ` ${error.message}`;
  } catch {
    // A status-specific message below is still actionable without a JSON body.
  }
  const message =
    response.status === 401
      ? "Google Calendar authorization expired. Reconnect to continue."
      : response.status === 403
        ? "Google Calendar denied read access. Enable the Calendar API and grant the read-only scope."
        : response.status === 429
          ? "Google Calendar is temporarily rate-limiting requests. Try again shortly."
          : `Google Calendar request failed (${response.status}).${detail}`;
  return new GoogleCalendarApiError(message, response.status);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}
