/**
 * High-level Picker flow orchestrator — the single function the Settings
 * pane calls when the user clicks "Pick photos".
 *
 * Combines:
 *   1. auth.ts          → interactive OAuth token
 *   2. api.ts           → createSession → user picks → poll → listMediaItems
 *   3. imageCache.ts    → fetch + base64 encode picked items
 *   4. store.ts         → persist to chrome.storage.local
 *
 * Returns a structured result so the UI can show a useful summary
 * ("Saved 12 photos, skipped 2 over budget") instead of a generic
 * success/failure toast.
 */

import {
  createSession,
  deleteSession,
  getSession,
  listMediaItems,
  parseDurationMs,
  type PickerSession,
} from "./api";
import { getToken } from "./auth";
import { cacheBatch, type CachedPhoto } from "./imageCache";
import { photosStore } from "./store";

export interface PickerFlowOptions {
  /** Called with the Picker URL — implementation opens it in a new tab. */
  openPickerUri: (url: string) => void;
  /** Called when the session is created so the UI can show "waiting…" etc. */
  onSessionCreated?: (session: PickerSession) => void;
  /** Returns true to abort the polling loop (e.g. user clicked Cancel). */
  shouldCancel?: () => boolean;
  /** AbortSignal-style cancellation (alternative to shouldCancel). */
  signal?: AbortSignal;
  /** Overall safety timeout in ms (default 10 min). */
  timeoutMs?: number;
}

export interface PickerFlowResult {
  photos: CachedPhoto[];
  skipped: Array<{ filename: string; reason: string }>;
  /** True when the user closed the Picker without picking anything. */
  emptySelection: boolean;
  /** True when the caller cancelled before completion. */
  cancelled: boolean;
}

export async function runPickerFlow(
  opts: PickerFlowOptions,
): Promise<PickerFlowResult> {
  const timeoutMs = opts.timeoutMs ?? 10 * 60 * 1000;
  const deadline = Date.now() + timeoutMs;
  const isCancelled = () =>
    opts.signal?.aborted === true || opts.shouldCancel?.() === true;

  const token = await getToken({ interactive: true });
  if (!token) {
    throw new Error("Sign-in cancelled or failed");
  }

  const session = await createSession(token);
  opts.onSessionCreated?.(session);
  opts.openPickerUri(session.pickerUri);

  const pollMs = Math.max(2000, parseDurationMs(session.pollingConfig.pollInterval));

  let polled: PickerSession = session;
  while (!polled.mediaItemsSet) {
    if (isCancelled()) {
      // Best-effort cleanup; failures here are silent on purpose.
      void deleteSession(token, session.id).catch(() => undefined);
      return { photos: [], skipped: [], emptySelection: false, cancelled: true };
    }
    if (Date.now() > deadline) {
      void deleteSession(token, session.id).catch(() => undefined);
      throw new Error("Timed out waiting for photo selection");
    }
    await sleep(pollMs);
    polled = await getSession(token, session.id);
  }

  const items = await listMediaItems(token, session.id);
  // Always tear down the session so we don't leave dangling state on
  // Google's side — even when the user picked nothing.
  void deleteSession(token, session.id).catch(() => undefined);

  if (items.length === 0) {
    return { photos: [], skipped: [], emptySelection: true, cancelled: false };
  }

  const batch = await cacheBatch(token, items);
  await photosStore.set({
    lastPickedAt: Date.now(),
    photos: batch.photos,
  });
  return {
    photos: batch.photos,
    skipped: batch.skipped,
    emptySelection: false,
    cancelled: false,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
