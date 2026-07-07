/**
 * Newtab-side thin client for the Obsidian Local REST API. Talks to the SW
 * proxy (`src/background/obsidianProxy.ts`) via `chrome.runtime.sendMessage`,
 * mirroring `imageCache.ts:fetchMediaViaSw` — including the try/catch that
 * surfaces a clear message when the SW is unloaded (Chrome auto-respawns it on
 * the next call).
 *
 * The wire types are hand-duplicated here (see `obsidianProxy.ts`) to match the
 * photos convention and avoid pulling the SW module into the newtab graph.
 */

import type { CompiledRoadmap, ProgressEvent, RoadmapSource } from "./types";

// ── Wire contract (duplicated from obsidianProxy.ts — keep in sync) ──────────
type ObsidianRequest =
  | { type: "obsidian:read"; relPath: string }
  | { type: "obsidian:append"; relPath: string; line: string };
type ObsidianResponse =
  | { ok: true; status: number; body: string | null }
  | { ok: false; status: number; message: string };

/**
 * Vault-relative paths for a source. Deliberately DERIVED (never stored) to
 * avoid drift and any directory-listing dependency. The vault root is
 * `Personal Projects`; `encodeURI` (applied SW-side) handles the space in
 * "Source Code".
 *
 * NOTE: the compiled JSON and the progress journal live under DIFFERENT
 * subtrees by design — the compiled roadmap is published into the Obsidian
 * `Projects/<repo>/Roadmaps/` area for reading, while the append-only progress
 * journal is written into the git-tracked `Source Code/<repo>/plans/` tree
 * alongside `agent.jsonl`. This asymmetry is intentional per the Phase-G
 * design §4.2 and is the most likely spot to need adjustment against a real
 * vault layout.
 */
export function derivePaths(
  repo: string,
  slug: string,
): { compiledPath: string; progressPath: string } {
  return {
    compiledPath: `Projects/${repo}/Roadmaps/${slug}/roadmap.compiled.json`,
    progressPath: `Source Code/${repo}/plans/${slug}/progress/proclivity.jsonl`,
  };
}

async function sendViaSw(req: ObsidianRequest): Promise<ObsidianResponse> {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    throw new Error(
      "chrome.runtime is unavailable — roadmap sync requires the loaded extension (the service worker performs the authenticated fetch).",
    );
  }
  let resp: ObsidianResponse | undefined;
  try {
    resp = (await chrome.runtime.sendMessage(req)) as ObsidianResponse;
  } catch (err) {
    // sendMessage rejects if the SW is unloaded / receiving end is missing.
    // Chrome respawns the SW on the next call; surface this one clearly.
    throw new Error(
      `Service worker did not respond (will auto-recover on next attempt): ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
  if (!resp) {
    throw new Error(
      "Service worker returned no response — the extension may need a reload.",
    );
  }
  return resp;
}

/** Minimal structural validation of an externally-authored compiled file. */
function asCompiledRoadmap(parsed: unknown): CompiledRoadmap {
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !Array.isArray((parsed as { items?: unknown }).items)
  ) {
    throw new Error(
      "Compiled roadmap is malformed (missing an `items` array).",
    );
  }
  const p = parsed as { slug?: unknown; title?: unknown; items: unknown[] };
  const slug = typeof p.slug === "string" ? p.slug : "";
  const title = typeof p.title === "string" ? p.title : slug;
  // Items are trusted structurally here and defended field-by-field in
  // ingest.ts; we only keep entries that at least have a string id + kind.
  const items = p.items.filter(
    (it): it is CompiledRoadmap["items"][number] =>
      !!it &&
      typeof it === "object" &&
      typeof (it as { id?: unknown }).id === "string" &&
      typeof (it as { kind?: unknown }).kind === "string",
  );
  return { slug, title, items };
}

/**
 * Read a source's compiled roadmap. Returns `null` when the file does not
 * exist yet (404). Throws on transport / auth / parse failure so the caller
 * (`sync.syncNow`) can record `lastSyncError`.
 */
export async function readCompiled(
  source: Pick<RoadmapSource, "repo" | "slug">,
): Promise<CompiledRoadmap | null> {
  const { compiledPath } = derivePaths(source.repo, source.slug);
  const resp = await sendViaSw({ type: "obsidian:read", relPath: compiledPath });
  if (!resp.ok) {
    throw new Error(resp.message || `Read failed (status ${resp.status}).`);
  }
  if (resp.body === null) return null; // 404 — no compiled file yet.
  let parsed: unknown;
  try {
    parsed = JSON.parse(resp.body);
  } catch {
    throw new Error(`Compiled roadmap at "${compiledPath}" is not valid JSON.`);
  }
  return asCompiledRoadmap(parsed);
}

/**
 * Append one progress event to a source's `proclivity.jsonl`. POST appends to
 * end-of-file (creating the file + `progress/` dir if missing), so there is no
 * read-modify-write race with concurrent agent/obsidian writers. Throws on
 * failure so the caller can leave the write-back cursor unchanged for retry.
 */
export async function appendProgress(
  source: Pick<RoadmapSource, "repo" | "slug">,
  event: ProgressEvent,
): Promise<void> {
  const { progressPath } = derivePaths(source.repo, source.slug);
  const line = `${JSON.stringify(event)}\n`;
  const resp = await sendViaSw({
    type: "obsidian:append",
    relPath: progressPath,
    line,
  });
  if (!resp.ok) {
    throw new Error(resp.message || `Append failed (status ${resp.status}).`);
  }
}

/**
 * Probe connectivity + auth against the vault root (`GET /vault/`). A 200 means
 * the server is up and the key is accepted; 401 means the key is wrong; a
 * thrown/`status:0` means the host is unreachable.
 */
export async function testConnection(): Promise<
  { ok: true } | { ok: false; status: number; message: string }
> {
  try {
    const resp = await sendViaSw({ type: "obsidian:read", relPath: "" });
    if (resp.ok) return { ok: true };
    return { ok: false, status: resp.status, message: resp.message };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
