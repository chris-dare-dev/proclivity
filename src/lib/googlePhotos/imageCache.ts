/**
 * Picked-media image / video cache.
 *
 * Why cache?
 *   PickerAPI mediaItem `baseUrl`s are valid for only ~1 hour after the
 *   Picker session closes, and there is no API to re-list those same items
 *   without forcing the user back through the Picker UI. Caching the bytes
 *   locally is the only way to keep a "slideshow widget" running without
 *   constantly nagging the user to re-pick.
 *
 * Strategy:
 *   - Photos: fetch `baseUrl=w<TARGET_W>-h<TARGET_H>`. Google serves a
 *     pre-downscaled JPEG, no client-side canvas work needed.
 *   - Videos: fetch `baseUrl=dv`. Google returns the raw transcoded file
 *     (typically MP4). Per-video raw size is capped so a single clip
 *     can't blow the whole budget.
 *   - Encode the bytes as a base64 data URL — directly storable in
 *     `chrome.storage.local`. (Blob URLs / FileSystem would be larger
 *     plumbing for a personal-scale widget.)
 *   - Enforce a hard byte budget per pick batch so chrome.storage.local
 *     never blows past the 10 MB cap.
 *
 * No Authorization header on either fetch — the Picker baseUrl is
 * pre-signed via the `/ppa/<token>` path segment; see fetchAndEncodePhoto
 * for the CORS-preflight rationale.
 */

import {
  GooglePhotosApiError,
  type PickedMediaItem,
} from "./api";

/** Target dimensions for cached photos — tuned for ~1080p screens. */
export const TARGET_WIDTH = 1600;
export const TARGET_HEIGHT = 1000;

/** Soft cap on total cached bytes (per batch). Items beyond this are dropped. */
export const CACHE_BUDGET_BYTES = 8 * 1024 * 1024; // 8 MB

/** Hard cap on photo count regardless of size. */
export const MAX_CACHED_PHOTOS = 30;

/**
 * Hard cap on video count per pick. Three is a soft UX choice: enough for
 * meaningful variety in the slideshow without dominating the cache.
 */
export const MAX_CACHED_VIDEOS = 3;

/**
 * Per-video raw (pre-base64) byte cap. 4 MB raw → ~5.3 MB base64. Picked
 * with the 8 MB total budget in mind: at this ceiling, one full-size video
 * plus a healthy spread of photos still fits.
 */
export const MAX_VIDEO_BYTES_RAW = 4 * 1024 * 1024;

export interface CachedPhoto {
  id: string;
  filename: string;
  mimeType: string;
  /** Original capture time from Google (RFC3339). */
  createTime: string;
  /** Delivered media dimensions (downscaled for photos, intrinsic for videos). */
  width: number;
  height: number;
  /** Inlined media — directly assignable to `<img src>` or `<video src>`. */
  dataUrl: string;
  /** Byte size of `dataUrl` (for budget accounting). */
  bytes: number;
  /**
   * Discriminator. Absent on records written by pre-video releases —
   * downstream readers treat the absence as `"photo"` so old caches keep
   * rendering without a migration step.
   */
  kind?: "photo" | "video";
}

/** Shared fetch shim — handles host extraction and error wrapping for both flavors. */
async function fetchMediaBlob(
  item: PickedMediaItem,
  suffix: string,
): Promise<Blob> {
  const url = `${item.mediaFile.baseUrl}${suffix}`;
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
    // NO Authorization header. The Picker mediaFile.baseUrl is a pre-signed
    // URL — the `/ppa/<token>` path segment carries the access grant. Adding
    // `Authorization: Bearer <oauth_token>` would promote this from a simple
    // CORS request to a preflighted one, and Google's CDN responds to those
    // preflights with a malformed `Access-Control-Allow-Origin: chrome-extension://`
    // header (no extension id appended) that Chrome correctly rejects.
    //
    // Note that MV3 host_permissions only grant CORS bypass to the service
    // worker, not to extension pages, so we can't rely on the allowlist alone
    // to skirt CORS here — keeping the fetch "simple" is the workable path.
    res = await fetch(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Network error fetching from ${host}: ${msg}. ` +
        `If this says "Failed to fetch" it usually means the host isn't in ` +
        `host_permissions, or the CDN refused the request — check DevTools ` +
        `Network panel for the actual response.`,
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
  return res.blob();
}

/**
 * Fetch one picked photo, downscaled, and return it as a CachedPhoto.
 * Throws on non-2xx (caller decides per-item whether to skip or abort).
 */
export async function fetchAndEncodePhoto(
  item: PickedMediaItem,
): Promise<CachedPhoto> {
  const blob = await fetchMediaBlob(item, `=w${TARGET_WIDTH}-h${TARGET_HEIGHT}`);
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
    kind: "photo",
  };
}

/**
 * Fetch one picked video at its transcoded resolution and return it as a
 * CachedPhoto (kind: "video"). `=dv` is Google's "download video" form —
 * the only Picker endpoint that returns playable bytes for VIDEO items.
 *
 * Pre-checks the blob size against MAX_VIDEO_BYTES_RAW before encoding so we
 * don't pay the base64-encode cost on a video we'll throw away.
 */
export async function fetchAndEncodeVideo(
  item: PickedMediaItem,
): Promise<CachedPhoto> {
  const blob = await fetchMediaBlob(item, "=dv");
  if (blob.size > MAX_VIDEO_BYTES_RAW) {
    throw new Error(
      `video too large for cache (${formatMb(blob.size)} > ${formatMb(MAX_VIDEO_BYTES_RAW)} limit)`,
    );
  }
  const dataUrl = await blobToDataUrl(blob);
  return {
    id: item.id,
    filename: item.mediaFile.filename,
    mimeType: blob.type || item.mediaFile.mimeType,
    createTime: item.createTime,
    width: item.mediaFile.mediaFileMetadata.width,
    height: item.mediaFile.mediaFileMetadata.height,
    dataUrl,
    bytes: dataUrl.length,
    kind: "video",
  };
}

/**
 * Back-compat alias: the original API name was `fetchAndEncode` (photos only).
 * Retained so any external caller / test still resolves; new code should
 * import the typed variants directly.
 */
export const fetchAndEncode = fetchAndEncodePhoto;

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  items: PickedMediaItem[],
  budgetBytes = CACHE_BUDGET_BYTES,
  maxPhotos = MAX_CACHED_PHOTOS,
  maxVideos = MAX_CACHED_VIDEOS,
): Promise<CacheBatchResult> {
  const photos: CachedPhoto[] = [];
  const skipped: Array<{ filename: string; reason: string }> = [];
  let used = 0;
  let photoCount = 0;
  let videoCount = 0;
  for (const item of items) {
    const filename = item.mediaFile.filename;
    if (item.type === "PHOTO") {
      if (photoCount >= maxPhotos) {
        skipped.push({
          filename,
          reason: `cap reached (${maxPhotos} photos)`,
        });
        continue;
      }
      try {
        const cached = await fetchAndEncodePhoto(item);
        if (used + cached.bytes > budgetBytes) {
          skipped.push({ filename, reason: "would exceed cache budget" });
          continue;
        }
        photos.push(cached);
        used += cached.bytes;
        photoCount += 1;
      } catch (err) {
        skipped.push({ filename, reason: errorMessage(err) });
      }
    } else if (item.type === "VIDEO") {
      if (videoCount >= maxVideos) {
        skipped.push({
          filename,
          reason: `cap reached (${maxVideos} videos)`,
        });
        continue;
      }
      const status =
        item.mediaFile.mediaFileMetadata.videoMetadata?.processingStatus;
      if (status && status !== "READY") {
        skipped.push({
          filename,
          reason: `video still ${status.toLowerCase()} on Google — retry later`,
        });
        continue;
      }
      try {
        const cached = await fetchAndEncodeVideo(item);
        if (used + cached.bytes > budgetBytes) {
          skipped.push({ filename, reason: "would exceed cache budget" });
          continue;
        }
        photos.push(cached);
        used += cached.bytes;
        videoCount += 1;
      } catch (err) {
        skipped.push({ filename, reason: errorMessage(err) });
      }
    } else {
      skipped.push({ filename, reason: `unsupported type: ${item.type}` });
    }
  }
  return { photos, skipped };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error ?? new Error("FileReader failed"));
    fr.readAsDataURL(blob);
  });
}
