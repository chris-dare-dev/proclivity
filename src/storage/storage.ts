import { EMPTY_STATE, type ProclivityState, type Reminder, type Sprint, type Todo } from "@/types";
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
 * Local-midnight ms helper, inlined here so the storage layer does not
 * import upward from `src/sections/**`. Mirrors `todayMidnight()` in
 * `src/sections/sprint/sprintUtils.ts:20-24`; keep the two definitions
 * behaviorally identical. The duplication is intentional — see
 * sprint-backlog-redesign-m1 brief-2 §3 for the layering rationale.
 */
function localMidnight(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Normalize raw storage state — the canonical backfill pass shared by
 * `get()` and `subscribe()` (H1 fix).
 *
 * Every consumer downstream can rely on:
 *   - `tags` always a `string[]` on todos and reminders
 *   - every `done === true` todo carries a `closedAt` number so the 30-day
 *     purge clock has an anchor.
 *   - every sprint carries a valid `state` in `{"draft","active","closed"}`
 *     (sprint-backlog-redesign-m1).
 *
 * H1: previously only `get()` ran this pass. `subscribe()` delivered raw
 * `newValue` from `chrome.storage.onChanged`, so service-worker writes or
 * cross-tab writes could land `done: true` + `closedAt: undefined` in React
 * state, breaking group labels, purge clocks, and the closed-todo count.
 *
 * Schema v2 (sprint-backlog-redesign-m1): backfill `Sprint.state` for any
 * legacy sprint whose field is absent or not one of the three allowed
 * literals. Heuristic mirrors the legacy `isArchived()` rule in
 * `src/sections/sprint/sprintUtils.ts:38-40` — a sprint whose `endsAt` is
 * before today's local midnight is treated as `"closed"`, anything else
 * `"active"`. New sprints (with valid v2 state) are passed through
 * untouched. No legacy data ever yields `"draft"` — that literal is only
 * produced by the m2 create-sprint affordance.
 *
 * // TODO(closed-todos-v2): remove the closedAt backfill after 2026-08-01.
 * // All active users will have closedAt-stamped data by then (30-day cycle).
 */
export function normalizeState(raw: ProclivityState): ProclivityState {
  const base = { ...EMPTY_STATE, ...raw };
  const midnight = localMidnight();
  return {
    ...base,
    todos: base.todos.map((t) => {
      const w: Todo = (t as Todo & { tags?: string[] }).tags !== undefined ? t : { ...t, tags: [] };
      if (w.done && w.closedAt === undefined)
        return { ...w, closedAt: w.completedAt ?? w.createdAt ?? Date.now() };
      return w;
    }),
    reminders: base.reminders.map((r) =>
      (r as Reminder & { tags?: string[] }).tags !== undefined ? r : { ...r, tags: [] },
    ),
    sprints: base.sprints.map((s) => {
      // Defensive: treat any value that is not one of the three allowed
      // literals (including undefined, null, typos from corrupted writes)
      // as "needs backfill". Silent fix matches the closedAt backfill posture.
      const v2 = s as Sprint & { state?: unknown };
      if (v2.state === "draft" || v2.state === "active" || v2.state === "closed") {
        return v2 as Sprint;
      }
      const next: Sprint = { ...v2, state: v2.endsAt < midnight ? "closed" : "active" };
      return next;
    }),
  };
}

/**
 * Serialize all write operations through a promise chain so concurrent
 * update() calls never clobber each other (finding #1).
 */
let writeChain: Promise<void> = Promise.resolve();

export const storage = {
  async get(): Promise<ProclivityState> {
    return normalizeState(await readRaw());
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
        // H1 fix: normalize newValue through the same backfill pass as get()
        // so the React tree never receives done:true + closedAt:undefined from
        // service-worker or cross-tab writes.
        const raw = (changes[STORAGE_KEY].newValue as ProclivityState | undefined) ?? EMPTY_STATE;
        listener(normalizeState(raw));
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
