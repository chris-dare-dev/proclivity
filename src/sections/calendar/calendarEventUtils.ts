export interface CalendarEventDraft {
  title: string;
  start: string;
  end: string;
  location: string;
  notes: string;
}

export interface CalendarEventFormErrors {
  title?: string;
  start?: string;
  end?: string;
}

export interface NewLocalCalendarEventFields {
  title: string;
  start: number;
  end: number;
  location?: string | undefined;
  notes?: string | undefined;
}

export type CalendarEventValidationResult =
  | { ok: true; value: NewLocalCalendarEventFields }
  | { ok: false; errors: CalendarEventFormErrors };

export function clearCalendarEventFieldErrors(
  current: CalendarEventFormErrors,
  field: keyof CalendarEventDraft,
): CalendarEventFormErrors {
  const next = { ...current };
  if (field === "title" || field === "start" || field === "end") {
    delete next[field];
  }
  // Interval order is reported on Ends but depends on both controls.
  if (field === "start") delete next.end;
  return next;
}

/** Format local wall-clock time for an input[type="datetime-local"]. */
export function toDateTimeLocalInput(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

/**
 * Parse a datetime-local value without letting Date.parse reinterpret it as
 * UTC. The round-trip check also rejects wall-clock times normalized through
 * a daylight-saving gap.
 */
export function fromDateTimeLocalInput(value: string): number | null {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const parsed = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hour ||
    parsed.getMinutes() !== minute
  ) {
    return null;
  }
  const timestamp = parsed.getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

/** Create the calm, predictable 09:00–10:00 draft for a selected day. */
export function createCalendarEventDraft(dayTimestamp: number): CalendarEventDraft {
  const start = new Date(dayTimestamp);
  start.setHours(9, 0, 0, 0);
  const end = new Date(start);
  end.setHours(10, 0, 0, 0);
  return {
    title: "",
    start: toDateTimeLocalInput(start.getTime()),
    end: toDateTimeLocalInput(end.getTime()),
    location: "",
    notes: "",
  };
}

export function validateCalendarEventDraft(
  draft: CalendarEventDraft,
): CalendarEventValidationResult {
  const errors: CalendarEventFormErrors = {};
  const title = draft.title.trim();
  const start = fromDateTimeLocalInput(draft.start);
  const end = fromDateTimeLocalInput(draft.end);

  if (!title) errors.title = "Title is required.";
  if (start === null) errors.start = "Choose a valid start date and time.";
  if (end === null) errors.end = "Choose a valid end date and time.";
  if (start !== null && end !== null && end <= start) {
    errors.end = "End must be after start.";
  }

  if (!title || start === null || end === null || end <= start) {
    return { ok: false, errors };
  }

  const location = draft.location.trim();
  const notes = draft.notes.trim();
  return {
    ok: true,
    value: {
      title,
      start,
      end,
      ...(location ? { location } : {}),
      ...(notes ? { notes } : {}),
    },
  };
}
