/// <reference types="chrome" />

import type { ProclivityState, Reminder } from "@/types";
import { STORAGE_KEY } from "@/storage/constants";
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
}

/** Fire a notification for a reminder that was missed while the SW was dead. */
async function fireMissedReminder(reminder: Reminder): Promise<void> {
  chrome.notifications.create(alarmName(reminder.id), {
    type: "basic",
    iconUrl: "icon-128.png",
    title: "Proclivity (missed)",
    message: reminder.title,
    priority: 2,
  });

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

  // ── Fire the notification ─────────────────────────────────
  const snoozeMinutes = state.settings.snoozeMinutes ?? 10;
  chrome.notifications.create(alarm.name, {
    type: "basic",
    iconUrl: "icon-128.png",
    title: "Proclivity",
    message: reminder.title,
    priority: 2,
    buttons: [{ title: `Snooze ${snoozeMinutes} min` }],
  });

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

  // Removed reminders → clear alarms
  for (const [id] of oldMap) {
    if (!newMap.has(id)) {
      chrome.alarms.clear(alarmName(id));
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

/* ─── Notification action: snooze ───────────────────────────── */

chrome.notifications.onButtonClicked.addListener(
  (notificationId: string, buttonIndex: number) => {
    if (buttonIndex !== 0) return;
    if (!notificationId.startsWith(ALARM_PREFIX)) return;
    readState().then((state) => {
      if (!state) return;
      const minutes = state.settings.snoozeMinutes ?? 10;
      chrome.alarms.create(notificationId, {
        when: Date.now() + minutes * 60_000,
      });
      chrome.notifications.clear(notificationId);
    });
  },
);

chrome.storage.onChanged.addListener(
  (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== "local" || !changes[STORAGE_KEY]) return;
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
