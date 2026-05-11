import { useEffect, useState } from "react";
import { EMPTY_STATE, type ProclivityState } from "@/types";
import { storage } from "./storage";

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
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const update = async (fn: (s: ProclivityState) => ProclivityState) => {
    await storage.update(fn);
  };

  return { state, loading, update };
}
