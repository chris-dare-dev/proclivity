/** Format a timestamp as a relative "in X minutes/hours/days" string. */
export function relativeTime(ts: number, now: number = Date.now()): string {
  const diffMs = ts - now;
  const absDiff = Math.abs(diffMs);
  const past = diffMs < 0;

  if (absDiff < 60_000) {
    return past ? "just now" : "in a moment";
  }
  if (absDiff < 60 * 60_000) {
    const mins = Math.round(absDiff / 60_000);
    return past ? `${mins}m ago` : `in ${mins}m`;
  }
  if (absDiff < 24 * 60 * 60_000) {
    const hrs = Math.round(absDiff / (60 * 60_000));
    return past ? `${hrs}h ago` : `in ${hrs}h`;
  }
  const days = Math.round(absDiff / (24 * 60 * 60_000));
  return past ? `${days}d ago` : `in ${days}d`;
}

/** Format a JS timestamp to a datetime-local input value. */
export function tsToDatetimeLocal(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/** Format a datetime-local input value to a JS timestamp. */
export function datetimeLocalToTs(val: string): number {
  return new Date(val).getTime();
}

/** Format a JS timestamp for display. */
export function formatFireAt(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
