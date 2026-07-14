import { describe, expect, it, vi } from "vitest";
import {
  OutlookIcsParseError,
  assertOutlookIcsTextSize,
  parseOutlookIcs,
  parseOutlookIcsFile,
} from "./parser";
import {
  OUTLOOK_ICS_MAX_BYTES,
  OUTLOOK_ICS_MAX_EVENT_COMPONENTS,
  OUTLOOK_ICS_MAX_TIMEZONE_OBSERVANCES,
  OUTLOOK_ICS_MAX_TIMEZONE_RDATES,
  OUTLOOK_ICS_MAX_TIMEZONES,
} from "./types";

const NOW = Date.parse("2026-07-13T12:00:00Z");

function expectedWindow(): { windowStart: number; windowEnd: number } {
  const start = new Date(NOW);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 42);
  const end = new Date(NOW);
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() + 367);
  return { windowStart: start.getTime(), windowEnd: end.getTime() };
}

function calendar(...components: string[]): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Proclivity tests//EN",
    ...components,
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

function event(...properties: string[]): string {
  return ["BEGIN:VEVENT", ...properties, "END:VEVENT"].join("\r\n");
}

function fixedTimezone(tzid: string, observanceCount = 1): string {
  return [
    "BEGIN:VTIMEZONE",
    `TZID:${tzid}`,
    ...Array.from({ length: observanceCount }, () => [
      "BEGIN:STANDARD",
      "DTSTART:19700101T000000",
      "TZOFFSETFROM:-0500",
      "TZOFFSETTO:-0500",
      "END:STANDARD",
    ]).flat(),
    "END:VTIMEZONE",
  ].join("\r\n");
}

describe("parseOutlookIcs", () => {
  it("normalizes only safe display fields and hashes the raw UID", async () => {
    const result = await parseOutlookIcs(
      calendar(
        event(
          "UID:raw-sensitive-uid@example.test",
          "DTSTART:20260714T130000Z",
          "DTEND:20260714T140000Z",
          "SUMMARY:  Weekly   planning  ",
          "CLASS:PUBLIC",
          "DESCRIPTION:must never be persisted",
          "ATTENDEE:mailto:person@example.test",
          "LOCATION:Secret room",
        ),
      ),
      { now: NOW },
    );

    expect(result.importedCount).toBe(1);
    expect(result.skippedCount).toBe(0);
    expect(result.redactedCount).toBe(0);
    expect(result.bounds).toEqual(expectedWindow());
    expect(result.snapshot.events[0]).toEqual({
      id: expect.stringMatching(/^outlook-ics:[a-f0-9]{64}$/),
      title: "Weekly planning",
      start: Date.parse("2026-07-14T13:00:00Z"),
      end: Date.parse("2026-07-14T14:00:00Z"),
      allDay: false,
      source: "outlook-ics",
      readOnly: true,
    });
    const persisted = JSON.stringify(result.snapshot);
    expect(persisted).not.toContain("raw-sensitive-uid");
    expect(persisted).not.toContain("must never be persisted");
    expect(persisted).not.toContain("person@example.test");
    expect(persisted).not.toContain("Secret room");
  });

  it("keeps wall dates for all-day events", async () => {
    const result = await parseOutlookIcs(
      calendar(
        event(
          "UID:all-day",
          "DTSTART;VALUE=DATE:20260714",
          "DTEND;VALUE=DATE:20260716",
          "SUMMARY:Conference",
        ),
      ),
      { now: NOW },
    );

    expect(result.snapshot.events[0]).toMatchObject({
      title: "Conference",
      allDay: true,
      startDate: "2026-07-14",
      endDateExclusive: "2026-07-16",
    });
  });

  it("redacts private, confidential, and unknown classifications", async () => {
    const result = await parseOutlookIcs(
      calendar(
        event(
          "UID:private",
          "DTSTART:20260714T130000Z",
          "DTEND:20260714T140000Z",
          "SUMMARY:Private secret",
          "CLASS:PRIVATE",
        ),
        event(
          "UID:confidential",
          "DTSTART:20260715T130000Z",
          "DTEND:20260715T140000Z",
          "SUMMARY:Confidential secret",
          "CLASS:CONFIDENTIAL",
        ),
        event(
          "UID:unknown-class",
          "DTSTART:20260716T130000Z",
          "DTEND:20260716T140000Z",
          "SUMMARY:Unknown secret",
          "CLASS:X-COMPANY-SECRET",
        ),
      ),
      { now: NOW },
    );

    expect(result.redactedCount).toBe(3);
    expect(result.snapshot.events.map(({ title }) => title)).toEqual([
      "Private work event",
      "Private work event",
      "Private work event",
    ]);
    expect(JSON.stringify(result.snapshot)).not.toContain("secret");
  });

  it("expands RRULE and RDATE while applying EXDATE and exceptions", async () => {
    const result = await parseOutlookIcs(
      calendar(
        event(
          "UID:recurring-series",
          "DTSTART:20260713T140000Z",
          "DTEND:20260713T150000Z",
          "RRULE:FREQ=DAILY;COUNT=5",
          "RDATE:20260718T140000Z",
          "EXDATE:20260714T140000Z",
          "SUMMARY:Daily sync",
        ),
        event(
          "UID:recurring-series",
          "RECURRENCE-ID:20260715T140000Z",
          "DTSTART:20260715T160000Z",
          "DTEND:20260715T170000Z",
          "SUMMARY:Moved sync",
        ),
        event(
          "UID:recurring-series",
          "RECURRENCE-ID:20260716T140000Z",
          "STATUS:CANCELLED",
        ),
      ),
      { now: NOW },
    );

    expect(result.snapshot.events.map(({ title, start }) => [title, start])).toEqual([
      ["Daily sync", Date.parse("2026-07-13T14:00:00Z")],
      ["Moved sync", Date.parse("2026-07-15T16:00:00Z")],
      ["Daily sync", Date.parse("2026-07-17T14:00:00Z")],
      ["Daily sync", Date.parse("2026-07-18T14:00:00Z")],
    ]);
    expect(result.skippedCount).toBe(1);
    expect(new Set(result.snapshot.events.map(({ id }) => id)).size).toBe(4);
  });

  it("deduplicates an RDATE that overlaps the RRULE recurrence set", async () => {
    const result = await parseOutlookIcs(
      calendar(
        event(
          "UID:duplicate-rdate",
          "DTSTART:20260713T140000Z",
          "DTEND:20260713T150000Z",
          "RRULE:FREQ=DAILY;COUNT=2",
          "RDATE:20260714T140000Z",
          "SUMMARY:One logical occurrence",
        ),
      ),
      { now: NOW },
    );

    expect(result.snapshot.events).toHaveLength(2);
    expect(new Set(result.snapshot.events.map(({ id }) => id)).size).toBe(2);
  });

  it("uses PERIOD RDATE duration unless an exception overrides it", async () => {
    const result = await parseOutlookIcs(
      calendar(
        event(
          "UID:period-rdates",
          "DTSTART:20260713T140000Z",
          "DTEND:20260713T150000Z",
          "RDATE;VALUE=PERIOD:20260715T130000Z/20260715T150000Z,20260716T130000Z/PT3H",
          "SUMMARY:Period occurrence",
        ),
        event(
          "UID:period-rdates",
          "RECURRENCE-ID:20260716T130000Z",
          "DTSTART:20260716T180000Z",
          "DTEND:20260716T190000Z",
          "SUMMARY:Exception override",
        ),
      ),
      { now: NOW },
    );

    expect(result.snapshot.events.map(({ title, start, end }) => [
      title,
      start,
      end,
    ])).toEqual([
      [
        "Period occurrence",
        Date.parse("2026-07-13T14:00:00Z"),
        Date.parse("2026-07-13T15:00:00Z"),
      ],
      [
        "Period occurrence",
        Date.parse("2026-07-15T13:00:00Z"),
        Date.parse("2026-07-15T15:00:00Z"),
      ],
      [
        "Exception override",
        Date.parse("2026-07-16T18:00:00Z"),
        Date.parse("2026-07-16T19:00:00Z"),
      ],
    ]);
  });

  it("follows a detached exception beyond the horizon when it moves into view", async () => {
    const result = await parseOutlookIcs(
      calendar(
        event(
          "UID:moved-from-future",
          "DTSTART:20260713T140000Z",
          "DTEND:20260713T150000Z",
          "RRULE:FREQ=WEEKLY;COUNT=60",
          "SUMMARY:Master occurrence",
        ),
        event(
          "UID:moved-from-future",
          "RECURRENCE-ID:20270823T140000Z",
          "DTSTART:20260714T160000Z",
          "DTEND:20260714T170000Z",
          "SUMMARY:Moved into view",
        ),
      ),
      { now: NOW },
    );

    expect(result.snapshot.events).toContainEqual(
      expect.objectContaining({
        title: "Moved into view",
        start: Date.parse("2026-07-14T16:00:00Z"),
        end: Date.parse("2026-07-14T17:00:00Z"),
      }),
    );
  });

  it("uses the newest SEQUENCE for duplicate UID records", async () => {
    const result = await parseOutlookIcs(
      calendar(
        event(
          "UID:revision",
          "SEQUENCE:1",
          "DTSTART:20260714T130000Z",
          "DTEND:20260714T140000Z",
          "SUMMARY:Old title",
        ),
        event(
          "UID:revision",
          "SEQUENCE:2",
          "DTSTART:20260714T130000Z",
          "DTEND:20260714T140000Z",
          "SUMMARY:Current title",
        ),
      ),
      { now: NOW },
    );

    expect(result.snapshot.events).toHaveLength(1);
    expect(result.snapshot.events[0]?.title).toBe("Current title");
    expect(result.skippedCount).toBe(1);
  });

  it("registers an embedded VTIMEZONE for local event times", async () => {
    const timezone = [
      "BEGIN:VTIMEZONE",
      "TZID:Custom Eastern",
      "BEGIN:STANDARD",
      "DTSTART:19701101T020000",
      "TZOFFSETFROM:-0400",
      "TZOFFSETTO:-0500",
      "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
      "END:STANDARD",
      "BEGIN:DAYLIGHT",
      "DTSTART:19700308T020000",
      "TZOFFSETFROM:-0500",
      "TZOFFSETTO:-0400",
      "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
      "END:DAYLIGHT",
      "END:VTIMEZONE",
    ].join("\r\n");
    const result = await parseOutlookIcs(
      calendar(
        timezone,
        event(
          "UID:zoned",
          "DTSTART;TZID=Custom Eastern:20260714T090000",
          "DTEND;TZID=Custom Eastern:20260714T100000",
          "SUMMARY:Zoned event",
        ),
      ),
      { now: NOW },
    );

    expect(result.snapshot.events[0]).toMatchObject({
      start: Date.parse("2026-07-14T13:00:00Z"),
      end: Date.parse("2026-07-14T14:00:00Z"),
    });
  });

  it("rejects malformed and high-frequency embedded time zones", async () => {
    const malformed = [
      "BEGIN:VTIMEZONE",
      "TZID:Broken Zone",
      "END:VTIMEZONE",
    ].join("\r\n");
    await expect(
      parseOutlookIcs(calendar(malformed), { now: NOW }),
    ).rejects.toMatchObject({ kind: "invalid-calendar" });

    const highFrequency = [
      "BEGIN:VTIMEZONE",
      "TZID:Runaway Zone",
      "BEGIN:STANDARD",
      "DTSTART:19700101T000000",
      "TZOFFSETFROM:-0500",
      "TZOFFSETTO:-0500",
      "RRULE:FREQ=SECONDLY",
      "END:STANDARD",
      "END:VTIMEZONE",
    ].join("\r\n");
    await expect(
      parseOutlookIcs(calendar(highFrequency), { now: NOW }),
    ).rejects.toMatchObject({ kind: "unsupported-calendar" });
  });

  it("bounds timezone RDATEs and rejects multi-value forms ical.js ignores", async () => {
    const multiValue = [
      "BEGIN:VTIMEZONE",
      "TZID:Ignored Dates",
      "BEGIN:STANDARD",
      "DTSTART:19700101T000000",
      "TZOFFSETFROM:-0500",
      "TZOFFSETTO:-0500",
      "RDATE:20200101T000000,20210101T000000",
      "END:STANDARD",
      "END:VTIMEZONE",
    ].join("\r\n");
    await expect(
      parseOutlookIcs(calendar(multiValue), { now: NOW }),
    ).rejects.toMatchObject({ kind: "unsupported-calendar" });

    const excessiveDates = [
      "BEGIN:VTIMEZONE",
      "TZID:Too Many Dates",
      "BEGIN:STANDARD",
      "DTSTART:19700101T000000",
      "TZOFFSETFROM:-0500",
      "TZOFFSETTO:-0500",
      ...Array.from(
        { length: OUTLOOK_ICS_MAX_TIMEZONE_RDATES + 1 },
        (_, index) =>
          `RDATE:${String(2000 + index).padStart(4, "0")}0101T000000`,
      ),
      "END:STANDARD",
      "END:VTIMEZONE",
    ].join("\r\n");
    await expect(
      parseOutlookIcs(calendar(excessiveDates), { now: NOW }),
    ).rejects.toMatchObject({ kind: "limit-exceeded" });
  });

  it("bounds embedded timezone and observance counts", async () => {
    const excessiveZones = Array.from(
      { length: OUTLOOK_ICS_MAX_TIMEZONES + 1 },
      (_, index) => fixedTimezone(`Bounded Zone ${index}`),
    );
    await expect(
      parseOutlookIcs(calendar(...excessiveZones), { now: NOW }),
    ).rejects.toMatchObject({ kind: "limit-exceeded" });

    await expect(
      parseOutlookIcs(
        calendar(
          fixedTimezone(
            "Too Many Observances",
            OUTLOOK_ICS_MAX_TIMEZONE_OBSERVANCES + 1,
          ),
        ),
        { now: NOW },
      ),
    ).rejects.toMatchObject({ kind: "limit-exceeded" });
  });

  it("rejects unknown TZIDs instead of treating them as local time", async () => {
    await expect(
      parseOutlookIcs(
        calendar(
          event(
            "UID:unknown-zone",
            "DTSTART;TZID=Missing Zone:20260714T090000",
            "DTEND;TZID=Missing Zone:20260714T100000",
            "SUMMARY:Must reject",
          ),
        ),
        { now: NOW },
      ),
    ).rejects.toMatchObject({ kind: "unknown-timezone" });
  });

  it("rejects unsupported Microsoft recurrence properties", async () => {
    await expect(
      parseOutlookIcs(
        calendar(
          event(
            "UID:unsupported",
            "DTSTART:20260714T130000Z",
            "DTEND:20260714T140000Z",
            "X-MICROSOFT-RRULE:FREQ=DAILY;COUNT=2",
          ),
        ),
        { now: NOW },
      ),
    ).rejects.toMatchObject({ kind: "unsupported-calendar" });

    await expect(
      parseOutlookIcs(
        calendar(
          event(
            "UID:unsupported-exdate",
            "DTSTART:20260714T130000Z",
            "DTEND:20260714T140000Z",
            "X-MICROSOFT-EXDATE:20260715T130000Z",
          ),
        ),
        { now: NOW },
      ),
    ).rejects.toMatchObject({ kind: "unsupported-calendar" });
  });

  it("rejects non-Gregorian calendar scales", async () => {
    await expect(
      parseOutlookIcs(
        calendar().replace(
          "PRODID:-//Proclivity tests//EN",
          "PRODID:-//Proclivity tests//EN\r\nCALSCALE:JULIAN",
        ),
        { now: NOW },
      ),
    ).rejects.toMatchObject({ kind: "unsupported-calendar" });
  });

  it("rejects scheduling messages instead of importing cancellations", async () => {
    const snapshot = calendar(
      event(
        "UID:cancel-method",
        "DTSTART:20260714T130000Z",
        "DTEND:20260714T140000Z",
        "SUMMARY:Cancelled meeting",
      ),
    );
    const published = snapshot.replace(
      "PRODID:-//Proclivity tests//EN",
      "PRODID:-//Proclivity tests//EN\r\nMETHOD:PUBLISH",
    );
    await expect(
      parseOutlookIcs(published, { now: NOW }),
    ).resolves.toMatchObject({ importedCount: 1 });

    const cancelled = snapshot.replace(
      "PRODID:-//Proclivity tests//EN",
      "PRODID:-//Proclivity tests//EN\r\nMETHOD:CANCEL",
    );
    await expect(
      parseOutlookIcs(cancelled, { now: NOW }),
    ).rejects.toMatchObject({ kind: "unsupported-calendar" });
  });

  it("handles folded and escaped Outlook summaries", async () => {
    const text = calendar(
      event(
        "UID:folded",
        "DTSTART:20260714T130000Z",
        "DURATION:PT45M",
        "SUMMARY:Executive review\\, Q3\\; East\\\\",
        " West",
      ),
    );
    const result = await parseOutlookIcs(text, { now: NOW });
    const repeated = await parseOutlookIcs(text, { now: NOW });

    expect(result.snapshot.events[0]?.title).toBe(
      "Executive review, Q3; East\\West",
    );
    expect(
      result.snapshot.events[0]!.end - result.snapshot.events[0]!.start,
    ).toBe(45 * 60 * 1_000);
    expect(repeated.snapshot.events[0]?.id).toBe(
      result.snapshot.events[0]?.id,
    );
  });

  it("requires exactly one VCALENDAR at version 2.0", async () => {
    await expect(
      parseOutlookIcs(calendar().replace("VERSION:2.0", "VERSION:1.0"), {
        now: NOW,
      }),
    ).rejects.toMatchObject({ kind: "unsupported-calendar" });
    await expect(
      parseOutlookIcs(`${calendar()}${calendar()}`, { now: NOW }),
    ).rejects.toMatchObject({ kind: "invalid-calendar" });
  });

  it("accepts the UTF-8 BOM used by some Outlook exports", async () => {
    const result = await parseOutlookIcs(
      `\ufeff${calendar(
        event(
          "UID:bom",
          "DTSTART:20260714T130000Z",
          "DTEND:20260714T140000Z",
        ),
      )}`,
      { now: NOW },
    );
    expect(result.importedCount).toBe(1);
  });

  it("bounds raw VEVENT component volume before expansion", async () => {
    const records = Array.from(
      { length: OUTLOOK_ICS_MAX_EVENT_COMPONENTS + 1 },
      (_, index) => event(`UID:${index}`),
    );
    await expect(
      parseOutlookIcs(calendar(...records), { now: NOW }),
    ).rejects.toMatchObject({ kind: "limit-exceeded" });
  });

  it("caps recurrence iteration before an old high-frequency rule can hang", async () => {
    await expect(
      parseOutlookIcs(
        calendar(
          event(
            "UID:runaway",
            "DTSTART:20200101T000000Z",
            "DTEND:20200101T000001Z",
            "RRULE:FREQ=SECONDLY",
          ),
        ),
        { now: NOW },
      ),
    ).rejects.toMatchObject({ kind: "limit-exceeded" });
  });
});

describe("Outlook ICS file-size guards", () => {
  it("measures UTF-8 bytes, not JavaScript code units", () => {
    expect(() =>
      assertOutlookIcsTextSize("é".repeat(OUTLOOK_ICS_MAX_BYTES / 2 + 1)),
    ).toThrowError(OutlookIcsParseError);
  });

  it("rejects file.size before reading the file", async () => {
    const text = vi.fn(async () => calendar());
    const file = {
      size: OUTLOOK_ICS_MAX_BYTES + 1,
      text,
    } as unknown as File;

    await expect(parseOutlookIcsFile(file, { now: NOW })).rejects.toMatchObject({
      kind: "file-too-large",
    });
    expect(text).not.toHaveBeenCalled();
  });
});
