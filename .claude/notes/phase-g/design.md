# Phase G — Roadmap Ingest & Write-Back — Implementation Design

Make the Proclivity MV3 extension (a) **ingest** `roadmap.compiled.json` from the
Obsidian vault via the Local REST API and surface roadmap items as native-looking
Todos + a Gantt chart, and (b) **write task-completion back** to the vault progress
journal (`proclivity.jsonl`) — without ever touching `roadmap.yaml` or the compiled
JSON.

Synthesized from four reader briefs (compiled-schema, storage, mv3-rest, ui) and
verified against the live codebase. All paths absolute where load-bearing.

---

## 0. Design invariants (the load-bearing decisions)

1. **Fetch runs in the service worker, never the newtab.** MV3 `host_permissions`
   grant a real CORS bypass only to the SW's `fetch`. The Obsidian plugin emits no
   permissive `Access-Control-Allow-Origin` for a `chrome-extension://` origin, so a
   direct newtab fetch to `http://127.0.0.1:27123` is CORS-blocked. Mirror the
   existing Google-Photos proxy exactly (`service-worker.ts` `handlePhotosFetch` +
   the `return true` async-channel `onMessage` idiom). See §3.
2. **Mirrors ride existing arrays; no new `ProclivityState` array.** Roadmap items
   become ordinary `Todo`s and `GanttChart`/`GanttTask`s carrying a deterministic
   `rm:` id. Nothing is added to `ProclivityState`/`EMPTY_STATE`, so **no
   `CURRENT_SCHEMA_VERSION` bump and no import/export plumbing** is needed — `rm:`
   mirrors round-trip as ordinary todos/charts (confirmed: `exportImport.ts:113`
   `{...EMPTY_STATE, ...raw}` + orphan-tag filter only).
3. **Secrets never enter `UserSettings` or the export blob.** Host + API key + source
   list + write-back cursor live in a dedicated `chrome.storage.local` key
   `proclivity:roadmap:v1` with its own sole read/writer module, exactly mirroring
   `PHOTOS_STORAGE_KEY`/`photosStore`. Only non-secret prefs (default scope, gantt
   toggle, auto-sync) go in `UserSettings`.
4. **Idempotent reconcile keyed on `rm:` id, field-scoped patch, no clobber.** Native
   todos (`uid()` = base36, never contains `:`) are structurally untouchable. Re-ingest
   of identical input yields an identical object. See §5.
5. **Dropped → close (not delete); tick → append (never rewrite).** Reuse
   `closeTodo`/`reopenTodo` from `closedTodos.ts`; write-back is POST-append-only to
   `proclivity.jsonl`. See §5, §6.
6. **Budget discipline.** All ingest/mapping code (`ingest.ts`, `sync.ts`,
   `client.ts`, `types.ts`) is reachable only from (a) the SW bundle, (b) the lazy
   Settings chunk, and (c) `import()`-on-demand paths. The newtab initial chunk gains
   only a lightweight `rm:` done-transition detector that dynamic-imports the
   write-back handler. No new npm dependency (native `fetch` + `JSON` only).
7. **`exactOptionalPropertyTypes`.** Use conditional-build style everywhere
   (`if (x !== undefined) obj.x = x; else delete obj.x`) — never write `undefined`
   literals into narrow optionals. `GanttTask`/`GanttChart` have no `normalizeState`
   backfill, so ingest must write **fully-formed** gantt objects.

---

## 1. New files (responsibility)

| File | Responsibility |
|---|---|
| `src/lib/roadmap/types.ts` | TS mirror of the compiled schema (`CompiledRoadmap`, `CompiledItem`, `ItemKind`, `ItemStatus`, `Lane`, `Priority`) + the journal `ProgressEvent` shape + `RoadmapSource`/`RoadmapStoreState`. Ingest-domain only — kept OUT of `src/types/index.ts`. |
| `src/lib/roadmap/store.ts` | `roadmapStore` over `proclivity:roadmap:v1` (get/set/patch/clear/subscribe), a near-verbatim copy of `src/lib/googlePhotos/store.ts`. Holds host, apiKey, sources, `writtenBack` cursor, `lastSyncAt`, `lastSyncError`. Sole read/writer for the key. |
| `src/background/obsidianProxy.ts` | SW-side authenticated fetch. Exports the wire types (`ObsidianRequest`/`ObsidianResponse`) + `handleObsidianMessage(msg)`. Reads host+apiKey from `roadmapStore.get()` itself (secret stays out of message payloads). GET → read, POST → append. Discriminated-union response identical in spirit to `PhotosFetchResponse`. |
| `src/lib/roadmap/client.ts` | Newtab-side thin client that talks to the SW proxy via `chrome.runtime.sendMessage` (mirrors `imageCache.ts:fetchMediaViaSw`, incl. the try/catch for SW-unloaded). `readCompiled(source) → CompiledRoadmap \| null` (404→null, JSON.parse), `appendProgress(source, event) → void`. Also `derivePaths(repo, slug)` (compiled + progress vault-relative paths). |
| `src/lib/roadmap/ingest.ts` | Pure mapping + the single reconcile updater. `mapItemsToTodos`, `mapRoadmapToGantt`, and `ingestRoadmaps(collected): (s) => s` — the atomic upsert/close/gantt-replace driver run inside one `storage.update`. No I/O. |
| `src/lib/roadmap/sync.ts` | Orchestration (newtab side). `syncNow(): Promise<SyncResult>` — read config → `client.readCompiled` per enabled source → `storage.update(ingestRoadmaps(...))` → write `lastSyncAt`/`lastSyncError` back to `roadmapStore`. `onMirrorToggle(mirrorId, done)` — the write-back append (§6). Heavy (pulls `ingest.ts`); only `import()`-ed on demand. |
| `src/components/settings/panes/RoadmapsPane.tsx` | The Settings pane. Live-subscribes to `roadmapStore` (like `GooglePhotosPane`→`photosStore`); host/key inputs, Test-connection, Add-roadmap (repo+slug→validate GET→store `RoadmapSource`), per-source enable/remove toggles, Sync-now (dynamic-imports `sync.ts`), lastSync status, and a "Long-term is hidden" nudge. Static imports kept light (`roadmapStore` + `client`); `sync.ts` dynamic-imported on button click. |

---

## 2. Modified files (exact changes)

| File | Change |
|---|---|
| `manifest.config.ts` | Add `"http://127.0.0.1/*"` to `host_permissions` (currently lines 46-49, the two Google hosts). Match patterns carry **no port** — this one entry covers `:27123`. No new `permissions` API entry. Add a rationale comment mirroring the existing Photos-CDN comment. |
| `src/types/index.ts` | (a) `SettingsPaneId` (233-242): add `\| "roadmaps"`. (b) `UserSettings` (250-408): add nested optional `roadmap?: { defaultScope?: TodoScope \| undefined; surfaceInGantt?: boolean \| undefined; autoSyncOnOpen?: boolean \| undefined } \| undefined`. (c) `ResolvedUserSettings` (416-483): add `roadmap: { defaultScope: TodoScope; surfaceInGantt: boolean; autoSyncOnOpen: boolean }`. |
| `src/storage/constants.ts` | (a) Add `export const ROADMAP_STORAGE_KEY = "proclivity:roadmap:v1";` next to `PHOTOS_STORAGE_KEY` (line 29) with the same "kept out of export/import" comment. (b) `DEFAULT_SETTINGS` (125-192): add `roadmap: { defaultScope: "today", surfaceInGantt: true, autoSyncOnOpen: false }`. (c) `resolvedSettings()` (203-278): add a per-subkey merge block (nested objects merge one level deep — copy the `geminiNano`/`googlePhotos` precedent at 243-259). |
| `src/newtab/App.tsx` | (a) `SETTINGS_PANE_IDS` set (41-51): add `"roadmaps"`. (b) Add a lightweight `useEffect` write-back detector: subscribe to store, diff `rm:`-prefixed todos' `done` flags against a ref snapshot, and on any transition `void import("@/lib/roadmap/sync").then(m => m.onMirrorToggle(id, done))`. (c) Optional auto-sync: if `rs.roadmap.autoSyncOnOpen`, `void import("@/lib/roadmap/sync").then(m => m.syncNow())` once on mount. Both use `import()` to keep `ingest.ts` out of the initial chunk. |
| `src/components/settings/panes/registry.ts` | `PANE_ORDER` (16-26): add `{ id: "roadmaps", label: "Roadmaps" }`. Sidebar auto-renders — no `SettingsSidebar.tsx` edit. |
| `src/components/settings/SettingsModal.tsx` | Import `RoadmapsPane` (25-33 import block) and add `case "roadmaps":` to `renderPane()` (418-534): `return <RoadmapsPane live={live} prefs={rs.roadmap} longTermHidden={!rs.sectionVisibility.longTerm} />`. Non-secret prefs use the existing `live()` updater (immediate persist); no `pending*` state needed (the pane owns its own `roadmapStore` reads/writes). |
| `src/background/service-worker.ts` | Import `handleObsidianMessage` + register a **second** `chrome.runtime.onMessage.addListener` (additive; the Photos listener at 605-619 returns `false` for non-matching types, so a second guarded listener composes cleanly). Type-guard `msg.type === "obsidian:read" \| "obsidian:append"`, else `return false`; on match `void handleObsidianMessage(req).then(sendResponse); return true;`. |

No change to `TodoList.tsx`, `Today.tsx`, `LongTerm.tsx`, `Gantt.tsx`, `ChartView.tsx`,
`ganttUtils.ts`, `SettingsSidebar.tsx`, `exportImport.ts`, `storage.ts`,
`normalizeState`, `EMPTY_STATE`. They surface `rm:` data as-is.

---

## 3. Fetch architecture — SW proxy (decision + rationale)

**Decision: route every Obsidian request through the service worker.** Newtab →
`chrome.runtime.sendMessage(req)` → SW `fetch` (CORS-bypassed) → discriminated-union
response → `return true` keeps the channel open.

Rationale (mv3-rest brief): in MV3 the `host_permissions` CORS bypass applies to the
**SW fetch**, not to a cross-origin `fetch()` from the extension document when the
server doesn't echo a valid ACAO. The Obsidian Local REST API does not emit permissive
CORS headers for a `chrome-extension://` origin, so a direct newtab fetch to
`127.0.0.1:27123` is rejected — the identical failure the codebase already hit against
Google's CDN and solved with the SW proxy. Loopback `http://127.0.0.1` is a
"potentially-trustworthy" origin, so mixed-content is *not* the blocker (a plain-HTTP
fetch from the secure newtab context is allowed); **CORS is**, hence the SW.

**Wire contract** (hand-duplicated in `obsidianProxy.ts` and `client.ts`, matching the
photos convention):

```ts
// request
type ObsidianRequest =
  | { type: "obsidian:read";   relPath: string }
  | { type: "obsidian:append"; relPath: string; line: string };
// response
type ObsidianResponse =
  | { ok: true;  status: number; body: string | null }   // read: body=text (200) | null (404)
  | { ok: false; status: number; message: string };       // status=0 for network errors
```

SW handler (`handleObsidianMessage`), reading host+key itself:

```ts
const { host, apiKey } = await roadmapStore.get();
const url = `${host}/vault/${encodeURI(relPath)}`;   // encodeURI leaves "/" intact, spaces→%20
const res = await fetch(url, req.type === "obsidian:read"
  ? { headers: { Authorization: `Bearer ${apiKey}` } }
  : { method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "text/markdown" },
      body: req.line });                                // one JSONL line, "\n"-terminated
```

- GET 200 → `{ ok:true, status:200, body:text }`; 404 → `{ ok:true, status:404, body:null }`.
- POST 204 → `{ ok:true, status:204, body:null }`.
- `!res.ok` (non-404) → `{ ok:false, status, message: truncate(body,200) }`; thrown →
  `{ ok:false, status:0, message }`. Same failure discipline as `handlePhotosFetch`.
- **Secret hygiene:** the message carries only `relPath`/`line`; the API key is read
  from `chrome.storage.local` inside the SW and never crosses the message boundary.

---

## 4. Config model

### 4.1 `host_permissions`
Add `"http://127.0.0.1/*"` (port-less match) alongside the two Google hosts. If HTTPS
`:27124` is ever adopted, add `"https://127.0.0.1/*"`.

### 4.2 Secret side-channel — `roadmapStore` (`proclivity:roadmap:v1`)
Mirrors `photosStore`. Deliberately outside `ProclivityState` (out of the React tree
and the export blob). Shape:

```ts
interface RoadmapSource {
  repo: string;    // Source Code dir name, case-preserved, e.g. "arXMCP"
  slug: string;    // plans subdir / compiled.slug, e.g. "paper-metadata"
  title: string | null;   // cached from compiled.title (display only)
  enabled: boolean;
}
interface RoadmapStoreState {
  host: string;        // e.g. "http://127.0.0.1:27123"
  apiKey: string;      // Obsidian Local REST API bearer
  sources: RoadmapSource[];
  writtenBack: Record<string, "done" | "in_progress">;  // mirrorId → last journal value (dedup cursor)
  lastSyncAt: number | null;
  lastSyncError: string | null;
}
const EMPTY_ROADMAP_STATE = { host: "http://127.0.0.1:27123", apiKey: "",
  sources: [], writtenBack: {}, lastSyncAt: null, lastSyncError: null };
```

Paths are **derived**, never stored (avoids drift + no directory-listing dependency):
```
compiledPath = `Projects/${repo}/Roadmaps/${slug}/roadmap.compiled.json`
progressPath = `Source Code/${repo}/plans/${slug}/progress/proclivity.jsonl`
```
(both vault-relative; the vault root *is* `Personal Projects`). `encodeURI` handles the
space in `Source Code`.

### 4.3 Non-secret prefs — `UserSettings.roadmap`
Four-file settings wiring (types ×2 + `DEFAULT_SETTINGS` + `resolvedSettings`):
`{ defaultScope: "today", surfaceInGantt: true, autoSyncOnOpen: false }`.
- `defaultScope` — scope for ingested task/spike todos. Default `"today"` because
  Long-term ships **hidden** (`sectionVisibility.longTerm:false`, constants.ts:154);
  `"today"` surfaces immediately. If the user picks `"long"`, the pane shows a nudge to
  re-enable Long-term.
- `surfaceInGantt` — when false, skip gantt upsert and prune `rm:` charts/tasks.
- `autoSyncOnOpen` — default false (respects "manual" cadence + avoids startup fetch).

---

## 5. Idempotent reconcile algorithm (`ingest.ts`)

**Mirror id scheme.** `srcKey = ${repo}/${slug}`.
- Todo / GanttTask mirror id: `rm:${srcKey}#${item.id}` (the `#` separator is
  unambiguous — repo, slug, and compiled item ids contain no `#`).
- GanttChart mirror id: `rm:${srcKey}` (no `#` → distinguishable from tasks).
- Predicates: one mirror `t.id === mkId`; all mirrors `t.id.startsWith("rm:")`.
- **Collision-safe** vs native ids: `uid()` is base36 and never contains `:`/`#`.

**Which items become what.**
- **Todos**: items with `kind ∈ {task, spike}` (the actionable leaves), `scope =
  prefs.defaultScope`. (Epics/milestones are structural → gantt only, no duplicate todo.)
- **Gantt**: one chart per roadmap; every item with **both** `targetStart` and
  `targetEnd` present → a `GanttTask`, `parentId = rm:${srcKey}#${item.parent}` when the
  parent is itself dated/mirrored. Undated items are omitted from gantt.

**Single atomic updater** — the whole reconcile is one `storage.update(fn)`, so it sees
normalized state and lands as one write:

```
ingestRoadmaps(collected: Array<{ srcKey; progressPath; compiled; prefs }>): (s) => s
```

For each collected roadmap:

1. **Upsert task/spike todos** (field-scoped, no clobber):
   - absent → build minimal `Todo { id, title, scope, done:false, createdAt:Date.now(), tags:[] }`;
     conditionally add `notes = item.summary` (`if (summary) t.notes = summary`).
   - present → overwrite **only** ingest-owned fields (`title`, `scope`, `notes`).
     **Never** touch `done`, `tags`, `sprintId`, `completedAt`, `closedAt`, close
     checkpoints, or `cardLayouts[id]` — user-owned. Do **not** sync `done` from
     roadmap status here (that would fight write-back and clobber a user tick).
2. **Dropped → close.** For items with `status === "dropped"`: fold
   `closeTodo(mkId)` into the same `fn` (it is a pure `(s)=>s`). If the mirror was
   purged, the upsert in step 1 re-creates it first, then close re-applies — the
   durable **re-create-then-re-close** the storage brief mandates (a closed mirror is
   not a permanent tombstone; `purgeOldClosed` will evict it, so reconcile must be able
   to rebuild it from source). **Asymmetry (documented):** we auto-close on drop but do
   **not** auto-reopen on un-drop, because a done mirror is indistinguishable from a
   user-completed one — un-drop leaves the mirror as-is.
3. **Gantt replace** (only if `prefs.surfaceInGantt`): remove all `rm:${srcKey}` chart
   + `rm:${srcKey}#*` tasks, then re-add:
   - chart `{ id:rm:${srcKey}, name: compiled.title ?? slug, createdAt: existing ?? Date.now() }`.
   - per dated item a **fully-formed** `GanttTask` (no gantt normalize backfill!):
     `startsAt = startOfDay(targetStart)`, `endsAt = max(startsAt, startOfDay(targetEnd))`,
     `progress = item.progress` (already 0-100 int), `done = item.status === "done"`,
     `parentId` only when parent is dated. Preserve existing `collapsed`/`color` if the
     task already existed.
   - **Containment clamp** (satisfy `findBoundsViolation`, ganttUtils.ts:155, so later
     user drags aren't rejected): `child.start = max(child.start, parent.start)`,
     `child.end = min(child.end, parent.end)` then `end = max(end, start)`.
   - If `!surfaceInGantt`: prune this srcKey's chart+tasks and add nothing.

**Date-tz note.** Compiled `targetStart/End` are epoch-ms of **local**-midnight
(`iso_to_ms` builds a naive datetime → machine-local). The extension runs on the *same*
PC, so the values are directly usable; re-snap via `startOfDay(new Date(ms))`
(`@/lib/dateUtils`) for DST/edge safety and to match the gantt's own local-midnight
convention.

**Idempotency proof.** Deterministic id + field-scoped patch + wholesale gantt replace
⇒ re-ingesting identical input yields identical objects; re-close preserves checkpoints
(`closeTodo` is idempotent); the `writtenBack` cursor prevents duplicate journal appends
(§6).

---

## 6. Write-back path (tick a mirror → append `proclivity.jsonl`)

**Trigger** (no `TodoList` edit — satisfies the brief). `App.tsx` runs a small
`storage.subscribe` effect that snapshots `rm:` todos' `done` flags in a ref; on any
transition it dynamic-imports `sync.ts` and calls `onMirrorToggle(mirrorId, done)`.

**`onMirrorToggle(mirrorId, done)`** (in `sync.ts`):
1. Parse `mirrorId`: strip `rm:`, split on `#` → `[srcKey, itemId]`. Look up the
   `RoadmapSource` (and thus `progressPath`) in `roadmapStore`. If none → no-op.
2. Compute intended journal value: `done → "done"`, else `"in_progress"` (a reopen).
   Read the dedup cursor `writtenBack[mirrorId]`; if unchanged → no-op (prevents
   spamming on ingest / reopen-of-already-planned). Freshly-ingested todos
   (`done:false`, no cursor) emit nothing.
3. Build the event — **exactly** the journal shape the compiler consumes
   (`id`, `field`, `value`, `at`, `actor`), with **`id` = the compiled item id**
   (`itemId`, e.g. `paper-metadata-e1`) — *not* the mirror todo id:
   ```json
   {"id":"paper-metadata-e1","field":"status","value":"done",
    "at":"2026-07-06T14:23:05","actor":"proclivity"}
   ```
   `at` = **local** ISO-8601, seconds precision, **no `Z`/offset** (matches Python
   `datetime.isoformat(timespec="seconds")` on a naive local datetime, so it sorts
   lexicographically against the compiler's own agent/obsidian events under
   last-timestamp-wins). Helper `isoLocalSeconds()` = `YYYY-MM-DDTHH:MM:SS` from local
   fields (never `toISOString()`, which is UTC+`Z`).
4. `await client.appendProgress(source, event)` → SW `POST /vault/${progressPath}` with
   `body = JSON.stringify(event) + "\n"`. POST appends to end-of-file and creates the
   file (and `progress/` dir) if missing — no read-modify-write race, safe for
   concurrent agent/obsidian writers.
5. On success, set `writtenBack[mirrorId] = value` in `roadmapStore`. On failure
   (Obsidian down) **leave the cursor unchanged** → retried on next toggle/sync; surface
   `lastSyncError` for the pane.

**One-writer discipline (absolute).** Proclivity writes **only** to
`.../progress/proclivity.jsonl` with `actor:"proclivity"`. It never writes
`agent.jsonl`/`obsidian.jsonl`, never PUT/PATCH/DELETE, never edits `roadmap.yaml` or
`roadmap.compiled.json`. The compiler re-harvests the journal and re-emits the compiled
JSON; proclivity's responsibility ends at appending its line. (Optional first-write
robustness: if a POST ever needs a guaranteed-fresh file, PUT-seed once — 204,
auto-creates the `progress/` parent — then POST subsequent lines. POST-creates-if-missing
makes this unnecessary in practice.)

**Idempotency.** The persisted cursor dedups across newtab reopens; even a stray
duplicate is harmless (compiler merge is last-timestamp-wins on identical `(id,field)`
value).

---

## 7. Explicitly deferred to manual / live testing

A headless agent cannot drive Chrome or reach the live vault. The agent **can and must**
run `npm run build` (`tsc -b && vite build`, strict) — that is *not* deferred. Deferred
to the user at a real machine:

1. Install + enable the **Obsidian Local REST API** plugin; enable the
   **non-encrypted HTTP server** (`:27123` is off by default — only HTTPS `:27124`
   answers otherwise); copy the generated API key.
2. Reload the unpacked extension so the new `host_permissions` entry + second SW
   `onMessage` listener take effect.
3. In Settings → **Roadmaps**: enter host + key, add a source (e.g. `arXMCP` /
   `paper-metadata`), Test-connection, Sync-now. Verify a real GET returns 200 (or 404
   for a bad path) **through the SW** (confirms the CORS bypass works against the live
   plugin, which is the one thing the codebase's Google-CDN experience predicts but
   can't prove for Obsidian without a live call).
4. Verify ingested `task/spike` todos render in Today (and Long-term once re-enabled);
   verify the `rm:` Gantt chart appears as an extra tab with correctly-placed bars
   (sanity-check `targetStart/End` tz-offset — the local-midnight assumption).
5. Tick a mirror todo → confirm a single well-formed line lands in
   `.../progress/proclivity.jsonl`, that re-ticking does **not** duplicate it, and that
   a re-compile overlays the status. Confirm nothing else in the vault is touched.
6. Confirm SW revival: after the SW idles out, the next `sendMessage` auto-respawns it
   (the `imageCache` try/catch pattern).

---

## 8. Build / constraint checklist

- **Chunk budget (<400 kB initial, 500 kB hard):** `ingest.ts`/`sync.ts`/`client.ts`/
  `types.ts` reachable only via SW bundle, lazy Settings chunk, and `import()`; App's
  only initial-chunk addition is the tiny done-transition detector. No `React.lazy`
  regression to Gantt/Photos.
- **No new deps:** native `fetch` + `JSON` only.
- **`exactOptionalPropertyTypes`:** conditional-build style; fully-formed `GanttTask`s.
- **`main`-only, conventional commits** (`feat(roadmap): …`) per repo `CLAUDE.md`.
