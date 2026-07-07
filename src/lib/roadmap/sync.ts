/**
 * Roadmap sync orchestration (newtab side). Heavy: it statically pulls
 * `ingest.ts`, so it is ONLY ever reached via `import()` on demand (Settings
 * Sync-now button, the App.tsx done-transition detector, and optional
 * auto-sync-on-open) — never from the initial newtab chunk.
 *
 *   - `syncNow()`      read every enabled source → one atomic ingest write.
 *   - `onMirrorToggle` append a single progress line when a mirror todo is
 *                      ticked / reopened by the user (write-back).
 */

import { storage } from "@/storage/storage";
import { resolvedSettings } from "@/storage/constants";
import { roadmapStore, srcKeyOf } from "./store";
import { appendProgress, derivePaths, readCompiled } from "./client";
import { ingestRoadmaps, mkTodoId, parseMirrorId } from "./ingest";
import type {
  CollectedRoadmap,
  ProgressEvent,
  RoadmapIngestPrefs,
} from "./types";

export interface SyncResult {
  ok: boolean;
  /** Roadmaps actually ingested (compiled file present + parsed). */
  synced: number;
  /** Enabled sources attempted. */
  sources: number;
  errors: string[];
}

/**
 * Local ISO-8601 to seconds precision, NO `Z`/offset — matches Python
 * `datetime.isoformat(timespec="seconds")` on a naive local datetime so the
 * journal sorts lexicographically against agent/obsidian events under the
 * compiler's last-timestamp-wins merge. Never `toISOString()` (that is UTC+Z).
 */
export function isoLocalSeconds(d: Date = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  );
}

/**
 * Read config → read each enabled source's compiled roadmap → apply one atomic
 * `ingestRoadmaps` write → persist lastSync status + cache source titles.
 */
export async function syncNow(): Promise<SyncResult> {
  const cfg = await roadmapStore.get();
  const enabled = cfg.sources.filter((s) => s.enabled);
  if (enabled.length === 0) {
    await roadmapStore.patch(() => ({
      lastSyncAt: Date.now(),
      lastSyncError: null,
    }));
    return { ok: true, synced: 0, sources: 0, errors: [] };
  }

  const rs = resolvedSettings((await storage.get()).settings);
  const prefs: RoadmapIngestPrefs = {
    defaultScope: rs.roadmap.defaultScope,
    surfaceInGantt: rs.roadmap.surfaceInGantt,
  };

  const collected: CollectedRoadmap[] = [];
  const errors: string[] = [];
  const titleUpdates = new Map<string, string>();

  for (const source of enabled) {
    const srcKey = srcKeyOf(source);
    try {
      const compiled = await readCompiled(source);
      if (compiled) {
        collected.push({ srcKey, compiled, prefs });
        titleUpdates.set(srcKey, compiled.title);
      } else {
        const { compiledPath } = derivePaths(source.repo, source.slug);
        errors.push(`${srcKey}: compiled roadmap not found (${compiledPath}).`);
      }
    } catch (e) {
      errors.push(`${srcKey}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Seed the write-back cursor for DROPPED mirrors BEFORE the ingest write, so
  // the App.tsx done-transition detector dedups the ingest-driven close and
  // does NOT journal a spurious "done" back for an item the SOURCE dropped.
  // (Write-back must reflect user ticks only, never ingest-driven closes.)
  const droppedIds: string[] = [];
  for (const c of collected) {
    for (const item of c.compiled.items) {
      if (
        (item.kind === "task" || item.kind === "spike") &&
        item.status === "dropped"
      ) {
        droppedIds.push(mkTodoId(c.srcKey, item.id));
      }
    }
  }

  if (collected.length > 0) {
    if (droppedIds.length > 0) {
      await roadmapStore.patch((cur) => {
        const wb: Record<string, "done" | "in_progress"> = {
          ...cur.writtenBack,
        };
        for (const id of droppedIds) wb[id] = "done";
        return { writtenBack: wb };
      });
    }
    await storage.update(ingestRoadmaps(collected));
  }

  await roadmapStore.patch((cur) => ({
    sources: cur.sources.map((s) => {
      const t = titleUpdates.get(srcKeyOf(s));
      return t !== undefined ? { ...s, title: t } : s;
    }),
    lastSyncAt: Date.now(),
    lastSyncError: errors.length > 0 ? errors.join(" | ") : null,
  }));

  return {
    ok: errors.length === 0,
    synced: collected.length,
    sources: enabled.length,
    errors,
  };
}

/**
 * Write-back: a mirror todo's `done` flag transitioned (user tick / reopen).
 * Appends exactly one `proclivity.jsonl` line, deduped via the persisted
 * `writtenBack` cursor so reopening-a-never-completed item, re-ticking, and
 * ingest-driven closes never spam the journal.
 */
export async function onMirrorToggle(
  mirrorId: string,
  done: boolean,
): Promise<void> {
  const parsed = parseMirrorId(mirrorId);
  if (!parsed) return;

  const cfg = await roadmapStore.get();
  const source = cfg.sources.find((s) => srcKeyOf(s) === parsed.srcKey);
  if (!source) return; // unknown / removed source → no-op

  const cursor = cfg.writtenBack[mirrorId];
  let value: "done" | "in_progress";
  if (done) {
    if (cursor === "done") return; // already recorded
    value = "done";
  } else {
    // Reopen: only journal if it was previously marked done (else there is
    // nothing to revert — a freshly-ingested todo has no cursor and emits
    // nothing).
    if (cursor === undefined || cursor === "in_progress") return;
    value = "in_progress";
  }

  const event: ProgressEvent = {
    id: parsed.itemId, // COMPILED item id, not the mirror todo id
    field: "status",
    value,
    at: isoLocalSeconds(),
    actor: "proclivity",
  };

  try {
    await appendProgress(source, event);
  } catch (e) {
    // Leave the cursor unchanged → retried on the next toggle/sync. Surface
    // the failure for the Settings pane.
    await roadmapStore.patch(() => ({
      lastSyncError: `Write-back failed for ${parsed.itemId}: ${
        e instanceof Error ? e.message : String(e)
      }`,
    }));
    return;
  }

  await roadmapStore.patch((cur) => ({
    writtenBack: { ...cur.writtenBack, [mirrorId]: value },
  }));
}
