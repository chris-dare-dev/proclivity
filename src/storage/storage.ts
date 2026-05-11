import { EMPTY_STATE, type ProclivityState } from "@/types";
import { STORAGE_KEY } from "./constants";

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
    return { ...EMPTY_STATE, ...s };
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
    // Keep the chain alive; swallow errors so future updates aren't blocked.
    writeChain = result.then(
      () => undefined,
      () => undefined,
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
