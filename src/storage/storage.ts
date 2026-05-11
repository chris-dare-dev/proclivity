import { EMPTY_STATE, type ProclivityState } from "@/types";

const KEY = "proclivity:state:v1";

type Listener = (state: ProclivityState) => void;

const isExtension =
  typeof chrome !== "undefined" && !!chrome.storage?.local;

async function readRaw(): Promise<ProclivityState> {
  if (isExtension) {
    const r = await chrome.storage.local.get(KEY);
    return (r[KEY] as ProclivityState | undefined) ?? EMPTY_STATE;
  }
  const raw = localStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as ProclivityState) : EMPTY_STATE;
}

async function writeRaw(state: ProclivityState): Promise<void> {
  if (isExtension) {
    await chrome.storage.local.set({ [KEY]: state });
    return;
  }
  localStorage.setItem(KEY, JSON.stringify(state));
}

export const storage = {
  async get(): Promise<ProclivityState> {
    const s = await readRaw();
    return { ...EMPTY_STATE, ...s };
  },
  async set(state: ProclivityState): Promise<void> {
    await writeRaw(state);
  },
  async update(
    fn: (s: ProclivityState) => ProclivityState,
  ): Promise<ProclivityState> {
    const next = fn(await this.get());
    await this.set(next);
    return next;
  },
  subscribe(listener: Listener): () => void {
    if (isExtension) {
      const handler = (
        changes: Record<string, chrome.storage.StorageChange>,
        area: string,
      ) => {
        if (area !== "local" || !changes[KEY]) return;
        listener((changes[KEY].newValue as ProclivityState) ?? EMPTY_STATE);
      };
      chrome.storage.onChanged.addListener(handler);
      return () => chrome.storage.onChanged.removeListener(handler);
    }
    const handler = (e: StorageEvent) => {
      if (e.key !== KEY) return;
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
