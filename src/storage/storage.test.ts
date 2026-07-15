import { describe, expect, it } from "vitest";
import { EMPTY_STATE, type ProclivityState } from "@/types";
import {
  normalizeLocalCalendarEvents,
  normalizeState,
} from "./storage";

describe("local calendar event storage normalization", () => {
  it("backfills the collection for legacy state", () => {
    const legacy = { ...EMPTY_STATE } as Partial<ProclivityState>;
    delete legacy.localCalendarEvents;

    expect(
      normalizeState(legacy as ProclivityState).localCalendarEvents,
    ).toEqual([]);
  });

  it("keeps valid local events and drops malformed or duplicate records", () => {
    const valid = {
      id: "local-calendar:one",
      title: "  Project review  ",
      start: new Date(2026, 6, 14, 9, 0).getTime(),
      end: new Date(2026, 6, 14, 10, 0).getTime(),
      location: "  Room 4B  ",
      notes: "  Bring the brief  ",
      source: "local-calendar",
      readOnly: false,
      allDay: false,
    };

    expect(
      normalizeLocalCalendarEvents([
        valid,
        { ...valid, title: "Duplicate id" },
        { ...valid, id: "local-calendar:backward", end: valid.start },
        { ...valid, id: "local-calendar:external", readOnly: true },
      ]),
    ).toEqual([
      {
        ...valid,
        title: "Project review",
        location: "Room 4B",
        notes: "Bring the brief",
      },
    ]);
  });
});
