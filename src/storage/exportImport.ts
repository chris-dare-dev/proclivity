import { EMPTY_STATE, type ProclivityState, type Reminder, type Todo } from "@/types";
import { storage } from "./storage";

/** Current export envelope schema. Bump when ProclivityState changes shape. */
export const CURRENT_SCHEMA_VERSION = 1;

export interface ProclivityExport {
  /** Integer schema version. Increment when ProclivityState shape changes
   *  in a breaking way. Import logic runs migrations up to the current. */
  schemaVersion: number;
  /** Informational — the extension version at time of export. */
  appVersion: string;
  /** ISO 8601 timestamp. Human-readable; not used by import logic. */
  exportedAt: string;
  /** The full ProclivityState verbatim, as of the export moment. */
  data: ProclivityState;
}

export type ImportResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Export the current ProclivityState as a downloaded JSON file.
 * Triggers a browser download via an object URL.
 */
export async function exportData(): Promise<void> {
  const state = await storage.get();
  const envelope: ProclivityExport = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    appVersion: getAppVersion(),
    exportedAt: new Date().toISOString(),
    data: state,
  };
  const json = JSON.stringify(envelope, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `proclivity-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Import a previously-exported backup file. Validates the envelope
 * shape and schema version, then replaces the entire state.
 */
export async function importData(file: File): Promise<ImportResult> {
  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, error: "Could not read the file." };
  }

  let envelope: unknown;
  try {
    envelope = JSON.parse(text);
  } catch {
    return {
      ok: false,
      error:
        "File could not be parsed. Make sure it's a valid Proclivity backup (.json).",
    };
  }

  if (
    typeof envelope !== "object" ||
    envelope === null ||
    !("schemaVersion" in envelope) ||
    typeof (envelope as Record<string, unknown>).schemaVersion !== "number" ||
    !("data" in envelope)
  ) {
    return {
      ok: false,
      error: "This doesn't look like a Proclivity backup file.",
    };
  }

  const env = envelope as { schemaVersion: number; data: unknown };
  if (env.schemaVersion > CURRENT_SCHEMA_VERSION) {
    return {
      ok: false,
      error:
        "This backup was made with a newer version of Proclivity and cannot be imported. Update the extension to restore this backup.",
    };
  }

  const data = env.data;
  if (typeof data !== "object" || data === null) {
    return { ok: false, error: "Backup data is missing or malformed." };
  }

  // For schemaVersion === 1 the shape matches ProclivityState directly.
  // Future migration logic would live here.
  const raw = data as Partial<ProclivityState>;
  const merged: ProclivityState = { ...EMPTY_STATE, ...raw };

  // The import path calls storage.set() directly, bypassing storage.get()'s
  // backfill logic. We must normalise tags here too, otherwise code that runs
  // before the next page reload will hit `todo.tags.includes(...)` on undefined.
  //
  // Additionally, drop any tag-id references in items that don't exist in the
  // imported state.tags array, and warn so the user can diagnose import issues.
  const knownTagIds = new Set((merged.tags ?? []).map((t) => t.id));

  merged.todos = merged.todos.map((t) => {
    const raw = t as Todo & { tags?: string[] };
    const existingTags = raw.tags ?? [];
    const validTags = existingTags.filter((id) => {
      if (knownTagIds.has(id)) return true;
      console.warn(`[proclivity] import: dropping unknown tag id "${id}" from todo "${t.id}"`);
      return false;
    });
    return { ...t, tags: validTags };
  });

  merged.reminders = merged.reminders.map((r) => {
    const raw = r as Reminder & { tags?: string[] };
    const existingTags = raw.tags ?? [];
    const validTags = existingTags.filter((id) => {
      if (knownTagIds.has(id)) return true;
      console.warn(`[proclivity] import: dropping unknown tag id "${id}" from reminder "${r.id}"`);
      return false;
    });
    return { ...r, tags: validTags };
  });

  await storage.set(merged);
  return { ok: true };
}

/**
 * Read the extension version from the runtime manifest. Falls back to a
 * placeholder string when running outside the extension context (e.g.
 * Vite preview).
 */
function getAppVersion(): string {
  if (typeof chrome !== "undefined" && chrome.runtime?.getManifest) {
    try {
      return chrome.runtime.getManifest().version ?? "unknown";
    } catch {
      return "unknown";
    }
  }
  return "unknown";
}
