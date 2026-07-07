/**
 * TypeScript mirror of the vault-side `roadmap.compiled.json` schema plus the
 * Proclivity-owned config/journal shapes. This module is **ingest-domain
 * only** — it is deliberately kept OUT of `src/types/index.ts` so the main
 * app-state types stay focused on the React tree. Nothing here is added to
 * `ProclivityState`; roadmap items ride the existing `Todo` / `GanttChart` /
 * `GanttTask` arrays as ordinary records carrying a deterministic `rm:` id.
 *
 * The compiled schema is produced by the arXMCP/personal-website roadmap
 * compiler from the canonical `roadmap.yaml` (roadmap/1). The enums below
 * mirror `.claude/scripts/roadmap-schema.json`; the compiled form camelCases
 * the date fields and pre-resolves them to epoch-ms of local-midnight
 * (`iso_to_ms`), and pre-computes `progress` as a 0-100 integer.
 *
 * All fields the ingest does not strictly consume are declared optional and
 * permissive — the JSON is read from an external file we do not control, so
 * `ingest.ts` / `client.ts` treat every field defensively.
 */

/** Structural role of a roadmap item (roadmap-schema.json `item.kind`). */
export type ItemKind = "epic" | "milestone" | "task" | "spike";

/** Lifecycle status (roadmap-schema.json `item.status`). */
export type ItemStatus =
  | "planned"
  | "ready"
  | "in_progress"
  | "blocked"
  | "done"
  | "dropped";

/** Horizon lane (roadmap-schema.json `item.lane`). */
export type Lane = "now" | "next" | "later";

/** MoSCoW priority (roadmap-schema.json `item.priority`). */
export type Priority = "must" | "should" | "could" | "wont";

/**
 * One compiled roadmap item. `id`, `kind`, `title` are always present
 * (schema `required`); everything else is optional and defended against at
 * the ingest boundary.
 */
export interface CompiledItem {
  id: string;
  kind: ItemKind;
  title: string;
  status?: ItemStatus | undefined;
  parent?: string | undefined;
  summary?: string | undefined;
  lane?: Lane | undefined;
  priority?: Priority | undefined;
  /** 0-100 integer completion, pre-computed by the compiler. */
  progress?: number | undefined;
  /** Epoch-ms of local-midnight (compiler `iso_to_ms` of `target_start`). */
  targetStart?: number | undefined;
  /** Epoch-ms of local-midnight (compiler `iso_to_ms` of `target_end`). */
  targetEnd?: number | undefined;
  /**
   * Per-item Proclivity hints — the compiler emits `proclivity:{scope,surface}`
   * on EVERY item (`roadmap_compile.py` `render_compiled`, defaults
   * `scope:"long"`, `surface:true`). `scope` (a `TodoScope`) overrides the
   * global `defaultScope` for this item's mirror todo when present; `surface`
   * `false` suppresses the Todo mirror entirely (the item may still appear as a
   * Gantt bar when it is dated + `surfaceInGantt`). `scope` is typed `string`
   * because the JSON is external/untrusted — it is validated at the ingest
   * boundary against the valid `TodoScope` set.
   */
  proclivity?:
    | { scope?: string | undefined; surface?: boolean | undefined }
    | undefined;
}

/** The compiled roadmap document (`roadmap.compiled.json`). */
export interface CompiledRoadmap {
  slug: string;
  title: string;
  items: CompiledItem[];
}

/**
 * One line appended to the vault progress journal (`proclivity.jsonl`). Shape
 * is exactly what the roadmap compiler re-harvests: `id` is the **compiled
 * item id** (not the mirror todo id), `field` is always `"status"` for the
 * proclivity writer, `at` is an OFFSET-AWARE local ISO-8601 seconds string
 * (e.g. `2026-07-06T14:23:05-04:00`) — byte-for-byte the shape Python emits via
 * `datetime.now().astimezone().isoformat(timespec="seconds")` in BOTH the vault
 * compiler harvest (`roadmap_compile.py`) and the agent journal writer
 * (`milestone-pipeline-record-progress.py`). The compiler folds journals
 * last-timestamp-wins by *string-comparing* `at`, so proclivity MUST emit the
 * same offset-aware format or its events would mis-sort against agent/obsidian
 * events. `actor` is always `"proclivity"`.
 */
export interface ProgressEvent {
  id: string;
  field: "status";
  value: "done" | "in_progress";
  at: string;
  actor: "proclivity";
}

/**
 * A configured roadmap source. Paths are DERIVED from `repo`/`slug` (see
 * `client.derivePaths`), never stored, to avoid drift.
 */
export interface RoadmapSource {
  /** Source Code dir name, case-preserved, e.g. "arXMCP". */
  repo: string;
  /** plans subdir / compiled.slug, e.g. "paper-metadata". */
  slug: string;
  /** Cached from `compiled.title` for display only; null until first read. */
  title: string | null;
  enabled: boolean;
}

/**
 * The dedicated `chrome.storage.local` payload for roadmap config +
 * write-back bookkeeping. Deliberately OUTSIDE `ProclivityState` (and thus the
 * React tree and the export blob) so the API key never lands in a backup —
 * exactly mirroring `PhotosState`/`PHOTOS_STORAGE_KEY`.
 */
export interface RoadmapStoreState {
  /** e.g. "http://127.0.0.1:27123". */
  host: string;
  /** Obsidian Local REST API bearer token. */
  apiKey: string;
  sources: RoadmapSource[];
  /** mirrorId → last journalled value; the write-back dedup cursor. */
  writtenBack: Record<string, "done" | "in_progress">;
  /**
   * Mirror ids whose SOURCE item was `dropped` at the last sync. Write-back is
   * suppressed for these so a user reopening (or ingest un-closing) a dropped
   * mirror never POSTs a resurrecting event to the vault journal.
   */
  droppedMirrors: string[];
  /**
   * Mirror ids of the actionable (task/spike) items present in the last-ingested
   * set, refreshed per collected source. A toggle on a mirror whose srcKey is
   * represented here but whose id is absent (the source item was removed from
   * the roadmap) is suppressed — a stale mirror must not write back.
   */
  knownMirrors: string[];
  lastSyncAt: number | null;
  lastSyncError: string | null;
}

/** Non-secret ingest preferences resolved from `UserSettings.roadmap`. */
export interface RoadmapIngestPrefs {
  defaultScope: "today" | "sprint" | "long";
  surfaceInGantt: boolean;
}

/** One roadmap collected by `sync.readCompiled`, ready for `ingestRoadmaps`. */
export interface CollectedRoadmap {
  /** `${repo}/${slug}` — the mirror-id namespace key. */
  srcKey: string;
  compiled: CompiledRoadmap;
  prefs: RoadmapIngestPrefs;
}
