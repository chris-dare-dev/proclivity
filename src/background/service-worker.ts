/// <reference types="chrome" />

import type { ProclivityState, Reminder } from "@/types";

const ALARM_PREFIX = "proclivity:reminder:";
const STATE_KEY = "proclivity:state:v1";

/* ─── Storage helpers ───────────────────────────────────────── */

async function readState(): Promise<ProclivityState | null> {
  const r = await chrome.storage.local.get(STATE_KEY);
  return (r[STATE_KEY] as ProclivityState | undefined) ?? null;
}

async function writeState(state: ProclivityState): Promise<void> {
  await chrome.storage.local.set({ [STATE_KEY]: state });
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
 */
async function reconcileAlarms(): Promise<void> {
  const state = await readState();
  const reminders = state?.reminders ?? [];

  // Build a set of reminder IDs that should have alarms
  const activeIds = new Set<string>();
  const now = Date.now();

  for (const r of reminders) {
    if (r.fired) continue;
    if (r.fireAt <= now) continue; // already in the past — skip
    activeIds.add(r.id);
  }

  // Fetch existing alarms
  const existingAlarms = await chrome.alarms.getAll();
  const existingProclivtyAlarms = existingAlarms.filter((a) =>
    a.name.startsWith(ALARM_PREFIX),
  );

  // Clear orphans
  for (const alarm of existingProclivtyAlarms) {
    const id = reminderIdFromAlarm(alarm.name);
    if (id && !activeIds.has(id)) {
      await chrome.alarms.clear(alarm.name);
    }
  }

  // Create missing alarms
  const existingAlarmNames = new Set(existingProclivtyAlarms.map((a) => a.name));
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

/* ─── Schedule the next occurrence for a recurring reminder ── */

/**
 * Returns the next fireAt for a recurring reminder, or null if none.
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

  if (next !== null) {
    // Recurring: update fireAt, re-create alarm, keep fired=false
    const updatedReminder: Reminder = { ...reminder, fireAt: next };
    chrome.alarms.create(alarmName(id), { when: next });

    await writeState({
      ...state,
      reminders: state.reminders.map((r) =>
        r.id === id ? updatedReminder : r,
      ),
    });
  } else {
    // Non-recurring: mark as fired
    await writeState({
      ...state,
      reminders: state.reminders.map((r) =>
        r.id === id ? { ...r, fired: true } : r,
      ),
    });
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
  reconcileAlarms();
});

chrome.runtime.onStartup.addListener(() => {
  reconcileAlarms();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  handleAlarm(alarm);
});

chrome.storage.onChanged.addListener(
  (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== "local" || !changes[STATE_KEY]) return;
    const oldState = changes[STATE_KEY].oldValue as ProclivityState | undefined;
    const newState = changes[STATE_KEY].newValue as ProclivityState | undefined;
    if (!newState) return;

    const oldReminders = oldState?.reminders ?? [];
    const newReminders = newState.reminders ?? [];

    diffAndSyncAlarms(oldReminders, newReminders);
  },
);

export {};
