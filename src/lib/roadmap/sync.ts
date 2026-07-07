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
  RoadmapStoreState,
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
 * OFFSET-AWARE local ISO-8601 to seconds precision, e.g. `2026-07-06T14:23:05-04:00`.
 * This is byte-for-byte the shape Python emits via
 * `datetime.now().astimezone().isoformat(timespec="seconds")` in BOTH the vault
 * compiler harvest (`roadmap_compile.py`) and the agent journal writer
 * (`milestone-pipeline-record-progress.py`). The compiler folds journals
 * last-timestamp-wins by *string-comparing* `at`, so proclivity MUST include the
 * same trailing offset or its events would mis-sort against agent/obsidian
 * events. Never `toISOString()` (that is UTC + `Z`, which sorts differently).
 */
export function isoLocalSeconds(d: Date = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, "0");
  // getTimezoneOffset() is minutes BEHIND UTC (EDT → 240), so negate it to get
  // minutes east of UTC and render Python's `±HH:MM` (never `Z`, even at UTC).
  const offMin = -d.getTimezoneOffset();
  const sign = offMin >= 0 ? "+" : "-";
  const absMin = Math.abs(offMin);
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}` +
    `${sign}${p(Math.floor(absMin / 60))}:${p(absMin % 60)}`
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

  // Snapshot the last-ingested set for write-back suppression, and seed the
  // write-back cursor for DROPPED mirrors — BOTH persisted BEFORE the ingest
  // write so the App.tsx done-transition detector (which fires off the ingest
  // write) dedups the ingest-driven close and does NOT journal a spurious
  // "done" for an item the SOURCE dropped. `knownMirrors`/`droppedMirrors` then
  // also suppress a *later* user reopen of a dropped/removed mirror.
  // (Write-back must reflect live user ticks only, never ingest-driven closes.)
  const collectedKeys = new Set(collected.map((c) => c.srcKey));
  const knownMirrors: string[] = [];
  const droppedMirrors: string[] = [];
  for (const c of collected) {
    for (const item of c.compiled.items) {
      if (item.kind !== "task" && item.kind !== "spike") continue;
      const mid = mkTodoId(c.srcKey, item.id);
      knownMirrors.push(mid);
      if (item.status === "dropped") droppedMirrors.push(mid);
    }
  }

  if (collected.length > 0) {
    await roadmapStore.patch((cur) => {
      // Keep entries for sources NOT collected this run (e.g. a transiently
      // unreadable source), replace those for the srcKeys we did collect.
      const keepOther = (arr: string[] | undefined): string[] =>
        (arr ?? []).filter((m) => {
          const k = parseMirrorId(m)?.srcKey;
          return k === undefined || !collectedKeys.has(k);
        });
      const wb: Record<string, "done" | "in_progress"> = {
        ...cur.writtenBack,
      };
      for (const id of droppedMirrors) wb[id] = "done";
      return {
        writtenBack: wb,
        knownMirrors: [...keepOther(cur.knownMirrors), ...knownMirrors],
        droppedMirrors: [...keepOther(cur.droppedMirrors), ...droppedMirrors],
      };
    });
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
 * True when a mirror toggle must NOT write back to the vault journal. Write-back
 * reflects live, user-owned mirrors only, so it is suppressed when the mirror's
 * source is:
 *   - unknown / removed / DISABLED (no live source to report to), OR
 *   - `dropped` at the last sync (reopening it must never resurrect it), OR
 *   - absent from the last-ingested set for its srcKey (the source item was
 *     deleted from the roadmap → the mirror is stale).
 *
 * Pure + config-only so it is unit-testable without a live store/SW.
 */
export function shouldSuppressWriteBack(
  cfg: RoadmapStoreState,
  mirrorId: string,
): boolean {
  const parsed = parseMirrorId(mirrorId);
  if (!parsed) return true;
  const source = cfg.sources.find((s) => srcKeyOf(s) === parsed.srcKey);
  if (!source || !source.enabled) return true; // unknown / removed / disabled
  const dropped = cfg.droppedMirrors ?? [];
  if (dropped.includes(mirrorId)) return true; // source item is dropped
  const known = cfg.knownMirrors ?? [];
  const srcHasKnown = known.some(
    (m) => parseMirrorId(m)?.srcKey === parsed.srcKey,
  );
  // Only suppress-as-removed once we actually have a known set for this srcKey
  // (else a pre-snapshot / transiently-unread source would false-suppress).
  if (srcHasKnown && !known.includes(mirrorId)) return true;
  return false;
}

/**
 * Write-back: a mirror todo's `done` flag transitioned (user tick / reopen).
 * Appends exactly one `proclivity.jsonl` line, deduped via the persisted
 * `writtenBack` cursor so reopening-a-never-completed item, re-ticking, and
 * ingest-driven closes never spam the journal. Suppressed entirely for dropped
 * / removed / disabled sources (see `shouldSuppressWriteBack`).
 */
export async function onMirrorToggle(
  mirrorId: string,
  done: boolean,
): Promise<void> {
  const parsed = parseMirrorId(mirrorId);
  if (!parsed) return;

  const cfg = await roadmapStore.get();
  if (shouldSuppressWriteBack(cfg, mirrorId)) return;

  const source = cfg.sources.find((s) => srcKeyOf(s) === parsed.srcKey);
  if (!source) return; // already ensured by shouldSuppressWriteBack; narrows TS

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
