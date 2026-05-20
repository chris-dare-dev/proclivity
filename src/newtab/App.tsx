import { lazy, memo, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { LazyMotion } from "motion/react";
import { Settings, MessageCircle } from "lucide-react";
import "./App.css";
import { Today } from "@/sections/Today";
import { Sprint } from "@/sections/Sprint";
import { LongTerm } from "@/sections/LongTerm";
import { Gantt } from "@/sections/Gantt";
import { Reminders } from "@/sections/Reminders";
import { useStore } from "@/storage/useStore";
import { configure as configureObservability } from "@/observability/logger";
import type { SettingsPaneId } from "@/types";

// Motion v12 (LazyMotion + domAnimation) — m2 frontend-uplift foundation.
// LazyMotion is a Context provider; the actual feature pack
// (domAnimation, ~41 kB raw / ~15.5 kB gzipped) loads lazily via the
// `features` prop which receives a dynamic-import loader.
//
// Why the indirection through `./motion-features` instead of inlining
// `import("motion/react").then(r => r.domAnimation)`: when the dynamic
// import target is the same module as a static import elsewhere in the
// file, Rollup merges them into the main chunk and the lazy split is
// lost. The motion-features.ts re-export module gives Rollup a distinct
// dependency-graph entry to split on. See the m2 research synthesis §3
// and the scope-exceeded post-mortem for the diagnosis trail.
//
// The `strict` prop on LazyMotion enforces that downstream consumers use
// the minimal `m.*` component family rather than `motion.*` (which would
// bring in the heavier feature set synchronously).
const loadDomAnimation = () =>
  import("./motion-features").then((mod) => mod.default);

/**
 * Valid SettingsPaneId values for deep-link URL parsing. Must stay in sync
 * with the `SettingsPaneId` union in `src/types/index.ts`. Kept here as a
 * runtime allowlist rather than pulled from the lazy `panes/registry` so
 * the URL parse can run before the SettingsModal chunk loads.
 */
const SETTINGS_PANE_IDS: ReadonlySet<SettingsPaneId> = new Set<SettingsPaneId>([
  "general",
  "appearance",
  "notifications",
  "todos",
  "geminiNano",
  "googlePhotos",
  "tags",
  "data",
  "advanced",
]);

function readSettingsParam(): SettingsPaneId | undefined {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("settings");
    if (raw === null) return undefined;
    return SETTINGS_PANE_IDS.has(raw as SettingsPaneId)
      ? (raw as SettingsPaneId)
      : undefined;
  } catch {
    return undefined;
  }
}

function stripSettingsParam(): void {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("settings")) return;
    url.searchParams.delete("settings");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  } catch {
    // ignore — replaceState may fail in some embedded contexts; harmless.
  }
}

// SettingsModal (and NanoSection, TagsSection, tag CRUD) are only needed when
// the user opens Settings — lazy-load to keep the initial newtab chunk slim.
const SettingsModal = lazy(() =>
  import("@/components/settings/SettingsModal").then((m) => ({ default: m.SettingsModal })),
);
import { resolvedSettings, NAV_CLOSED_EVENT } from "@/storage/constants";
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

// QuickPrompt — always-visible Nano prompt above the tabs. Lazy because the
// component pulls in @/hooks/useQuickPrompt -> @/llm/tools which would
// otherwise drag the system-prompt builder into the initial bundle.
const QuickPrompt = lazy(() =>
  import("@/components/QuickPrompt").then((m) => ({ default: m.QuickPrompt })),
);

// ClosedTodosView is the archive surface — lazy-loaded so the closed-pile
// rendering code (date grouping, restore controls, bulk ops) stays out of
// the initial newtab chunk. Default users who never click the Closed tab
// pay zero kB for the view itself; only the data-layer selectors imported
// by TodoList land in the shared chunk.
const ClosedTodosView = lazy(() =>
  import("@/components/closed/ClosedTodosView").then((m) => ({
    default: m.ClosedTodosView,
  })),
);

// Photos slideshow banner — lazy so the base64 photo cache and slideshow
// CSS only load when the feature is enabled. Mounted between the header
// and the tab bar (not as a tab) so the slideshow reads as a persistent
// widget rather than another planning surface. Hidden by default;
// visibility is flipped on after the first successful pick.
const Photos = lazy(() => import("@/sections/Photos"));

type Tab =
  | "today"
  | "sprint"
  | "long"
  | "gantt"
  | "reminders"
  | "calendar"
  | "closed";

const TABS: { id: Tab; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "sprint", label: "Sprint" },
  { id: "long", label: "Long-term" },
  { id: "gantt", label: "Gantt" },
  { id: "calendar", label: "Calendar" },
  { id: "reminders", label: "Reminders" },
  // "Closed" sits at the rightmost slot — archival semantics. Always visible
  // (no sectionVisibility gate) so the destination promised by the close
  // action is always findable; see .claude/notes/closed-todos-research-B.md §3.
  { id: "closed", label: "Closed" },
];

function greetingFor(
  d: Date,
  schedule: "standard" | "earlyBird" | "nightOwl" = "standard",
): string {
  const h = d.getHours();
  // Cutoffs: [stillUp, morning→afternoon, afternoon→evening]
  const [nightCutoff, afternoonCutoff, eveningCutoff] =
    schedule === "earlyBird"
      ? ([4, 11, 16] as const)
      : schedule === "nightOwl"
        ? ([6, 13, 18] as const)
        : ([5, 12, 17] as const); // standard
  if (h < nightCutoff) return "Still up";
  if (h < afternoonCutoff) return "Good morning";
  if (h < eveningCutoff) return "Good afternoon";
  return "Good evening";
}

// Header owns its own 1-second tick so the rest of App doesn't re-render
// on each clock update (Pattern F).
const Header = memo(function Header() {
  const { state } = useStore();
  const [now, setNow] = useState(() => new Date());
  // Deep-link: `?settings=<paneId>` opens the modal to that pane on first
  // load. Read once at mount; subsequent opens go to the persisted lastPane.
  // `pendingInitialPane` is undefined unless the URL param was present and
  // valid — passed through to SettingsModal which prefers it over lastPane.
  const [pendingInitialPane, setPendingInitialPane] = useState<
    SettingsPaneId | undefined
  >(() => readSettingsParam());
  const [settingsOpen, setSettingsOpen] = useState(
    () => pendingInitialPane !== undefined,
  );
  const [chatOpen, setChatOpen] = useState(false);
  useThemeSync(state.settings);
  useEffect(() => {
    // Strip the param so a refresh doesn't keep re-opening the modal.
    // Runs after we've captured the value into state.
    if (pendingInitialPane !== undefined) stripSettingsParam();
  }, [pendingInitialPane]);
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
      : `${greetingFor(now, rs.greetingSchedule)}${name ? `, ${name}` : ""}.`;
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
              <MessageCircle size={20} aria-hidden="true" />
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
            <Settings size={20} aria-hidden="true" />
          </button>
        </div>
      </header>
      <Suspense fallback={null}>
        <SettingsModal
          open={settingsOpen}
          onClose={() => {
            setSettingsOpen(false);
            // Clear the one-shot deep-link prop after the modal closes so
            // a manual gear-click reopens to the persisted lastPane.
            setPendingInitialPane(undefined);
          }}
          {...(pendingInitialPane !== undefined
            ? { initialPane: pendingInitialPane }
            : {})}
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

/**
 * Mapping from Tab id to sectionVisibility key.
 *
 * "closed" is intentionally absent — the Closed tab is always-visible (see
 * the TABS comment above and research-B.md §3 for the rationale). The
 * `visibleTabs` memo below treats Closed as unconditionally visible.
 */
const TAB_KEY: Record<
  Exclude<Tab, "closed">,
  Exclude<keyof ResolvedUserSettings["sectionVisibility"], "photos">
> = {
  today: "today",
  sprint: "sprint",
  long: "longTerm",
  gantt: "gantt",
  reminders: "reminders",
  calendar: "calendar",
};

/** Tabs whose visibility is user-controllable via Settings → Dashboard. */
function isVisibilityGated(tabId: Tab): tabId is Exclude<Tab, "closed"> {
  return tabId !== "closed";
}

export default function App() {
  const [tab, setTab] = useState<Tab>("today");
  // m5-s9 (UPL-3): which tab currently owns the staggered-reveal animation.
  // Seeded from `tab` so first paint plays the cascade AND so any future
  // change to the initial-tab source (e.g. honoring chrome.storage's last-
  // active-tab) is reflected here automatically (m5 rect L1). The useRef-
  // tracked timeout below clears this ~250 ms after each tab change so
  // subsequent storage-driven re-renders never replay the animation
  // mid-display. brief-2 §4 risk: rapid tab switching must cancel the
  // pending timeout before scheduling a new one.
  const [staggeredTab, setStaggeredTab] = useState<Tab | null>(tab);
  const staggerTimeoutRef = useRef<number | undefined>(undefined);

  // m4-s11 (UPL-2): which tab is currently fading OUT during a cross-
  // dissolve. The useLayoutEffect below captures the previous tab via
  // prevTabRef and sets leavingTab=prev whenever tab changes, then
  // schedules a 250 ms clear (matches the m5 stagger precedent; gives
  // a small safety buffer past the CSS 220 ms transition before hidden=
  // reasserts). Initial null is correct — there is no leaving panel on
  // first paint. App.css §section-fade handles the visual cross-dissolve:
  // [data-leaving] panel position:absolute over the incoming one, opacity
  // transition 1→0; the incoming panel runs @keyframes tabpanel-fade-in
  // with fill-mode:both. `inert` is set on the leaving panel as the
  // load-bearing a11y guard (blocks Tab + a11y tree while hidden=false
  // for the 220 ms fade window).
  const [leavingTab, setLeavingTab] = useState<Tab | null>(null);
  const leavingTimeoutRef = useRef<number | undefined>(undefined);
  const prevTabRef = useRef<Tab>(tab);
  const { state } = useStore();
  const rs = useMemo(() => resolvedSettings(state.settings), [state.settings]);

  // useLayoutEffect (not useEffect) so the data-staggered toggle commits
  // BEFORE the browser paints the new tab's contents. Otherwise items
  // would flash visible for ~1 frame at full opacity, then jump back to
  // opacity 0 when the animation's `from` state takes hold — a visible
  // FOUC on every tab switch (m5 rect M6 from web-perf critic).
  // The effect is synchronous + cheap (two state sets and a setTimeout
  // schedule), so the layout-blocking cost is negligible.
  useLayoutEffect(() => {
    setStaggeredTab(tab);
    if (staggerTimeoutRef.current !== undefined) {
      window.clearTimeout(staggerTimeoutRef.current);
    }
    staggerTimeoutRef.current = window.setTimeout(() => {
      // Clear so subsequent storage-update re-renders see staggeredTab !== tab
      // and don't apply data-staggered="true".
      setStaggeredTab((current) => (current === tab ? null : current));
      staggerTimeoutRef.current = undefined;
    }, 250);
    return () => {
      if (staggerTimeoutRef.current !== undefined) {
        window.clearTimeout(staggerTimeoutRef.current);
        staggerTimeoutRef.current = undefined;
      }
    };
  }, [tab]);

  // m4-s11 (UPL-2): cross-dissolve state machine. Capture the previous
  // tab via prevTabRef so we know which panel was OUTGOING on each tab
  // change; set it as leavingTab for 250 ms, then clear so hidden=
  // reasserts and the panel exits the layout. Cancel any pending
  // timeout on rapid switching (same useRef pattern as the stagger
  // above — proven canonical in m5-s9). useLayoutEffect commits the
  // data-leaving + inert toggles synchronously before the browser
  // paints, eliminating the same paint-frame flash class as m5 rect M6.
  useLayoutEffect(() => {
    const prev = prevTabRef.current;
    if (prev !== tab) {
      setLeavingTab(prev);
      if (leavingTimeoutRef.current !== undefined) {
        window.clearTimeout(leavingTimeoutRef.current);
      }
      leavingTimeoutRef.current = window.setTimeout(() => {
        // Clear only if still tracking the same outgoing tab. Functional
        // updater avoids racing a more-recent leavingTab set from a
        // subsequent tab change.
        setLeavingTab((current) => (current === prev ? null : current));
        leavingTimeoutRef.current = undefined;
      }, 250);
    }
    prevTabRef.current = tab;
    return () => {
      if (leavingTimeoutRef.current !== undefined) {
        window.clearTimeout(leavingTimeoutRef.current);
        leavingTimeoutRef.current = undefined;
      }
    };
  }, [tab]);

  const visibleTabs = useMemo(
    () =>
      TABS.filter((t) =>
        isVisibilityGated(t.id) ? rs.sectionVisibility[TAB_KEY[t.id]] : true,
      ),
    [rs.sectionVisibility],
  );

  // If the active tab gets hidden via settings, fall back to the first
  // visible one so the dashboard never renders an "invisible" section.
  // The Closed tab is unconditionally visible so this guard only fires for
  // visibility-gated tabs.
  useEffect(() => {
    if (visibleTabs.length === 0) return;
    if (isVisibilityGated(tab) && !rs.sectionVisibility[TAB_KEY[tab]]) {
      const firstVisible = visibleTabs[0];
      if (firstVisible) {
        // m4 rect L4: skip the cross-dissolve for visibility-driven tab
        // changes — the outgoing panel's <div> is unmounted by the
        // conditional render gate, so a fade-out has no DOM node to apply
        // to. Sync prevTabRef to the incoming tab BEFORE setTab so the
        // leavingTab useLayoutEffect sees prev === tab and skips
        // setLeavingTab(prev). Also cancel any in-flight timeout.
        prevTabRef.current = firstVisible.id;
        if (leavingTimeoutRef.current !== undefined) {
          window.clearTimeout(leavingTimeoutRef.current);
          leavingTimeoutRef.current = undefined;
        }
        setLeavingTab(null);
        setTab(firstVisible.id);
      }
    }
  }, [rs.sectionVisibility, tab, visibleTabs]);

  // Listen for cross-section "jump to Closed" requests from the counter
  // affordance in each active section. Cleanup on unmount keeps the listener
  // scoped to App's lifetime.
  useEffect(() => {
    const handler = () => setTab("closed");
    window.addEventListener(NAV_CLOSED_EVENT, handler);
    return () => window.removeEventListener(NAV_CLOSED_EVENT, handler);
  }, []);

  return (
    <LazyMotion features={loadDomAnimation} strict>
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

        {/* QuickPrompt — always-visible Nano prompt. Renders nothing when the
            feature toggle is off OR Nano is unavailable OR we're in card mode.
            Suspense fallback is null so layout doesn't shift while the lazy
            chunk loads. */}
        <Suspense fallback={null}>
          <QuickPrompt />
        </Suspense>

        {/* Photos banner — sits between header/QuickPrompt and the tab bar.
            The Photos component itself returns null when no photos are
            cached, so the slot collapses cleanly until the user picks. The
            sectionVisibility.photos toggle still gates whether the banner
            is even rendered for users who want to hide it. */}
        {rs.sectionVisibility.photos && (
          <Suspense fallback={null}>
            <Photos />
          </Suspense>
        )}

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
              hidden={tab !== "today" && leavingTab !== "today"}
              data-staggered={staggeredTab === "today" ? "true" : undefined}
              data-leaving={leavingTab === "today" ? "true" : undefined}
              inert={leavingTab === "today" ? true : undefined}
            >
              <Today />
            </div>
          )}
          {rs.sectionVisibility.sprint && (
            <div
              id="tabpanel-sprint"
              role="tabpanel"
              aria-labelledby="tab-btn-sprint"
              hidden={tab !== "sprint" && leavingTab !== "sprint"}
              data-staggered={staggeredTab === "sprint" ? "true" : undefined}
              data-leaving={leavingTab === "sprint" ? "true" : undefined}
              inert={leavingTab === "sprint" ? true : undefined}
            >
              <Sprint />
            </div>
          )}
          {rs.sectionVisibility.longTerm && (
            <div
              id="tabpanel-long"
              role="tabpanel"
              aria-labelledby="tab-btn-long"
              hidden={tab !== "long" && leavingTab !== "long"}
              data-staggered={staggeredTab === "long" ? "true" : undefined}
              data-leaving={leavingTab === "long" ? "true" : undefined}
              inert={leavingTab === "long" ? true : undefined}
            >
              <LongTerm />
            </div>
          )}
          {rs.sectionVisibility.gantt && (
            <div
              id="tabpanel-gantt"
              role="tabpanel"
              aria-labelledby="tab-btn-gantt"
              hidden={tab !== "gantt" && leavingTab !== "gantt"}
              data-leaving={leavingTab === "gantt" ? "true" : undefined}
              inert={leavingTab === "gantt" ? true : undefined}
            >
              <Gantt />
            </div>
          )}
          {rs.sectionVisibility.reminders && (
            <div
              id="tabpanel-reminders"
              role="tabpanel"
              aria-labelledby="tab-btn-reminders"
              hidden={tab !== "reminders" && leavingTab !== "reminders"}
              data-leaving={leavingTab === "reminders" ? "true" : undefined}
              inert={leavingTab === "reminders" ? true : undefined}
            >
              <Reminders />
            </div>
          )}
          {rs.sectionVisibility.calendar && (
            <div
              id="tabpanel-calendar"
              role="tabpanel"
              aria-labelledby="tab-btn-calendar"
              hidden={tab !== "calendar" && leavingTab !== "calendar"}
              data-leaving={leavingTab === "calendar" ? "true" : undefined}
              inert={leavingTab === "calendar" ? true : undefined}
            >
              <Suspense fallback={null}>
                <Calendar
                  onTabChange={(t) => {
                    // Guard: only switch to a valid Tab value. "closed" is
                    // intentionally accepted here so Calendar (or a future
                    // sub-component) can deep-link to the archive.
                    const valid: Tab[] = [
                      "today",
                      "sprint",
                      "long",
                      "gantt",
                      "reminders",
                      "calendar",
                      "closed",
                    ];
                    if ((valid as string[]).includes(t)) setTab(t as Tab);
                  }}
                />
              </Suspense>
            </div>
          )}
          {/* Closed surface — always rendered (unconditional visibility) and
              lazy-loaded so its rendering code stays out of the initial chunk
              until the user actually opens the tab. */}
          <div
            id="tabpanel-closed"
            role="tabpanel"
            aria-labelledby="tab-btn-closed"
            hidden={tab !== "closed" && leavingTab !== "closed"}
            data-leaving={leavingTab === "closed" ? "true" : undefined}
            inert={leavingTab === "closed" ? true : undefined}
          >
            <Suspense fallback={null}>
              <ClosedTodosView />
            </Suspense>
          </div>
          {visibleTabs.length === 0 && (
            <div className="section-empty">
              All sections are hidden. Open Settings to re-enable one.
            </div>
          )}
        </main>
      </div>
    </LazyMotion>
  );
}
