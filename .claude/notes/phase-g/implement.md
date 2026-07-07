# Phase G — Roadmap Ingest & Write-Back — Implementation Notes

Status: implemented, `npm run build` green, unit tests green. Live Chrome +
live-vault verification is deferred to the user (a headless agent cannot drive
Chrome or reach the Obsidian Local REST API) — see design §7.

## Build / test result

- `npm run build` (`tsc -b && vite build`): **PASS**, 2353 modules, built in ~3.8s.
- **Initial newtab chunk**: `dist/assets/index.html-*.js` = **305.51 kB**
  (gzip 97.64 kB). Under the 400 kB soft / 500 kB hard ceiling. `MeshBackground`
  (823 kB) remains the only heavy chunk and stays lazy.
- Roadmap code is correctly split OUT of the initial chunk:
  `sync-*.js` (4.71 kB), `client-*.js` (1.85 kB), roadmap `store-*.js` (1.29 kB),
  and `closedTodos-*.js` (pulled by `ingest.ts`) are all separate lazy/SW chunks.
  The only initial-chunk addition is the tiny write-back done-transition detector
  in `App.tsx`, which `import()`s `sync.ts` on demand.
- `npm run test` (`vitest run`): **16 passed** (13 ingest + 3 sync).

## Files created

| File | Responsibility |
|---|---|
| `src/lib/roadmap/types.ts` | Mirror of the compiled schema (`CompiledRoadmap`, `CompiledItem`, `ItemKind`/`ItemStatus`/`Lane`/`Priority`), the journal `ProgressEvent`, and `RoadmapSource`/`RoadmapStoreState`/`RoadmapIngestPrefs`/`CollectedRoadmap`. Enums mirror `.claude/scripts/roadmap-schema.json`. |
| `src/lib/roadmap/store.ts` | `roadmapStore` over `proclivity:roadmap:v1` (get/set/**patch**/clear/subscribe) + `EMPTY_ROADMAP_STATE` + `srcKeyOf`. Sole read/writer for the key; `patch()` serializes read-modify-write through a promise chain (it has several concurrent RMW callers, unlike the single-writer photos cache). |
| `src/background/obsidianProxy.ts` | SW-side authenticated fetch. `ObsidianRequest`/`ObsidianResponse` wire types, `isObsidianRequest` guard, `handleObsidianMessage` (reads host+key from `roadmapStore` itself; GET→read, POST→append; 404→`body:null`, network→`status:0`). |
| `src/lib/roadmap/client.ts` | Newtab thin client over the SW proxy (mirrors `imageCache.fetchMediaViaSw`). `derivePaths`, `readCompiled` (404→null, JSON.parse + minimal validation), `appendProgress`, `testConnection`. |
| `src/lib/roadmap/ingest.ts` | Pure mapping + the single idempotent reconcile updater. Mirror-id scheme (`mkTodoId`/`mkChartId`/`isMirrorId`/`parseMirrorId`), `ingestRoadmaps(collected): (s)=>s`. No I/O. |
| `src/lib/roadmap/sync.ts` | Newtab orchestration. `syncNow()`, `onMirrorToggle()`, `isoLocalSeconds()`. Heavy (statically pulls `ingest.ts`) → only ever `import()`-ed. |
| `src/components/settings/panes/RoadmapsPane.tsx` | The Settings pane: connection (host/key + Save + Test), Add-roadmap (repo+slug → validate GET → store source), per-source enable/remove, Sync-now (dynamic-imports `sync.ts`), last-sync status, long-term-hidden nudge, and the three non-secret prefs. |
| `src/lib/roadmap/ingest.test.ts` | 13 unit tests: id scheme, idempotency, no-clobber, task/spike-only, dropped→close (incl. re-create-then-re-close), gantt build/parent-link/containment-clamp/prune/createdAt-preserve. |
| `src/lib/roadmap/sync.test.ts` | 3 unit tests: `isoLocalSeconds` local wall-clock format, zero-padding, no-`Z`. |
| `vitest.config.ts` | Standalone Vitest config (mirrors only the `@` alias; does NOT load the crx/react build plugins). |

## Files modified

| File | Change |
|---|---|
| `manifest.config.ts` | Added `"http://127.0.0.1/*"` to `host_permissions` (port-less → covers :27123) with a rationale comment. |
| `src/types/index.ts` | `SettingsPaneId += "roadmaps"`; `UserSettings.roadmap?` (nested optional); `ResolvedUserSettings.roadmap`. |
| `src/storage/constants.ts` | `ROADMAP_STORAGE_KEY`; `DEFAULT_SETTINGS.roadmap`; `resolvedSettings()` roadmap merge block. |
| `src/newtab/App.tsx` | `SETTINGS_PANE_IDS += "roadmaps"`; write-back done-transition detector effect; optional auto-sync-on-open effect; `storage` import. |
| `src/components/settings/panes/registry.ts` | `PANE_ORDER += { id: "roadmaps", label: "Roadmaps" }`. |
| `src/components/settings/SettingsModal.tsx` | Import `RoadmapsPane`; `case "roadmaps"`. |
| `src/background/service-worker.ts` | Import proxy; second additive `onMessage` listener (guards on `isObsidianRequest`, else `return false`). |
| `package.json` | `vitest` devDep (^3.2.7) + `"test": "vitest run"` script. |
| `package-lock.json` | vitest dependency tree (33 packages, dev-only, never bundled). |

## What was built vs deferred

**Built (and verified by build + unit tests):**
- The full ingest/reconcile pipeline (types → store → SW proxy → client → pure
  ingest → sync orchestration → Settings pane → newtab write-back detector).
- Idempotent, field-scoped, no-clobber reconcile with dropped→close and
  wholesale gantt replace + containment clamp — all unit-guarded.
- Write-back append path with the persisted dedup cursor and local-ISO
  timestamp.

**Deferred to the user at a real machine (design §7 — cannot be done headless):**
- Installing/enabling the Obsidian Local REST API plugin + HTTP server, copying
  the key, reloading the unpacked extension.
- The live CORS-bypass proof against the running plugin, real ingest render,
  gantt bar placement (the local-midnight tz assumption), and a real write-back
  landing one line in `proclivity.jsonl`.

## Decisions that deviate from / extend the design (scrutinize these)

1. **Added dev-only `vitest`.** The design mandated unit guards but the repo had
   no test runner, and Node 24's native TS runner cannot resolve the repo's `@/`
   alias or extensionless imports (so the real reconcile — which reuses
   `closeTodo`, whose transitive graph uses extensionless imports — is not
   runnable under bare `node:test`). `vitest` is dev-only and never enters the
   bundle. If this dependency is unwanted, the tests + `vitest.config.ts` +
   `test` script can be dropped without touching production code.

2. **Dropped-mirror write-back suppression (NOT in the design text).** The
   App.tsx done-transition detector fires on ANY `rm:` `done` flip — including
   the flip caused by ingest **closing a dropped item**. Left unhandled, that
   would append a spurious `{field:"status",value:"done"}` for an item the
   SOURCE dropped (wrong, and against the spirit of roadmap fidelity). `syncNow`
   therefore seeds `writtenBack[mirrorId] = "done"` for every dropped task/spike
   mirror **before** the ingest write, so the subsequent detector call dedups
   and journals nothing. Trade-off: if a dropped item is later un-dropped and
   the user then ticks it, the seeded cursor suppresses that first "done" write.
   This is an edge of the design's documented drop/un-drop asymmetry.

## Things Phase-G reviewers should scrutinize

1. **`derivePaths` root asymmetry (most likely live-test failure point).** Per
   design §4.2 the compiled JSON and the progress journal live under DIFFERENT
   vault subtrees:
   `compiledPath = Projects/<repo>/Roadmaps/<slug>/roadmap.compiled.json`
   vs `progressPath = Source Code/<repo>/plans/<slug>/progress/proclivity.jsonl`.
   Implemented verbatim. If the real vault serves the compiled file from the
   `Source Code/.../plans/<slug>/` tree instead, `readCompiled` will 404 and
   this is the one line to change (`src/lib/roadmap/client.ts`).
2. **Write-back trigger vs ingest-driven closes** — the seeding fix above.
   Confirm no code path can still journal a non-user-initiated status.
3. **`scope`/`notes` are ingest-owned** — a re-sync resets a mirror todo's
   `scope` to `defaultScope` and drives `notes` from `item.summary` (deleting
   notes when there is no summary). Confirm this matches intent (design §5 step 1
   lists both as ingest-owned). `done`/`tags`/`sprintId`/`completedAt`/`closedAt`
   and close checkpoints are preserved.
4. **Compiled-schema fidelity** — `types.ts`/`ingest.ts` assume the compiled
   form is camelCased (`targetStart`/`targetEnd` as epoch-ms local-midnight,
   `progress` 0-100 int). Verify against a real `roadmap.compiled.json`; the
   client validator is intentionally permissive and defends per-field in ingest.
5. **Second SW `onMessage` listener composition** — confirm the additive
   listener returns `false` for non-obsidian messages so the photos listener
   still answers (both guarded; verified by build, not by a live SW round-trip).
6. **Secret hygiene** — the API key lives only in `proclivity:roadmap:v1` and is
   read SW-side; the message payload carries only `relPath`/`line`. Confirm no
   path leaks it into `ProclivityState`/export.
7. **`roadmapStore.patch` write-chain** — added to avoid lost updates between
   concurrent RMW callers (sync `lastSync*`, write-back cursor, pane edits).
   Confirm the chain semantics are sound.
