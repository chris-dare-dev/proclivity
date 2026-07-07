/// <reference types="chrome" />

/**
 * Service-worker-side authenticated fetch against the Obsidian Local REST API.
 *
 * Why the SW and not a direct newtab fetch: MV3 `host_permissions` grant a real
 * CORS bypass to the **service worker's** `fetch`, not to a cross-origin
 * `fetch()` from the extension document when the server doesn't echo a valid
 * `Access-Control-Allow-Origin` for a `chrome-extension://` origin. The
 * Obsidian Local REST API emits no permissive ACAO for our origin, so a direct
 * newtab fetch to `http://127.0.0.1:27123` is CORS-rejected — the identical
 * failure the codebase already hit against Google's CDN and solved with the SW
 * proxy (`handlePhotosFetch`). Loopback `http://127.0.0.1` is a
 * potentially-trustworthy origin, so mixed-content is NOT the blocker; CORS is,
 * hence the SW.
 *
 * Secret hygiene: the host + API key are read from `roadmapStore` **inside the
 * SW**; the message payload carries only `relPath`/`line`, so the bearer token
 * never crosses the `chrome.runtime` message boundary.
 *
 * Wire contract is hand-duplicated in `src/lib/roadmap/client.ts` (matching the
 * photos convention where `imageCache.ts` duplicates the photos wire types) —
 * keep both sides in sync.
 */

import { roadmapStore } from "@/lib/roadmap/store";

export type ObsidianRequest =
  | { type: "obsidian:read"; relPath: string }
  | { type: "obsidian:append"; relPath: string; line: string };

export type ObsidianResponse =
  // read: body = text (200) | null (404). append: body = null (204).
  | { ok: true; status: number; body: string | null }
  // status = HTTP code, or 0 for network / not-configured errors.
  | { ok: false; status: number; message: string };

/** Narrowing type-guard used by the SW `onMessage` listener. */
export function isObsidianRequest(msg: unknown): msg is ObsidianRequest {
  if (!msg || typeof msg !== "object") return false;
  const t = (msg as { type?: unknown }).type;
  return t === "obsidian:read" || t === "obsidian:append";
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) : s;
}

export async function handleObsidianMessage(
  req: ObsidianRequest,
): Promise<ObsidianResponse> {
  const { host, apiKey } = await roadmapStore.get();
  if (!host || !apiKey) {
    return {
      ok: false,
      status: 0,
      message:
        "Roadmap sync is not configured — set the Obsidian host and API key in Settings → Roadmaps.",
    };
  }
  // `encodeURI` leaves "/" intact and turns spaces into %20 (e.g. the space in
  // "Source Code"). The Local REST API serves vault files under /vault/<path>.
  const url = `${host}/vault/${encodeURI(req.relPath)}`;
  try {
    const res =
      req.type === "obsidian:read"
        ? await fetch(url, {
            headers: { Authorization: `Bearer ${apiKey}` },
          })
        : await fetch(url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "text/markdown",
            },
            body: req.line,
          });

    // 404 on a read is a normal "no compiled file yet" signal, not an error.
    if (req.type === "obsidian:read" && res.status === 404) {
      return { ok: true, status: 404, body: null };
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        status: res.status,
        message: `${res.status} ${res.statusText}${
          body ? `: ${truncate(body, 200)}` : ""
        }`,
      };
    }
    if (req.type === "obsidian:append") {
      // POST appends to end-of-file (creating the file + parent dir if
      // missing). No response body is meaningful.
      return { ok: true, status: res.status, body: null };
    }
    const text = await res.text();
    return { ok: true, status: res.status, body: text };
  } catch (err) {
    // fetch rejects on network failure / server down / bad host.
    return {
      ok: false,
      status: 0,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
