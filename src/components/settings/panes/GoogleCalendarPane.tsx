import { useCallback, useEffect, useState } from "react";
import { CalendarDays, RefreshCw, ShieldCheck } from "lucide-react";
import {
  clearCalendarToken,
  getCalendarToken,
} from "@/lib/googleCalendar/auth";
import { GoogleCalendarApiError } from "@/lib/googleCalendar/api";
import {
  EMPTY_GOOGLE_CALENDAR_STATE,
  googleCalendarStore,
} from "@/lib/googleCalendar/store";
import { syncGoogleCalendarWindow } from "@/lib/googleCalendar/sync";
import type { GoogleCalendarState } from "@/lib/googleCalendar/types";
import { calendarGridWindow, startOfMonth } from "@/sections/calendar/calendarUtils";
import type { WeekStart } from "@/types";

type PaneStatus = "checking" | "idle" | "working" | "error";

export function GoogleCalendarPane({ weekStart }: { weekStart: WeekStart }) {
  const [integration, setIntegration] = useState<GoogleCalendarState>(
    EMPTY_GOOGLE_CALENDAR_STATE,
  );
  const [hasToken, setHasToken] = useState(false);
  const [status, setStatus] = useState<PaneStatus>("checking");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const stored = await googleCalendarStore.get();
      // When the feature is off, do not even perform a silent token request:
      // Chrome could mint/cache a fresh token from an existing Google grant.
      const token = stored.enabled
        ? await getCalendarToken({ interactive: false })
        : null;
      return { stored, token };
    })()
      .then(({ stored, token }) => {
        if (!mounted) return;
        setIntegration(stored);
        setHasToken(token !== null);
        setStatus("idle");
      })
      .catch((cause: unknown) => {
        if (!mounted) return;
        setStatus("error");
        setError(cause instanceof Error ? cause.message : String(cause));
      });
    const unsubscribe = googleCalendarStore.subscribe((next) => {
      if (mounted) setIntegration(next);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const syncCurrentWindow = useCallback(async () => {
    setStatus("working");
    setError(null);
    let token: string | null = null;
    try {
      // This is intentionally interactive only from an explicit user click.
      token = await getCalendarToken({ interactive: true });
      if (!token) throw new Error("Google did not return an access token.");
      // OAuth has succeeded even if the first Calendar API sync does not.
      setHasToken(true);
      const { windowStart, windowEnd } = calendarGridWindow(
        startOfMonth(Date.now()),
        weekStart,
      );
      const cache = await syncGoogleCalendarWindow({
        token,
        windowStart,
        windowEnd,
      });
      await googleCalendarStore.enableWithCache(cache);
      setIntegration(await googleCalendarStore.get());
      setHasToken(true);
      setStatus("idle");
    } catch (cause) {
      if (
        cause instanceof GoogleCalendarApiError &&
        cause.kind === "authorization"
      ) {
        if (token) await clearCalendarToken(token);
        setHasToken(false);
      }
      setStatus("error");
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [weekStart]);

  const turnOff = useCallback(async () => {
    setStatus("working");
    setError(null);
    try {
      const token = await getCalendarToken({ interactive: false });
      if (token) await clearCalendarToken(token);
      await googleCalendarStore.disableAndClear();
      setIntegration(EMPTY_GOOGLE_CALENDAR_STATE);
      setHasToken(false);
      setStatus("idle");
    } catch (cause) {
      setStatus("error");
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  const connected = integration.enabled && hasToken;
  const cachedCount = integration.caches.reduce(
    (count, cache) => count + cache.events.length,
    0,
  );
  const latestCache = integration.caches[0] ?? null;

  return (
    <div
      role="tabpanel"
      id="settings-pane-googleCalendar"
      aria-labelledby="settings-tab-googleCalendar"
      className="settings-pane"
    >
      <section className="settings-section">
        <h3 className="settings-section-heading">Google Calendar</h3>
        <div className="calendar-integration-boundary">
          <ShieldCheck size={18} aria-hidden="true" />
          <div>
            <strong>One-way and read-only</strong>
            <p>
              Google events appear in Proclivity. Local sprints, reminders,
              todos, finances, and Gantt tasks are never sent to Google.
            </p>
          </div>
        </div>
        <p className="settings-hint">
          This first version reads the primary calendar only and caches the
          visible 42-day month windows locally in a small bounded history.
          Event descriptions, attendees, email addresses, and conferencing
          data are not requested.
        </p>
        <p className="settings-hint">
          Connection, sync, and turn-off actions here apply immediately. The
          Settings footer only saves or cancels ordinary preference changes.
        </p>

        {status === "checking" && (
          <p className="settings-hint">Checking Google Calendar…</p>
        )}

        {status !== "checking" && !connected && (
          <button
            type="button"
            className="calendar-integration-action"
            onClick={() => void syncCurrentWindow()}
            disabled={status === "working"}
          >
            <CalendarDays size={16} aria-hidden="true" />
            {status === "working"
              ? "Connecting…"
              : hasToken
                ? "Retry Google Calendar sync"
              : integration.enabled
                ? "Reconnect Google Calendar"
                : "Connect Google Calendar"}
          </button>
        )}

        {connected && (
          <div className="settings-row">
            <button
              type="button"
              className="calendar-integration-action"
              onClick={() => void syncCurrentWindow()}
              disabled={status === "working"}
            >
              <RefreshCw size={15} aria-hidden="true" />
              {status === "working" ? "Syncing…" : "Sync current month"}
            </button>
            <button
              type="button"
              onClick={() => void turnOff()}
              disabled={status === "working"}
            >
              Turn off and clear events
            </button>
          </div>
        )}

        {status === "error" && error && (
          <div className="settings-hint settings-hint--error" role="alert">
            <strong>
              Google Calendar couldn’t {hasToken ? "sync" : "connect"}.
            </strong>{" "}
            {error}
          </div>
        )}

        <dl className="calendar-integration-facts">
          <div>
            <dt>Status</dt>
            <dd>{connected ? "Connected · read-only" : "Not connected"}</dd>
          </div>
          <div>
            <dt>Cached events</dt>
            <dd>{cachedCount}</dd>
          </div>
          <div>
            <dt>Last synced</dt>
            <dd>
              {latestCache
                ? new Date(latestCache.lastSyncedAt).toLocaleString()
                : "Never"}
            </dd>
          </div>
        </dl>

        <p className="settings-hint">
          “Turn off” clears Calendar data and its cached token from this
          browser without revoking Google Photos. To revoke every Proclivity
          Google permission, use “Disconnect Google account” in Google Photos
          or remove Proclivity from your Google Account’s connected apps.
        </p>
      </section>
    </div>
  );
}
