/// <reference types="chrome" />

import type { PendingAlert, ProclivityState, Reminder } from "@/types";
import {
  ALERTS_STORAGE_KEY,
  CLOSED_PURGE_ALARM,
  CLOSED_PURGE_INTERVAL_MINUTES,
  SNOOZE_ALARM_PREFIX,
  STORAGE_KEY,
  resolvedSettings,
} from "@/storage/constants";
import {
  dismissAlertsForReminder,
  enqueueAlert,
  readAlerts,
} from "@/storage/alerts";
import { purgeOldClosed } from "@/storage/closedTodos";
import {
  configure as configureObservability,
  getLogger,
} from "@/observability/logger";

const ALARM_PREFIX = "proclivity:reminder:";

// Observability phase 2 — SW logger. The SW runs in its own module scope
// (separate from the newtab bundle), so it needs its own configure() call
// on init AND on every storage-change so the user's debug toggle takes
// effect here too.
const swLog = getLogger("sw");

function applyObservabilityConfig(state: ProclivityState | undefined): void {
  const d = state?.settings.debug;
  configureObservability({
    enabled: d?.enabled ?? false,
    namespaces: d?.namespaces ?? "*",
  });
}

/* ─── Write queue ────────────────────────────────────────────────
 * The service worker has its own module scope, separate from the
 * newtab bundle. We serialize all storage writes through a local
 * promise chain so alarm handlers and storage-change listeners never
 * clobber each other (finding #2).
 */
let swWriteChain: Promise<void> = Promise.resolve();

function swUpdate(
  fn: (s: ProclivityState) => ProclivityState,
): Promise<void> {
  const next = swWriteChain.then(async () => {
    const state = await readState();
    if (!state) return;
    await writeState(fn(state));
  });
  swWriteChain = next.catch(() => undefined);
  return next;
}

/* ─── Storage helpers ───────────────────────────────────────── */

async function readState(): Promise<ProclivityState | null> {
  const r = await chrome.storage.local.get(STORAGE_KEY);
  return (r[STORAGE_KEY] as ProclivityState | undefined) ?? null;
}

async function writeState(state: ProclivityState): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

/* ─── Alarm name helpers ───────────────────────────────────── */

function alarmName(reminderId: string): string {
  return `${ALARM_PREFIX}${reminderId}`;
}

function reminderIdFromAlarm(name: string): string | null {
  if (!name.startsWith(ALARM_PREFIX)) return null;
  return name.slice(ALARM_PREFIX.length);
}

/* ─── In-app alerts ──────────────────────────────────────────
 * OS-level notification delivery is unreliable and fails invisibly on both
 * macOS (Notification Center suppression, Sequoia regressions — Chromium
 * issue 375640809) and Windows (Focus Assist; Chrome absent from the
 * senders list until its first successful toast). chrome.notifications was
 * removed in favor of alerts the extension fully controls: the SW enqueues
 * a PendingAlert, the newtab renders it as a persistent toast, and the
 * toolbar badge carries the count while no dashboard tab is open.
 */

function occurrenceId(reminderId: string): string {
  return `${reminderId}:${Date.now().toString(36)}`;
}

async function enqueueReminderAlert(
  reminder: Reminder,
  opts: { missed?: boolean } = {},
): Promise<void> {
  try {
    await enqueueAlert({
      id: occurrenceId(reminder.id),
      reminderId: reminder.id,
      title: reminder.title,
      firedAt: Date.now(),
      ...(opts.missed ? { missed: true } : {}),
    });
    swLog.info("alert.enqueued", {
      reminderId: reminder.id,
      title: reminder.title,
      missed: opts.missed ?? false,
    });
  } catch (err: unknown) {
    swLog.error("alert.enqueue.failed", {
      reminderId: reminder.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Mirror the pending-alert count onto the toolbar badge. The badge is drawn
 * by the browser chrome itself, so unlike OS notifications it cannot be
 * suppressed by Focus modes / notification settings — it is the ambient
 * "you have due reminders" signal while no new-tab is open.
 */
async function syncBadge(count: number): Promise<void> {
  if (!chrome.action?.setBadgeText) return;
  try {
    await chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
    if (count > 0) {
      await chrome.action.setBadgeBackgroundColor({ color: "#7c9cff" });
    }
  } catch (err: unknown) {
    swLog.warn("badge.sync.failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/* ─── Reconcile alarms with stored reminders ──────────────── */

/**
 * For each non-fired reminder with a future fireAt, ensure a chrome.alarms
 * entry exists. Clear any orphan proclivity:reminder:* alarms that have no
 * corresponding reminder in storage.
 *
 * Reminders whose fireAt is already in the past are fired immediately and
 * marked so they don't get stuck in "Upcoming" after an SW restart (finding #3).
 */
async function reconcileAlarms(): Promise<void> {
  const state = await readState();
  // Apply observability config from disk before any logs in this run fire,
  // so the maintainer's debug-toggle is honored on first reconcile (obs-1).
  applyObservabilityConfig(state ?? undefined);

  const reminders = state?.reminders ?? [];

  // Build a set of reminder IDs that should have alarms
  const activeIds = new Set<string>();
  const now = Date.now();
  let missedFired = 0;

  for (const r of reminders) {
    if (r.fired) continue;
    if (r.fireAt <= now) {
      // Fire the missed notification and mark it (finding #3)
      await fireMissedReminder(r);
      missedFired++;
      continue;
    }
    activeIds.add(r.id);
  }

  // Fetch existing alarms
  const existingAlarms = await chrome.alarms.getAll();
  // Fixed typo: existingProclivtyAlarms → existingProclivityAlarms (finding #27)
  const existingProclivityAlarms = existingAlarms.filter((a) =>
    a.name.startsWith(ALARM_PREFIX),
  );
  const existingCount = existingProclivityAlarms.length;

  // Clear orphans
  let cleared = 0;
  for (const alarm of existingProclivityAlarms) {
    const id = reminderIdFromAlarm(alarm.name);
    if (id && !activeIds.has(id)) {
      await chrome.alarms.clear(alarm.name);
      cleared++;
    }
  }

  // Create missing alarms
  const existingAlarmNames = new Set(existingProclivityAlarms.map((a) => a.name));
  let created = 0;
  for (const id of activeIds) {
    const name = alarmName(id);
    if (!existingAlarmNames.has(name)) {
      const reminder = reminders.find((r) => r.id === id);
      if (reminder) {
        chrome.alarms.create(name, { when: reminder.fireAt });
        created++;
      }
    }
  }

  // Before/after diff: useful for diagnosing missed-reminder reports and
  // for confirming an SW restart did the right thing on revival (obs-1).
  swLog.info("reconcileAlarms", {
    reminders: reminders.length,
    activeIds: activeIds.size,
    existing: existingCount,
    created,
    cleared,
    missedFired,
  });

  // Ensure the closed-todos purge alarm exists. Chrome alarms persist across
  // SW restarts so this is mostly a no-op after install; we re-create it
  // defensively on every reconcile in case the alarm was lost (e.g. extension
  // update truncated the alarm store, or onInstalled fired for a fresh
  // install with no prior alarms). The handler is idempotent.
  await ensureClosedPurgeAlarm();

  // Re-sync the toolbar badge from the pending-alert queue — the badge is
  // in-memory browser UI and does not survive a browser restart, while the
  // queue does.
  const alerts = await readAlerts();
  await syncBadge(alerts.length);
}

/**
 * Idempotent: creates the daily closed-todos purge alarm if missing, leaves
 * it alone if already scheduled. We do NOT clear-and-recreate every reconcile
 * because that would reset the periodic timer back to "fires N minutes from
 * now" each time the SW wakes — defeating the every-24h cadence on long-idle
 * profiles.
 */
async function ensureClosedPurgeAlarm(): Promise<void> {
  const existing = await chrome.alarms.get(CLOSED_PURGE_ALARM);
  if (existing) return;
  // `delayInMinutes` provides the first fire offset so we don't pile up onto
  // a freshly-installed extension's first second. `periodInMinutes` keeps it
  // repeating every 24h thereafter.
  chrome.alarms.create(CLOSED_PURGE_ALARM, {
    delayInMinutes: CLOSED_PURGE_INTERVAL_MINUTES,
    periodInMinutes: CLOSED_PURGE_INTERVAL_MINUTES,
  });
  swLog.info("closed.purge.alarm.created", {
    delayMinutes: CLOSED_PURGE_INTERVAL_MINUTES,
    periodMinutes: CLOSED_PURGE_INTERVAL_MINUTES,
  });
}

/**
 * Run the closed-todos purge through the SW write queue. The updater is
 * idempotent — a second consecutive call is a no-op besides the log entry.
 *
 * M2 fix: previously read state twice (before + after) outside the write
 * queue, racing with any concurrent write between the swUpdate call and the
 * second readState(). The "after" count was unreliable when another tab was
 * actively writing. Now we capture before/after inside the updater wrapper
 * so both reads are atomic with the write, and the "purged" count is exact.
 */
async function runClosedPurge(): Promise<void> {
  let beforeClosed = 0;
  let afterClosed = 0;

  await swUpdate((s) => {
    beforeClosed = s.todos.filter((t) => t.done).length;
    // Read the user's retention preference from the stored settings so the
    // SW honors the same value as the newtab purge pass.
    const retentionDays = resolvedSettings(s.settings).closedTodoRetentionDays;
    const next = purgeOldClosed(retentionDays)(s);
    afterClosed = next.todos.filter((t) => t.done).length;
    return next;
  });

  swLog.info("closed.purge", {
    before: beforeClosed,
    after: afterClosed,
    purged: beforeClosed - afterClosed,
  });
}

/** Enqueue an alert for a reminder that was missed while the SW was dead. */
async function fireMissedReminder(reminder: Reminder): Promise<void> {
  // The alert queue is the delivery mechanism, so "missed" occurrences are
  // never lost — they surface as toasts the next time a new-tab opens, with
  // the badge carrying the count until then.
  await enqueueReminderAlert(reminder, { missed: true });

  const next = nextFireAt(reminder);
  await swUpdate((s) => ({
    ...s,
    reminders: s.reminders.map((r) => {
      if (r.id !== reminder.id) return r;
      if (next !== null) {
        // Recurring: advance to next occurrence, keep fired=false
        return { ...r, fireAt: next };
      }
      // Non-recurring: mark fired
      return { ...r, fired: true };
    }),
  }));

  if (next !== null) {
    chrome.alarms.create(alarmName(reminder.id), { when: next });
  }
}

/* ─── Schedule the next occurrence for a recurring reminder ── */

/**
 * Returns the next fireAt for a recurring reminder, or null if none.
 *
 * We anchor from the nominal fireAt (not the actual firing time) so
 * recurring reminders don't drift over time — e.g. a daily 9am reminder
 * always fires at 9am even if Chrome woke up late (finding #23).
 */
function nextFireAt(reminder: Reminder): number | null {
  if (!reminder.recurrence || reminder.recurrence === "none") return null;
  const delta =
    reminder.recurrence === "daily"
      ? 24 * 60 * 60_000
      : 7 * 24 * 60 * 60_000;
  return reminder.fireAt + delta;
}

/* ─── Quiet hours ────────────────────────────────────────────
 * If the user has a quiet-hours window set and the current local
 * time falls inside it, the notification is deferred to the end of
 * the window rather than firing immediately.
 */

function parseHM(value: string): { h: number; m: number } {
  const parts = value.split(":");
  const h = Number(parts[0] ?? 0);
  const m = Number(parts[1] ?? 0);
  return {
    h: Number.isFinite(h) ? h : 0,
    m: Number.isFinite(m) ? m : 0,
  };
}

function isInQuietHours(qh: { from: string; to: string }, ref: Date): boolean {
  const nowMin = ref.getHours() * 60 + ref.getMinutes();
  const from = parseHM(qh.from);
  const to = parseHM(qh.to);
  const fromMin = from.h * 60 + from.m;
  const toMin = to.h * 60 + to.m;
  if (fromMin === toMin) return false;
  if (fromMin < toMin) return nowMin >= fromMin && nowMin < toMin;
  // crosses midnight
  return nowMin >= fromMin || nowMin < toMin;
}

function quietHoursEndAt(qh: { from: string; to: string }, ref: Date): number {
  const to = parseHM(qh.to);
  const candidate = new Date(ref);
  candidate.setHours(to.h, to.m, 0, 0);
  if (candidate.getTime() <= ref.getTime()) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate.getTime();
}

/* ─── Alarm fired handler ───────────────────────────────────── */

async function handleAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
  // Dispatch by alarm name. The closed-todos purge is in its own namespace so
  // the reminder reconciler's orphan-detection never confuses it for an
  // abandoned reminder alarm.
  if (alarm.name === CLOSED_PURGE_ALARM) {
    try {
      await runClosedPurge();
    } catch (err: unknown) {
      swLog.error("closed.purge.failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  // ── Snoozed alert re-fire ──────────────────────────────────
  // Snooze alarms live in their own namespace and re-surface an alert
  // WITHOUT touching the reminder's stored fireAt/recurrence — snoozing a
  // recurring reminder must not shift its schedule.
  if (alarm.name.startsWith(SNOOZE_ALARM_PREFIX)) {
    const snoozedId = alarm.name.slice(SNOOZE_ALARM_PREFIX.length);
    const state = await readState();
    const reminder = state?.reminders.find((r) => r.id === snoozedId);
    if (!state || !reminder) return;
    const qh = state.settings.quietHours;
    if (qh && isInQuietHours(qh, new Date())) {
      chrome.alarms.create(alarm.name, {
        when: quietHoursEndAt(qh, new Date()),
      });
      return;
    }
    await enqueueReminderAlert(reminder);
    return;
  }

  const id = reminderIdFromAlarm(alarm.name);
  if (!id) return;

  const state = await readState();
  if (!state) return;

  const reminder = state.reminders.find((r) => r.id === id);
  if (!reminder) return;

  // ── Quiet hours: defer to end of window ───────────────────
  const qh = state.settings.quietHours;
  if (qh && isInQuietHours(qh, new Date())) {
    const deferUntil = quietHoursEndAt(qh, new Date());
    chrome.alarms.create(alarm.name, { when: deferUntil });
    return;
  }

  // ── Enqueue the in-app alert ───────────────────────────────
  await enqueueReminderAlert(reminder);

  const next = nextFireAt(reminder);

  // Use the write queue so this doesn't race with UI writes (finding #2)
  await swUpdate((s) => {
    const updatedReminders = s.reminders.map((r) => {
      if (r.id !== id) return r;
      if (next !== null) {
        // Recurring: update fireAt, keep fired=false
        return { ...r, fireAt: next };
      }
      // Non-recurring: mark as fired
      return { ...r, fired: true };
    });
    return { ...s, reminders: updatedReminders };
  });

  if (next !== null) {
    // Recurring: update fireAt and re-create alarm
    chrome.alarms.create(alarmName(id), { when: next });
  }
}

/* ─── Storage change listener — diff reminders array ───────── */

function diffAndSyncAlarms(
  oldReminders: Reminder[],
  newReminders: Reminder[],
): void {
  const now = Date.now();
  const oldMap = new Map(oldReminders.map((r) => [r.id, r]));
  const newMap = new Map(newReminders.map((r) => [r.id, r]));

  // Removed reminders → clear alarms (including any pending snooze) and
  // retract any alert still sitting in the queue / on screen.
  for (const [id] of oldMap) {
    if (!newMap.has(id)) {
      chrome.alarms.clear(alarmName(id));
      chrome.alarms.clear(`${SNOOZE_ALARM_PREFIX}${id}`);
      void dismissAlertsForReminder(id);
    }
  }

  for (const [id, r] of newMap) {
    if (r.fired) {
      // Fired → ensure alarm is cleared
      chrome.alarms.clear(alarmName(id));
      continue;
    }
    if (r.fireAt <= now) continue; // past

    const old = oldMap.get(id);
    if (!old) {
      // New reminder — create alarm
      chrome.alarms.create(alarmName(id), { when: r.fireAt });
    } else if (old.fireAt !== r.fireAt) {
      // fireAt changed — recreate alarm
      chrome.alarms.clear(alarmName(id));
      chrome.alarms.create(alarmName(id), { when: r.fireAt });
    }
    // Otherwise the alarm already exists and is correct
  }
}

/* ─── Listeners ─────────────────────────────────────────────── */

// Initial config read on module load — applies the user's debug toggle
// without waiting for the first reconcile. (obs-1)
readState().then((s) => applyObservabilityConfig(s ?? undefined));

chrome.runtime.onInstalled.addListener(() => {
  swLog.info("lifecycle", { event: "onInstalled" });
  reconcileAlarms().catch((err: unknown) =>
    swLog.error("reconcileAlarms.failed", {
      phase: "onInstalled",
      error: err instanceof Error ? err.message : String(err),
    }),
  );
});

chrome.runtime.onStartup.addListener(() => {
  swLog.info("lifecycle", { event: "onStartup" });
  reconcileAlarms().catch((err: unknown) =>
    swLog.error("reconcileAlarms.failed", {
      phase: "onStartup",
      error: err instanceof Error ? err.message : String(err),
    }),
  );
});

chrome.alarms.onAlarm.addListener((alarm) => {
  swLog.debug("onAlarm", { name: alarm.name, scheduledTime: alarm.scheduledTime });
  handleAlarm(alarm);
});

/* ─── Google Photos byte-fetch proxy ─────────────────────────
 * The newtab page can't fetch Picker baseUrls with Authorization: Bearer
 * directly: any extension-page request that promotes to CORS-preflight is
 * answered by Google's CDN with a malformed Access-Control-Allow-Origin
 * header, and Chrome rejects it. MV3 host_permissions, however, DO grant
 * the service worker a real CORS bypass on listed hosts. So the newtab
 * delegates the actual image / video byte-fetch to us here.
 *
 * Contract (newtab ↔ SW):
 *   request: { type: "photos:fetchBytes", url, token, maxBytes? }
 *   ok    : { ok: true, dataUrl, mimeType, sizeBytes }
 *   fail  : { ok: false, status, message, code?, sizeBytes? }
 *     - status = HTTP code, or 0 for network / size errors
 *     - code   = "too_large" when sizeBytes > maxBytes
 */
interface PhotosFetchRequest {
  type: "photos:fetchBytes";
  url: string;
  token: string;
  maxBytes?: number;
}

type PhotosFetchResponse =
  | { ok: true; dataUrl: string; mimeType: string; sizeBytes: number }
  | {
      ok: false;
      status: number;
      message: string;
      code?: string;
      sizeBytes?: number;
    };

async function handlePhotosFetch(
  req: PhotosFetchRequest,
): Promise<PhotosFetchResponse> {
  try {
    const res = await fetch(req.url, {
      headers: { Authorization: `Bearer ${req.token}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        status: res.status,
        message: `${res.status} ${res.statusText}${body ? `: ${body.slice(0, 200)}` : ""}`,
      };
    }
    const blob = await res.blob();
    if (req.maxBytes !== undefined && blob.size > req.maxBytes) {
      return {
        ok: false,
        status: 0,
        code: "too_large",
        sizeBytes: blob.size,
        message: `payload ${formatMbSw(blob.size)} exceeds limit ${formatMbSw(req.maxBytes)}`,
      };
    }
    const dataUrl = await blobToDataUrlSw(blob);
    return {
      ok: true,
      dataUrl,
      mimeType: blob.type,
      sizeBytes: blob.size,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

function formatMbSw(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function blobToDataUrlSw(blob: Blob): Promise<string> {
  // FileReader is exposed in the ServiceWorkerGlobalScope; safe to use here.
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error ?? new Error("FileReader failed"));
    fr.readAsDataURL(blob);
  });
}

chrome.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
  // Type guard before touching fields so any unrelated message just returns
  // false (keeps the channel synchronous and lets other listeners respond).
  if (
    !msg ||
    typeof msg !== "object" ||
    (msg as { type?: unknown }).type !== "photos:fetchBytes"
  ) {
    return false;
  }
  const req = msg as PhotosFetchRequest;
  void handlePhotosFetch(req).then(sendResponse);
  // Returning true keeps the message channel open for the async response.
  return true;
});

/* ─── Toolbar action: badge + click-through ─────────────────── */

// Clicking the toolbar icon opens a fresh tab — which this extension
// overrides with the dashboard, where any pending alerts render as toasts.
chrome.action?.onClicked.addListener(() => {
  void chrome.tabs.create({});
});

chrome.storage.onChanged.addListener(
  (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== "local") return;

    // Alert-queue changes (enqueued here, dismissed/snoozed by the newtab)
    // drive the toolbar badge from either writer.
    const alertsChange = changes[ALERTS_STORAGE_KEY];
    if (alertsChange) {
      const alerts =
        (alertsChange.newValue as PendingAlert[] | undefined) ?? [];
      void syncBadge(alerts.length);
    }

    if (!changes[STORAGE_KEY]) return;
    const oldState = changes[STORAGE_KEY].oldValue as ProclivityState | undefined;
    const newState = changes[STORAGE_KEY].newValue as ProclivityState | undefined;
    if (!newState) return;

    // Re-apply the observability config so debug-toggle changes take effect
    // in the SW context too (obs-1).
    applyObservabilityConfig(newState);

    const oldReminders = oldState?.reminders ?? [];
    const newReminders = newState.reminders ?? [];

    diffAndSyncAlarms(oldReminders, newReminders);
  },
);

export {};
