import { useEffect, useMemo, useState } from "react";
import {
  EMPTY_OUTLOOK_ICS_STATE,
  outlookIcsStore,
} from "@/lib/outlookIcs/store";
import type {
  OutlookIcsEvent,
  OutlookIcsSnapshot,
  OutlookIcsState,
} from "@/lib/outlookIcs/types";

export const OUTLOOK_ICS_STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export interface OutlookIcsCalendarResult {
  events: OutlookIcsEvent[];
  snapshot: OutlookIcsSnapshot | null;
  stale: boolean;
}

export function useOutlookIcsCalendar(
  windowStart: number,
  windowEnd: number,
): OutlookIcsCalendarResult {
  const [state, setState] = useState<OutlookIcsState>(EMPTY_OUTLOOK_ICS_STATE);

  useEffect(() => {
    let mounted = true;
    let revision = 0;
    const unsubscribe = outlookIcsStore.subscribe((next) => {
      revision += 1;
      if (mounted) setState(next);
    });
    const initialRevision = revision;
    void (async () => {
      try {
        const next = await outlookIcsStore.get();
        if (mounted && revision === initialRevision) setState(next);
      } catch {
        // Keep the empty state if extension storage is temporarily unavailable.
      }
    })();
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const events = useMemo(
    () => selectVisibleOutlookIcsEvents(state.snapshot, windowStart, windowEnd),
    [state.snapshot, windowEnd, windowStart],
  );

  return {
    events,
    snapshot: state.snapshot,
    stale: isOutlookIcsSnapshotStale(state.snapshot),
  };
}

export function selectVisibleOutlookIcsEvents(
  snapshot: OutlookIcsSnapshot | null,
  windowStart: number,
  windowEnd: number,
): OutlookIcsEvent[] {
  if (
    !snapshot ||
    !Number.isFinite(windowStart) ||
    !Number.isFinite(windowEnd) ||
    windowEnd <= windowStart
  ) {
    return [];
  }
  const windowStartDate = localIsoDate(windowStart);
  const windowEndDate = localIsoDate(windowEnd);
  return snapshot.events.filter(
    (event) =>
      event.allDay
        ? event.startDate < windowEndDate &&
          event.endDateExclusive > windowStartDate
        : event.start < windowEnd && event.end > windowStart,
  );
}

function localIsoDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(
    date.getMonth() + 1,
  ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function isOutlookIcsSnapshotStale(
  snapshot: OutlookIcsSnapshot | null,
  now = Date.now(),
): boolean {
  return (
    snapshot !== null &&
    now - snapshot.importedAt >= OUTLOOK_ICS_STALE_AFTER_MS
  );
}
