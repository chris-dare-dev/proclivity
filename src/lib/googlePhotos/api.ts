/**
 * Google Photos Picker API client.
 *
 * Picker flow (per https://developers.google.com/photos/picker/guides):
 *   1. POST /v1/sessions       → { id, pickerUri, pollingConfig, mediaItemsSet: false }
 *   2. Open `pickerUri` in a new tab — user picks photos in Google's UI.
 *   3. Poll GET /v1/sessions/{id} until `mediaItemsSet === true`.
 *   4. GET /v1/mediaItems?sessionId={id} → list of MediaItem.
 *   5. DELETE /v1/sessions/{id} to clean up.
 *
 * `baseUrl` on each MediaItem is valid for ~1 hour and requires the same
 * OAuth token as an `Authorization: Bearer` header on fetch. Append
 * `=w<W>-h<H>` to request a sized image (the unsized URL returns the
 * original-resolution asset).
 *
 * All functions throw `GooglePhotosApiError` with `.status` so callers can
 * distinguish 401 (re-auth) from 4xx/5xx (real failure).
 */

import { clearToken } from "./auth";

const PICKER_BASE = "https://photospicker.googleapis.com/v1";

export class GooglePhotosApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
    this.name = "GooglePhotosApiError";
  }
}

export interface PickerSession {
  id: string;
  pickerUri: string;
  pollingConfig: {
    /** Duration string, e.g. "5s" — minimum interval between status polls. */
    pollInterval: string;
    /** Duration string, e.g. "600s" — give up if the user hasn't acted. */
    timeoutIn: string;
  };
  /** RFC3339 — session itself expires (separate from mediaItem baseUrl expiry). */
  expireTime: string;
  mediaItemsSet: boolean;
}

export interface PickedMediaItem {
  id: string;
  createTime: string;
  type: "PHOTO" | "VIDEO" | "TYPE_UNSPECIFIED";
  mediaFile: {
    baseUrl: string;
    mimeType: string;
    filename: string;
    mediaFileMetadata: {
      width: number;
      height: number;
      /**
       * Present on VIDEO items only. `processingStatus !== "READY"` means
       * Google is still transcoding the upload — the `=dv` download won't
       * succeed yet, so callers should skip the item with a clear reason.
       */
      videoMetadata?: {
        processingStatus?: "READY" | "PROCESSING" | "FAILED" | string;
        fps?: number;
      };
    };
  };
}

interface MediaItemsResponse {
  mediaItems?: PickedMediaItem[];
  nextPageToken?: string;
}

async function request<T>(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${PICKER_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new GooglePhotosApiError(
      `Photos API ${res.status} ${res.statusText} on ${path}`,
      res.status,
      body,
    );
  }
  // 204 No Content on DELETE
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function createSession(token: string): Promise<PickerSession> {
  return request<PickerSession>(token, "/sessions", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function getSession(
  token: string,
  sessionId: string,
): Promise<PickerSession> {
  return request<PickerSession>(token, `/sessions/${encodeURIComponent(sessionId)}`);
}

export async function deleteSession(
  token: string,
  sessionId: string,
): Promise<void> {
  await request<void>(token, `/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
  });
}

/**
 * Fetch every MediaItem the user picked in this session, following
 * `nextPageToken` until exhausted. Capped at `maxItems` to bound memory
 * usage — the storage cache enforces its own cap downstream.
 */
export async function listMediaItems(
  token: string,
  sessionId: string,
  maxItems = 100,
): Promise<PickedMediaItem[]> {
  const items: PickedMediaItem[] = [];
  let pageToken: string | undefined;
  do {
    const query = new URLSearchParams({
      sessionId,
      pageSize: "100",
    });
    if (pageToken) query.set("pageToken", pageToken);
    const res = await request<MediaItemsResponse>(
      token,
      `/mediaItems?${query.toString()}`,
    );
    if (res.mediaItems) items.push(...res.mediaItems);
    pageToken = res.nextPageToken;
    if (items.length >= maxItems) {
      items.length = maxItems;
      break;
    }
  } while (pageToken);
  return items;
}

/**
 * Parse a duration string like "5s" / "0.250s" into milliseconds. Google's
 * API returns durations in this format on PickerSession.pollingConfig.
 */
export function parseDurationMs(d: string): number {
  const m = /^(\d+(?:\.\d+)?)s$/.exec(d);
  if (!m || m[1] === undefined) return 5000;
  return Math.round(parseFloat(m[1]) * 1000);
}

/**
 * 401-aware wrapper: if `op` throws with status 401, clear the cached token
 * and rethrow so the caller can re-auth. (We don't auto-retry here — the
 * caller may need to surface a "session expired" message to the user.)
 */
export async function withTokenRetry<T>(
  token: string,
  op: (t: string) => Promise<T>,
): Promise<T> {
  try {
    return await op(token);
  } catch (err) {
    if (err instanceof GooglePhotosApiError && err.status === 401) {
      await clearToken(token);
    }
    throw err;
  }
}
