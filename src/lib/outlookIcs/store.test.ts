import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EMPTY_OUTLOOK_ICS_STATE,
  normalizeOutlookIcsState,
  outlookIcsStore,
} from "./store";
import {
  OUTLOOK_ICS_MAX_EVENTS,
  OUTLOOK_ICS_MAX_TITLE_LENGTH,
  type OutlookIcsEvent,
  type OutlookIcsSnapshot,
  type OutlookIcsState,
} from "./types";
import {
  isOutlookIcsSnapshotStale,
  OUTLOOK_ICS_STALE_AFTER_MS,
  selectVisibleOutlookIcsEvents,
} from "@/hooks/useOutlookIcsCalendar";
import { OUTLOOK_ICS_STORAGE_KEY } from "@/storage/constants";

function timedEvent(id: string, start = 100, end = 200): OutlookIcsEvent {
  return {
    id: eventId(id),
    title: id,
    start,
    end,
    allDay: false,
    source: "outlook-ics",
    readOnly: true,
  };
}

function eventId(seed: string): string {
  const hex = [...seed]
    .map((character) => character.codePointAt(0)!.toString(16).padStart(2, "0"))
    .join("")
    .padEnd(64, "0")
    .slice(0, 64);
  return `outlook-ics:${hex}`;
}

function snapshot(events: OutlookIcsEvent[]): OutlookIcsSnapshot {
  return {
    importedAt: 1_000,
    windowStart: 0,
    windowEnd: 10_000,
    events,
    skippedCount: 2,
    redactedCount: 1,
  };
}

describe("Outlook ICS snapshot store", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes a persisted snapshot and strips unrecognized event fields", () => {
    const normalized = normalizeOutlookIcsState({
      snapshot: {
        ...snapshot([timedEvent("meeting")]),
        ignored: "field",
        events: [{ ...timedEvent("meeting"), description: "must not persist" }],
      },
    });

    expect(normalized).toEqual({ snapshot: snapshot([timedEvent("meeting")]) });
    expect(normalized.snapshot?.events[0]).not.toHaveProperty("description");
  });

  it("rejects malformed snapshot metadata and drops malformed events", () => {
    expect(
      normalizeOutlookIcsState({
        snapshot: { ...snapshot([]), windowEnd: 0 },
      }),
    ).toBe(EMPTY_OUTLOOK_ICS_STATE);

    expect(
      normalizeOutlookIcsState({
        snapshot: { ...snapshot([]), importedAt: Number.MAX_VALUE },
      }),
    ).toBe(EMPTY_OUTLOOK_ICS_STATE);

    const normalized = normalizeOutlookIcsState({
      snapshot: {
        ...snapshot([]),
        events: [
          timedEvent("valid"),
          { ...timedEvent("backwards"), start: 300, end: 200 },
          {
            ...timedEvent("bad-all-day"),
            allDay: true,
            startDate: "2026-02-30",
            endDateExclusive: "2026-03-01",
          },
        ],
      },
    });
    expect(normalized.snapshot?.events.map((event) => event.title)).toEqual([
      "valid",
    ]);

    const sanitized = normalizeOutlookIcsState({
      snapshot: {
        ...snapshot([]),
        events: [
          { ...timedEvent("raw-id"), id: "raw-sensitive-id" },
          {
            ...timedEvent("long-title"),
            title: "x".repeat(OUTLOOK_ICS_MAX_TITLE_LENGTH + 1),
          },
        ],
      },
    });
    expect(sanitized.snapshot?.events).toEqual([]);
  });

  it("caps one persisted snapshot at 5,000 normalized events", () => {
    const events = Array.from({ length: OUTLOOK_ICS_MAX_EVENTS + 1 }, (_, index) =>
      timedEvent(`event-${index}`),
    );
    expect(normalizeOutlookIcsState({ snapshot: snapshot(events) }).snapshot?.events)
      .toHaveLength(OUTLOOK_ICS_MAX_EVENTS);
  });

  it("selects events that intersect a requested half-open window", () => {
    const source = snapshot([
      timedEvent("ends-at-start", 0, 100),
      timedEvent("overlaps-start", 50, 101),
      timedEvent("inside", 150, 175),
      timedEvent("overlaps-end", 199, 250),
      timedEvent("starts-at-end", 200, 250),
    ]);
    expect(
      selectVisibleOutlookIcsEvents(source, 100, 200).map((event) => event.id),
    ).toEqual([
      eventId("overlaps-start"),
      eventId("inside"),
      eventId("overlaps-end"),
    ]);
  });

  it("uses wall dates for all-day filtering after a timezone change", () => {
    const windowStart = new Date(2026, 6, 14).getTime();
    const windowEnd = new Date(2026, 6, 15).getTime();
    const source = snapshot([
      {
        id: eventId("wall-date"),
        title: "Wall-date event",
        // Simulate epochs calculated in a radically different prior timezone.
        start: windowStart + 3 * 86_400_000,
        end: windowEnd + 3 * 86_400_000,
        allDay: true,
        startDate: "2026-07-14",
        endDateExclusive: "2026-07-15",
        source: "outlook-ics",
        readOnly: true,
      },
      {
        id: eventId("ends-at-start-date"),
        title: "Ends at window start",
        start: windowStart - 86_400_000,
        end: windowStart,
        allDay: true,
        startDate: "2026-07-13",
        endDateExclusive: "2026-07-14",
        source: "outlook-ics",
        readOnly: true,
      },
      {
        id: eventId("starts-at-end-date"),
        title: "Starts at window end",
        start: windowEnd,
        end: windowEnd + 86_400_000,
        allDay: true,
        startDate: "2026-07-15",
        endDateExclusive: "2026-07-16",
        source: "outlook-ics",
        readOnly: true,
      },
    ]);

    expect(
      selectVisibleOutlookIcsEvents(source, windowStart, windowEnd).map(
        (event) => event.id,
      ),
    ).toEqual([eventId("wall-date")]);
  });

  it("marks an imported snapshot stale at seven days", () => {
    const source = snapshot([]);
    expect(
      isOutlookIcsSnapshotStale(
        source,
        source.importedAt + OUTLOOK_ICS_STALE_AFTER_MS - 1,
      ),
    ).toBe(false);
    expect(
      isOutlookIcsSnapshotStale(
        source,
        source.importedAt + OUTLOOK_ICS_STALE_AFTER_MS,
      ),
    ).toBe(true);
    expect(isOutlookIcsSnapshotStale(null)).toBe(false);
  });

  it("uses one atomic storage write and surfaces quota failures", async () => {
    const set = vi.fn().mockRejectedValue(new Error("QUOTA_BYTES"));
    const mutationId = "active-import";
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({
            [OUTLOOK_ICS_STORAGE_KEY]: { snapshot: null, mutationId },
          }),
          set,
        },
        onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
      },
    });

    await expect(
      outlookIcsStore.commitImport(
        mutationId,
        snapshot([timedEvent("meeting")]),
      ),
    ).rejects.toThrow("QUOTA_BYTES");
    expect(set).toHaveBeenCalledTimes(1);
  });

  it("surfaces extension storage read failures", async () => {
    vi.stubGlobal("chrome", {
      storage: {
        local: { get: vi.fn().mockRejectedValue(new Error("storage offline")) },
      },
    });

    await expect(outlookIcsStore.get()).rejects.toThrow("storage offline");
  });

  it("does not report a committed preview write as failed when a listener throws", async () => {
    const setItem = vi.fn();
    let stored: string | null = null;
    vi.stubGlobal("chrome", undefined);
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => stored),
      setItem: setItem.mockImplementation((_key: string, value: string) => {
        stored = value;
      }),
      removeItem: vi.fn(),
    });
    const unsubscribe = outlookIcsStore.subscribe(() => {
      throw new Error("render failed");
    });

    const mutationId = await outlookIcsStore.beginImport();
    await expect(
      outlookIcsStore.commitImport(
        mutationId,
        snapshot([timedEvent("meeting")]),
      ),
    ).resolves.toBe(true);
    expect(setItem).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("prevents an older in-flight import from resurrecting a cleared snapshot", async () => {
    let stored: string | null = null;
    vi.stubGlobal("chrome", undefined);
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => stored),
      setItem: vi.fn((_key: string, value: string) => {
        stored = value;
      }),
      removeItem: vi.fn(),
    });

    const mutationId = await outlookIcsStore.beginImport();
    await outlookIcsStore.clear();
    await expect(
      outlookIcsStore.commitImport(
        mutationId,
        snapshot([timedEvent("must-not-return")]),
      ),
    ).resolves.toBe(false);
    await expect(outlookIcsStore.get()).resolves.toBe(EMPTY_OUTLOOK_ICS_STATE);
    expect(stored).not.toContain("must-not-return");
  });

  it("isolates throwing listeners for cross-window preview updates", () => {
    const handlers: Array<(event: StorageEvent) => void> = [];
    vi.stubGlobal("chrome", undefined);
    vi.stubGlobal("window", {
      addEventListener: vi.fn(
        (type: string, handler: (event: StorageEvent) => void) => {
          if (type === "storage") handlers.push(handler);
        },
      ),
      removeEventListener: vi.fn(),
    });
    const received: OutlookIcsState[] = [];
    const unsubscribeThrowing = outlookIcsStore.subscribe(() => {
      throw new Error("render failed");
    });
    const unsubscribeRecording = outlookIcsStore.subscribe((next) => {
      received.push(next);
    });
    const event = {
      key: OUTLOOK_ICS_STORAGE_KEY,
      newValue: JSON.stringify({
        snapshot: snapshot([timedEvent("cross-window")]),
      }),
    } as StorageEvent;

    expect(() => handlers.forEach((handler) => handler(event))).not.toThrow();
    expect(received.at(-1)?.snapshot?.events[0]?.title).toBe("cross-window");
    unsubscribeThrowing();
    unsubscribeRecording();
  });
});
