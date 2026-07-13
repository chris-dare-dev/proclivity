import { describe, expect, it } from "vitest";
import {
  EMPTY_GOOGLE_CALENDAR_STATE,
  normalizeState,
  withCalendarCache,
} from "./store";
import type {
  GoogleCalendarEvent,
  GoogleCalendarWindowCache,
} from "./types";

function event(id: string): GoogleCalendarEvent {
  return {
    id,
    calendarId: "primary",
    title: id,
    start: 1,
    end: 2,
    source: "google-calendar",
    readOnly: true,
    allDay: false,
  };
}

function cache(
  windowStart: number,
  lastSyncedAt: number,
  events: GoogleCalendarEvent[] = [event(`event-${windowStart}`)],
): GoogleCalendarWindowCache {
  return {
    windowStart,
    windowEnd: windowStart + 42,
    lastSyncedAt,
    events,
  };
}

describe("Google Calendar bounded window store", () => {
  it("migrates the original single-cache shape", () => {
    const legacyCache = cache(100, 500);
    expect(normalizeState({ enabled: true, cache: legacyCache })).toEqual({
      enabled: true,
      caches: [legacyCache],
    });
  });

  it("retains recent windows and replaces a matching window atomically", () => {
    let state = { ...EMPTY_GOOGLE_CALENDAR_STATE, enabled: true };
    state = withCalendarCache(state, cache(100, 100));
    state = withCalendarCache(state, cache(200, 200));
    state = withCalendarCache(state, cache(100, 300, [event("replacement")]));

    expect(state.caches.map((entry) => entry.windowStart)).toEqual([100, 200]);
    expect(state.caches[0]?.events[0]?.id).toBe("replacement");
  });

  it("keeps at most six recent windows", () => {
    let state = { ...EMPTY_GOOGLE_CALENDAR_STATE, enabled: true };
    for (let index = 0; index < 7; index += 1) {
      state = withCalendarCache(
        state,
        cache(index * 100, index * 100),
      );
    }
    expect(state.caches).toHaveLength(6);
    expect(state.caches.map((entry) => entry.windowStart)).toEqual([
      600,
      500,
      400,
      300,
      200,
      100,
    ]);
  });

  it("enforces the 5,000-event ceiling across windows", () => {
    const full = Array.from({ length: 5_000 }, (_, index) =>
      event(`bulk-${index}`),
    );
    const state = withCalendarCache(
      {
        enabled: true,
        caches: [cache(100, 100, full)],
      },
      cache(200, 200),
    );
    expect(state.caches).toHaveLength(1);
    expect(state.caches[0]?.windowStart).toBe(200);
  });
});
