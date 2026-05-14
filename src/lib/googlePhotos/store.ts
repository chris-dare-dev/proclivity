/**
 * Wrapper around `chrome.storage.local` for the picked-photo cache.
 *
 * Stored under PHOTOS_STORAGE_KEY (separate from the main ProclivityState
 * key so the multi-MB base64 payload never lands in:
 *   - the React state tree (we don't want it re-rendering 30 components),
 *   - the export/import JSON (would bloat backups by ~6 MB),
 *   - the closed-todos purge bookkeeping.
 *
 * The Photos settings pane and the Photos slideshow section are the only
 * consumers. Both subscribe via `subscribe()` to live-update on Pick / Clear.
 */

import { PHOTOS_STORAGE_KEY } from "@/storage/constants";
import type { CachedPhoto } from "./imageCache";

export interface PhotosState {
  /** RFC3339-ms of the last successful pick → cache cycle. */
  lastPickedAt: number | null;
  photos: CachedPhoto[];
}

export const EMPTY_PHOTOS_STATE: PhotosState = {
  lastPickedAt: null,
  photos: [],
};

const isExtension =
  typeof chrome !== "undefined" && !!chrome.storage?.local;

type Listener = (state: PhotosState) => void;

export const photosStore = {
  async get(): Promise<PhotosState> {
    if (!isExtension) {
      // Out-of-extension dev fallback (e.g. `vite dev`): localStorage is too
      // small for base64 photos, but reads still need to return *something*
      // so the UI renders.
      const raw =
        typeof localStorage !== "undefined"
          ? localStorage.getItem(PHOTOS_STORAGE_KEY)
          : null;
      return raw
        ? ((JSON.parse(raw) as PhotosState) ?? EMPTY_PHOTOS_STATE)
        : EMPTY_PHOTOS_STATE;
    }
    const r = await chrome.storage.local.get(PHOTOS_STORAGE_KEY);
    return (r[PHOTOS_STORAGE_KEY] as PhotosState | undefined) ?? EMPTY_PHOTOS_STATE;
  },
  async set(next: PhotosState): Promise<void> {
    if (!isExtension) {
      try {
        localStorage.setItem(PHOTOS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // localStorage quota — silently drop in dev mode.
      }
      return;
    }
    await chrome.storage.local.set({ [PHOTOS_STORAGE_KEY]: next });
  },
  async clear(): Promise<void> {
    if (!isExtension) {
      try {
        localStorage.removeItem(PHOTOS_STORAGE_KEY);
      } catch {
        // ignore
      }
      return;
    }
    await chrome.storage.local.remove(PHOTOS_STORAGE_KEY);
  },
  subscribe(listener: Listener): () => void {
    if (isExtension) {
      const handler = (
        changes: Record<string, chrome.storage.StorageChange>,
        area: string,
      ) => {
        if (area !== "local" || !changes[PHOTOS_STORAGE_KEY]) return;
        const next =
          (changes[PHOTOS_STORAGE_KEY].newValue as PhotosState | undefined) ??
          EMPTY_PHOTOS_STATE;
        listener(next);
      };
      chrome.storage.onChanged.addListener(handler);
      return () => chrome.storage.onChanged.removeListener(handler);
    }
    const handler = (e: StorageEvent) => {
      if (e.key !== PHOTOS_STORAGE_KEY) return;
      listener(
        e.newValue ? (JSON.parse(e.newValue) as PhotosState) : EMPTY_PHOTOS_STATE,
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
