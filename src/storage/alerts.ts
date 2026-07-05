import type { PendingAlert } from "@/types";
import { ALERTS_STORAGE_KEY } from "./constants";
import { getLogger } from "@/observability/logger";

/**
 * Pending in-app alert store — the sole read/writer for ALERTS_STORAGE_KEY.
 *
 * Both the service worker (enqueue on alarm fire) and the newtab page
 * (dismiss/snooze) import this module; each context serializes its own writes
 * through a module-local promise chain, matching the per-context posture of
 * storage.ts / swWriteChain (finding #2). Cross-context read-modify-write
 * races are theoretically possible but the window is milliseconds and the
 * operations are idempotent (enqueue replaces by reminderId; dismiss by id).
 */

const alertsLog = getLogger("alerts");

const isExtension =
  typeof chrome !== "undefined" && !!chrome.storage?.local;

type AlertsListener = (alerts: PendingAlert[]) => void;

async function readRaw(): Promise<PendingAlert[]> {
  if (isExtension) {
    const r = await chrome.storage.local.get(ALERTS_STORAGE_KEY);
    return (r[ALERTS_STORAGE_KEY] as PendingAlert[] | undefined) ?? [];
  }
  const raw = localStorage.getItem(ALERTS_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as PendingAlert[]) : [];
}

async function writeRaw(alerts: PendingAlert[]): Promise<void> {
  if (isExtension) {
    await chrome.storage.local.set({ [ALERTS_STORAGE_KEY]: alerts });
    return;
  }
  localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(alerts));
}

let writeChain: Promise<void> = Promise.resolve();

function update(
  fn: (alerts: PendingAlert[]) => PendingAlert[],
): Promise<void> {
  const next = writeChain.then(async () => {
    await writeRaw(fn(await readRaw()));
  });
  writeChain = next.catch((err: unknown) => {
    alertsLog.warn("update.rejected", {
      error: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  });
  return next;
}

export async function readAlerts(): Promise<PendingAlert[]> {
  return readRaw();
}

/**
 * Enqueue an alert, replacing any existing entry for the same reminder so a
 * recurring reminder that fires repeatedly against an unopened dashboard
 * holds a single (latest) alert rather than stacking one per occurrence.
 */
export function enqueueAlert(alert: PendingAlert): Promise<void> {
  return update((alerts) => [
    ...alerts.filter((a) => a.reminderId !== alert.reminderId),
    alert,
  ]);
}

/** Remove a single alert by its occurrence id. Idempotent. */
export function dismissAlert(alertId: string): Promise<void> {
  return update((alerts) => alerts.filter((a) => a.id !== alertId));
}

/** Remove every alert belonging to a reminder (e.g. the reminder was deleted). */
export function dismissAlertsForReminder(reminderId: string): Promise<void> {
  return update((alerts) => alerts.filter((a) => a.reminderId !== reminderId));
}

/** Subscribe to alert-list changes (cross-context via chrome.storage.onChanged). */
export function subscribeAlerts(listener: AlertsListener): () => void {
  if (isExtension) {
    const handler = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area !== "local" || !changes[ALERTS_STORAGE_KEY]) return;
      listener(
        (changes[ALERTS_STORAGE_KEY].newValue as PendingAlert[] | undefined) ??
          [],
      );
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }
  const handler = (e: StorageEvent) => {
    if (e.key !== ALERTS_STORAGE_KEY) return;
    listener(e.newValue ? (JSON.parse(e.newValue) as PendingAlert[]) : []);
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
