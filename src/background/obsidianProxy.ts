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
  // `append` is one logical op but two HTTP round-trips (GET then PUT) — the
  // reported status is the PUT's. See `appendViaReadModifyWrite`.
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

/** Shape a non-2xx response into the error arm of the wire contract. */
async function failure(res: Response): Promise<ObsidianResponse> {
  const body = await res.text().catch(() => "");
  return {
    ok: false,
    status: res.status,
    message: `${res.status} ${res.statusText}${
      body ? `: ${truncate(body, 200)}` : ""
    }`,
  };
}

/**
 * Append one line to a vault file via GET + PUT — deliberately NOT
 * `POST /vault/<path>`, even though that endpoint is documented as "append".
 *
 * The plugin implements POST as `appendFileContent`, which resolves the file
 * through Obsidian's VAULT INDEX and, on a miss, silently treats it as empty
 * before writing the whole file back:
 *
 *     const file = app.vault.getAbstractFileByPath(p);   // null when unindexed
 *     if (file instanceof TFile) contents = await vault.read(file);
 *     await vault.adapter.write(p, contents + body);     // → truncates to `body`
 *
 * Obsidian only indexes recognized extensions unless "Detect all file
 * extensions" is on, and `.jsonl` is not one — so POST would replace the
 * journal with a single line on every tick, silently discarding prior events.
 * Even with that setting on, the file is created through `adapter.write`
 * (which bypasses the index) and indexed asynchronously afterwards, so a
 * second tick can still race the indexer into the same truncating branch.
 *
 * GET (`adapter.readBinary`) and PUT (`adapter.write`) both bypass the index,
 * so this pair is correct regardless of indexing state. A 404 on the GET means
 * "file does not exist yet" → start from empty; PUT then creates it along with
 * any missing parent directories.
 *
 * This IS a read-modify-write. That is safe here for one reason only: each
 * actor owns its own journal file, so `proclivity.jsonl` has exactly one
 * writer. Never point a second writer at it.
 */
async function appendViaReadModifyWrite(
  url: string,
  apiKey: string,
  line: string,
): Promise<ObsidianResponse> {
  const auth = { Authorization: `Bearer ${apiKey}` };

  const cur = await fetch(url, { headers: auth });
  let existing = "";
  if (cur.status !== 404) {
    if (!cur.ok) return failure(cur);
    existing = await cur.text();
  }
  // Guard the join: a journal whose last line lacks a trailing newline would
  // otherwise concatenate two JSON objects onto one line.
  if (existing.length > 0 && !existing.endsWith("\n")) existing += "\n";

  const put = await fetch(url, {
    method: "PUT",
    headers: { ...auth, "Content-Type": "text/markdown" },
    body: existing + line,
  });
  if (!put.ok) return failure(put);
  return { ok: true, status: put.status, body: null };
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
    if (req.type === "obsidian:append") {
      return await appendViaReadModifyWrite(url, apiKey, req.line);
    }
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    // 404 on a read is a normal "no compiled file yet" signal, not an error.
    if (res.status === 404) return { ok: true, status: 404, body: null };
    if (!res.ok) return failure(res);
    return { ok: true, status: res.status, body: await res.text() };
  } catch (err) {
    // fetch rejects on network failure / server down / bad host.
    return {
      ok: false,
      status: 0,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
