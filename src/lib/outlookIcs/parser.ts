import {
  OUTLOOK_ICS_MAX_BYTES,
  OUTLOOK_ICS_MAX_COMPONENTS,
  OUTLOOK_ICS_MAX_EVENT_COMPONENTS,
  OUTLOOK_ICS_MAX_EVENTS,
  OUTLOOK_ICS_MAX_EXPANSION_ITERATIONS,
  OUTLOOK_ICS_MAX_TITLE_LENGTH,
  OUTLOOK_ICS_MAX_TIMEZONE_OBSERVANCES,
  OUTLOOK_ICS_MAX_TIMEZONE_RDATES,
  OUTLOOK_ICS_MAX_TIMEZONES,
  OUTLOOK_ICS_PRIVATE_TITLE,
  OUTLOOK_ICS_SOURCE,
  OUTLOOK_ICS_WINDOW_FUTURE_DAYS,
  OUTLOOK_ICS_WINDOW_PAST_DAYS,
  type OutlookIcsEvent,
  type OutlookIcsImportResult,
  type OutlookIcsParseOptions,
} from "./types";

const MAX_UID_LENGTH = 2_048;
const BUILTIN_TZIDS = new Set(["Z", "UTC", "GMT"]);

type IcalApi = (typeof import("ical.js"))["default"];
type IcalComponent = InstanceType<IcalApi["Component"]>;
type IcalEvent = InstanceType<IcalApi["Event"]>;
type IcalPeriod = InstanceType<IcalApi["Period"]>;
type IcalTime = InstanceType<IcalApi["Time"]>;
type IcalTimezone = InstanceType<IcalApi["Timezone"]>;

export type OutlookIcsParseErrorKind =
  | "file-too-large"
  | "invalid-calendar"
  | "unsupported-calendar"
  | "unknown-timezone"
  | "limit-exceeded";

export class OutlookIcsParseError extends Error {
  constructor(
    message: string,
    readonly kind: OutlookIcsParseErrorKind,
  ) {
    super(message);
    this.name = "OutlookIcsParseError";
  }
}

interface IndexedComponent {
  component: IcalComponent;
  index: number;
}

interface EventGroup {
  uid: string;
  records: IndexedComponent[];
}

interface NormalizedCandidate {
  uid: string;
  recurrenceIdentity: string;
  title: string;
  start: number;
  end: number;
  allDay: boolean;
  startDate?: string | undefined;
  endDateExclusive?: string | undefined;
  redacted: boolean;
  /** Detached exceptions outrank PERIOD RDATEs, which outrank base rules. */
  priority: 0 | 1 | 2;
}

interface SelectedException {
  component: IcalComponent;
  recurrenceTime: IcalTime;
  localKey: string;
  utcKey: string;
}

interface PeriodRdate {
  start: IcalTime;
  end: IcalTime;
  localKey: string;
  utcKey: string;
}

/** Returns the UTF-8 byte size and rejects text above the import ceiling. */
export function assertOutlookIcsTextSize(text: string): number {
  if (typeof text !== "string") {
    throw calendarError("The selected calendar is not text.");
  }
  if (text.length > OUTLOOK_ICS_MAX_BYTES) throw fileTooLargeError();
  const size = new TextEncoder().encode(text).byteLength;
  if (size > OUTLOOK_ICS_MAX_BYTES) throw fileTooLargeError();
  return size;
}

/** Rejects an oversized File before invoking File.text(). */
export async function parseOutlookIcsFile(
  file: File,
  options: OutlookIcsParseOptions = {},
): Promise<OutlookIcsImportResult> {
  if (
    typeof file?.size !== "number" ||
    !Number.isFinite(file.size) ||
    file.size < 0
  ) {
    throw calendarError("The selected calendar file is invalid.");
  }
  if (file.size > OUTLOOK_ICS_MAX_BYTES) throw fileTooLargeError();

  let text: string;
  try {
    text = await file.text();
  } catch {
    throw calendarError("The selected calendar file could not be read.");
  }
  return parseOutlookIcs(text, options);
}

/**
 * Parses an Outlook iCalendar snapshot into a bounded, read-only local cache.
 * Raw UIDs and every non-display field remain in memory only for this import.
 */
export async function parseOutlookIcs(
  text: string,
  options: OutlookIcsParseOptions = {},
): Promise<OutlookIcsImportResult> {
  assertOutlookIcsTextSize(text);
  // Outlook exports may carry a UTF-8 BOM. It is transport metadata, not an
  // iCalendar content character.
  const calendarText = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  preflightStructure(calendarText);

  const importedAt = options.now ?? Date.now();
  if (!Number.isFinite(importedAt)) {
    throw calendarError("The calendar import time is invalid.");
  }
  const { windowStart, windowEnd } = displayWindow(importedAt);

  const ICAL = (await import("ical.js")).default;
  let calendar: IcalComponent;
  try {
    calendar = new ICAL.Component(ICAL.parse(calendarText));
  } catch {
    throw calendarError("The selected file is not a valid iCalendar snapshot.");
  }

  validateCalendar(calendar);
  const components = walkComponents(calendar);
  rejectUnsupportedProperties(components);
  const zones = collectTimezones(ICAL, calendar);
  validateTimezoneReferences(components, zones.keys());

  const previousZones = new Map<string, IcalTimezone | undefined>();
  for (const [tzid, component] of zones) {
    previousZones.set(
      tzid,
      ICAL.TimezoneService.has(tzid)
        ? ICAL.TimezoneService.get(tzid)
        : undefined,
    );
    try {
      ICAL.TimezoneService.register(component);
    } catch {
      restoreTimezones(ICAL, previousZones);
      throw calendarError("The calendar contains an invalid time zone.");
    }
  }

  let candidates: NormalizedCandidate[];
  let skippedCount: number;
  try {
    const parsed = collectCandidates(
      ICAL,
      calendar.getAllSubcomponents("vevent"),
      windowStart,
      windowEnd,
    );
    candidates = parsed.candidates;
    skippedCount = parsed.skippedCount;
  } catch (error) {
    if (error instanceof OutlookIcsParseError) throw error;
    throw calendarError(
      "The calendar contains recurrence data that could not be expanded.",
    );
  } finally {
    restoreTimezones(ICAL, previousZones);
  }

  if (candidates.length > OUTLOOK_ICS_MAX_EVENTS) {
    throw limitError(
      `The calendar contains more than ${OUTLOOK_ICS_MAX_EVENTS.toLocaleString()} occurrences in the import window.`,
    );
  }

  const events = await Promise.all(candidates.map(normalizeCandidate));
  events.sort(
    (left, right) =>
      left.start - right.start ||
      left.end - right.end ||
      left.id.localeCompare(right.id),
  );
  const redactedCount = candidates.reduce(
    (count, candidate) => count + (candidate.redacted ? 1 : 0),
    0,
  );
  const snapshot = {
    importedAt,
    windowStart,
    windowEnd,
    events,
    skippedCount,
    redactedCount,
  };

  return {
    snapshot,
    importedCount: events.length,
    skippedCount,
    redactedCount,
    bounds: { windowStart, windowEnd },
  };
}

function preflightStructure(text: string): void {
  let calendarBegins = 0;
  let calendarEnds = 0;
  let componentCount = 0;
  let eventCount = 0;

  for (const line of text.split(/\r\n|\n|\r/)) {
    if (/^BEGIN:VCALENDAR$/i.test(line)) calendarBegins += 1;
    if (/^END:VCALENDAR$/i.test(line)) calendarEnds += 1;
    if (/^BEGIN:[A-Z0-9-]+$/i.test(line)) componentCount += 1;
    if (/^BEGIN:VEVENT$/i.test(line)) eventCount += 1;
    if (componentCount > OUTLOOK_ICS_MAX_COMPONENTS) {
      throw limitError(
        `The calendar contains more than ${OUTLOOK_ICS_MAX_COMPONENTS.toLocaleString()} components.`,
      );
    }
    if (eventCount > OUTLOOK_ICS_MAX_EVENT_COMPONENTS) {
      throw limitError(
        `The calendar contains more than ${OUTLOOK_ICS_MAX_EVENT_COMPONENTS.toLocaleString()} event records.`,
      );
    }
  }

  if (calendarBegins !== 1 || calendarEnds !== 1) {
    throw calendarError("The file must contain exactly one VCALENDAR.");
  }
}

function validateCalendar(calendar: IcalComponent): void {
  if (calendar.name !== "vcalendar") {
    throw calendarError("The selected file is not a VCALENDAR.");
  }
  const versions = calendar.getAllProperties("version");
  if (
    versions.length !== 1 ||
    versions[0]?.getFirstValue() !== "2.0"
  ) {
    throw new OutlookIcsParseError(
      "The calendar must use iCalendar version 2.0.",
      "unsupported-calendar",
    );
  }

  const scales = calendar.getAllProperties("calscale");
  const scale = scales[0]?.getFirstValue();
  if (
    scales.length > 1 ||
    (scale !== undefined &&
      (typeof scale !== "string" || scale.toUpperCase() !== "GREGORIAN"))
  ) {
    throw new OutlookIcsParseError(
      "Only Gregorian Outlook calendars can be imported.",
      "unsupported-calendar",
    );
  }

  const methods = calendar.getAllProperties("method");
  const method = methods[0]?.getFirstValue();
  if (
    methods.length > 1 ||
    (method !== undefined &&
      (typeof method !== "string" || method.toUpperCase() !== "PUBLISH"))
  ) {
    throw new OutlookIcsParseError(
      "Only published Outlook calendar snapshots can be imported.",
      "unsupported-calendar",
    );
  }
}

function walkComponents(root: IcalComponent): IcalComponent[] {
  const result: IcalComponent[] = [];
  const pending = [root];
  while (pending.length > 0) {
    const component = pending.pop();
    if (!component) break;
    result.push(component);
    if (result.length > OUTLOOK_ICS_MAX_COMPONENTS) {
      throw limitError(
        `The calendar contains more than ${OUTLOOK_ICS_MAX_COMPONENTS.toLocaleString()} components.`,
      );
    }
    pending.push(...component.getAllSubcomponents());
  }
  return result;
}

function rejectUnsupportedProperties(components: IcalComponent[]): void {
  for (const component of components) {
    if (
      component.hasProperty("x-microsoft-rrule") ||
      component.hasProperty("x-microsoft-exdate")
    ) {
      throw new OutlookIcsParseError(
        "This Outlook snapshot uses unsupported Microsoft recurrence data.",
        "unsupported-calendar",
      );
    }
  }
}

function collectTimezones(
  ICAL: IcalApi,
  calendar: IcalComponent,
): Map<string, IcalComponent> {
  const zones = new Map<string, IcalComponent>();
  const timezoneComponents = calendar.getAllSubcomponents("vtimezone");
  if (timezoneComponents.length > OUTLOOK_ICS_MAX_TIMEZONES) {
    throw limitError("The calendar contains too many time zones.");
  }

  let observanceCount = 0;
  let rdateCount = 0;
  for (const component of timezoneComponents) {
    const properties = component.getAllProperties("tzid");
    const value = properties[0]?.getFirstValue();
    if (
      properties.length !== 1 ||
      typeof value !== "string" ||
      value.length === 0 ||
      value.length > 255 ||
      zones.has(value)
    ) {
      throw calendarError("The calendar contains an invalid time zone.");
    }

    const observances = component.getAllSubcomponents();
    if (
      observances.length === 0 ||
      observances.some(
        (observance) =>
          observance.name !== "standard" && observance.name !== "daylight",
      )
    ) {
      throw calendarError("The calendar contains an invalid time zone.");
    }
    observanceCount += observances.length;
    if (observanceCount > OUTLOOK_ICS_MAX_TIMEZONE_OBSERVANCES) {
      throw limitError("The calendar contains too many time-zone observances.");
    }
    for (const observance of observances) {
      rdateCount += validateTimezoneObservance(ICAL, observance);
      if (rdateCount > OUTLOOK_ICS_MAX_TIMEZONE_RDATES) {
        throw limitError("The calendar contains too many time-zone dates.");
      }
    }
    zones.set(value, component);
  }
  return zones;
}

function validateTimezoneObservance(
  ICAL: IcalApi,
  observance: IcalComponent,
): number {
  if (observance.getAllSubcomponents().length > 0) {
    throw calendarError("The calendar contains an invalid time zone.");
  }

  const starts = observance.getAllProperties("dtstart");
  const offsetsFrom = observance.getAllProperties("tzoffsetfrom");
  const offsetsTo = observance.getAllProperties("tzoffsetto");
  if (starts.length !== 1 || offsetsFrom.length !== 1 || offsetsTo.length !== 1) {
    throw calendarError("The calendar contains an invalid time zone.");
  }
  const startProperty = starts[0]!;
  const start = startProperty.getFirstValue();
  const offsetFrom = offsetsFrom[0]!.getFirstValue();
  const offsetTo = offsetsTo[0]!.getFirstValue();
  if (
    startProperty.type !== "date-time" ||
    startProperty.getParameter("tzid") !== undefined ||
    !(start instanceof ICAL.Time) ||
    start.isDate ||
    start.zone !== ICAL.Timezone.localTimezone ||
    !(offsetFrom instanceof ICAL.UtcOffset) ||
    !(offsetTo instanceof ICAL.UtcOffset) ||
    !isValidUtcOffset(offsetFrom.toSeconds()) ||
    !isValidUtcOffset(offsetTo.toSeconds())
  ) {
    throw calendarError("The calendar contains an invalid time zone.");
  }

  if (
    observance.hasProperty("exdate") ||
    observance.hasProperty("exrule")
  ) {
    throw new OutlookIcsParseError(
      "The calendar contains unsupported time-zone recurrence data.",
      "unsupported-calendar",
    );
  }

  const rules = observance.getAllProperties("rrule");
  if (rules.length > 1) {
    throw new OutlookIcsParseError(
      "The calendar contains unsupported time-zone recurrence data.",
      "unsupported-calendar",
    );
  }
  if (rules.length === 1) {
    const rule = rules[0]!.getFirstValue();
    if (!(rule instanceof ICAL.Recur) || !isSafeTimezoneRule(ICAL, rule)) {
      throw new OutlookIcsParseError(
        "The calendar contains unsupported time-zone recurrence data.",
        "unsupported-calendar",
      );
    }
  }

  let rdateCount = 0;
  for (const property of observance.getAllProperties("rdate")) {
    const values = property.getValues();
    // ical.js 2.2.1 reads only the first value of each timezone RDATE
    // property, so reject multi-value forms rather than silently shifting time.
    if (
      property.type !== "date-time" ||
      property.getParameter("tzid") !== undefined ||
      values.length !== 1 ||
      !(values[0] instanceof ICAL.Time) ||
      values[0].isDate ||
      values[0].zone !== ICAL.Timezone.localTimezone
    ) {
      throw new OutlookIcsParseError(
        "The calendar contains unsupported time-zone recurrence data.",
        "unsupported-calendar",
      );
    }
    rdateCount += 1;
  }
  return rdateCount;
}

function isValidUtcOffset(seconds: number): boolean {
  return Number.isInteger(seconds) && Math.abs(seconds) < 24 * 60 * 60;
}

function isSafeTimezoneRule(
  ICAL: IcalApi,
  rule: InstanceType<IcalApi["Recur"]>,
): boolean {
  if (
    rule.freq !== "YEARLY" ||
    rule.interval !== 1 ||
    (rule.count !== null &&
      (!Number.isInteger(rule.count) || rule.count < 1 || rule.count > 200)) ||
    (rule.until !== null && !(rule.until instanceof ICAL.Time))
  ) {
    return false;
  }

  const allowedParts = new Set(["BYMONTH", "BYDAY", "BYMONTHDAY"]);
  if (Object.keys(rule.parts).some((part) => !allowedParts.has(part))) {
    return false;
  }
  const months = rule.parts.BYMONTH ?? [];
  const days = rule.parts.BYDAY ?? [];
  const monthDays = rule.parts.BYMONTHDAY ?? [];
  return (
    months.length <= 1 &&
    months.every((month) => Number.isInteger(month) && month >= 1 && month <= 12) &&
    ((days.length === 0 && monthDays.length === 0) || months.length === 1) &&
    !(days.length > 0 && monthDays.length > 0) &&
    days.length <= 1 &&
    days.every((day) => /^(?:[+-]?[1-5])(?:SU|MO|TU|WE|TH|FR|SA)$/.test(day)) &&
    monthDays.length <= 1 &&
    monthDays.every(
      (day) => Number.isInteger(day) && day !== 0 && day >= -31 && day <= 31,
    )
  );
}

function validateTimezoneReferences(
  components: IcalComponent[],
  embeddedZoneIds: Iterable<string>,
): void {
  const known = new Set([...BUILTIN_TZIDS, ...embeddedZoneIds]);
  for (const component of components) {
    for (const property of component.getAllProperties()) {
      const value = property.getParameter("tzid");
      if (value === undefined) continue;
      if (typeof value !== "string" || !known.has(value)) {
        throw new OutlookIcsParseError(
          "The calendar references a time zone that it does not define.",
          "unknown-timezone",
        );
      }
    }
  }
}

function restoreTimezones(
  ICAL: IcalApi,
  previous: Map<string, IcalTimezone | undefined>,
): void {
  for (const [tzid, timezone] of previous) {
    if (timezone) ICAL.TimezoneService.register(timezone, tzid);
    else ICAL.TimezoneService.remove(tzid);
  }
}

function collectCandidates(
  ICAL: IcalApi,
  eventComponents: IcalComponent[],
  windowStart: number,
  windowEnd: number,
): { candidates: NormalizedCandidate[]; skippedCount: number } {
  if (eventComponents.length > OUTLOOK_ICS_MAX_EVENT_COMPONENTS) {
    throw limitError(
      `The calendar contains more than ${OUTLOOK_ICS_MAX_EVENT_COMPONENTS.toLocaleString()} event records.`,
    );
  }

  const groups = new Map<string, EventGroup>();
  let skippedCount = 0;
  eventComponents.forEach((component, index) => {
    const uid = component.getFirstPropertyValue("uid");
    if (
      typeof uid !== "string" ||
      uid.trim().length === 0 ||
      uid.length > MAX_UID_LENGTH
    ) {
      skippedCount += 1;
      return;
    }
    const group = groups.get(uid);
    if (group) group.records.push({ component, index });
    else groups.set(uid, { uid, records: [{ component, index }] });
  });

  const candidates = new Map<string, NormalizedCandidate>();
  let iterationCount = 0;
  for (const group of groups.values()) {
    const masters = group.records.filter(
      ({ component }) => !component.hasProperty("recurrence-id"),
    );
    const exceptions = group.records.filter(({ component }) =>
      component.hasProperty("recurrence-id"),
    );
    if (masters.length === 0) {
      skippedCount += exceptions.length;
      continue;
    }

    const masterRecord = newestRecord(masters);
    skippedCount += masters.length - 1;
    const master = masterRecord.component;
    if (isCancelled(master)) {
      skippedCount += 1;
      continue;
    }

    const selectedExceptions = selectExceptions(ICAL, exceptions);
    skippedCount += selectedExceptions.skippedCount;
    const periodRdates = extractPeriodRdates(ICAL, master);
    const excludedPeriodKeys = collectTimePropertyKeys(ICAL, master, "exdate");
    const suppressedKeys = new Set<string>();
    let cancellationCutoff: number | null = null;
    const activeExceptions: IcalComponent[] = [];
    const activeExceptionKeys = new Set<string>();
    const requiredExceptionKeys = new Set<string>();
    let traversalEnd = windowEnd;

    for (const selected of selectedExceptions.exceptions) {
      if (isCancelled(selected.component)) {
        suppressedKeys.add(selected.localKey);
        suppressedKeys.add(selected.utcKey);
        if (modifiesFuture(selected.component)) {
          const cutoff = timeToMillis(selected.recurrenceTime);
          if (cutoff !== null) {
            cancellationCutoff =
              cancellationCutoff === null
                ? cutoff
                : Math.min(cancellationCutoff, cutoff);
          }
        }
        continue;
      }
      const exceptionTimes = readEventTimes(ICAL, selected.component);
      if (!exceptionTimes) {
        suppressedKeys.add(selected.localKey);
        suppressedKeys.add(selected.utcKey);
        skippedCount += 1;
        continue;
      }
      activeExceptions.push(selected.component);
      activeExceptionKeys.add(selected.localKey);
      activeExceptionKeys.add(selected.utcKey);
      if (
        exceptionTimes.end > windowStart &&
        exceptionTimes.start < windowEnd
      ) {
        const recurrenceMs = timeToMillis(selected.recurrenceTime);
        if (recurrenceMs !== null) traversalEnd = Math.max(traversalEnd, recurrenceMs);
        requiredExceptionKeys.add(selected.localKey);
        requiredExceptionKeys.add(selected.utcKey);
      }
    }

    let event: IcalEvent;
    try {
      event = new ICAL.Event(master, {
        strictExceptions: true,
        exceptions: activeExceptions,
      });
      if (!event.startDate || !event.endDate) throw new Error();
    } catch {
      skippedCount += 1;
      continue;
    }

    const iterator = event.iterator();
    const seenExceptionKeys = new Set<string>();
    for (;;) {
      if (iterationCount >= OUTLOOK_ICS_MAX_EXPANSION_ITERATIONS) {
        throw limitError(
          `The calendar recurrence rules require more than ${OUTLOOK_ICS_MAX_EXPANSION_ITERATIONS.toLocaleString()} iterations.`,
        );
      }
      iterationCount += 1;
      const occurrence = iterator.next();
      if (!occurrence) break;

      const occurrenceMs = timeToMillis(occurrence);
      if (occurrenceMs === null) {
        skippedCount += 1;
        continue;
      }
      const localKey = occurrence.toString();
      const utcKey = occurrence.convertToZone(ICAL.Timezone.utcTimezone).toString();
      if (activeExceptionKeys.has(localKey) || activeExceptionKeys.has(utcKey)) {
        seenExceptionKeys.add(localKey);
        seenExceptionKeys.add(utcKey);
      }

      if (
        suppressedKeys.has(localKey) ||
        suppressedKeys.has(utcKey) ||
        (cancellationCutoff !== null && occurrenceMs >= cancellationCutoff)
      ) {
        if (occurrenceMs >= windowStart && occurrenceMs < windowEnd) {
          skippedCount += 1;
        }
        if (occurrenceMs >= traversalEnd) break;
        continue;
      }

      let details;
      try {
        details = event.getOccurrenceDetails(occurrence);
      } catch {
        skippedCount += 1;
        if (occurrenceMs >= traversalEnd) break;
        continue;
      }
      const candidate = normalizeOccurrence(
        group.uid,
        occurrence,
        details.item,
        event,
        details.startDate,
        details.endDate,
      );
      if (candidate) {
        if (overlaps(candidate, windowStart, windowEnd)) {
          addCandidate(candidates, candidate);
          if (candidates.size > OUTLOOK_ICS_MAX_EVENTS) {
            throw limitError(
              `The calendar contains more than ${OUTLOOK_ICS_MAX_EVENTS.toLocaleString()} occurrences in the import window.`,
            );
          }
        }
      } else if (occurrenceMs >= windowStart && occurrenceMs < windowEnd) {
        skippedCount += 1;
      }

      // RecurExpansion is ordered by recurrence identity. Exceptions can move
      // an occurrence, so evaluate the boundary occurrence before stopping.
      if (occurrenceMs >= traversalEnd) break;
    }

    for (const period of periodRdates) {
      if (iterationCount >= OUTLOOK_ICS_MAX_EXPANSION_ITERATIONS) {
        throw limitError(
          `The calendar recurrence rules require more than ${OUTLOOK_ICS_MAX_EXPANSION_ITERATIONS.toLocaleString()} iterations.`,
        );
      }
      iterationCount += 1;
      const periodStartMs = timeToMillis(period.start);
      const isSuppressed =
        excludedPeriodKeys.has(period.localKey) ||
        excludedPeriodKeys.has(period.utcKey) ||
        suppressedKeys.has(period.localKey) ||
        suppressedKeys.has(period.utcKey) ||
        (periodStartMs !== null &&
          cancellationCutoff !== null &&
          periodStartMs >= cancellationCutoff);
      if (isSuppressed) {
        const explicitTimes = timePairToMillis(period.start, period.end);
        if (
          explicitTimes &&
          explicitTimes.end > windowStart &&
          explicitTimes.start < windowEnd
        ) {
          skippedCount += 1;
        }
        continue;
      }

      let item = event;
      let startTime = period.start;
      let endTime = period.end;
      const hasExactException =
        activeExceptionKeys.has(period.localKey) ||
        activeExceptionKeys.has(period.utcKey);
      let hasExceptionOverride = false;
      try {
        const details = event.getOccurrenceDetails(period.start);
        if (details.item !== event) {
          item = details.item;
          startTime = details.startDate;
          endTime = details.endDate;
          hasExceptionOverride = true;
        }
        if (hasExactException) {
          seenExceptionKeys.add(period.localKey);
          seenExceptionKeys.add(period.utcKey);
        }
      } catch {
        skippedCount += 1;
        continue;
      }
      const candidate = normalizeOccurrence(
        group.uid,
        period.start,
        item,
        event,
        startTime,
        endTime,
        hasExceptionOverride ? 2 : 1,
      );
      if (candidate && overlaps(candidate, windowStart, windowEnd)) {
        addCandidate(candidates, candidate);
        if (candidates.size > OUTLOOK_ICS_MAX_EVENTS) {
          throw limitError(
            `The calendar contains more than ${OUTLOOK_ICS_MAX_EVENTS.toLocaleString()} occurrences in the import window.`,
          );
        }
      }
    }

    // A RECURRENCE-ID not produced by the selected master's recurrence set is
    // not safe to synthesize as a standalone event.
    for (const selected of selectedExceptions.exceptions) {
      if (
        (requiredExceptionKeys.has(selected.localKey) ||
          requiredExceptionKeys.has(selected.utcKey)) &&
        !seenExceptionKeys.has(selected.localKey) &&
        !seenExceptionKeys.has(selected.utcKey)
      ) {
        skippedCount += 1;
      }
    }
  }

  return { candidates: [...candidates.values()], skippedCount };
}

function selectExceptions(
  ICAL: IcalApi,
  records: IndexedComponent[],
): { exceptions: SelectedException[]; skippedCount: number } {
  const byIdentity = new Map<string, Array<IndexedComponent & { time: IcalTime }>>();
  let skippedCount = 0;
  for (const record of records) {
    const value = record.component.getFirstPropertyValue("recurrence-id");
    if (!(value instanceof ICAL.Time)) {
      skippedCount += 1;
      continue;
    }
    const key = recurrenceIdentity(value);
    const entries = byIdentity.get(key);
    const indexed = { ...record, time: value };
    if (entries) entries.push(indexed);
    else byIdentity.set(key, [indexed]);
  }

  const exceptions: SelectedException[] = [];
  for (const entries of byIdentity.values()) {
    const selected = newestRecord(entries);
    skippedCount += entries.length - 1;
    exceptions.push({
      component: selected.component,
      recurrenceTime: selected.time,
      localKey: selected.time.toString(),
      utcKey: selected.time.convertToZone(ICAL.Timezone.utcTimezone).toString(),
    });
  }
  return { exceptions, skippedCount };
}

function extractPeriodRdates(
  ICAL: IcalApi,
  component: IcalComponent,
): PeriodRdate[] {
  const periods: PeriodRdate[] = [];
  for (const property of component.getAllProperties("rdate")) {
    if (property.type !== "period") continue;
    for (const value of property.getValues()) {
      if (!(value instanceof ICAL.Period)) {
        throw calendarError("The calendar contains an invalid recurrence date.");
      }
      const period = value as IcalPeriod;
      const end = period.getEnd();
      if (
        !(period.start instanceof ICAL.Time) ||
        !(end instanceof ICAL.Time) ||
        period.start.isDate ||
        end.isDate ||
        timePairToMillis(period.start, end) === null
      ) {
        throw calendarError("The calendar contains an invalid recurrence date.");
      }
      periods.push({
        start: period.start,
        end,
        localKey: period.start.toString(),
        utcKey: period.start
          .convertToZone(ICAL.Timezone.utcTimezone)
          .toString(),
      });
    }
    // RecurExpansion assumes RDATE values are Time objects. PERIOD values are
    // normalized explicitly below so they cannot enter that iterator.
    component.removeProperty(property);
  }
  return periods;
}

function collectTimePropertyKeys(
  ICAL: IcalApi,
  component: IcalComponent,
  propertyName: string,
): Set<string> {
  const keys = new Set<string>();
  for (const property of component.getAllProperties(propertyName)) {
    for (const value of property.getValues()) {
      if (!(value instanceof ICAL.Time)) {
        throw calendarError("The calendar contains invalid recurrence data.");
      }
      keys.add(value.toString());
      keys.add(value.convertToZone(ICAL.Timezone.utcTimezone).toString());
    }
  }
  return keys;
}

function addCandidate(
  candidates: Map<string, NormalizedCandidate>,
  candidate: NormalizedCandidate,
): void {
  const key = JSON.stringify([candidate.uid, candidate.recurrenceIdentity]);
  const current = candidates.get(key);
  if (!current || candidate.priority > current.priority) {
    candidates.set(key, candidate);
  }
}

function newestRecord<T extends IndexedComponent>(records: T[]): T {
  return records.reduce((newest, candidate) =>
    compareRevision(candidate, newest) >= 0 ? candidate : newest,
  );
}

function compareRevision(left: IndexedComponent, right: IndexedComponent): number {
  const sequenceDifference =
    numericProperty(left.component, "sequence") -
    numericProperty(right.component, "sequence");
  if (sequenceDifference !== 0) return sequenceDifference;
  const stampDifference =
    timestampProperty(left.component, "last-modified") -
    timestampProperty(right.component, "last-modified");
  if (stampDifference !== 0) return stampDifference;
  const dtstampDifference =
    timestampProperty(left.component, "dtstamp") -
    timestampProperty(right.component, "dtstamp");
  return dtstampDifference !== 0 ? dtstampDifference : left.index - right.index;
}

function numericProperty(component: IcalComponent, name: string): number {
  const value = component.getFirstPropertyValue(name);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return 0;
}

function timestampProperty(component: IcalComponent, name: string): number {
  const value = component.getFirstPropertyValue(name);
  if (value && typeof value === "object" && "toUnixTime" in value) {
    const seconds = (value as IcalTime).toUnixTime();
    return Number.isFinite(seconds) ? seconds : 0;
  }
  return 0;
}

function isCancelled(component: IcalComponent): boolean {
  const status = component.getFirstPropertyValue("status");
  return typeof status === "string" && status.toUpperCase() === "CANCELLED";
}

function modifiesFuture(component: IcalComponent): boolean {
  const property = component.getFirstProperty("recurrence-id");
  const range = property?.getParameter("range");
  return typeof range === "string" && range.toUpperCase() === "THISANDFUTURE";
}

function readEventTimes(
  ICAL: IcalApi,
  component: IcalComponent,
): { start: number; end: number } | null {
  try {
    const event = new ICAL.Event(component);
    const start = event.startDate;
    const end = event.endDate;
    return start && end ? timePairToMillis(start, end) : null;
  } catch {
    return null;
  }
}

function normalizeOccurrence(
  uid: string,
  recurrence: IcalTime,
  item: IcalEvent,
  master: IcalEvent,
  startTime: IcalTime,
  endTime: IcalTime,
  priority: 0 | 1 | 2 = item === master ? 0 : 2,
): NormalizedCandidate | null {
  const times = timePairToMillis(startTime, endTime);
  if (!times) return null;
  const display = displayTitle(item.component, master.component);
  const common = {
    uid,
    recurrenceIdentity: recurrenceIdentity(recurrence),
    title: display.title,
    start: times.start,
    end: times.end,
    allDay: startTime.isDate,
    redacted: display.redacted,
    priority,
  };

  if (!startTime.isDate) return common;
  return {
    ...common,
    startDate: formatIcalDate(startTime),
    endDateExclusive: formatIcalDate(endTime),
  };
}

function displayTitle(
  component: IcalComponent,
  master: IcalComponent,
): { title: string; redacted: boolean } {
  const classProperties = component.getAllProperties("class");
  const inheritedClassProperties = master.getAllProperties("class");
  const source = classProperties.length > 0
    ? classProperties
    : inheritedClassProperties;
  if (source.length > 1) {
    return { title: OUTLOOK_ICS_PRIVATE_TITLE, redacted: true };
  }
  if (source.length === 1) {
    const value = source[0]?.getFirstValue();
    if (typeof value !== "string" || value.toUpperCase() !== "PUBLIC") {
      return { title: OUTLOOK_ICS_PRIVATE_TITLE, redacted: true };
    }
  }

  const ownSummary = component.getFirstPropertyValue("summary");
  const masterSummary = master.getFirstPropertyValue("summary");
  const raw = typeof ownSummary === "string"
    ? ownSummary
    : typeof masterSummary === "string"
      ? masterSummary
      : "";
  const title = raw
    .replace(
      /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]+/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, OUTLOOK_ICS_MAX_TITLE_LENGTH);
  return { title: title || "Untitled work event", redacted: false };
}

function timePairToMillis(
  startTime: IcalTime,
  endTime: IcalTime,
): { start: number; end: number } | null {
  if (startTime.isDate !== endTime.isDate) return null;
  const start = timeToMillis(startTime);
  const end = timeToMillis(endTime);
  return start !== null && end !== null && end > start ? { start, end } : null;
}

function timeToMillis(time: IcalTime): number | null {
  if (time.isDate) return localDateMillis(time.year, time.month, time.day);
  const value = time.toJSDate().getTime();
  return Number.isFinite(value) ? value : null;
}

/**
 * Align the retained horizon to local calendar days. Using Date#setDate keeps
 * the wall-date boundary correct across daylight-saving transitions, while an
 * exclusive end makes the date-only range truthful in Settings.
 */
function displayWindow(now: number): {
  windowStart: number;
  windowEnd: number;
} {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - OUTLOOK_ICS_WINDOW_PAST_DAYS);

  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() + OUTLOOK_ICS_WINDOW_FUTURE_DAYS + 1);

  return { windowStart: start.getTime(), windowEnd: end.getTime() };
}

function localDateMillis(year: number, month: number, day: number): number | null {
  const value = new Date(0);
  value.setHours(0, 0, 0, 0);
  value.setFullYear(year, month - 1, day);
  return value.getFullYear() === year &&
    value.getMonth() === month - 1 &&
    value.getDate() === day
    ? value.getTime()
    : null;
}

function formatIcalDate(time: IcalTime): string {
  return `${String(time.year).padStart(4, "0")}-${String(time.month).padStart(2, "0")}-${String(time.day).padStart(2, "0")}`;
}

function recurrenceIdentity(time: IcalTime): string {
  return time.isDate
    ? `date:${formatIcalDate(time)}`
    : `instant:${time.toUnixTime()}`;
}

function overlaps(
  candidate: NormalizedCandidate,
  windowStart: number,
  windowEnd: number,
): boolean {
  return candidate.end > windowStart && candidate.start < windowEnd;
}

async function normalizeCandidate(
  candidate: NormalizedCandidate,
): Promise<OutlookIcsEvent> {
  const id = await hashEventIdentity(
    candidate.uid,
    candidate.recurrenceIdentity,
  );
  const common = {
    id,
    title: candidate.title,
    start: candidate.start,
    end: candidate.end,
    source: OUTLOOK_ICS_SOURCE,
    readOnly: true as const,
  };
  if (!candidate.allDay) return { ...common, allDay: false };
  if (!candidate.startDate || !candidate.endDateExclusive) {
    throw calendarError("An all-day event could not be normalized.");
  }
  return {
    ...common,
    allDay: true,
    startDate: candidate.startDate,
    endDateExclusive: candidate.endDateExclusive,
  };
}

async function hashEventIdentity(
  uid: string,
  recurrence: string,
): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw calendarError("Secure event identifiers are unavailable.");
  }
  const payload = new TextEncoder().encode(JSON.stringify([uid, recurrence]));
  const digest = await subtle.digest("SHA-256", payload);
  const hex = [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  return `outlook-ics:${hex}`;
}

function fileTooLargeError(): OutlookIcsParseError {
  return new OutlookIcsParseError(
    "The selected calendar is larger than the 5 MiB import limit.",
    "file-too-large",
  );
}

function calendarError(message: string): OutlookIcsParseError {
  return new OutlookIcsParseError(message, "invalid-calendar");
}

function limitError(message: string): OutlookIcsParseError {
  return new OutlookIcsParseError(message, "limit-exceeded");
}
