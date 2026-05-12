/**
 * tags.ts — Tag CRUD helpers and filter utility.
 *
 * All mutations route through storage.update() so they are serialised in the
 * existing write chain and observed by all tabs via the storage.subscribe()
 * change listener.
 *
 * Tag CRUD is extracted from section components because the same operations
 * are needed in at least four places (Today, Sprint, LongTerm, Reminders,
 * Settings). Keeping them here avoids duplication and provides a single
 * test surface.
 */

import { storage, uid } from "./storage";
import type { Tag } from "@/types";

// ── Tag presets ────────────────────────────────────────────────────────────
// Reuses the same 8 hex values as ACCENT_PRESETS in SettingsModal.tsx so the
// project has one canonical palette. These are exported so the picker and the
// Settings swatch grid can stay in sync.

export const TAG_COLOR_PRESETS: ReadonlyArray<{ name: string; value: string }> = [
  { name: "Indigo", value: "#7c9cff" },
  { name: "Teal", value: "#5be3c3" },
  { name: "Rose", value: "#ff6b9d" },
  { name: "Amber", value: "#ffb86b" },
  { name: "Violet", value: "#a78bfa" },
  { name: "Sky", value: "#38bdf8" },
  { name: "Lime", value: "#86efac" },
  { name: "Orange", value: "#fb923c" },
] as const;

/** Default hex used when no color has been chosen. */
export const DEFAULT_TAG_COLOR = TAG_COLOR_PRESETS[0]!.value;

// ── CRUD ───────────────────────────────────────────────────────────────────

/**
 * Create a new tag and append it to state.tags. Returns the created Tag.
 * If no color is supplied the first preset is used.
 */
export async function createTag(label: string, color?: string): Promise<Tag> {
  const id = uid();
  const finalColor = (color && color.trim()) ? color : DEFAULT_TAG_COLOR;
  const tag: Tag = { id, label: label.trim(), color: finalColor };
  await storage.update((s) => ({
    ...s,
    tags: [...s.tags, tag],
  }));
  return tag;
}

/**
 * Rename an existing tag. No-op if the id does not exist.
 * Duplicate-label check is left to the caller (UI shows inline error).
 */
export async function renameTag(id: string, label: string): Promise<void> {
  await storage.update((s) => ({
    ...s,
    tags: s.tags.map((t) => (t.id === id ? { ...t, label: label.trim() } : t)),
  }));
}

/** Recolor an existing tag. No-op if the id does not exist. */
export async function recolorTag(id: string, color: string): Promise<void> {
  await storage.update((s) => ({
    ...s,
    tags: s.tags.map((t) => (t.id === id ? { ...t, color } : t)),
  }));
}

/**
 * Delete a tag and cascade-remove its id from all todos and reminders.
 *
 * Cascade-remove is chosen over orphan-tolerant for two reasons:
 * 1. Items with a dangling tag id are silently invisible in filter results —
 *    a subtle, confusing bug.
 * 2. The cascade is cheap: a single storage.update() pass over all items.
 */
export async function deleteTag(id: string): Promise<void> {
  await storage.update((s) => ({
    ...s,
    tags: s.tags.filter((t) => t.id !== id),
    todos: s.todos.map((t) => ({ ...t, tags: t.tags.filter((tid) => tid !== id) })),
    reminders: s.reminders.map((r) => ({ ...r, tags: r.tags.filter((tid) => tid !== id) })),
  }));
}

// ── Filter ─────────────────────────────────────────────────────────────────

/**
 * Filter a list of tagged items by active tag ids using OR semantics.
 *
 * OR semantics: an item matches if it has at least one of the active tag ids.
 * Items with zero tags never match when any filter is active (they carry no
 * tag that could satisfy the OR condition). This is intentional — filtering
 * should show items related to the selected tags, not the entire untagged
 * backlog. Documented here so the decision is explicit.
 *
 * Returns all items unchanged when activeTagIds is empty (no filter active).
 */
export function filterByTags<T extends { tags: string[] }>(
  items: T[],
  activeTagIds: string[],
): T[] {
  if (activeTagIds.length === 0) return items;
  return items.filter((item) =>
    activeTagIds.some((tagId) => item.tags.includes(tagId)),
  );
}
