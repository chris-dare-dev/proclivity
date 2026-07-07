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
 * proclivity writer, `at` is a local ISO-8601 seconds string (NO `Z`/offset —
 * matches Python `datetime.isoformat(timespec="seconds")` on a naive local
 * datetime so it sorts lexicographically against agent/obsidian events under
 * last-timestamp-wins), and `actor` is always `"proclivity"`.
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
