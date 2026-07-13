import { GOOGLE_CALENDAR_STORAGE_KEY } from "@/storage/constants";
import type {
  GoogleCalendarEvent,
  GoogleCalendarState,
  GoogleCalendarWindowCache,
} from "./types";
import {
  GOOGLE_CALENDAR_MAX_EVENTS,
  GOOGLE_CALENDAR_MAX_WINDOWS,
} from "./types";

export const EMPTY_GOOGLE_CALENDAR_STATE: GoogleCalendarState = {
  enabled: false,
  caches: [],
};

type Listener = (state: GoogleCalendarState) => void;
let writeChain: Promise<void> = Promise.resolve();

function hasExtensionStorage(): boolean {
  return typeof chrome !== "undefined" && !!chrome.storage?.local;
}

export const googleCalendarStore = {
  async get(): Promise<GoogleCalendarState> {
    if (!hasExtensionStorage()) {
      try {
        const raw =
          typeof localStorage === "undefined"
            ? null
            : localStorage.getItem(GOOGLE_CALENDAR_STORAGE_KEY);
        return raw ? normalizeState(JSON.parse(raw)) : EMPTY_GOOGLE_CALENDAR_STATE;
      } catch {
        return EMPTY_GOOGLE_CALENDAR_STATE;
      }
    }
    const stored = await chrome.storage.local.get(GOOGLE_CALENDAR_STORAGE_KEY);
    return normalizeState(stored[GOOGLE_CALENDAR_STORAGE_KEY]);
  },

  async set(next: GoogleCalendarState): Promise<void> {
    if (!hasExtensionStorage()) {
      try {
        localStorage.setItem(GOOGLE_CALENDAR_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Dev-preview localStorage may be unavailable; the integration remains off.
      }
      return;
    }
    await chrome.storage.local.set({ [GOOGLE_CALENDAR_STORAGE_KEY]: next });
  },

  async update(
    transform: (current: GoogleCalendarState) => GoogleCalendarState,
  ): Promise<void> {
    writeChain = writeChain
      .catch(() => undefined)
      .then(async () => {
        const current = await googleCalendarStore.get();
        await googleCalendarStore.set(transform(current));
      });
    await writeChain;
  },

  async enableWithCache(cache: GoogleCalendarWindowCache): Promise<void> {
    await googleCalendarStore.update((current) =>
      withCalendarCache({ ...current, enabled: true }, cache),
    );
  },

  async replaceCache(cache: GoogleCalendarWindowCache): Promise<void> {
    await googleCalendarStore.update((current) =>
      withCalendarCache(current, cache),
    );
  },

  async disableAndClear(): Promise<void> {
    await googleCalendarStore.update(() => EMPTY_GOOGLE_CALENDAR_STATE);
  },

  subscribe(listener: Listener): () => void {
    if (hasExtensionStorage()) {
      const handler = (
        changes: Record<string, chrome.storage.StorageChange>,
        areaName: string,
      ) => {
        if (areaName !== "local" || !changes[GOOGLE_CALENDAR_STORAGE_KEY]) return;
        listener(normalizeState(changes[GOOGLE_CALENDAR_STORAGE_KEY].newValue));
      };
      chrome.storage.onChanged.addListener(handler);
      return () => chrome.storage.onChanged.removeListener(handler);
    }
    const handler = (event: StorageEvent) => {
      if (event.key !== GOOGLE_CALENDAR_STORAGE_KEY) return;
      try {
        listener(
          event.newValue
            ? normalizeState(JSON.parse(event.newValue))
            : EMPTY_GOOGLE_CALENDAR_STATE,
        );
      } catch {
        listener(EMPTY_GOOGLE_CALENDAR_STATE);
      }
    };
    if (typeof window !== "undefined") window.addEventListener("storage", handler);
    return () => {
      if (typeof window !== "undefined") window.removeEventListener("storage", handler);
    };
  },
};

export function normalizeState(value: unknown): GoogleCalendarState {
  if (!isRecord(value)) return EMPTY_GOOGLE_CALENDAR_STATE;
  // Migrate the first implementation's single `cache` field in-place.
  const rawCaches = Array.isArray(value.caches)
    ? value.caches
    : value.cache === undefined
      ? []
      : [value.cache];
  return {
    enabled: value.enabled === true,
    caches: boundCaches(
      rawCaches
        .map(normalizeCache)
        .filter((cache): cache is GoogleCalendarWindowCache => cache !== null),
    ),
  };
}

export function withCalendarCache(
  state: GoogleCalendarState,
  cache: GoogleCalendarWindowCache,
): GoogleCalendarState {
  const normalized = normalizeCache(cache);
  if (!normalized) return state;
  return {
    ...state,
    caches: boundCaches([
      normalized,
      ...state.caches.filter(
        (candidate) =>
          candidate.windowStart !== normalized.windowStart ||
          candidate.windowEnd !== normalized.windowEnd,
      ),
    ]),
  };
}

function boundCaches(
  caches: GoogleCalendarWindowCache[],
): GoogleCalendarWindowCache[] {
  const retained: GoogleCalendarWindowCache[] = [];
  let eventCount = 0;

  for (const cache of [...caches].sort(
    (a, b) => b.lastSyncedAt - a.lastSyncedAt,
  )) {
    if (retained.length >= GOOGLE_CALENDAR_MAX_WINDOWS) break;
    if (eventCount + cache.events.length > GOOGLE_CALENDAR_MAX_EVENTS) continue;
    retained.push(cache);
    eventCount += cache.events.length;
  }
  return retained;
}

function normalizeCache(value: unknown): GoogleCalendarWindowCache | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.windowStart !== "number" ||
    !Number.isFinite(value.windowStart) ||
    typeof value.windowEnd !== "number" ||
    !Number.isFinite(value.windowEnd) ||
    typeof value.lastSyncedAt !== "number" ||
    !Number.isFinite(value.lastSyncedAt) ||
    !(value.windowEnd > value.windowStart) ||
    !Array.isArray(value.events)
  ) {
    return null;
  }
  const events = value.events
    .filter(isGoogleCalendarEvent)
    .slice(0, GOOGLE_CALENDAR_MAX_EVENTS);
  return {
    windowStart: value.windowStart,
    windowEnd: value.windowEnd,
    lastSyncedAt: value.lastSyncedAt,
    events,
  };
}

function isGoogleCalendarEvent(value: unknown): value is GoogleCalendarEvent {
  if (!isRecord(value)) return false;
  if (
    typeof value.id !== "string" ||
    value.calendarId !== "primary" ||
    typeof value.title !== "string" ||
    typeof value.start !== "number" ||
    typeof value.end !== "number" ||
    !(value.end > value.start) ||
    value.source !== "google-calendar" ||
    value.readOnly !== true ||
    typeof value.allDay !== "boolean" ||
    (value.htmlLink !== undefined && !isSafeCalendarLink(value.htmlLink))
  ) {
    return false;
  }
  return value.allDay
    ? typeof value.startDate === "string" &&
        typeof value.endDateExclusive === "string"
    : true;
}

function isSafeCalendarLink(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "calendar.google.com" ||
        url.hostname === "www.google.com")
    );
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
