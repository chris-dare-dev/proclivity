import { fromDateInput, toDateInput } from "@/lib/dateUtils";
import {
  GOOGLE_CALENDAR_ID,
  GOOGLE_CALENDAR_MAX_EVENTS,
  type GoogleCalendarEvent,
} from "./types";

const EVENTS_ENDPOINT =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const API_DISABLED_REASONS = new Set([
  "accessnotconfigured",
  "apidisabled",
  "servicedisabled",
]);
const AUTHORIZATION_REASONS = new Set([
  "accesstokenscopeinsufficient",
  "insufficientpermissions",
]);
const RATE_LIMIT_REASONS = new Set([
  "ratelimitexceeded",
  "userratelimitexceeded",
]);
const QUOTA_REASONS = new Set([
  "dailylimitexceeded",
  "dailylimitexceededunreg",
  "quotaexceeded",
]);
const ADMIN_POLICY_REASONS = new Set([
  "adminpolicyenforced",
  "userblockedbyadmin",
]);

type FetchLike = typeof fetch;

export type GoogleCalendarApiErrorKind =
  | "authorization"
  | "api-disabled"
  | "rate-limit"
  | "quota"
  | "admin-policy"
  | "permission"
  | "request";

export class GoogleCalendarApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly kind: GoogleCalendarApiErrorKind,
    readonly reason: string | null = null,
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
  const baseDelays = [1_000, 2_000];
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      ...(signal ? { signal } : {}),
    });
    const retryable = await isRetryableResponse(response);
    if (!retryable || attempt >= baseDelays.length) {
      return response;
    }
    const jitter = Math.floor(Math.random() * 1_001);
    await abortableDelay(baseDelays[attempt]! + jitter, signal);
  }
}

async function isRetryableResponse(response: Response): Promise<boolean> {
  if (RETRYABLE_STATUS.has(response.status)) return true;
  if (response.status !== 403) return false;

  // Calendar reports some rate limits as HTTP 403. Inspect a clone so the
  // original body remains available for the user-facing error classifier.
  const details = await parseGoogleApiError(response.clone());
  return RATE_LIMIT_REASONS.has(normalizeReason(details.reason));
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
  const details = await parseGoogleApiError(response);
  const classification = classifyApiError(response.status, details.reason);
  return new GoogleCalendarApiError(
    classification.message,
    response.status,
    classification.kind,
    details.reason,
  );
}

interface ParsedGoogleApiError {
  reason: string | null;
}

async function parseGoogleApiError(
  response: Response,
): Promise<ParsedGoogleApiError> {
  try {
    const body = asRecord(await response.json());
    const error = asRecord(body?.error);
    if (!error) return { reason: null };

    const reasons = [
      ...extractReasons(error.errors),
      ...extractReasons(error.details),
    ];
    return { reason: selectReason(reasons) };
  } catch {
    return { reason: null };
  }
}

function extractReasons(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const reasons: string[] = [];
  for (const entry of value) {
    const reason = safeIdentifier(asRecord(entry)?.reason);
    if (reason) reasons.push(reason);
  }
  return reasons;
}

function safeIdentifier(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^[A-Za-z][A-Za-z0-9_.-]{0,99}$/.test(trimmed) ? trimmed : null;
}

function selectReason(reasons: string[]): string | null {
  const knownSets = [
    API_DISABLED_REASONS,
    AUTHORIZATION_REASONS,
    RATE_LIMIT_REASONS,
    QUOTA_REASONS,
    ADMIN_POLICY_REASONS,
  ];
  for (const known of knownSets) {
    const match = reasons.find((reason) => known.has(normalizeReason(reason)));
    if (match) return match;
  }
  return reasons[0] ?? null;
}

function normalizeReason(reason: string | null): string {
  return reason?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
}

function classifyApiError(
  status: number,
  reason: string | null,
): { message: string; kind: GoogleCalendarApiErrorKind } {
  if (status === 401) {
    return {
      message: "Google Calendar authorization expired. Reconnect to continue.",
      kind: "authorization",
    };
  }
  if (status === 429) {
    return {
      message:
        "Google Calendar is temporarily rate-limiting requests. Try again shortly.",
      kind: "rate-limit",
    };
  }
  if (status !== 403) {
    return {
      message: `Google Calendar request failed (${status}).`,
      kind: "request",
    };
  }

  const normalized = normalizeReason(reason);
  if (API_DISABLED_REASONS.has(normalized)) {
    return {
      message:
        "The Google Calendar API is disabled in the exact Cloud project tied to Proclivity's OAuth client. Enable it there, wait a minute for the change to propagate, then retry.",
      kind: "api-disabled",
    };
  }
  if (AUTHORIZATION_REASONS.has(normalized)) {
    return {
      message:
        "Google sign-in succeeded, but this token cannot read Calendar events. Confirm the Calendar read-only scope under Google Auth Platform > Data Access, then reconnect.",
      kind: "authorization",
    };
  }
  if (RATE_LIMIT_REASONS.has(normalized)) {
    return {
      message:
        "Google Calendar is temporarily rate-limiting requests. Try again shortly.",
      kind: "rate-limit",
    };
  }
  if (QUOTA_REASONS.has(normalized)) {
    return {
      message:
        "Google Calendar reached an API or Calendar usage limit. Check Calendar usage limits and the Cloud project's API quotas, then retry later.",
      kind: "quota",
    };
  }
  if (ADMIN_POLICY_REASONS.has(normalized)) {
    return {
      message:
        "A Google Workspace administrator policy blocked Calendar access. Contact the administrator or try an unmanaged account.",
      kind: "admin-policy",
    };
  }
  return {
    message: reason
      ? `Google Calendar denied the API request (Google reason: ${reason}). Check the Calendar API and OAuth settings, then retry.`
      : "Google Calendar denied the API request. Check the Calendar API and OAuth settings, then retry.",
    kind: "permission",
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}
