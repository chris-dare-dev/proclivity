import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { MonthGrid } from "./calendar/MonthGrid";
import {
  addMonths,
  calendarGridWindow,
  isCurrentMonth,
  monthLabel,
  startOfMonth,
} from "./calendar/calendarUtils";
import { startOfDay } from "@/lib/dateUtils";
import { useStore } from "@/storage/useStore";
import { OPEN_SETTINGS_EVENT } from "@/storage/constants";
import {
  useGoogleCalendar,
  type GoogleCalendarSyncStatus,
} from "@/hooks/useGoogleCalendar";
import "./calendar/calendar.css";

/**
 * Calendar — month-grid view of the user's reminders, today-scope
 * todos, long-term todos (with `dueAt`), and sprints (as multi-day
 * bars).
 *
 * Default export so the section can be wired up with `React.lazy`
 * from App.tsx — keeps the initial newtab chunk slim.
 *
 * Read-only by design in v1: editing items still happens in their
 * native tabs (Today, Sprint, Long-term, Reminders). The Calendar
 * is a cross-cutting overview, not a duplicate of those CRUD UIs.
 */
interface CalendarProps {
  /** Optional callback from App — navigates to a named tab (M3/M4). */
  onTabChange?: ((tab: string) => void) | undefined;
}

export default function Calendar({ onTabChange }: CalendarProps) {
  const { state } = useStore();
  const sectionRef = useRef<HTMLElement | null>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const update = (width: number) => setCompact(width <= 720);
    update(section.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) update(entry.contentRect.width);
    });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  // L5: only weekStart is used from settings — inline rather than resolvedSettings.
  const weekStart = state.settings.weekStart ?? "mon";
  const timeFormat = state.settings.timeFormat ?? "auto";

  // The currently-focused month. Initialized to "today's month" so the
  // user always lands on something useful; navigation is purely local
  // state — no need to persist this between sessions.
  const [monthStart, setMonthStart] = useState<number>(() =>
    startOfMonth(Date.now()),
  );

  // H3: live "today" timestamp updated at each local midnight so new-tab
  // pages that survive the rollover show the correct Today cell.
  const [today, setToday] = useState<number>(() => startOfDay(Date.now()));
  useEffect(() => {
    // Schedule the next tick just after local midnight.
    const msUntilMidnight = startOfDay(Date.now()) + 86_400_000 - Date.now();
    const t = setTimeout(() => setToday(startOfDay(Date.now())), msUntilMidnight + 1000);
    return () => clearTimeout(t);
  }, [today]);

  const goPrev = useCallback(
    () => setMonthStart((ts) => addMonths(ts, -1)),
    [],
  );
  const goNext = useCallback(
    () => setMonthStart((ts) => addMonths(ts, 1)),
    [],
  );
  const goToday = useCallback(
    () => setMonthStart(startOfMonth(Date.now())),
    [],
  );

  const showingCurrent = isCurrentMonth(monthStart);
  const label = useMemo(() => monthLabel(monthStart), [monthStart]);
  const { windowStart, windowEnd } = useMemo(
    () => calendarGridWindow(monthStart, weekStart),
    [monthStart, weekStart],
  );
  const googleCalendar = useGoogleCalendar(windowStart, windowEnd);
  const openGoogleCalendarSettings = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent(OPEN_SETTINGS_EVENT, { detail: "googleCalendar" }),
    );
  }, []);

  return (
    <section ref={sectionRef} className="calendar-section" aria-label="Calendar">
      <header className="calendar-header">
        <div className="calendar-header__nav">
          <button
            type="button"
            className="calendar-nav-btn"
            onClick={goPrev}
            aria-label="Previous month"
            title="Previous month"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          {/* M3: visible heading without aria-live (to avoid SR double-announce).
              A visually-hidden live region below announces month changes. */}
          <h2 className="calendar-header__title">
            {label}
          </h2>
          <button
            type="button"
            className="calendar-nav-btn"
            onClick={goNext}
            aria-label="Next month"
            title="Next month"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="calendar-header__right">
          <button
            type="button"
            className="calendar-today-btn"
            onClick={goToday}
            disabled={showingCurrent}
            aria-label="Jump to current month"
          >
            Today
          </button>
        </div>
      </header>

      {/* M3: visually-hidden live region announces month changes without
          re-triggering on heading focus navigation. */}
      <span className="sr-only" aria-live="polite">{label}</span>

      <GoogleCalendarStatus
        status={googleCalendar.status}
        eventCount={googleCalendar.events.length}
        lastSyncedAt={googleCalendar.lastSyncedAt}
        error={googleCalendar.error}
        onRefresh={() => void googleCalendar.refresh()}
        onOpenSettings={openGoogleCalendarSettings}
      />

      <Legend />

      <MonthGrid
        compact={compact}
        monthStart={monthStart}
        weekStart={weekStart}
        today={today}
        reminders={state.reminders}
        todos={state.todos}
        sprints={state.sprints}
        tags={state.tags}
        googleEvents={googleCalendar.events}
        timeFormat={timeFormat}
        {...(state.activeSprintId !== undefined
          ? { activeSprintId: state.activeSprintId }
          : {})}
        {...(onTabChange !== undefined ? { onTabChange } : {})}
      />
    </section>
  );
}

function Legend() {
  return (
    <ul className="calendar-legend" aria-label="Legend">
      {/* H3: show both active and inactive sprint bar states so the legend
          matches the dominant (active) bar the user sees on screen. */}
      <li>
        <span className="calendar-legend__bar calendar-legend__bar--active" aria-hidden="true" /> Sprint (active)
      </li>
      <li>
        <span className="calendar-legend__bar" aria-hidden="true" /> Sprint
      </li>
      {/* L2: mirror the R/T/L glyph letters from chip dots into legend dots
          so users can decode the pairing at a glance. */}
      <li>
        <span className="calendar-legend__dot calendar-legend__dot--google" aria-hidden="true">G</span>{" "}
        Google event
      </li>
      <li>
        <span className="calendar-legend__dot calendar-legend__dot--reminder" aria-hidden="true">R</span>{" "}
        Reminder
      </li>
      <li>
        <span className="calendar-legend__dot calendar-legend__dot--today" aria-hidden="true">T</span>{" "}
        Today todo
      </li>
      <li>
        <span className="calendar-legend__dot calendar-legend__dot--long" aria-hidden="true">L</span>{" "}
        Long-term
      </li>
    </ul>
  );
}

function GoogleCalendarStatus({
  status,
  eventCount,
  lastSyncedAt,
  error,
  onRefresh,
  onOpenSettings,
}: {
  status: GoogleCalendarSyncStatus;
  eventCount: number;
  lastSyncedAt: number | null;
  error: string | null;
  onRefresh: () => void;
  onOpenSettings: () => void;
}) {
  if (status === "loading") {
    return (
      <div className="calendar-google-status" aria-live="polite">
        <CalendarDays size={15} aria-hidden="true" />
        <span>Checking Google Calendar…</span>
      </div>
    );
  }

  if (status === "off" || status === "reconnect") {
    return (
      <div className="calendar-google-status" aria-live="polite">
        <CalendarDays size={15} aria-hidden="true" />
        <span>
          {status === "reconnect"
            ? "Google Calendar needs to reconnect."
            : "Add your Google events to this calendar."}
        </span>
        <button type="button" onClick={onOpenSettings}>
          {status === "reconnect" ? "Reconnect" : "Connect read-only"}
        </button>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div
        className="calendar-google-status calendar-google-status--error"
        aria-live="polite"
      >
        <CalendarDays size={15} aria-hidden="true" />
        <span>
          <strong>Google Calendar couldn’t refresh.</strong>{" "}
          {error ?? "Try again or reconnect in Settings."}
          {eventCount > 0 ? " Showing cached events." : ""}
        </span>
        <button type="button" onClick={onRefresh}>Retry</button>
        <button type="button" onClick={onOpenSettings}>Settings</button>
      </div>
    );
  }

  const syncedLabel = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      })
    : "just now";
  return (
    <div className="calendar-google-status" aria-live="polite">
      <CalendarDays size={15} aria-hidden="true" />
      <span>
        {status === "syncing"
          ? `Updating Google Calendar${eventCount > 0 ? ` · ${eventCount} cached` : ""}…`
          : `Google Calendar · ${eventCount} event${eventCount === 1 ? "" : "s"} · synced ${syncedLabel}`}
      </span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={status === "syncing"}
        aria-label="Refresh Google Calendar"
        title="Refresh Google Calendar"
      >
        <RefreshCw
          size={13}
          aria-hidden="true"
          className={status === "syncing" ? "is-spinning" : undefined}
        />
        <span>{status === "syncing" ? "Syncing" : "Refresh"}</span>
      </button>
    </div>
  );
}
