/**
 * Picked-photo image cache.
 *
 * Why cache?
 *   PickerAPI mediaItem `baseUrl`s are valid for only ~1 hour after the
 *   Picker session closes, and there is no API to re-list those same items
 *   without forcing the user back through the Picker UI. Caching the bytes
 *   locally is the only way to keep a "slideshow widget" running without
 *   constantly nagging the user to re-pick.
 *
 * Strategy:
 *   - Fetch `baseUrl=w<TARGET_W>-h<TARGET_H>` with Authorization: Bearer.
 *     Google serves a pre-downscaled JPEG, no client-side canvas work needed.
 *   - Encode the bytes as a base64 data URL — directly storable in
 *     `chrome.storage.local`. (Blob URLs / FileSystem would be larger
 *     plumbing for a personal-scale widget.)
 *   - Enforce a hard byte budget per pick batch so chrome.storage.local
 *     never blows past the 10 MB cap.
 */

import {
  GooglePhotosApiError,
  type PickedMediaItem,
} from "./api";

/** Target dimensions for the cached copy — tuned for ~1080p screens. */
export const TARGET_WIDTH = 1600;
export const TARGET_HEIGHT = 1000;

/** Soft cap on total cached bytes (per batch). Photos beyond this are dropped. */
export const CACHE_BUDGET_BYTES = 6 * 1024 * 1024; // 6 MB

/** Hard cap on photo count regardless of size. */
export const MAX_CACHED_PHOTOS = 30;

export interface CachedPhoto {
  id: string;
  filename: string;
  mimeType: string;
  /** Original capture time from Google (RFC3339). */
  createTime: string;
  /** Downscaled dimensions actually delivered by Google. */
  width: number;
  height: number;
  /** Inlined image — directly assignable to `<img src>`. */
  dataUrl: string;
  /** Byte size of `dataUrl` (for budget accounting). */
  bytes: number;
}

/**
 * Fetch one picked item, downscaled, and return it as a CachedPhoto.
 * Throws on non-2xx (caller decides per-photo whether to skip or abort).
 */
export async function fetchAndEncode(
  token: string,
  item: PickedMediaItem,
): Promise<CachedPhoto> {
  const url = `${item.mediaFile.baseUrl}=w${TARGET_WIDTH}-h${TARGET_HEIGHT}`;
  // Parse the host eagerly so we can name it in any failure message — a bare
  // "Failed to fetch" without a host is essentially undebuggable.
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return "<unparseable-baseUrl>";
    }
  })();
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    // A thrown fetch (TypeError) is almost always Chrome blocking the request
    // because the host isn't in manifest.host_permissions. Surface the host
    // explicitly so the user can see exactly what to allowlist.
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Network error fetching from ${host}: ${msg}. ` +
        `If this says "Failed to fetch", add "https://${host}/*" to host_permissions in manifest.config.ts.`,
    );
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new GooglePhotosApiError(
      `Failed to fetch ${item.mediaFile.filename} from ${host}: ${res.status} ${res.statusText}`,
      res.status,
      body,
    );
  }
  const blob = await res.blob();
  const dataUrl = await blobToDataUrl(blob);
  // `data:<mime>;base64,<payload>` — bytes ≈ payload length × 0.75. We use
  // dataUrl.length as a conservative byte estimate; it's <2% off and the
  // chrome.storage quota check uses the full string anyway.
  return {
    id: item.id,
    filename: item.mediaFile.filename,
    mimeType: blob.type || item.mediaFile.mimeType,
    createTime: item.createTime,
    width: item.mediaFile.mediaFileMetadata.width,
    height: item.mediaFile.mediaFileMetadata.height,
    dataUrl,
    bytes: dataUrl.length,
  };
}

/**
 * Fetch many items in sequence, stopping when the byte budget or count cap
 * is hit. Returns the photos that fit, plus per-item errors for diagnostics.
 *
 * Sequential (not parallel) on purpose:
 *   - Google's per-token rate limits are aggressive enough that bursts of 20+
 *     concurrent fetches can trip a 429.
 *   - The UX cost of "12 photos take 15s" is small for a one-time pick.
 */
export interface CacheBatchResult {
  photos: CachedPhoto[];
  skipped: Array<{ filename: string; reason: string }>;
}

export async function cacheBatch(
  token: string,
  items: PickedMediaItem[],
  budgetBytes = CACHE_BUDGET_BYTES,
  maxPhotos = MAX_CACHED_PHOTOS,
): Promise<CacheBatchResult> {
  const photos: CachedPhoto[] = [];
  const skipped: Array<{ filename: string; reason: string }> = [];
  let used = 0;
  for (const item of items) {
    if (photos.length >= maxPhotos) {
      skipped.push({
        filename: item.mediaFile.filename,
        reason: `cap reached (${maxPhotos} photos)`,
      });
      continue;
    }
    if (item.type !== "PHOTO") {
      skipped.push({
        filename: item.mediaFile.filename,
        reason: `unsupported type: ${item.type}`,
      });
      continue;
    }
    try {
      const cached = await fetchAndEncode(token, item);
      if (used + cached.bytes > budgetBytes) {
        skipped.push({
          filename: item.mediaFile.filename,
          reason: "would exceed cache budget",
        });
        continue;
      }
      photos.push(cached);
      used += cached.bytes;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      skipped.push({ filename: item.mediaFile.filename, reason: msg });
    }
  }
  return { photos, skipped };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error ?? new Error("FileReader failed"));
    fr.readAsDataURL(blob);
  });
}
