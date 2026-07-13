import { describe, expect, it } from "vitest";
import {
  buildEventsUrl,
  GoogleCalendarApiError,
  listPrimaryCalendarEvents,
  normalizeGoogleCalendarEvent,
} from "./api";
import { toDateInput } from "@/lib/dateUtils";

describe("Google Calendar GET-only client", () => {
  it("lists and paginates the bounded primary-calendar window", async () => {
    const calls: Array<{ url: string; init?: RequestInit | undefined }> = [];
    const bodies = [
      {
        nextPageToken: "page-2",
        items: [
          {
            id: "timed-1",
            status: "confirmed",
            summary: "Design review",
            start: { dateTime: "2026-07-13T09:00:00-04:00" },
            end: { dateTime: "2026-07-13T10:00:00-04:00" },
            htmlLink: "https://calendar.google.com/calendar/event?eid=abc",
          },
        ],
      },
      {
        // Google may return a short (even empty) page with another token.
        nextPageToken: "page-3",
        items: [],
      },
      {
        items: [
          {
            id: "all-day-1",
            status: "confirmed",
            summary: "Conference",
            start: { date: "2026-07-14" },
            end: { date: "2026-07-16" },
          },
          {
            id: "cancelled",
            status: "cancelled",
            start: { date: "2026-07-14" },
            end: { date: "2026-07-15" },
          },
        ],
      },
    ];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), ...(init ? { init } : {}) });
      return new Response(JSON.stringify(bodies[calls.length - 1]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const windowStart = new Date(2026, 6, 1).getTime();
    const windowEnd = new Date(2026, 7, 1).getTime();
    const events = await listPrimaryCalendarEvents({
      token: "secret-token",
      windowStart,
      windowEnd,
      fetchImpl,
    });

    expect(calls).toHaveLength(3);
    expect(calls[0]?.init?.method).toBe("GET");
    expect((calls[0]?.init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer secret-token",
    );
    const first = new URL(calls[0]!.url);
    expect(first.pathname).toBe("/calendar/v3/calendars/primary/events");
    expect(first.searchParams.get("singleEvents")).toBe("true");
    expect(first.searchParams.get("orderBy")).toBe("startTime");
    expect(first.searchParams.get("showDeleted")).toBe("false");
    expect(first.searchParams.get("timeZone")).toBe("UTC");
    expect(first.searchParams.get("timeMin")).toBe(
      new Date(windowStart).toISOString(),
    );
    expect(first.searchParams.get("timeMax")).toBe(
      new Date(windowEnd).toISOString(),
    );
    expect(new URL(calls[1]!.url).searchParams.get("pageToken")).toBe("page-2");
    expect(new URL(calls[2]!.url).searchParams.get("pageToken")).toBe("page-3");
    expect(events.map((event) => event.id)).toEqual([
      "gcal:primary:timed-1",
      "gcal:primary:all-day-1",
    ]);
    expect(events.every((event) => event.readOnly)).toBe(true);
  });

  it("normalizes all-day dates as local dates with an exclusive end", () => {
    const event = normalizeGoogleCalendarEvent({
      id: "holiday",
      summary: "Holiday",
      start: { date: "2026-11-01" },
      end: { date: "2026-11-02" },
      htmlLink: "javascript:alert(1)",
    });
    expect(event?.allDay).toBe(true);
    expect(event && toDateInput(event.start)).toBe("2026-11-01");
    expect(event && toDateInput(event.end)).toBe("2026-11-02");
    expect(event?.htmlLink).toBeUndefined();
  });

  it("accepts documented compact RFC3339 offsets but rejects offset-less times", () => {
    const compactOffset = normalizeGoogleCalendarEvent({
      id: "compact-offset",
      summary: "Compact offset",
      start: { dateTime: "2026-07-13T09:00:00-0400" },
      end: { dateTime: "2026-07-13T10:00:00-0400" },
    });
    expect(compactOffset?.allDay).toBe(false);
    expect(compactOffset?.start).toBe(Date.parse("2026-07-13T09:00:00-0400"));

    expect(
      normalizeGoogleCalendarEvent({
        id: "offset-less",
        summary: "Ambiguous local time",
        start: {
          dateTime: "2026-07-13T09:00:00",
          timeZone: "America/New_York",
        },
        end: {
          dateTime: "2026-07-13T10:00:00",
          timeZone: "America/New_York",
        },
      }),
    ).toBeNull();
  });

  it("caps accumulated events rather than assuming full pages", async () => {
    let calls = 0;
    const page = (offset: number) =>
      Array.from({ length: 2_500 }, (_, index) => ({
        id: `event-${offset + index}`,
        summary: "Busy",
        start: { dateTime: "2026-07-13T09:00:00Z" },
        end: { dateTime: "2026-07-13T10:00:00Z" },
      }));
    const fetchImpl = (async () => {
      calls += 1;
      return new Response(
        JSON.stringify({
          items: page((calls - 1) * 2_500),
          nextPageToken: `page-${calls + 1}`,
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    await expect(
      listPrimaryCalendarEvents({
        token: "secret-token",
        windowStart: 1,
        windowEnd: 2,
        fetchImpl,
      }),
    ).rejects.toThrow("more than 5,000 events");
    expect(calls).toBe(2);
  });

  it("follows a long chain of short pages until Google exhausts the token", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      const finalPage = calls === 102;
      return new Response(
        JSON.stringify({
          items: finalPage
            ? [
                {
                  id: "after-long-chain",
                  summary: "Eventually returned",
                  start: { dateTime: "2026-07-13T09:00:00Z" },
                  end: { dateTime: "2026-07-13T10:00:00Z" },
                },
              ]
            : [],
          ...(finalPage ? {} : { nextPageToken: `page-${calls}` }),
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const events = await listPrimaryCalendarEvents({
      token: "secret-token",
      windowStart: 1,
      windowEnd: 2,
      fetchImpl,
    });
    expect(calls).toBe(102);
    expect(events.map((event) => event.id)).toEqual([
      "gcal:primary:after-long-chain",
    ]);
  });

  it("surfaces a 401 as an authorization error without retrying", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return new Response(JSON.stringify({ error: { message: "Invalid" } }), {
        status: 401,
      });
    }) as typeof fetch;
    await expect(
      listPrimaryCalendarEvents({
        token: "expired",
        windowStart: 1,
        windowEnd: 2,
        fetchImpl,
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<GoogleCalendarApiError>>({ status: 401 }),
    );
    expect(calls).toBe(1);
  });

  it("constructs only the bounded primary event-list endpoint", () => {
    const url = new URL(buildEventsUrl(1, 2));
    expect(url.pathname).toBe("/calendar/v3/calendars/primary/events");
    expect(url.searchParams.get("showDeleted")).toBe("false");
    expect(url.searchParams.get("timeMin")).not.toBeNull();
    expect(url.searchParams.get("timeMax")).not.toBeNull();
  });
});
