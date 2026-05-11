/// <reference types="chrome" />

import type { ProclivityState, Reminder } from "@/types";
import { STORAGE_KEY } from "@/storage/constants";

const ALARM_PREFIX = "proclivity:reminder:";

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
  const reminders = state?.reminders ?? [];

  // Build a set of reminder IDs that should have alarms
  const activeIds = new Set<string>();
  const now = Date.now();

  for (const r of reminders) {
    if (r.fired) continue;
    if (r.fireAt <= now) {
      // Fire the missed notification and mark it (finding #3)
      await fireMissedReminder(r);
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

  // Clear orphans
  for (const alarm of existingProclivityAlarms) {
    const id = reminderIdFromAlarm(alarm.name);
    if (id && !activeIds.has(id)) {
      await chrome.alarms.clear(alarm.name);
    }
  }

  // Create missing alarms
  const existingAlarmNames = new Set(existingProclivityAlarms.map((a) => a.name));
  for (const id of activeIds) {
    const name = alarmName(id);
    if (!existingAlarmNames.has(name)) {
      const reminder = reminders.find((r) => r.id === id);
      if (reminder) {
        chrome.alarms.create(name, { when: reminder.fireAt });
      }
    }
  }
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

/* ─── Alarm fired handler ───────────────────────────────────── */

async function handleAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
  const id = reminderIdFromAlarm(alarm.name);
  if (!id) return;

  const state = await readState();
  if (!state) return;

  const reminder = state.reminders.find((r) => r.id === id);
  if (!reminder) return;

  // Fire a notification
  chrome.notifications.create(alarm.name, {
    type: "basic",
    iconUrl: "icon-128.png",
    title: "Proclivity",
    message: reminder.title,
    priority: 2,
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

chrome.runtime.onInstalled.addListener(() => {
  console.log("[proclivity] service worker installed");
  // Wrap in try/catch; SW lifecycle errors are real but we at least log them (finding #44)
  reconcileAlarms().catch((err) =>
    console.error("[proclivity] reconcileAlarms failed on install:", err),
  );
});

chrome.runtime.onStartup.addListener(() => {
  reconcileAlarms().catch((err) =>
    console.error("[proclivity] reconcileAlarms failed on startup:", err),
  );
});

chrome.alarms.onAlarm.addListener((alarm) => {
  handleAlarm(alarm);
});

chrome.storage.onChanged.addListener(
  (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== "local" || !changes[STORAGE_KEY]) return;
    const oldState = changes[STORAGE_KEY].oldValue as ProclivityState | undefined;
    const newState = changes[STORAGE_KEY].newValue as ProclivityState | undefined;
    if (!newState) return;

    const oldReminders = oldState?.reminders ?? [];
    const newReminders = newState.reminders ?? [];

    diffAndSyncAlarms(oldReminders, newReminders);
  },
);

export {};
