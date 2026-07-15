import { describe, expect, it } from "vitest";
import {
  clearCalendarEventFieldErrors,
  createCalendarEventDraft,
  fromDateTimeLocalInput,
  toDateTimeLocalInput,
  validateCalendarEventDraft,
} from "./calendarEventUtils";

describe("local calendar event drafts", () => {
  it("prefills the selected local day from 09:00 to 10:00", () => {
    const selectedDay = new Date(2026, 6, 14).getTime();

    expect(createCalendarEventDraft(selectedDay)).toEqual({
      title: "",
      start: "2026-07-14T09:00",
      end: "2026-07-14T10:00",
      location: "",
      notes: "",
    });
  });

  it("round-trips datetime-local values through local components", () => {
    const timestamp = new Date(2026, 10, 3, 13, 45).getTime();
    const input = toDateTimeLocalInput(timestamp);

    expect(input).toBe("2026-11-03T13:45");
    expect(fromDateTimeLocalInput(input)).toBe(timestamp);
  });

  it("rejects blank titles and non-forward intervals", () => {
    const result = validateCalendarEventDraft({
      title: "   ",
      start: "2026-07-14T10:00",
      end: "2026-07-14T10:00",
      location: "",
      notes: "",
    });

    expect(result).toEqual({
      ok: false,
      errors: {
        title: "Title is required.",
        end: "End must be after start.",
      },
    });
  });

  it("trims saved fields and omits blank optional values", () => {
    const result = validateCalendarEventDraft({
      title: "  Project review  ",
      start: "2026-07-14T09:00",
      end: "2026-07-14T10:30",
      location: "  Room 4B  ",
      notes: "   ",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        title: "Project review",
        start: new Date(2026, 6, 14, 9, 0).getTime(),
        end: new Date(2026, 6, 14, 10, 30).getTime(),
        location: "Room 4B",
      },
    });
  });

  it("rejects normalized or malformed local dates", () => {
    expect(fromDateTimeLocalInput("2026-02-30T09:00")).toBeNull();
    expect(fromDateTimeLocalInput("2026-07-14 09:00")).toBeNull();
  });

  it("clears a derived end error when the start value changes", () => {
    expect(
      clearCalendarEventFieldErrors(
        { title: "Title is required.", end: "End must be after start." },
        "start",
      ),
    ).toEqual({ title: "Title is required." });
  });
});
