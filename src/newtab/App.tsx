import { lazy, memo, Suspense, useEffect, useMemo, useState } from "react";
import "./App.css";
import { Today } from "@/sections/Today";
import { Sprint } from "@/sections/Sprint";
import { LongTerm } from "@/sections/LongTerm";
import { Gantt } from "@/sections/Gantt";
import { Reminders } from "@/sections/Reminders";
import { useStore } from "@/storage/useStore";
import { configure as configureObservability } from "@/observability/logger";

// SettingsModal (and NanoSection, TagsSection, tag CRUD) are only needed when
// the user opens Settings — lazy-load to keep the initial newtab chunk slim.
const SettingsModal = lazy(() =>
  import("@/components/settings/SettingsModal").then((m) => ({ default: m.SettingsModal })),
);
import { resolvedSettings } from "@/storage/constants";
import { useThemeSync } from "@/hooks/useThemeSync";
import type { ResolvedUserSettings } from "@/types";

// Three.js is ~800kB minified — keep it out of the initial chunk so the
// planner UI renders without waiting on it. The mesh fades in once loaded.
const MeshBackground = lazy(() =>
  import("@/components/MeshBackground").then((m) => ({ default: m.MeshBackground })),
);

// Chat panel is code-split so it never loads for users who disable the feature.
// Mirrors the MeshBackground lazy-load pattern (AC #6).
const ChatPanel = lazy(() => import("@/components/chat/ChatPanel"));

// Calendar is the only purely-derived view (no first-class CRUD UI of its
// own) — lazy-load so its month-grid CSS + helpers don't sit in the initial
// chunk for users who never visit the tab.
const Calendar = lazy(() => import("@/sections/Calendar"));

type Tab = "today" | "sprint" | "long" | "gantt" | "reminders" | "calendar";

const TABS: { id: Tab; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "sprint", label: "Sprint" },
  { id: "long", label: "Long-term" },
  { id: "gantt", label: "Gantt" },
  { id: "calendar", label: "Calendar" },
  { id: "reminders", label: "Reminders" },
];

function greetingFor(d: Date) {
  const h = d.getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// Header owns its own 1-second tick so the rest of App doesn't re-render
// on each clock update (Pattern F).
const Header = memo(function Header() {
  const { state } = useStore();
  const [now, setNow] = useState(() => new Date());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  useThemeSync(state.settings);
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const rs = useMemo(() => resolvedSettings(state.settings), [state.settings]);
  // Phase 1 of the observability rollout — propagate the user's debug
  // preferences into the logger module whenever they change.
  // See plans/observability-plan.md.
  useEffect(() => {
    configureObservability({
      enabled: rs.debug.enabled,
      namespaces: rs.debug.namespaces,
    });
  }, [rs.debug.enabled, rs.debug.namespaces]);
  const name = rs.name.trim();
  const greeting =
    rs.greetingStyle === "none"
      ? name
        ? `${name}.`
        : ""
      : `${greetingFor(now)}${name ? `, ${name}` : ""}.`;
  const timeOpts: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    ...(rs.timeFormat === "12h"
      ? { hourCycle: "h12" as const }
      : rs.timeFormat === "24h"
        ? { hourCycle: "h23" as const }
        : {}),
  };

  const chatEnabled = rs.geminiNano.chatEnabled;

  return (
    <>
      <header className="header">
        <div className="header-left">
          <div className="greeting">{greeting}</div>
          <div className="date">
            {now.toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </div>
        </div>
        <div className="header-right">
          <div className="clock">
            {now.toLocaleTimeString(undefined, timeOpts)}
          </div>
          {chatEnabled && (
            <button
              type="button"
              className="settings-button"
              aria-label="Chat with Nano"
              title="Chat with Nano"
              aria-pressed={chatOpen}
              onClick={() => setChatOpen((prev) => !prev)}
            >
              <ChatBubbleIcon />
            </button>
          )}
          <button
            type="button"
            className="settings-button"
            data-new={rs.settingsV2Seen ? undefined : "true"}
            aria-label="Settings"
            title="Settings"
            onClick={() => setSettingsOpen(true)}
          >
            <GearIcon />
          </button>
        </div>
      </header>
      <Suspense fallback={null}>
        <SettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />
      </Suspense>
      {/*
        Gate on both `chatEnabled` (feature toggle) AND `chatOpen` (user
        intent) so the ChatPanel unmounts entirely when closed — its
        useChatSession cleanup effect aborts the in-flight prompt and
        destroys the session, releasing GPU/CPU memory (rect H2).
      */}
      {chatEnabled && chatOpen && (
        <Suspense fallback={null}>
          <ChatPanel onClose={() => setChatOpen(false)} />
        </Suspense>
      )}
    </>
  );
});

function GearIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

function ChatBubbleIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

const TAB_KEY: Record<Tab, keyof ResolvedUserSettings["sectionVisibility"]> = {
  today: "today",
  sprint: "sprint",
  long: "longTerm",
  gantt: "gantt",
  reminders: "reminders",
  calendar: "calendar",
};

export default function App() {
  const [tab, setTab] = useState<Tab>("today");
  const { state } = useStore();
  const rs = useMemo(() => resolvedSettings(state.settings), [state.settings]);

  const visibleTabs = useMemo(
    () => TABS.filter((t) => rs.sectionVisibility[TAB_KEY[t.id]]),
    [rs.sectionVisibility],
  );

  // If the active tab gets hidden via settings, fall back to the first
  // visible one so the dashboard never renders an "invisible" section.
  useEffect(() => {
    if (visibleTabs.length === 0) return;
    if (!rs.sectionVisibility[TAB_KEY[tab]]) {
      const firstVisible = visibleTabs[0];
      if (firstVisible) setTab(firstVisible.id);
    }
  }, [rs.sectionVisibility, tab, visibleTabs]);

  return (
    <>
      {rs.meshEnabled && (
        <Suspense fallback={null}>
          <MeshBackground
            intensity={rs.meshIntensity}
            reducedMotion={rs.reducedMotion}
          />
        </Suspense>
      )}
      <div className="app">
        <Header />

        {/* L3: each tab button gets an id so the matching tabpanel can
            reference it via aria-labelledby, completing the tablist pattern. */}
        <nav className="tabs" role="tablist">
          {visibleTabs.map((t) => (
            <button
              key={t.id}
              id={`tab-btn-${t.id}`}
              role="tab"
              aria-selected={tab === t.id}
              aria-controls={`tabpanel-${t.id}`}
              className={`tab ${tab === t.id ? "tab-active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {/*
          Keep all sections mounted (#39) — switching tabs preserves
          local state (drafts, expanded archived sprints, etc.). Inactive
          and hidden sections are skipped via the visible-section gate.
        */}
        <main className="content">
          {rs.sectionVisibility.today && (
            <div
              id="tabpanel-today"
              role="tabpanel"
              aria-labelledby="tab-btn-today"
              hidden={tab !== "today"}
            >
              <Today />
            </div>
          )}
          {rs.sectionVisibility.sprint && (
            <div
              id="tabpanel-sprint"
              role="tabpanel"
              aria-labelledby="tab-btn-sprint"
              hidden={tab !== "sprint"}
            >
              <Sprint />
            </div>
          )}
          {rs.sectionVisibility.longTerm && (
            <div
              id="tabpanel-long"
              role="tabpanel"
              aria-labelledby="tab-btn-long"
              hidden={tab !== "long"}
            >
              <LongTerm />
            </div>
          )}
          {rs.sectionVisibility.gantt && (
            <div
              id="tabpanel-gantt"
              role="tabpanel"
              aria-labelledby="tab-btn-gantt"
              hidden={tab !== "gantt"}
            >
              <Gantt />
            </div>
          )}
          {rs.sectionVisibility.reminders && (
            <div
              id="tabpanel-reminders"
              role="tabpanel"
              aria-labelledby="tab-btn-reminders"
              hidden={tab !== "reminders"}
            >
              <Reminders />
            </div>
          )}
          {rs.sectionVisibility.calendar && (
            <div
              id="tabpanel-calendar"
              role="tabpanel"
              aria-labelledby="tab-btn-calendar"
              hidden={tab !== "calendar"}
            >
              <Suspense fallback={null}>
                <Calendar
                  onTabChange={(t) => {
                    // Guard: only switch to a valid Tab value.
                    const valid: Tab[] = ["today", "sprint", "long", "gantt", "reminders", "calendar"];
                    if ((valid as string[]).includes(t)) setTab(t as Tab);
                  }}
                />
              </Suspense>
            </div>
          )}
          {visibleTabs.length === 0 && (
            <div className="section-empty">
              All sections are hidden. Open Settings to re-enable one.
            </div>
          )}
        </main>
      </div>
    </>
  );
}
