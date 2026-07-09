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

import type {
  CompiledItem,
  CompiledRoadmap,
  ProgressEvent,
  RoadmapSource,
} from "./types";

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
 * `Projects/<vaultProject>/Roadmaps/` area for reading, while the append-only
 * progress journal is written into the git-tracked `Source Code/<repo>/plans/`
 * tree alongside `agent.jsonl`. This asymmetry is intentional per the Phase-G
 * design §4.2.
 *
 * The two roots take SEPARATE names: `vaultProject` roots the read and `repo`
 * roots the write. They default equal (every project except Proclivity), so a
 * caller may pass a single name; Proclivity needs both because its vault folder
 * (`Proclivity`) and Source Code dir (`proclivity`) differ in case — a single
 * string would be wrong for one root and only "work" via case-insensitive FS
 * resolution, which the Obsidian REST API does not guarantee (and which breaks
 * on a case-sensitive host).
 */
export function derivePaths(
  repo: string,
  slug: string,
  vaultProject?: string,
): { compiledPath: string; progressPath: string } {
  const project = vaultProject && vaultProject.length > 0 ? vaultProject : repo;
  return {
    compiledPath: `Projects/${project}/Roadmaps/${slug}/roadmap.compiled.json`,
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

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/**
 * Normalize one raw compiled item. The compiler emits JSON **`null`** (not
 * `undefined`) for every absent optional field (`parent`, `summary`, `lane`,
 * `priority`, `estimateDays`, `targetStart`, `targetEnd`), but the
 * `CompiledItem` type declares them `T | undefined`. Under
 * `exactOptionalPropertyTypes` we OMIT the field entirely when it is `null` or
 * the wrong type (conditional-build style), so downstream code only ever sees
 * `undefined` — never a stray `null` masquerading as a value.
 */
function normalizeItem(raw: Record<string, unknown>): CompiledItem {
  const item: CompiledItem = {
    id: String(raw.id),
    kind: raw.kind as CompiledItem["kind"],
    title: str(raw.title) ?? String(raw.id),
  };
  const status = str(raw.status);
  if (status !== undefined) item.status = status as CompiledItem["status"];
  const parent = str(raw.parent);
  if (parent !== undefined) item.parent = parent;
  const summary = str(raw.summary);
  if (summary !== undefined) item.summary = summary;
  const lane = str(raw.lane);
  if (lane !== undefined) item.lane = lane as CompiledItem["lane"];
  const priority = str(raw.priority);
  if (priority !== undefined) item.priority = priority as CompiledItem["priority"];
  const progress = num(raw.progress);
  if (progress !== undefined) item.progress = progress;
  const targetStart = num(raw.targetStart);
  if (targetStart !== undefined) item.targetStart = targetStart;
  const targetEnd = num(raw.targetEnd);
  if (targetEnd !== undefined) item.targetEnd = targetEnd;
  const pv = raw.proclivity;
  if (pv && typeof pv === "object") {
    const proclivity: NonNullable<CompiledItem["proclivity"]> = {};
    const scope = str((pv as Record<string, unknown>).scope);
    if (scope !== undefined) proclivity.scope = scope;
    const surface = (pv as Record<string, unknown>).surface;
    if (typeof surface === "boolean") proclivity.surface = surface;
    item.proclivity = proclivity;
  }
  return item;
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
  // Keep only entries with a string id + kind, then normalize each so the
  // compiler's JSON `null`s become omitted (`undefined`) fields — ingest.ts
  // still defends per-field on top of this.
  const items = p.items
    .filter(
      (it): it is Record<string, unknown> =>
        !!it &&
        typeof it === "object" &&
        typeof (it as { id?: unknown }).id === "string" &&
        typeof (it as { kind?: unknown }).kind === "string",
    )
    .map(normalizeItem);
  return { slug, title, items };
}

/**
 * Read a source's compiled roadmap. Returns `null` when the file does not
 * exist yet (404). Throws on transport / auth / parse failure so the caller
 * (`sync.syncNow`) can record `lastSyncError`.
 */
export async function readCompiled(
  source: Pick<RoadmapSource, "repo" | "slug" | "vaultProject">,
): Promise<CompiledRoadmap | null> {
  const { compiledPath } = derivePaths(
    source.repo,
    source.slug,
    source.vaultProject,
  );
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
 * Append one progress event to a source's `proclivity.jsonl`, creating the file
 * and its `progress/` dir if missing.
 *
 * The SW performs this as a read-modify-write (GET + PUT), NOT the Local REST
 * API's "append" POST — see `obsidianProxy.ts:appendViaReadModifyWrite` for why
 * POST silently truncates a `.jsonl` journal. What makes the RMW safe is that
 * each actor owns its own journal file: `proclivity.jsonl` has exactly one
 * writer, so it never races the agent (`agent.jsonl`) or compiler
 * (`obsidian.jsonl`) writers. Do not repoint a second writer at this file.
 *
 * Throws on failure so the caller can leave the write-back cursor unchanged for
 * retry.
 */
export async function appendProgress(
  source: Pick<RoadmapSource, "repo" | "slug" | "vaultProject">,
  event: ProgressEvent,
): Promise<void> {
  const { progressPath } = derivePaths(
    source.repo,
    source.slug,
    source.vaultProject,
  );
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
