/*
 * Shared local-time date helpers. Single source of truth for any section
 * that needs to align timestamps to local-midnight day boundaries
 * (Gantt, Calendar, reminders, sprint date inputs).
 *
 * All functions operate on millisecond timestamps in the user's local
 * timezone — Proclivity stores wall-clock dates, not UTC instants, so
 * "what day is this?" must follow the device clock.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Return the local-midnight timestamp for the day that contains `ts`. */
export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Add `n` calendar days (DST-safe via Date.setDate). */
export function addDays(ts: number, n: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

/** Whole-day diff between two timestamps (rounded; DST-safe). */
export function daysBetween(a: number, b: number): number {
  return Math.round((startOfDay(b) - startOfDay(a)) / DAY_MS);
}

/** Format a timestamp as YYYY-MM-DD (local), suitable for <input type="date">. */
export function toDateInput(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse a YYYY-MM-DD <input type="date"> value into a local-midnight timestamp. */
export function fromDateInput(s: string): number {
  const parts = s.split("-").map(Number);
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return new Date(y, m - 1, d).getTime();
}

/** True if two timestamps fall on the same local calendar day. */
export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}
