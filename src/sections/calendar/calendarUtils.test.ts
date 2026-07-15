import { describe, expect, it } from "vitest";
import type { GoogleCalendarEvent } from "@/lib/googleCalendar/types";
import type { OutlookIcsEvent } from "@/lib/outlookIcs/types";
import { addDays } from "@/lib/dateUtils";
import type { LocalCalendarEvent } from "@/types";
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

function outlookEvent(
  overrides: Partial<OutlookIcsEvent> &
    Pick<OutlookIcsEvent, "id" | "start" | "end">,
): OutlookIcsEvent {
  const { id, start, end, ...rest } = overrides;
  return {
    id,
    title: "Outlook event",
    start,
    end,
    source: "outlook-ics",
    readOnly: true,
    allDay: false,
    ...rest,
  } as OutlookIcsEvent;
}

function localEvent(
  overrides: Partial<LocalCalendarEvent> &
    Pick<LocalCalendarEvent, "id" | "start" | "end">,
): LocalCalendarEvent {
  const { id, start, end, ...rest } = overrides;
  return {
    id,
    title: "Local event",
    start,
    end,
    source: "local-calendar",
    readOnly: false,
    allDay: false,
    ...rest,
  };
}

describe("external events in the month-grid index", () => {
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
    expect(indexed.get(start)?.calendarEvents).toHaveLength(1);
    expect(indexed.get(addDays(start, 1))?.calendarEvents).toHaveLength(1);
    expect(indexed.get(addDays(start, 2))?.calendarEvents).toHaveLength(1);
    expect(indexed.get(end)?.calendarEvents).toHaveLength(0);
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
    expect(indexed.get(day)?.calendarEvents).toHaveLength(1);
    expect(indexed.get(midnight)?.calendarEvents).toHaveLength(0);
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
    expect(indexed.get(day)?.calendarEvents).toHaveLength(1);
    expect(indexed.get(nextDay)?.calendarEvents).toHaveLength(1);
  });

  it("indexes Google and Outlook events through the same interval rules", () => {
    const day = new Date(2026, 6, 13).getTime();
    const google = googleEvent({
      id: "gcal:primary:meeting",
      start: new Date(2026, 6, 13, 9, 0).getTime(),
      end: new Date(2026, 6, 13, 10, 0).getTime(),
    });
    const outlook = outlookEvent({
      id: "outlook:meeting",
      start: new Date(2026, 6, 13, 11, 0).getTime(),
      end: new Date(2026, 6, 13, 12, 0).getTime(),
    });

    const indexed = indexDayItems(cells, [], [], day, [outlook, google]);
    expect(
      indexed.get(day)?.calendarEvents.map((event) => event.source),
    ).toEqual(["google-calendar", "outlook-ics"]);
  });

  it("indexes local events with imported events and sorts them by start time", () => {
    const day = new Date(2026, 6, 13).getTime();
    const google = googleEvent({
      id: "gcal:primary:meeting",
      start: new Date(2026, 6, 13, 11, 0).getTime(),
      end: new Date(2026, 6, 13, 12, 0).getTime(),
    });
    const local = localEvent({
      id: "local-calendar:review",
      title: "Project review",
      start: new Date(2026, 6, 13, 9, 0).getTime(),
      end: new Date(2026, 6, 13, 10, 0).getTime(),
      location: "Room 4B",
      notes: "Bring the brief",
    });

    const indexed = indexDayItems(cells, [], [], day, [google, local]);

    expect(
      indexed.get(day)?.calendarEvents.map((event) => event.source),
    ).toEqual(["local-calendar", "google-calendar"]);
  });
});
