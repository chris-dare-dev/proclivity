import { useCallback, useEffect, useState } from "react";
import { EMPTY_STATE, type ProclivityState } from "@/types";
import { storage } from "./storage";
import { purgeOldClosed } from "./closedTodos";
import { resolvedSettings } from "./constants";

export function useStore(): {
  state: ProclivityState;
  loading: boolean;
  update: (fn: (s: ProclivityState) => ProclivityState) => Promise<void>;
} {
  const [state, setState] = useState<ProclivityState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    storage.get().then((s) => {
      if (cancelled) return;
      setState(s);
      setLoading(false);
    });
    const unsub = storage.subscribe(setState);

    // M1 fix: run the closed-todos purge on every newtab open, as specified
    // in research-A.md §2.3. The SW alarm covers the 24h cadence; this path
    // covers active users who open many tabs but whose SW is infrequently
    // wakened. The updater is idempotent — calling it twice is a no-op.
    // Read the user's retention preference inside the updater so we get the
    // current state (not the EMPTY_STATE default).
    void storage.update((s) => {
      const retentionDays = resolvedSettings(s.settings).closedTodoRetentionDays;
      return purgeOldClosed(retentionDays)(s);
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  // Stable reference across re-renders so useCallback deps in consumers stay clean (#40)
  const update = useCallback(async (fn: (s: ProclivityState) => ProclivityState) => {
    await storage.update(fn);
  }, []);

  return { state, loading, update };
}
