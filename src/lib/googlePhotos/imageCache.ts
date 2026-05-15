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
 * Auth — fetched via the service-worker proxy.
 *   Direct fetch from the newtab fails: with Authorization header it
 *   triggers a CORS preflight Google's CDN answers with a malformed ACAO
 *   header; without it the CDN returns 403 (no public read on real
 *   user libraries). MV3 host_permissions grant CORS bypass to the
 *   service worker only, so the SW does the authenticated fetch and
 *   ships the base64-encoded bytes back via chrome.runtime.sendMessage.
 *   See src/background/service-worker.ts "Google Photos byte-fetch proxy".
 */

import { type PickedMediaItem } from "./api";

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

/**
 * Wire-format for the SW proxy. Mirrored in service-worker.ts —
 * keep both sides in sync.
 */
interface PhotosFetchOk {
  ok: true;
  dataUrl: string;
  mimeType: string;
  sizeBytes: number;
}
interface PhotosFetchErr {
  ok: false;
  status: number;
  message: string;
  code?: string;
  sizeBytes?: number;
}
type PhotosFetchResponse = PhotosFetchOk | PhotosFetchErr;

/**
 * Round-trip through the service worker to fetch a Picker mediaFile.baseUrl
 * with Authorization. Returns the bytes already base64-encoded as a data URL
 * since chrome.runtime message passing handles large strings cheaply and we
 * need a data URL downstream anyway.
 *
 * `maxBytes` (when supplied) is enforced on the SW side, before the proxy
 * pays the base64-encode cost on a payload we'd throw away.
 */
async function fetchMediaViaSw(
  item: PickedMediaItem,
  suffix: string,
  token: string,
  maxBytes?: number,
): Promise<PhotosFetchOk> {
  const url = `${item.mediaFile.baseUrl}${suffix}`;
  if (
    typeof chrome === "undefined" ||
    !chrome.runtime?.sendMessage
  ) {
    // Dev / non-extension fallback. The direct fetch will almost certainly
    // 403 against real Picker URLs, but we surface a meaningful error rather
    // than a generic undefined-deref so `vite dev` sessions stay legible.
    throw new Error(
      "chrome.runtime is unavailable — Google Photos requires the loaded extension (the SW handles the authenticated fetch).",
    );
  }
  let resp: PhotosFetchResponse;
  try {
    resp = (await chrome.runtime.sendMessage({
      type: "photos:fetchBytes",
      url,
      token,
      ...(maxBytes !== undefined ? { maxBytes } : {}),
    })) as PhotosFetchResponse;
  } catch (err) {
    // sendMessage rejects if the SW is unloaded / receiving end is missing.
    // Chrome will spin the SW back up automatically on the next call, but
    // we surface this one clearly so a transient miss is recognisable.
    throw new Error(
      `Service worker did not respond (will auto-recover on next attempt): ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
  if (!resp) {
    throw new Error(
      "Service worker returned no response — extension may need a reload",
    );
  }
  if (!resp.ok) {
    if (resp.code === "too_large") {
      const size =
        resp.sizeBytes !== undefined ? ` (${formatMb(resp.sizeBytes)})` : "";
      throw new Error(`video too large for cache${size}: ${resp.message}`);
    }
    if (resp.status === 401) {
      throw new Error(
        "OAuth token rejected (401) — the picker session likely expired; re-pick to refresh",
      );
    }
    if (resp.status === 403) {
      throw new Error(
        "Google denied access (403) — the picker session may have expired or the URL is no longer valid",
      );
    }
    throw new Error(
      `Fetch failed (${resp.status || "network"}): ${resp.message}`,
    );
  }
  return resp;
}

/**
 * Fetch one picked photo, downscaled, and return it as a CachedPhoto.
 * Throws on non-2xx (caller decides per-item whether to skip or abort).
 */
export async function fetchAndEncodePhoto(
  item: PickedMediaItem,
  token: string,
): Promise<CachedPhoto> {
  const r = await fetchMediaViaSw(
    item,
    `=w${TARGET_WIDTH}-h${TARGET_HEIGHT}`,
    token,
  );
  // `data:<mime>;base64,<payload>` — bytes ≈ payload length × 0.75. We use
  // dataUrl.length as a conservative byte estimate; it's <2% off and the
  // chrome.storage quota check uses the full string anyway.
  return {
    id: item.id,
    filename: item.mediaFile.filename,
    mimeType: r.mimeType || item.mediaFile.mimeType,
    createTime: item.createTime,
    width: item.mediaFile.mediaFileMetadata.width,
    height: item.mediaFile.mediaFileMetadata.height,
    dataUrl: r.dataUrl,
    bytes: r.dataUrl.length,
    kind: "photo",
  };
}

/**
 * Fetch one picked video at its transcoded resolution and return it as a
 * CachedPhoto (kind: "video"). `=dv` is Google's "download video" form —
 * the only Picker endpoint that returns playable bytes for VIDEO items.
 *
 * The SW enforces MAX_VIDEO_BYTES_RAW before encoding, so oversized clips
 * surface as a `too_large` error here instead of swallowing CPU on a 200 MB
 * dataUrl we'd immediately discard.
 */
export async function fetchAndEncodeVideo(
  item: PickedMediaItem,
  token: string,
): Promise<CachedPhoto> {
  const r = await fetchMediaViaSw(item, "=dv", token, MAX_VIDEO_BYTES_RAW);
  return {
    id: item.id,
    filename: item.mediaFile.filename,
    mimeType: r.mimeType || item.mediaFile.mimeType,
    createTime: item.createTime,
    width: item.mediaFile.mediaFileMetadata.width,
    height: item.mediaFile.mediaFileMetadata.height,
    dataUrl: r.dataUrl,
    bytes: r.dataUrl.length,
    kind: "video",
  };
}

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
  token: string,
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
        const cached = await fetchAndEncodePhoto(item, token);
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
        const cached = await fetchAndEncodeVideo(item, token);
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
