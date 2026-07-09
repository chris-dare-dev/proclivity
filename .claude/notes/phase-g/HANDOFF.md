# Phase G — Roadmap ↔ Obsidian Integration — HANDOFF

> Written 2026-07-08 to resume in a fresh session. Self-contained: assumes the
> reader has NO prior conversation context. Companion docs in this folder:
> [`design.md`](design.md) (the load-bearing design), [`implement.md`](implement.md)
> (what was built + scrutiny points). The originating research lives in the
> Obsidian vault at
> `Projects/Proclivity/Proclivity Obsidian Integration Research 2026-07-05.md`.

---

## 0. TL;DR — where this stands

Proclivity (this MV3 Chrome extension) can now **read roadmaps from the Obsidian
vault** via the Local REST API, **surface them as native Todos + Gantt bars**,
and **write task-completion back** to a per-actor progress journal — all over
loopback HTTP, no network, no new runtime deps.

- **Code: complete, green, pushed.** `main` HEAD = `6edc367`, in sync with
  `origin/main`. `npm run build` exit 0 (initial newtab chunk 305.51 kB gzip
  97.65 kB, under the 400 kB soft ceiling). `npm test` = **27 passed**.
- **Live integration: partially verified on the maintainer's Windows machine.**
  - ✅ Connect (Test connection → 200) — works.
  - ✅ Add roadmap (`readCompiled` 200 + parse) — works.
  - ✅ Ingest → Todos — works (2 gemini-nano spikes appear under Long-term).
  - ✅ Gantt path — proven **empty-correct** (gemini-nano has no dated items;
    chart header renders, zero bars — expected, not a bug).
  - ⛔ **Write-back — NOT yet exercised.** `plans/gemini-nano/progress/proclivity.jsonl`
    does not exist yet. This is THE remaining verification (see §6).
- Working tree has one unrelated dirty file: `M AGENTS.md` (vault-linker
  frontmatter injection from the `.obsidian` PostToolUse hook — leave it or
  commit separately; it is NOT part of Phase G).

---

## 1. What the feature is (mental model)

```
AGENT-OWNED                                   APP-OWNED (Proclivity)
Claude writes → plans/<slug>/roadmap.yaml     plans/<slug>/progress/proclivity.jsonl ← appended on tick
                     │
     vault compiler (.obsidian/roadmap_compile.py, runs on hook + 3h reconcile)
                     ▼
Projects/<Project>/Roadmaps/<slug>/roadmap.compiled.json   ← the ONLY file Proclivity reads
                     │  (Obsidian Local REST API, http://127.0.0.1:27123)
                     ▼
        Proclivity SW proxy → newtab ingest → rm:-prefixed Todos + GanttChart/Tasks
```

- Proclivity **never** parses `roadmap.yaml`; it reads compiled JSON only.
- Plan structure is agent-owned (regenerable). Execution state (done/in-progress)
  lives only in append-only per-actor JSONL journals, merged last-timestamp-wins.
- Mirror records carry a deterministic id so re-sync is an idempotent upsert and
  never collides with native todos (`uid()` is base36, never contains `:`/`#`):
  - Todo / GanttTask: `rm:${srcKey}#${itemId}`
  - GanttChart:       `rm:${srcKey}`   (no `#`)
  - `srcKey = ${repo}/${slug}`

---

## 2. Item → UI mapping (why a given roadmap shows what it shows)

From `src/lib/roadmap/ingest.ts`. **Internalize this — most "nothing shows up"
confusion is explained here, not by a bug.**

| Compiled item kind | Becomes a Todo? | Becomes a Gantt bar? |
|---|---|---|
| `task` / `spike` | **Yes**, unless `proclivity.surface === false` | Yes, **iff** it has both `targetStart` & `targetEnd` |
| `epic` / `milestone` | **No** (structural) | Yes, **iff** dated (both endpoints) |

Additional rules:
- **Scope**: a Todo's scope = per-item `proclivity.scope` (if a valid
  `today|sprint|long`) **else** the pane's default scope. The per-item value
  **overrides** the default — changing the default-scope setting does NOT move an
  item whose compiled `proclivity.scope` is set.
- **Gantt bar requires BOTH dates.** An undated roadmap produces a chart *header
  with zero bars* (correct, not broken).
- `done` is **never** synced from roadmap status into the Todo — that would fight
  write-back and clobber a user tick. A `status: done` spike still ingests as an
  open todo.
- `status: dropped` items → their mirror todo is **closed** (not deleted).

### Worked example: the `gemini-nano` roadmap (what the maintainer tested)
8 items: e1/e2/e3 (epics), m1/m2/m3 (milestones), spike-1, spike-2. **All have
`targetStart/targetEnd: null`**, and both spikes carry `proclivity.scope: "long"`.
Therefore ingest yields **exactly 2 Todos, both Long-term scope**, and **an empty
Gantt**. That is the complete, correct output for this roadmap.

### Roadmaps that DO populate a Gantt (for demoing that path)
Vault `Projects/arXMCP/Roadmaps/<slug>/roadmap.compiled.json`, all same-cased
(`repo` = `arXMCP`, no vault-project override needed):
- `paper-metadata` — 9 items, 2 dated
- `evidence-engine` — 19 items, 4 dated
- `retrieval-unlocks` — 34 items, 9 dated (richest chart)

---

## 3. Files (the whole surface area)

New (`src/lib/roadmap/` unless noted):
| File | Responsibility |
|---|---|
| `types.ts` | Compiled-schema mirror, `ProgressEvent`, `RoadmapSource` (**incl. `vaultProject?`**, see §4), `RoadmapStoreState`, `RoadmapIngestPrefs`, `CollectedRoadmap` |
| `store.ts` | `roadmapStore` over `proclivity:roadmap:v1` (get/set/**patch**/clear/subscribe) + `srcKeyOf`. Sole read/writer for the secret key |
| `../../background/obsidianProxy.ts` | SW-side authenticated fetch. `Authorization: Bearer ${apiKey}` built HERE (see §5 gotcha). GET→read (404→null); append = GET+PUT read-modify-write, **never POST** — the plugin's POST truncates non-indexed files (`.jsonl`), see the fn docblock |
| `client.ts` | Newtab thin client over the SW proxy. **`derivePaths(repo, slug, vaultProject?)`**, `readCompiled`, `appendProgress`, `testConnection`, `normalizeItem` (JSON `null`→omitted) |
| `ingest.ts` | Pure mapping + idempotent reconcile. Mirror-id scheme, `ingestRoadmaps(collected): (s)=>s`. No I/O |
| `sync.ts` | Newtab orchestration: `syncNow()`, `onMirrorToggle()`, offset-aware `isoLocalSeconds()`. Heavy → only `import()`-ed |
| `../../components/settings/panes/RoadmapsPane.tsx` | The Settings → Roadmaps UI (connection, add-source incl. optional vault-project field, per-source toggle/remove, Sync-now, prefs) |
| `client.test.ts`, `ingest.test.ts`, `sync.test.ts`, `store.test.ts`, `../../background/obsidianProxy.test.ts` | 47 unit tests total |
| `../../../vitest.config.ts` | Standalone Vitest config (`@` alias only) |

Modified: `manifest.config.ts` (+`http://127.0.0.1/*` host perm), `src/types/index.ts`
(+`roadmaps` pane id, `UserSettings.roadmap?`), `src/storage/constants.ts`
(`ROADMAP_STORAGE_KEY`, defaults), `src/newtab/App.tsx` (write-back done-detector
+ optional auto-sync), `src/components/settings/{registry.ts,SettingsModal.tsx}`,
`src/background/service-worker.ts` (2nd additive `onMessage` listener),
`package.json`/`package-lock.json` (dev-only `vitest`).

Commit trail (all pushed):
`9bb7183` migrate gemini-nano → roadmap/1 · `696dd15` SW proxy/store/client ·
`a016c8f` reconcile + write-back + tests · `bddabe8` Settings pane + write-back
detector · `8c07e0f` design+impl notes · `f92950b` review rectifications ·
**`6edc367` vaultProject/repo path decoupling (latest)**.

---

## 4. The `vaultProject` fix (commit `6edc367`) — read before touching paths

`derivePaths` builds two vault-relative paths from ONE `repo` string:
```
compiledPath (READ):  Projects/<vaultProject ?? repo>/Roadmaps/<slug>/roadmap.compiled.json
progressPath (WRITE): Source Code/<repo>/plans/<slug>/progress/proclivity.jsonl
```
For **every project the two folder names match** — EXCEPT Proclivity itself: the
Obsidian vault folder is `Projects/Proclivity` (capital P) while the source dir is
`Source Code/proclivity` (lowercase). A single string can't be correct for both;
it only "worked" via case-insensitive Windows FS and would break on the REST API's
own path lookup / a case-sensitive host. Fix: `RoadmapSource.vaultProject?`
overrides only the READ root, defaults to `repo`. **So when adding the Proclivity
self-roadmap, enter repo `proclivity` + vault project `Proclivity`.** Every other
project: leave vault-project blank.

Paths are vault-**relative**; the vault root is `C:\Users\cedar\Documents\Personal
Projects` (confirmed: `.obsidian/` present there). Both `Projects/` and
`Source Code/` are subfolders of that root.

---

## 5. Setup runbook (Chrome + Obsidian on Windows) + gotchas hit

### Load the extension
1. Build if needed: `npm run build` in the repo → outputs `dist/`.
2. `chrome://extensions` → Developer mode ON → **Load unpacked** →
   `C:\Users\cedar\Documents\Personal Projects\Source Code\proclivity\dist`.
3. Open a new tab (it overrides newtab). Rebuild → click ↻ on the card to reload.

### Enable the vault HTTP API
4. Obsidian on the `Personal Projects` vault → Settings → Community plugins →
   install & enable **Local REST API** (by coddingtonbear).
5. In its settings, turn ON **"Enable Non-encrypted (HTTP) Server"** (binds
   `http://127.0.0.1:27123`). **Do NOT use the HTTPS:27124 server** — an MV3
   service worker cannot fetch its self-signed cert (Chromium issue 40882068).
6. Copy the **API key**.

### Connect Proclivity → Settings (gear) → Roadmaps
7. Host `http://127.0.0.1:27123`. API key: pasting the hex alone is still the
   cleanest, but a pasted `Bearer ` prefix is now harmless.
   - ⚠️ **GOTCHA (cost us a 401), now FIXED:** the plugin displays the key as
     `Bearer <hex>`. The extension adds `Bearer ` itself
     (`obsidianProxy.ts`: `Authorization: Bearer ${apiKey}`), so pasting the
     prefix used to produce `Bearer Bearer …` → **401 Unauthorized**.
     `normalizeApiKey` (`store.ts`) now strips it on save (`RoadmapsPane`) AND
     on read (`obsidianProxy`, the sole header-building site) — so a key already
     persisted with the prefix self-heals rather than 401ing until re-saved.
8. **Test connection** → expect "Connected — the vault answered…". Only
   `http://127.0.0.1[:port]` is accepted (Chrome match patterns don't resolve
   `localhost`).
9. Add roadmap → **Sync now** (Add only stores config; Sync ingests).

### ⚠️ GOTCHA: Sprint + Long-term sections ship HIDDEN
`src/storage/constants.ts` (~line 159) — Sprint & Long-term start hidden (Phase-0
decision). Roadmap todos scoped `long` land in a hidden tab → "nothing shows up".
Fix: **Settings → General → Section visibility → enable Long-term** (the Roadmaps
pane shows a nudge when relevant).

---

## 6. THE remaining task — verify write-back end-to-end

Everything above the write-back leg is confirmed. To close Phase G:

1. Ensure BOTH gemini-nano spike todos are visible (Long-term tab).
2. **Tick spike-1.** The newtab detector (`App.tsx`) fires on the `rm:` done-flip
   and `import()`s `sync.onMirrorToggle`, which sends a `ProgressEvent` through
   the SW proxy to `appendProgress`.
   Prefer **spike-1**: `agent.jsonl` already records it `done` (2026-05-11), so a
   proclivity `done` event wins the LWW merge but leaves effective status
   unchanged — full write path, zero semantic change to the plan. Ticking spike-2
   flips a live plan item.
3. **Then tick spike-2 as well, and confirm the journal holds TWO lines** at
   `C:\Users\cedar\Documents\Personal Projects\Source Code\proclivity\plans\gemini-nano\progress\proclivity.jsonl`
   (created on first write, next to the existing `agent.jsonl`). Expect:
   ```json
   {"id":"gemini-nano-spike-1","field":"status","value":"done","at":"2026-07-09T14:23:05-04:00","actor":"proclivity"}
   {"id":"gemini-nano-spike-2","field":"status","value":"done","at":"2026-07-09T14:23:41-04:00","actor":"proclivity"}
   ```
   ⚠️ **The two-tick assertion is the whole point — one tick proves nothing.**
   Appending to a *nonexistent* file yields exactly one line under BOTH correct
   append semantics and the truncating-overwrite bug that the GET→PUT change
   fixed (`obsidianProxy.ts:appendViaReadModifyWrite`), so a single-tick check
   passes either way. If the journal ever holds only the most recent event, the
   SW is truncating and that fix has regressed.

   The `at` MUST be offset-aware ISO seconds (`±HH:MM`) — byte-compatible with the
   Python journal writers so the compiler's last-timestamp-wins merge sorts
   correctly (this was rectification #1 in `implement.md`). The compiler compares
   `at` as a **string** (`str(e["at"]) >= str(latest[k]["at"])` in
   `roadmap_compile.py`), so `agent.jsonl`'s date-only values and proclivity's
   offset-aware values interleave correctly without a naive-vs-aware `TypeError`.
4. **Suppression checks** (write-back must NOT fire for non-user events):
   - Un-ticking, then a Sync — no resurrecting event for source-`dropped` items.
     (Note: un-ticking spike-1 journals `in_progress` and DOES flip its effective
     status — do this last, or on a throwaway item.)
   - Ticking a mirror whose source item was removed / whose source is disabled →
     suppressed (`shouldSuppressWriteBack`, `sync.ts`).

If the append 404s or misplaces, the first suspect is a path/casing mismatch —
re-check §4 and `derivePaths`.

---

## 7. Scrutiny points carried over from `implement.md` (still worth a live eye)
1. `derivePaths` roots (now split via `vaultProject`) — the most likely live break.
2. Write-back trigger vs ingest-driven closes — confirm no non-user status is journalled.
3. `scope`/`notes` are ingest-owned on CREATE; re-sync preserves user re-scoping & notes (unless `summary` present). `done`/`tags`/`sprintId`/timestamps preserved.
4. Compiled-schema fidelity — camelCase, `targetStart/End` epoch-ms local-midnight, `progress` 0-100. Client validator is permissive; ingest defends per-field.
5. 2nd SW `onMessage` listener returns `false` for non-obsidian msgs so the Photos proxy still answers.
6. Secret hygiene — API key only in `proclivity:roadmap:v1`, read SW-side; message payloads carry only `relPath`/`line`; never in `ProclivityState`/export.
7. `roadmapStore.patch` write-chain serializes concurrent RMW callers.

---

## 8. Backlog / not-yet-done

**Small hardening:**
1. ~~Strip a leading `Bearer ` (+ trim) when saving the API key~~ — **DONE.**
   `normalizeApiKey` lives in `store.ts` (with the key it guards, not beside
   `normalizeHost` as originally sketched) and is applied at both `RoadmapsPane`
   save sites *and* in `obsidianProxy` where the header is built, so existing
   bad state self-heals. 8 unit tests in `store.test.ts` + 2 in
   `obsidianProxy.test.ts`.

**Open decisions from the research §7 (unresolved):**
- Canvas vs Excalidraw render target (schema is render-agnostic; current reality is Canvas).
- Write-back v1: direct REST append (implemented) vs manual export — keep direct.
- Gantt panel fate: retire vs repoint at roadmap milestones — leaning repoint.
- Old prose roadmaps: migrate to `roadmap/1` vs coexist (coexistence is safe; Bases key on `type: roadmap`).

**Deferred future phases (research §6):**
- Phase 2/3: loopback FastAPI daemon + WebSocket badge push (SW-held socket,
  Chrome 116+), daily-note `rm:<id>` completion harvest, full sprint-code retirement.

**Content, not code:** gemini-nano `roadmap.yaml` is at `phase: sequenced`,
`status: active` (3/5 now-items done). To see it on the Gantt, add
`target_start`/`target_end` to m1/m2/m3 and recompile (a real plan edit — get
maintainer sign-off on dates first).

---

## 9. Quick commands

```bash
# from C:\Users\cedar\Documents\Personal Projects\Source Code\proclivity
npm run build          # tsc -b && vite build  (must be exit 0)
npm test               # vitest run  (expect 27 passed)
git log --oneline -8   # confirm HEAD = 6edc367 (or later)
```

Vault sanity (PowerShell):
```powershell
Test-Path "C:\Users\cedar\Documents\Personal Projects\.obsidian"   # vault root
Get-Content "C:\Users\cedar\Documents\Personal Projects\Source Code\proclivity\plans\gemini-nano\progress\proclivity.jsonl"  # write-back proof (does not exist until first tick)
```
