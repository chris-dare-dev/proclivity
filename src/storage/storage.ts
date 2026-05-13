import { EMPTY_STATE, type ProclivityState, type Reminder, type Todo } from "@/types";
import { STORAGE_KEY } from "./constants";
import { getLogger } from "@/observability/logger";

// Observability phase 2 — storage writes were previously swallowed
// silently when they rejected. Surface them via the logger so quota
// overflows, JSON-serialisation issues, and SW/UI races are visible.
const storageLog = getLogger("storage");

type Listener = (state: ProclivityState) => void;

const isExtension =
  typeof chrome !== "undefined" && !!chrome.storage?.local;

async function readRaw(): Promise<ProclivityState> {
  if (isExtension) {
    const r = await chrome.storage.local.get(STORAGE_KEY);
    return (r[STORAGE_KEY] as ProclivityState | undefined) ?? EMPTY_STATE;
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as ProclivityState) : EMPTY_STATE;
}

async function writeRaw(state: ProclivityState): Promise<void> {
  if (isExtension) {
    await chrome.storage.local.set({ [STORAGE_KEY]: state });
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/**
 * Serialize all write operations through a promise chain so concurrent
 * update() calls never clobber each other (finding #1).
 */
let writeChain: Promise<void> = Promise.resolve();

export const storage = {
  async get(): Promise<ProclivityState> {
    const s = await readRaw();
    const base = { ...EMPTY_STATE, ...s };
    // Backfill `tags: []` on Todo and Reminder items that predate the tags
    // feature, and `closedAt` on `done: true` todos that predate the closed-todos
    // feature. Stored JSON from before either feature was introduced will be
    // missing those keys at runtime even though the TypeScript type requires
    // them. This single normalisation pass in get() is the canonical enforcement
    // boundary — every consumer downstream can rely on:
    //   - `tags` always a string[]
    //   - any `done === true` todo carrying a `closedAt` number (so the 30-day
    //     auto-purge clock has something to measure against).
    return {
      ...base,
      todos: base.todos.map((t) => {
        const raw = t as Todo & { tags?: string[] };
        const withTags = raw.tags !== undefined ? t : { ...t, tags: [] };
        // Backfill closedAt for legacy completed todos. We prefer completedAt
        // (the user's actual completion timestamp) and fall back to createdAt so
        // a todo with neither still has a sensible age anchor (clamped to "now"
        // if both are absent, which keeps the purge from instantly deleting
        // pre-feature data).
        if (withTags.done && withTags.closedAt === undefined) {
          const anchor =
            withTags.completedAt ?? withTags.createdAt ?? Date.now();
          return { ...withTags, closedAt: anchor };
        }
        return withTags;
      }),
      reminders: base.reminders.map((r) => {
        const raw = r as Reminder & { tags?: string[] };
        return raw.tags !== undefined ? r : { ...r, tags: [] };
      }),
    };
  },
  async set(state: ProclivityState): Promise<void> {
    await writeRaw(state);
  },
  update(
    fn: (s: ProclivityState) => ProclivityState,
  ): Promise<ProclivityState> {
    // Chain each update so reads always see the latest committed write.
    const result = writeChain.then(async () => {
      const next = fn(await this.get());
      await this.set(next);
      return next;
    });
    // Keep the chain alive; swallow errors so future updates aren't blocked —
    // but log them via the observability sink so they're not invisible.
    // (obs-2)
    writeChain = result.then(
      () => undefined,
      (err: unknown) => {
        storageLog.warn("update.rejected", {
          error: err instanceof Error ? err.message : String(err),
          name: err instanceof Error ? err.name : undefined,
        });
        return undefined;
      },
    );
    return result;
  },
  subscribe(listener: Listener): () => void {
    if (isExtension) {
      const handler = (
        changes: Record<string, chrome.storage.StorageChange>,
        area: string,
      ) => {
        if (area !== "local" || !changes[STORAGE_KEY]) return;
        listener(
          (changes[STORAGE_KEY].newValue as ProclivityState) ?? EMPTY_STATE,
        );
      };
      chrome.storage.onChanged.addListener(handler);
      return () => chrome.storage.onChanged.removeListener(handler);
    }
    const handler = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      listener(e.newValue ? JSON.parse(e.newValue) : EMPTY_STATE);
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  },
};

export function uid(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  );
}
