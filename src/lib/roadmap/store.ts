/**
 * Wrapper around `chrome.storage.local` for roadmap config + write-back
 * bookkeeping, stored under ROADMAP_STORAGE_KEY.
 *
 * Kept separate from the main ProclivityState key (STORAGE_KEY) for the same
 * reasons `photosStore` is: the payload here holds a **secret** (the Obsidian
 * Local REST API bearer token) plus the write-back dedup cursor, and neither
 * should ever land in:
 *   - the React state tree,
 *   - the export/import JSON (a backup must not carry the API key),
 *   - the closed-todos purge bookkeeping.
 *
 * This module is the SOLE read/writer for ROADMAP_STORAGE_KEY, and is imported
 * from BOTH the service worker (`obsidianProxy.ts`, which reads host+key itself
 * so the secret never crosses a message boundary) and the newtab (Settings
 * pane + `sync.ts`). `patch()` serializes read-modify-write through a local
 * promise chain because it has several concurrent writers (sync writes
 * lastSync*, the write-back path writes the `writtenBack` cursor, the pane
 * writes host/key/sources) — unlike the single-writer photos cache.
 */

import { ROADMAP_STORAGE_KEY } from "@/storage/constants";
import type { RoadmapStoreState } from "./types";

export const EMPTY_ROADMAP_STATE: RoadmapStoreState = {
  host: "http://127.0.0.1:27123",
  apiKey: "",
  sources: [],
  writtenBack: {},
  droppedMirrors: [],
  knownMirrors: [],
  lastSyncAt: null,
  lastSyncError: null,
};

const isExtension =
  typeof chrome !== "undefined" && !!chrome.storage?.local;

type Listener = (state: RoadmapStoreState) => void;

/** Serialize read-modify-write so concurrent patch() calls never clobber. */
let writeChain: Promise<void> = Promise.resolve();

async function readRaw(): Promise<RoadmapStoreState> {
  if (!isExtension) {
    const raw =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(ROADMAP_STORAGE_KEY)
        : null;
    return raw
      ? ((JSON.parse(raw) as RoadmapStoreState) ?? EMPTY_ROADMAP_STATE)
      : EMPTY_ROADMAP_STATE;
  }
  const r = await chrome.storage.local.get(ROADMAP_STORAGE_KEY);
  return (
    (r[ROADMAP_STORAGE_KEY] as RoadmapStoreState | undefined) ??
    EMPTY_ROADMAP_STATE
  );
}

async function writeRaw(next: RoadmapStoreState): Promise<void> {
  if (!isExtension) {
    try {
      localStorage.setItem(ROADMAP_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // localStorage quota / unavailable — silently drop in dev mode.
    }
    return;
  }
  await chrome.storage.local.set({ [ROADMAP_STORAGE_KEY]: next });
}

export const roadmapStore = {
  get(): Promise<RoadmapStoreState> {
    return readRaw();
  },
  async set(next: RoadmapStoreState): Promise<void> {
    await writeRaw(next);
  },
  /**
   * Atomically merge a partial update. The updater receives the current state
   * and returns the fields to overwrite. Serialized through `writeChain` so
   * two concurrent patches (e.g. a Sync-now writing `lastSyncAt` and a mirror
   * tick writing `writtenBack`) don't lose each other's write.
   */
  patch(
    fn: (cur: RoadmapStoreState) => Partial<RoadmapStoreState>,
  ): Promise<RoadmapStoreState> {
    const result = writeChain.then(async () => {
      const cur = await readRaw();
      const next: RoadmapStoreState = { ...cur, ...fn(cur) };
      await writeRaw(next);
      return next;
    });
    writeChain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  },
  async clear(): Promise<void> {
    if (!isExtension) {
      try {
        localStorage.removeItem(ROADMAP_STORAGE_KEY);
      } catch {
        // ignore
      }
      return;
    }
    await chrome.storage.local.remove(ROADMAP_STORAGE_KEY);
  },
  subscribe(listener: Listener): () => void {
    if (isExtension) {
      const handler = (
        changes: Record<string, chrome.storage.StorageChange>,
        area: string,
      ) => {
        if (area !== "local" || !changes[ROADMAP_STORAGE_KEY]) return;
        const next =
          (changes[ROADMAP_STORAGE_KEY].newValue as
            | RoadmapStoreState
            | undefined) ?? EMPTY_ROADMAP_STATE;
        listener(next);
      };
      chrome.storage.onChanged.addListener(handler);
      return () => chrome.storage.onChanged.removeListener(handler);
    }
    const handler = (e: StorageEvent) => {
      if (e.key !== ROADMAP_STORAGE_KEY) return;
      listener(
        e.newValue
          ? (JSON.parse(e.newValue) as RoadmapStoreState)
          : EMPTY_ROADMAP_STATE,
      );
    };
    if (typeof window !== "undefined")
      window.addEventListener("storage", handler);
    return () => {
      if (typeof window !== "undefined")
        window.removeEventListener("storage", handler);
    };
  },
};

/** The mirror-id namespace key for a source: `${repo}/${slug}`. */
export function srcKeyOf(source: {
  repo: string;
  slug: string;
}): string {
  return `${source.repo}/${source.slug}`;
}
