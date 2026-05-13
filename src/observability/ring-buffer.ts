/*
 * Persistent ring buffer for the observability subsystem. Phase 3 of
 * plans/observability-plan.md.
 *
 * Stores LogEntry records in a separate chrome.storage.local key
 * (LOG_STORAGE_KEY). Capped at MAX_ENTRIES; oldest entries are dropped
 * on overflow. The newtab and the service worker each have their own
 * module-scope write chain — the two chains share the same storage key
 * and interleave at the chrome.storage.local layer, which is fine for
 * a debug log (a read-modify-write race would at worst drop one entry).
 *
 * Imported lazily from logger.ts only when a persisted level fires, so
 * the module's ~50 LOC never lands in callers' import trees.
 *
 * Hooks (subscribers) exist so the in-app log viewer (phase 4) can
 * re-render on append without a full re-fetch on every tick.
 */

import { LOG_STORAGE_KEY } from "@/storage/constants";
import type { LogEntry } from "./types";

const MAX_ENTRIES = 500;

const isExtension =
  typeof chrome !== "undefined" && !!chrome.storage?.local;

/**
 * Per-context (newtab OR service-worker) write chain. Serializes the
 * read-modify-write pair so a single context's appends never lose
 * entries against themselves. Cross-context interleaving is acceptable —
 * see file header.
 */
let writeChain: Promise<void> = Promise.resolve();

type Listener = (entries: readonly LogEntry[]) => void;
const listeners = new Set<Listener>();

/**
 * Append one log entry. Best-effort and synchronous-fire-and-forget for
 * the caller — the actual write happens on the microtask queue. Errors
 * are swallowed so a buffer write failure can never break the foreground
 * code that emitted the log.
 */
export function appendEntry(entry: LogEntry): void {
  const next = writeChain.then(async () => {
    const existing = await readRaw();
    const merged = [...existing, entry];
    const trimmed =
      merged.length > MAX_ENTRIES
        ? merged.slice(merged.length - MAX_ENTRIES)
        : merged;
    await writeRaw(trimmed);
    // Notify in-process subscribers (cross-context updates come via
    // chrome.storage.onChanged once a subscriber wires that up).
    if (listeners.size > 0) {
      for (const l of listeners) {
        try {
          l(trimmed);
        } catch {
          // never let a subscriber kill the chain
        }
      }
    }
  });
  writeChain = next.catch(() => undefined);
}

/** Read all entries — typically called by the in-app viewer on open. */
export async function readAll(): Promise<LogEntry[]> {
  return readRaw();
}

/** Wipe the ring buffer. Used by the viewer's "Clear all" affordance. */
export async function clearAll(): Promise<void> {
  if (isExtension) {
    await chrome.storage.local.remove(LOG_STORAGE_KEY);
  } else {
    localStorage.removeItem(LOG_STORAGE_KEY);
  }
  for (const l of listeners) {
    try {
      l([]);
    } catch {
      // ignore
    }
  }
}

/**
 * Subscribe to ring-buffer mutations. Returns an unsubscribe function.
 * Phase 4's viewer wires this to its rendering pipeline. Cross-context
 * updates (a write from the SW affecting the newtab's view, or vice
 * versa) are NOT delivered through this subscriber — the caller should
 * also listen to `chrome.storage.onChanged` keyed on LOG_STORAGE_KEY
 * when full freshness is required.
 */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** For tests / phase 4 — current cap exported so callers don't hard-code. */
export const RING_BUFFER_MAX = MAX_ENTRIES;

// ── Storage helpers ────────────────────────────────────────────────────

async function readRaw(): Promise<LogEntry[]> {
  if (isExtension) {
    const r = await chrome.storage.local.get(LOG_STORAGE_KEY);
    return (r[LOG_STORAGE_KEY] as LogEntry[] | undefined) ?? [];
  }
  const raw = localStorage.getItem(LOG_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as LogEntry[]) : [];
}

async function writeRaw(entries: LogEntry[]): Promise<void> {
  if (isExtension) {
    await chrome.storage.local.set({ [LOG_STORAGE_KEY]: entries });
    return;
  }
  localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(entries));
}
