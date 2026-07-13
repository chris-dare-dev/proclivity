import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dateUtils";
import { syncGoogleCalendarWindow } from "./sync";

describe("Google Calendar visible-window sync", () => {
  it("pads the API query for timezone boundaries then clips the cache exactly", async () => {
    const windowStart = new Date(2026, 6, 1).getTime();
    const windowEnd = addDays(windowStart, 42);
    let requestUrl = "";
    const fetchImpl = (async (input: RequestInfo | URL) => {
      requestUrl = String(input);
      return new Response(
        JSON.stringify({
          items: [
            {
              id: "before",
              summary: "Before window",
              start: { date: "2026-06-30" },
              end: { date: "2026-07-01" },
            },
            {
              id: "inside",
              summary: "Inside window",
              start: { date: "2026-07-01" },
              end: { date: "2026-07-02" },
            },
            {
              id: "after",
              summary: "After window",
              start: { dateTime: new Date(windowEnd).toISOString() },
              end: { dateTime: new Date(windowEnd + 3_600_000).toISOString() },
            },
          ],
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const synced = await syncGoogleCalendarWindow({
      token: "calendar-token",
      windowStart,
      windowEnd,
      now: () => 123,
      fetchImpl,
    });

    const url = new URL(requestUrl);
    expect(url.searchParams.get("timeMin")).toBe(
      new Date(addDays(windowStart, -2)).toISOString(),
    );
    expect(url.searchParams.get("timeMax")).toBe(
      new Date(addDays(windowEnd, 2)).toISOString(),
    );
    expect(synced.events.map((event) => event.id)).toEqual([
      "gcal:primary:inside",
    ]);
    expect(synced.windowStart).toBe(windowStart);
    expect(synced.windowEnd).toBe(windowEnd);
    expect(synced.lastSyncedAt).toBe(123);
  });
});
