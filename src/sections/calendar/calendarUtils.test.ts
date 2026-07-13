import { describe, expect, it } from "vitest";
import type { GoogleCalendarEvent } from "@/lib/googleCalendar/types";
import { addDays } from "@/lib/dateUtils";
import {
  buildMonthGrid,
  indexDayItems,
  startOfMonth,
} from "./calendarUtils";

function googleEvent(
  overrides: Partial<GoogleCalendarEvent> & Pick<GoogleCalendarEvent, "id" | "start" | "end">,
): GoogleCalendarEvent {
  const { id, start, end, ...rest } = overrides;
  return {
    id,
    calendarId: "primary",
    title: "Google event",
    start,
    end,
    source: "google-calendar",
    readOnly: true,
    allDay: false,
    ...rest,
  } as GoogleCalendarEvent;
}

describe("Google events in the month-grid index", () => {
  const monthStart = new Date(2026, 6, 1).getTime();
  const cells = buildMonthGrid(
    startOfMonth(monthStart),
    "mon",
    new Date(2026, 6, 13).getTime(),
  );

  it("indexes every day of a multi-day all-day event except its exclusive end", () => {
    const start = new Date(2026, 6, 13).getTime();
    const end = new Date(2026, 6, 16).getTime();
    const event = googleEvent({
      id: "gcal:primary:multi",
      start,
      end,
      allDay: true,
      startDate: "2026-07-13",
      endDateExclusive: "2026-07-16",
    });
    const indexed = indexDayItems(cells, [], [], start, [event]);
    expect(indexed.get(start)?.googleEvents).toHaveLength(1);
    expect(indexed.get(addDays(start, 1))?.googleEvents).toHaveLength(1);
    expect(indexed.get(addDays(start, 2))?.googleEvents).toHaveLength(1);
    expect(indexed.get(end)?.googleEvents).toHaveLength(0);
  });

  it("does not leak a timed event ending at midnight into the next day", () => {
    const day = new Date(2026, 6, 13).getTime();
    const midnight = addDays(day, 1);
    const event = googleEvent({
      id: "gcal:primary:late",
      start: new Date(2026, 6, 13, 23, 0).getTime(),
      end: midnight,
    });
    const indexed = indexDayItems(cells, [], [], day, [event]);
    expect(indexed.get(day)?.googleEvents).toHaveLength(1);
    expect(indexed.get(midnight)?.googleEvents).toHaveLength(0);
  });

  it("indexes a timed event on both days when it crosses midnight", () => {
    const day = new Date(2026, 6, 13).getTime();
    const nextDay = addDays(day, 1);
    const event = googleEvent({
      id: "gcal:primary:overnight",
      start: new Date(2026, 6, 13, 23, 0).getTime(),
      end: new Date(2026, 6, 14, 1, 0).getTime(),
    });
    const indexed = indexDayItems(cells, [], [], day, [event]);
    expect(indexed.get(day)?.googleEvents).toHaveLength(1);
    expect(indexed.get(nextDay)?.googleEvents).toHaveLength(1);
  });
});
