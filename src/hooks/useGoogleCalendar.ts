import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clearCalendarToken, getCalendarToken } from "@/lib/googleCalendar/auth";
import { GoogleCalendarApiError } from "@/lib/googleCalendar/api";
import {
  EMPTY_GOOGLE_CALENDAR_STATE,
  googleCalendarStore,
} from "@/lib/googleCalendar/store";
import { syncGoogleCalendarWindow } from "@/lib/googleCalendar/sync";
import type {
  GoogleCalendarEvent,
  GoogleCalendarState,
} from "@/lib/googleCalendar/types";

export const GOOGLE_CALENDAR_CACHE_TTL_MS = 10 * 60 * 1000;

export type GoogleCalendarSyncStatus =
  | "loading"
  | "off"
  | "syncing"
  | "ready"
  | "reconnect"
  | "error";

export interface GoogleCalendarWindowResult {
  events: GoogleCalendarEvent[];
  status: GoogleCalendarSyncStatus;
  error: string | null;
  lastSyncedAt: number | null;
  refresh: () => Promise<void>;
}

export function useGoogleCalendar(
  windowStart: number,
  windowEnd: number,
): GoogleCalendarWindowResult {
  const [integration, setIntegration] = useState<GoogleCalendarState>(
    EMPTY_GOOGLE_CALENDAR_STATE,
  );
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<GoogleCalendarSyncStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    let mounted = true;
    void googleCalendarStore.get().then((next) => {
      if (!mounted) return;
      setIntegration(next);
      setLoaded(true);
    });
    const unsubscribe = googleCalendarStore.subscribe((next) => {
      if (mounted) setIntegration(next);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const matchingCache = useMemo(
    () =>
      integration.caches.find(
        (cache) =>
          cache.windowStart === windowStart && cache.windowEnd === windowEnd,
      ) ?? null,
    [integration.caches, windowEnd, windowStart],
  );

  const events = useMemo(
    () => matchingCache?.events ?? [],
    [matchingCache],
  );

  const performRefresh = useCallback(async (
    controller: AbortController,
  ): Promise<void> => {
    activeRequest.current?.abort();
    activeRequest.current = controller;
    setStatus("syncing");
    setError(null);
    let token: string | null = null;
    try {
      token = await getCalendarToken({ interactive: false });
      if (!isCurrentRequest(activeRequest, controller)) return;
      if (!token) {
        setStatus("reconnect");
        return;
      }
      const cache = await syncGoogleCalendarWindow({
        token,
        windowStart,
        windowEnd,
        signal: controller.signal,
      });
      if (!isCurrentRequest(activeRequest, controller)) return;
      await googleCalendarStore.replaceCache(cache);
      if (!isCurrentRequest(activeRequest, controller)) return;
      setStatus("ready");
    } catch (cause) {
      if (
        isAbortError(cause) ||
        !isCurrentRequest(activeRequest, controller)
      ) {
        return;
      }
      if (
        cause instanceof GoogleCalendarApiError &&
        cause.kind === "authorization"
      ) {
        if (token) await clearCalendarToken(token);
        if (!isCurrentRequest(activeRequest, controller)) return;
        setStatus("reconnect");
      } else {
        setStatus("error");
      }
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
    }
  }, [windowStart, windowEnd]);

  const runRefresh = useCallback(async (): Promise<void> => {
    await performRefresh(new AbortController());
  }, [performRefresh]);

  useEffect(() => {
    if (!loaded) return;
    if (!integration.enabled) {
      activeRequest.current?.abort();
      setStatus("off");
      setError(null);
      return;
    }
    const isFresh =
      matchingCache !== null &&
      Date.now() - matchingCache.lastSyncedAt < GOOGLE_CALENDAR_CACHE_TTL_MS;
    if (isFresh) {
      setStatus("ready");
      setError(null);
      return;
    }
    const controller = new AbortController();
    void performRefresh(controller);
    return () => controller.abort();
  }, [loaded, integration.enabled, matchingCache, performRefresh]);

  // A manual refresh is not owned by the automatic-refresh effect above.
  // Cancel it explicitly when navigation changes the requested grid window so
  // an old month's 401/error cannot publish status into a fresh cached month.
  useEffect(
    () => () => {
      const request = activeRequest.current;
      request?.abort();
      if (activeRequest.current === request) activeRequest.current = null;
    },
    [windowEnd, windowStart],
  );

  return {
    events,
    status,
    error,
    lastSyncedAt: matchingCache?.lastSyncedAt ?? null,
    refresh: runRefresh,
  };
}

function isAbortError(value: unknown): boolean {
  return value instanceof Error && value.name === "AbortError";
}

function isCurrentRequest(
  activeRequest: React.RefObject<AbortController | null>,
  controller: AbortController,
): boolean {
  return activeRequest.current === controller && !controller.signal.aborted;
}
