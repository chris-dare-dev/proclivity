import { OUTLOOK_ICS_STORAGE_KEY } from "@/storage/constants";
import type {
  OutlookIcsEvent,
  OutlookIcsSnapshot,
  OutlookIcsState,
} from "./types";
import {
  OUTLOOK_ICS_MAX_EVENTS,
  OUTLOOK_ICS_MAX_TITLE_LENGTH,
} from "./types";

export const EMPTY_OUTLOOK_ICS_STATE: OutlookIcsState = { snapshot: null };

type Listener = (state: OutlookIcsState) => void;
const fallbackListeners = new Set<Listener>();
const OUTLOOK_ICS_MUTATION_LOCK = "proclivity:outlook-ics:mutation:v1";

interface PersistedOutlookIcsState extends OutlookIcsState {
  /** Last user intent; contains no calendar data and invalidates older imports. */
  mutationId: string;
}

let fallbackMutationQueue: Promise<void> = Promise.resolve();
let fallbackMutationCounter = 0;

function hasExtensionStorage(): boolean {
  return typeof chrome !== "undefined" && !!chrome.storage?.local;
}

async function readRawState(): Promise<unknown> {
  if (hasExtensionStorage()) {
    const stored = await chrome.storage.local.get(OUTLOOK_ICS_STORAGE_KEY);
    return stored[OUTLOOK_ICS_STORAGE_KEY];
  }
  if (typeof localStorage === "undefined") return undefined;
  const raw = localStorage.getItem(OUTLOOK_ICS_STORAGE_KEY);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

async function writeState(
  next: PersistedOutlookIcsState,
  fallbackError = "The Outlook snapshot could not be stored locally.",
): Promise<void> {
  if (hasExtensionStorage()) {
    await chrome.storage.local.set({ [OUTLOOK_ICS_STORAGE_KEY]: next });
    return;
  }
  if (typeof localStorage === "undefined") {
    throw new Error("Local calendar storage is unavailable.");
  }
  try {
    localStorage.setItem(OUTLOOK_ICS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    throw new Error(fallbackError);
  }
  notifyFallbackListeners({ snapshot: next.snapshot });
}

function createMutationId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  fallbackMutationCounter += 1;
  return `${Date.now().toString(36)}-${fallbackMutationCounter.toString(36)}`;
}

function persistedMutationId(value: unknown): string | null {
  if (!isRecord(value)) return null;
  return typeof value.mutationId === "string" && value.mutationId.length <= 128
    ? value.mutationId
    : null;
}

function withMutationLock<T>(operation: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks
      .request(OUTLOOK_ICS_MUTATION_LOCK, operation)
      .then((result) => result);
  }
  const run = fallbackMutationQueue.then(operation, operation);
  fallbackMutationQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export const outlookIcsStore = {
  async get(): Promise<OutlookIcsState> {
    return normalizeOutlookIcsState(await readRawState());
  },

  /** Record import intent before parsing so a later clear always wins. */
  async beginImport(): Promise<string> {
    return withMutationLock(async () => {
      const current = normalizeOutlookIcsState(await readRawState());
      const mutationId = createMutationId();
      await writeState({ snapshot: current.snapshot, mutationId });
      return mutationId;
    });
  },

  /** Commit only if no newer import/remove/clear intent superseded this one. */
  async commitImport(
    mutationId: string,
    snapshot: OutlookIcsSnapshot,
  ): Promise<boolean> {
    if (typeof mutationId !== "string" || mutationId.length === 0) {
      throw new TypeError("Cannot commit an unidentified Outlook ICS import.");
    }
    if (!isCompleteSnapshot(snapshot)) {
      throw new TypeError("Cannot persist an incomplete Outlook ICS snapshot.");
    }
    const normalized = normalizeSnapshot(snapshot);
    if (!normalized) {
      throw new TypeError("Cannot persist an invalid Outlook ICS snapshot.");
    }
    return withMutationLock(async () => {
      const stored = await readRawState();
      if (persistedMutationId(stored) !== mutationId) return false;
      await writeState({ snapshot: normalized, mutationId });
      return true;
    });
  },

  async clear(): Promise<void> {
    await withMutationLock(async () => {
      await writeState(
        { snapshot: null, mutationId: createMutationId() },
        "The Outlook snapshot could not be removed.",
      );
    });
  },

  subscribe(listener: Listener): () => void {
    if (hasExtensionStorage()) {
      const handler = (
        changes: Record<string, chrome.storage.StorageChange>,
        areaName: string,
      ) => {
        if (areaName !== "local" || !changes[OUTLOOK_ICS_STORAGE_KEY]) return;
        try {
          listener(
            normalizeOutlookIcsState(
              changes[OUTLOOK_ICS_STORAGE_KEY].newValue,
            ),
          );
        } catch {
          // A rendering subscriber cannot disrupt other extension listeners.
        }
      };
      chrome.storage.onChanged.addListener(handler);
      return () => chrome.storage.onChanged.removeListener(handler);
    }

    fallbackListeners.add(listener);
    const handler = (event: StorageEvent) => {
      if (event.key !== OUTLOOK_ICS_STORAGE_KEY) return;
      let next = EMPTY_OUTLOOK_ICS_STATE;
      try {
        next = event.newValue
          ? normalizeOutlookIcsState(JSON.parse(event.newValue))
          : EMPTY_OUTLOOK_ICS_STATE;
      } catch {
        next = EMPTY_OUTLOOK_ICS_STATE;
      }
      try {
        listener(next);
      } catch {
        // One preview subscriber must not disrupt later storage listeners.
      }
    };
    if (typeof window !== "undefined") window.addEventListener("storage", handler);
    return () => {
      fallbackListeners.delete(listener);
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", handler);
      }
    };
  },
};

function notifyFallbackListeners(next: OutlookIcsState): void {
  for (const listener of fallbackListeners) {
    try {
      listener(next);
    } catch {
      // A rendering subscriber cannot retroactively fail a committed write.
    }
  }
}

export function normalizeOutlookIcsState(value: unknown): OutlookIcsState {
  if (!isRecord(value)) return EMPTY_OUTLOOK_ICS_STATE;
  if (value.snapshot === null || value.snapshot === undefined) {
    return EMPTY_OUTLOOK_ICS_STATE;
  }
  const snapshot = normalizeSnapshot(value.snapshot);
  return snapshot ? { snapshot } : EMPTY_OUTLOOK_ICS_STATE;
}

function normalizeSnapshot(value: unknown): OutlookIcsSnapshot | null {
  if (!hasValidSnapshotMetadata(value) || !Array.isArray(value.events)) {
    return null;
  }
  const events = value.events
    .filter(isOutlookIcsEvent)
    .slice(0, OUTLOOK_ICS_MAX_EVENTS)
    .map(copyEvent);
  return {
    importedAt: value.importedAt,
    windowStart: value.windowStart,
    windowEnd: value.windowEnd,
    events,
    skippedCount: value.skippedCount,
    redactedCount: value.redactedCount,
  };
}

function isCompleteSnapshot(value: unknown): value is OutlookIcsSnapshot {
  return (
    hasValidSnapshotMetadata(value) &&
    Array.isArray(value.events) &&
    value.events.every(isOutlookIcsEvent)
  );
}

function hasValidSnapshotMetadata(value: unknown): value is Record<
  "importedAt" | "windowStart" | "windowEnd" | "skippedCount" | "redactedCount",
  number
> & Record<string, unknown> {
  if (!isRecord(value)) return false;
  return (
    isFiniteTimestamp(value.importedAt) &&
    isFiniteTimestamp(value.windowStart) &&
    isFiniteTimestamp(value.windowEnd) &&
    value.windowEnd > value.windowStart &&
    isNonNegativeInteger(value.skippedCount) &&
    isNonNegativeInteger(value.redactedCount)
  );
}

function isOutlookIcsEvent(value: unknown): value is OutlookIcsEvent {
  if (!isRecord(value)) return false;
  if (
    typeof value.id !== "string" ||
    !/^outlook-ics:[a-f0-9]{64}$/.test(value.id) ||
    typeof value.title !== "string" ||
    value.title.length === 0 ||
    value.title.length > OUTLOOK_ICS_MAX_TITLE_LENGTH ||
    !isFiniteTimestamp(value.start) ||
    !isFiniteTimestamp(value.end) ||
    value.end <= value.start ||
    value.source !== "outlook-ics" ||
    value.readOnly !== true ||
    typeof value.allDay !== "boolean"
  ) {
    return false;
  }
  return value.allDay
    ? isIsoDate(value.startDate) &&
        isIsoDate(value.endDateExclusive) &&
        value.endDateExclusive > value.startDate
    : true;
}

function copyEvent(event: OutlookIcsEvent): OutlookIcsEvent {
  const base = {
    id: event.id,
    title: event.title,
    start: event.start,
    end: event.end,
    source: event.source,
    readOnly: event.readOnly,
  };
  return event.allDay
    ? {
        ...base,
        allDay: true,
        startDate: event.startDate,
        endDateExclusive: event.endDateExclusive,
      }
    : { ...base, allDay: false };
}

function isFiniteTimestamp(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isFinite(new Date(value).getTime())
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
