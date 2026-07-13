import {
  Fragment,
  lazy,
  memo,
  Suspense,
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { LazyMotion } from "motion/react";
import { Toaster } from "sonner";
import {
  ArrowLeftRight,
  Maximize2,
  MessageCircle,
  Minimize2,
  Settings,
} from "lucide-react";
import "./App.css";
import { Today } from "@/sections/Today";
import { Sprint } from "@/sections/Sprint";
import { LongTerm } from "@/sections/LongTerm";
import { Gantt } from "@/sections/Gantt";
import { Reminders } from "@/sections/Reminders";
import { EmbedFrame } from "@/components/embed/EmbedFrame";
import { useStore } from "@/storage/useStore";
import { storage } from "@/storage/storage";
import { configure as configureObservability } from "@/observability/logger";
import type { SettingsPaneId } from "@/types";
import {
  clampCompanionWidth,
  companionWidthBounds,
  WORKSPACE_COMPANION_DEFAULT_WIDTH,
} from "@/lib/workspaceSizing";
import { CompanionResizeHandle } from "./CompanionResizeHandle";
import {
  surfacesInGroup,
  WORKSPACE_GROUPS,
  WORKSPACE_SURFACES,
  workspaceSurface,
  type WorkspaceSurface,
} from "./workspace";

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
  "googleCalendar",
  "roadmaps",
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
import { resolvedSettings, NAV_CLOSED_EVENT, OPEN_SETTINGS_EVENT } from "@/storage/constants";
import { useThemeSync } from "@/hooks/useThemeSync";
import { ReminderAlerts } from "@/components/alerts/ReminderAlerts";
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

// Photos is a first-class Memory workspace. It stays lazy so the base64 cache
// and media CSS never land in the initial chunk for users who leave it hidden.
const Photos = lazy(() => import("@/sections/Photos"));

// Keyboard help overlay — lazy so the shortcut-list component and its CSS
// stay out of the initial chunk. Loads only on first Cmd+/ press.
const KeyboardHelpOverlay = lazy(
  () => import("@/components/help/KeyboardHelpOverlay"),
);

// Command palette — lazy so cmdk + all Radix Dialog peers (~48 kB minified /
// ~16 kB gz) stay OUT OF THE INITIAL CHUNK. They land in a separate
// `CommandPalette-*.js` chunk. Note (m11 rect L2): the chunk FETCH itself
// happens in parallel during app warm-up because Suspense renders the
// component with `open=false` on App's first render — it's not strictly
// "fetched on first Cmd+K press." The user-perceived rendering is gated
// by `open`, not by the chunk fetch. All cmdk imports are confined to
// CommandPalette.tsx; none leak into this file.
const CommandPalette = lazy(
  () => import("@/components/palette/CommandPalette"),
);

// m11 rect M2: Tab type hoisted to @/types/index.ts so children (CommandPalette,
// and any future palette/keyboard-shell consumers) don't have to inverse-import
// from this parent file. Re-exported here for back-compat with any in-flight
// PRs that still reference `@/newtab/App`.
import type { Tab } from "@/types";
export type { Tab };

// Embedded-website tabs. These render external sites in an <iframe> rather
// than a planning surface. OSINT is the user's own tool (osint-6g5.pages.dev)
// and frames cleanly; Finances embeds app.monarch.com, made frame-able by the
// declarativeNetRequest header-strip ruleset in the manifest. Both are
// always-visible (like Closed) — they are not sectionVisibility-gated.
const OSINT_URL = "https://osint-6g5.pages.dev/";
const MONARCH_URL = "https://app.monarch.com/";
// Monarch sandbox: allow the app to actually run (scripts, its own-origin
// storage, forms, OAuth popups, modals) but deliberately WITHOUT
// `allow-top-navigation`, so frame-busting scripts can't hijack the new-tab
// page. `allow-storage-access-by-user-activation` lets Monarch request its
// first-party cookies via the Storage Access API when embedded third-party.
const MONARCH_SANDBOX =
  "allow-same-origin allow-scripts allow-forms allow-popups " +
  "allow-popups-to-escape-sandbox allow-modals " +
  "allow-storage-access-by-user-activation";

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

interface HeaderProps {
  surface: WorkspaceSurface;
  visibleTabs: readonly WorkspaceSurface[];
  companionTab: Tab | null;
  focusMode: boolean;
  canShowCompanion: boolean;
  onCompanionChange: (tab: Tab | null) => void;
  onSwap: () => void;
  onToggleFocus: () => void;
}

// Header owns its own 1-second tick so the rest of App doesn't re-render
// on each clock update (Pattern F).
const Header = memo(function Header({
  surface,
  visibleTabs,
  companionTab,
  focusMode,
  canShowCompanion,
  onCompanionChange,
  onSwap,
  onToggleFocus,
}: HeaderProps) {
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
  // Bridge shell actions to the settings modal without prop-drilling. A
  // SettingsPaneId detail lets Photos deep-link to its setup pane; callers
  // without a detail retain the normal last-pane behavior.
  useEffect(() => {
    const handler = (event: Event) => {
      const pane = (event as CustomEvent<SettingsPaneId>).detail;
      if (pane && SETTINGS_PANE_IDS.has(pane)) setPendingInitialPane(pane);
      setSettingsOpen(true);
    };
    window.addEventListener(OPEN_SETTINGS_EVENT, handler);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, handler);
  }, []);
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
  const groupLabel =
    WORKSPACE_GROUPS.find((group) => group.id === surface.group)?.label ?? "Workspace";
  const companionSurface = companionTab ? workspaceSurface(companionTab) : null;

  return (
    <>
      <header className="header">
        <div className="header-left">
          <div className="workspace-kicker">{groupLabel}</div>
          <div className="workspace-title-row">
            <h1>{surface.label}</h1>
            {companionSurface && (
              <span className="workspace-companion-status">
                + {companionSurface.label}
                {!canShowCompanion ? " on wide windows" : ""}
              </span>
            )}
          </div>
          <p className="workspace-description">{surface.description}</p>
        </div>
        <div className="header-right">
          <div className="header-day-context">
            {greeting && <span className="greeting">{greeting}</span>}
            <span className="date">
              {now.toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
          <div className="clock" aria-label={`Current time ${now.toLocaleTimeString(undefined, timeOpts)}`}>
            {now.toLocaleTimeString(undefined, timeOpts)}
          </div>
          {canShowCompanion && (
            <label className="companion-picker">
              <span>Companion</span>
              <select
                value={companionTab ?? ""}
                onChange={(event) =>
                  onCompanionChange(
                    event.target.value ? (event.target.value as Tab) : null,
                  )
                }
              >
                <option value="">None</option>
                {visibleTabs
                  .filter((candidate) => candidate.id !== surface.id)
                  .map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.label}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {canShowCompanion && companionSurface && (
            <button
              type="button"
              className="workspace-action workspace-swap-action"
              onClick={onSwap}
              title="Swap primary and companion workspaces"
            >
              <ArrowLeftRight size={15} aria-hidden="true" />
              <span>Swap</span>
            </button>
          )}
          <button
            type="button"
            className="workspace-action"
            aria-pressed={focusMode}
            onClick={onToggleFocus}
            title={focusMode ? "Exit focus mode" : "Focus the primary workspace"}
          >
            {focusMode ? (
              <Minimize2 size={15} aria-hidden="true" />
            ) : (
              <Maximize2 size={15} aria-hidden="true" />
            )}
            <span>{focusMode ? "Exit focus" : "Focus"}</span>
          </button>
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
 * "closed", "osint" and "finance" are intentionally absent — archive and
 * external-workspace destinations are always findable. Photos remains coupled
 * to its setup flow and appears once sectionVisibility.photos is enabled.
 */
type GatedTab = Exclude<Tab, "closed" | "osint" | "finance">;
const TAB_KEY: Record<
  GatedTab,
  keyof ResolvedUserSettings["sectionVisibility"]
> = {
  today: "today",
  sprint: "sprint",
  long: "longTerm",
  gantt: "gantt",
  reminders: "reminders",
  calendar: "calendar",
  photos: "photos",
};

/** Tabs whose visibility is user-controllable via Settings → Dashboard. */
function isVisibilityGated(tabId: Tab): tabId is GatedTab {
  return tabId !== "closed" && tabId !== "osint" && tabId !== "finance";
}

export default function App() {
  // OSINT is the default tab on new-tab open (user preference).
  const [tab, setTab] = useState<Tab>("osint");
  // A wide workspace may opt into one companion. The choice stays in memory
  // when focus mode or a narrow viewport collapses the split.
  const [companionTab, setCompanionTab] = useState<Tab | null>(null);
  const [companionWidth, setCompanionWidth] = useState(
    WORKSPACE_COMPANION_DEFAULT_WIDTH,
  );
  const [workspaceInlineSize, setWorkspaceInlineSize] = useState<
    number | undefined
  >(undefined);
  const [companionResizing, setCompanionResizing] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [canShowCompanion, setCanShowCompanion] = useState(() =>
    window.matchMedia("(min-width: 1280px)").matches,
  );
  const workspaceNavRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLElement | null>(null);
  const [navOverflow, setNavOverflow] = useState({
    before: false,
    after: false,
  });
  // m10: keyboard help overlay toggle state. Cmd+/ (Mac) / Ctrl+/ (Win/Linux)
  // opens/closes the help overlay. Lazy-loaded on first open.
  const [helpOpen, setHelpOpen] = useState(false);
  useHotkeys(
    "mod+slash",
    () => setHelpOpen((open) => !open),
    { preventDefault: true, description: "Show keyboard shortcuts" },
  );
  // m11: command palette toggle state. Cmd+K (Mac) / Ctrl+K (Win/Linux)
  // opens/closes the palette. Lazy-loaded on first open; cmdk lands only in
  // the lazy CommandPalette-*.js chunk, not this initial chunk.
  // preventDefault overrides Chrome's address-bar Cmd+K behavior (consistent
  // with the mod+slash precedent from m10).
  const [paletteOpen, setPaletteOpen] = useState(false);
  // enableOnFormTags: true is REQUIRED (m11 rect H1) — when the palette opens,
  // focus moves into <Command.Input>, and react-hotkeys-hook's default
  // behavior skips firing when the target is a form element. Without this,
  // Cmd+K can OPEN the palette but cannot TOGGLE it closed while typing
  // (the user has to Escape or click the backdrop). Matches the precedent
  // ChatPanel uses for its Escape hotkey.
  useHotkeys(
    "mod+k",
    () => setPaletteOpen((open) => !open),
    {
      preventDefault: true,
      enableOnFormTags: true,
      description: "Open command palette",
    },
  );
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
  const { state, update } = useStore();
  const rs = useMemo(() => resolvedSettings(state.settings), [state.settings]);

  useEffect(() => {
    setCompanionWidth(rs.workspaceCompanionWidthPx);
  }, [rs.workspaceCompanionWidthPx]);

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const setMeasuredWidth = (width: number) => {
      const rounded = Math.round(width);
      setWorkspaceInlineSize((current) =>
        current === rounded ? current : rounded,
      );
    };
    const styles = window.getComputedStyle(content);
    setMeasuredWidth(
      content.getBoundingClientRect().width -
        Number.parseFloat(styles.paddingLeft) -
        Number.parseFloat(styles.paddingRight),
    );

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setMeasuredWidth(entry.contentRect.width);
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  const companionBounds = useMemo(
    () => companionWidthBounds(workspaceInlineSize),
    [workspaceInlineSize],
  );
  const effectiveCompanionWidth = clampCompanionWidth(
    companionWidth,
    workspaceInlineSize,
  );
  const contentStyle = {
    "--workspace-companion-size": `${effectiveCompanionWidth}px`,
  } as CSSProperties & { "--workspace-companion-size": string };

  const previewCompanionWidth = useCallback((nextWidth: number) => {
    contentRef.current?.style.setProperty(
      "--workspace-companion-size",
      `${nextWidth}px`,
    );
  }, []);

  const commitCompanionWidth = useCallback(
    (nextWidth: number) => {
      const preferredWidth = clampCompanionWidth(nextWidth);
      setCompanionWidth(preferredWidth);
      void update((current) => ({
        ...current,
        settings: {
          ...current.settings,
          workspaceCompanionWidthPx: preferredWidth,
        },
      }));
    },
    [update],
  );

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1280px)");
    const onChange = (event: MediaQueryListEvent) => setCanShowCompanion(event.matches);
    setCanShowCompanion(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

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
      WORKSPACE_SURFACES.filter((surface) =>
        isVisibilityGated(surface.id)
          ? rs.sectionVisibility[TAB_KEY[surface.id]]
          : true,
      ),
    [rs.sectionVisibility],
  );

  // The navigation becomes a horizontal strip below 1280px. Track both
  // clipped edges so CSS can provide an honest, bidirectional overflow cue.
  useEffect(() => {
    const nav = workspaceNavRef.current;
    if (!nav) return;
    const updateOverflow = () => {
      const before = nav.scrollLeft > 2;
      const after = nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 2;
      setNavOverflow((current) =>
        current.before === before && current.after === after
          ? current
          : { before, after },
      );
    };
    updateOverflow();
    nav.addEventListener("scroll", updateOverflow, { passive: true });
    const observer = new ResizeObserver(updateOverflow);
    observer.observe(nav);
    return () => {
      nav.removeEventListener("scroll", updateOverflow);
      observer.disconnect();
    };
  }, [visibleTabs]);

  const handleSelectTab = useCallback(
    (next: Tab) => {
      if (next === tab) return;
      // Selecting the current companion promotes it and keeps the old primary
      // as the companion. This makes rail and command-palette navigation
      // predictable while preserving the user's two-surface arrangement.
      if (next === companionTab) setCompanionTab(tab);
      setTab(next);
    },
    [companionTab, tab],
  );

  const handleCompanionChange = useCallback(
    (next: Tab | null) => setCompanionTab(next === tab ? null : next),
    [tab],
  );

  const handleSwap = useCallback(() => {
    if (!companionTab) return;
    const previousPrimary = tab;
    setTab(companionTab);
    setCompanionTab(previousPrimary);
  }, [companionTab, tab]);

  const splitActive =
    canShowCompanion && !focusMode && companionTab !== null && companionTab !== tab;

  // Pointer previews mutate the CSS custom property directly to avoid
  // re-rendering iframe-heavy panels on every move. Reassert React's resolved
  // width whenever the split lifecycle changes so an interrupted drag can
  // never leave an imperative preview behind.
  useLayoutEffect(() => {
    previewCompanionWidth(effectiveCompanionWidth);
  }, [effectiveCompanionWidth, previewCompanionWidth, splitActive]);

  // Each external workspace mounts only after first use, then stays warm.
  // There are exactly two bounded embeds, so this preserves their in-frame
  // navigation/session UI without returning to eager Finance network work.
  const [visitedEmbeds, setVisitedEmbeds] = useState<
    ReadonlySet<"osint" | "finance">
  >(() => new Set(["osint"]));
  useEffect(() => {
    const nextEmbed =
      tab === "osint" || tab === "finance"
        ? tab
        : splitActive &&
            (companionTab === "osint" || companionTab === "finance")
          ? companionTab
          : null;
    if (!nextEmbed) return;
    setVisitedEmbeds((current) => {
      if (current.has(nextEmbed)) return current;
      const next = new Set(current);
      next.add(nextEmbed);
      return next;
    });
  }, [companionTab, splitActive, tab]);

  const shouldMountEmbed = (id: "osint" | "finance") =>
    tab === id ||
    (splitActive && companionTab === id) ||
    leavingTab === id ||
    visitedEmbeds.has(id);

  const panelSlot = (id: Tab): "primary" | "companion" | undefined =>
    id === tab ? "primary" : splitActive && id === companionTab ? "companion" : undefined;
  const panelIsLeaving = (id: Tab) => !splitActive && leavingTab === id;
  const panelIsVisible = (id: Tab) => panelSlot(id) !== undefined || panelIsLeaving(id);
  // React 18 predates first-class inert typing. The empty string is the
  // standards-correct boolean-attribute value and avoids React's warning for
  // `inert={true}` while retaining the existing transition accessibility guard.
  const inertWhenLeaving = (id: Tab) =>
    panelIsLeaving(id) ? ("" as unknown as boolean) : undefined;

  // Keep the DOM and keyboard focus order aligned with the visual workspace:
  // primary first, companion second, then the outgoing/resting panels. Stable
  // section keys let React move each mounted panel without resetting its local
  // component state.
  const orderedPanelIds = useMemo(() => {
    const rank = (id: Tab) => {
      if (id === tab) return 0;
      if (splitActive && id === companionTab) return 1;
      if (!splitActive && id === leavingTab) return 2;
      return 3;
    };

    return visibleTabs
      .map((surface, registryIndex) => ({
        id: surface.id,
        rank: rank(surface.id),
        registryIndex,
      }))
      .sort((a, b) => a.rank - b.rank || a.registryIndex - b.registryIndex)
      .map(({ id }) => id);
  }, [companionTab, leavingTab, splitActive, tab, visibleTabs]);

  useEffect(() => {
    document.getElementById(`workspace-nav-${tab}`)?.scrollIntoView({
      block: "nearest",
      inline: "center",
      behavior: "auto",
    });
  }, [tab]);

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
        setCompanionTab((current) =>
          current === firstVisible.id ? null : current,
        );
        setTab(firstVisible.id);
      }
    }
  }, [rs.sectionVisibility, tab, visibleTabs]);

  // A setup toggle can hide the companion while the primary remains valid.
  useEffect(() => {
    if (
      companionTab !== null &&
      !visibleTabs.some((surface) => surface.id === companionTab)
    ) {
      setCompanionTab(null);
    }
  }, [companionTab, visibleTabs]);

  // Listen for cross-section "jump to Closed" requests from the counter
  // affordance in each active section. Cleanup on unmount keeps the listener
  // scoped to App's lifetime.
  useEffect(() => {
    const handler = () => handleSelectTab("closed");
    window.addEventListener(NAV_CLOSED_EVENT, handler);
    return () => window.removeEventListener(NAV_CLOSED_EVENT, handler);
  }, [handleSelectTab]);

  // Phase G: roadmap write-back detector. An INDEPENDENT storage subscription
  // (not the useStore render path) snapshots rm:-prefixed todos' `done` flags
  // and, on any transition, dynamic-imports the write-back handler. This is the
  // ONLY roadmap code in the initial newtab chunk — the tiny diff loop; both
  // ingest.ts and sync.ts stay out of the static graph via import(). Freshly-
  // ingested mirror todos have no prior snapshot entry, so they never emit
  // (prev === undefined). Mounted once.
  useEffect(() => {
    const snapshot = new Map<string, boolean>();
    let seeded = false;
    const seed = (todos: ReadonlyArray<{ id: string; done: boolean }>) => {
      for (const t of todos) {
        if (t.id.startsWith("rm:")) snapshot.set(t.id, t.done);
      }
      seeded = true;
    };
    void storage.get().then((s) => {
      if (!seeded) seed(s.todos);
    });
    const unsub = storage.subscribe((next) => {
      if (!seeded) {
        seed(next.todos);
        return;
      }
      for (const t of next.todos) {
        if (!t.id.startsWith("rm:")) continue;
        const prev = snapshot.get(t.id);
        snapshot.set(t.id, t.done);
        if (prev !== undefined && prev !== t.done) {
          const done = t.done;
          const id = t.id;
          void import("@/lib/roadmap/sync").then((m) =>
            m.onMirrorToggle(id, done),
          );
        }
      }
    });
    return unsub;
  }, []);

  // Phase G: optional auto-sync on new-tab open. Off by default; gated so the
  // heavy sync path is import()-ed only when the user opts in. Reads the
  // setting captured at mount.
  useEffect(() => {
    if (rs.roadmap.autoSyncOnOpen) {
      void import("@/lib/roadmap/sync").then((m) => m.syncNow());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderWorkspacePanel = (id: Tab) => {
    let modifier: "embed" | "list" | "tool" | "media";
    let content: ReactNode;

    switch (id) {
      case "osint":
        modifier = "embed";
        content = shouldMountEmbed("osint") ? (
          <EmbedFrame src={OSINT_URL} title="OSINT" />
        ) : null;
        break;
      case "today":
        modifier = "list";
        content = <Today />;
        break;
      case "sprint":
        modifier = "list";
        content = <Sprint />;
        break;
      case "long":
        modifier = "list";
        content = <LongTerm />;
        break;
      case "gantt":
        modifier = "tool";
        content = <Gantt />;
        break;
      case "reminders":
        modifier = "list";
        content = <Reminders />;
        break;
      case "calendar":
        modifier = "tool";
        content = (
          <Suspense fallback={null}>
            <Calendar
              onTabChange={(next) => {
                const destination = WORKSPACE_SURFACES.find(
                  (surface) => surface.id === next,
                );
                if (destination) handleSelectTab(destination.id);
              }}
            />
          </Suspense>
        );
        break;
      case "finance":
        modifier = "embed";
        content = shouldMountEmbed("finance") ? (
          <EmbedFrame
            src={MONARCH_URL}
            title="Finances"
            sandbox={MONARCH_SANDBOX}
            note="If Monarch will not stay signed in here, use the external workspace."
          />
        ) : null;
        break;
      case "photos":
        modifier = "media";
        content = (
          <Suspense fallback={null}>
            <Photos
              active={panelIsVisible("photos") && !panelIsLeaving("photos")}
            />
          </Suspense>
        );
        break;
      case "closed":
        modifier = "list";
        content = (
          <Suspense fallback={null}>
            <ClosedTodosView />
          </Suspense>
        );
        break;
    }

    const staggered =
      (id === "today" || id === "sprint" || id === "long") &&
      staggeredTab === id;

    return (
      <section
        key={id}
        id={`workspace-panel-${id}`}
        role="region"
        aria-labelledby={`workspace-nav-${id}`}
        className={`workspace-panel workspace-panel--${modifier}`}
        hidden={!panelIsVisible(id)}
        data-slot={panelSlot(id)}
        data-staggered={staggered ? "true" : undefined}
        data-leaving={panelIsLeaving(id) ? "true" : undefined}
        inert={inertWhenLeaving(id)}
        aria-hidden={panelIsLeaving(id) ? true : undefined}
      >
        {content}
      </section>
    );
  };

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
      <div
        className="app"
        data-focus-mode={focusMode ? "true" : undefined}
        data-split={splitActive ? "true" : undefined}
      >
        <Header
          surface={workspaceSurface(tab)}
          visibleTabs={visibleTabs}
          companionTab={companionTab}
          focusMode={focusMode}
          canShowCompanion={canShowCompanion}
          onCompanionChange={handleCompanionChange}
          onSwap={handleSwap}
          onToggleFocus={() => setFocusMode((current) => !current)}
        />

        <aside className="workspace-rail" aria-label="Workspace navigation">
          <div className="workspace-brand">
            <span>Proclivity</span>
            <small>Field desk</small>
          </div>
          <nav
            ref={workspaceNavRef}
            className="workspace-nav"
            aria-label="Destinations"
            data-overflow-before={navOverflow.before ? "true" : undefined}
            data-overflow-after={navOverflow.after ? "true" : undefined}
          >
            {WORKSPACE_GROUPS.map((group) => {
              const groupSurfaces = surfacesInGroup(visibleTabs, group.id);
              if (groupSurfaces.length === 0) return null;
              return (
                <div className="workspace-nav-group" key={group.id}>
                  <div className="workspace-nav-label">{group.label}</div>
                  <div className="workspace-nav-items">
                    {groupSurfaces.map((surface) => (
                      <button
                        key={surface.id}
                        id={`workspace-nav-${surface.id}`}
                        type="button"
                        className="workspace-nav-button"
                        aria-label={`${surface.label}${
                          companionTab === surface.id
                            ? ", companion workspace"
                            : ""
                        }`}
                        aria-current={tab === surface.id ? "page" : undefined}
                        aria-controls={`workspace-panel-${surface.id}`}
                        data-companion={
                          companionTab === surface.id ? "true" : undefined
                        }
                        onClick={() => handleSelectTab(surface.id)}
                      >
                        <span>{surface.label}</span>
                        {companionTab === surface.id && (
                          <span className="workspace-nav-companion" aria-hidden="true">
                            +
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>
          <div className="workspace-rail-footer">
            <kbd>Ctrl K</kbd>
            <span>switch</span>
          </div>
        </aside>

        <div className="workspace-main">
          {/* QuickPrompt renders nothing when disabled; display:contents on the
              wrapper prevents an empty shell row. */}
          <div className="workspace-prompt">
            <Suspense fallback={null}>
              <QuickPrompt />
            </Suspense>
          </div>

          {/* Sections stay mounted to preserve drafts and local view state.
              The two external iframes use a bounded warm-cache policy above. */}
          <main
            ref={contentRef}
            className="content"
            data-split={splitActive ? "true" : undefined}
            data-resizing={companionResizing ? "true" : undefined}
            style={contentStyle}
            aria-label="Workspace panels"
          >
            {orderedPanelIds.map((id, index) => (
              <Fragment key={id}>
                {renderWorkspacePanel(id)}
                {splitActive && index === 0 && companionTab && (
                  <CompanionResizeHandle
                    width={effectiveCompanionWidth}
                    min={companionBounds.min}
                    max={companionBounds.max}
                    defaultWidth={WORKSPACE_COMPANION_DEFAULT_WIDTH}
                    workspaceInlineSize={workspaceInlineSize}
                    companionLabel={workspaceSurface(companionTab).label}
                    controlsId={`workspace-panel-${companionTab}`}
                    onPreview={previewCompanionWidth}
                    onCommit={commitCompanionWidth}
                    onDraggingChange={setCompanionResizing}
                  />
                )}
              </Fragment>
            ))}
            {visibleTabs.length === 0 && (
              <div className="section-empty">
                All sections are hidden. Open Settings to re-enable one.
              </div>
            )}
          </main>
        </div>
      </div>
      {/* Keyboard help overlay — outside .app so it renders above all sections
          via the Modal portal. Lazy-loaded; null fallback avoids layout shift. */}
      <Suspense fallback={null}>
        <KeyboardHelpOverlay
          open={helpOpen}
          onClose={() => setHelpOpen(false)}
        />
      </Suspense>
      {/* Command palette — outside .app so it renders above all sections via
          cmdk's Command.Dialog portal. Lazy-loaded; cmdk + Radix Dialog peers
          land in the CommandPalette-*.js chunk. visibleTabs is passed so
          section-switch commands respect the user's sectionVisibility settings.
          "Open Settings" is bridged via OPEN_SETTINGS_EVENT (custom event caught
          by Header()'s useEffect) — direct prop access is unavailable because
          setSettingsOpen lives in Header memo scope, not App() scope. */}
      <Suspense fallback={null}>
        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          onSwitchTab={handleSelectTab}
          onOpenHelp={() => setHelpOpen(true)}
          visibleTabs={visibleTabs}
        />
      </Suspense>
      {/* m8: sonner toast host — portals to document.body; positioned outside
          .app but inside LazyMotion for consistent provider context. Fixed
          duration={3500}; sonner's own CSS @media (prefers-reduced-motion)
          collapses animations natively — no JS useReducedMotion() wrapper
          needed.

          m8 rect M3 — `richColors` REMOVED: sonner's rich-color presets
          (success/error/warning/info) fail WCAG AA 4.5:1 contrast in
          light mode (lowest: warning at 3.07:1). Sonner's normal-mode
          color palette passes 10.5:1+ in both themes. Re-enable only if
          a future milestone adds proclivity-themed token overrides via
          `[data-rich-colors='true'][data-sonner-toast]` CSS.

          m8 rect L5 — `theme` now derived from `rs.theme` so sonner's
          color-scheme tracks the in-app theme toggle (was `theme="system"`
          which read only `prefers-color-scheme` and could diverge from
          the in-app state when OS=light + app=dark or vice versa). */}
      <Toaster
        position="bottom-right"
        theme={
          rs.theme === "dark" ? "dark" : rs.theme === "light" ? "light" : "system"
        }
        closeButton
        duration={3500}
      />
      {/* In-app reminder alerts — mirrors the SW's pending-alert queue into
          persistent toasts (duration: Infinity, explicit dismiss/snooze).
          Replaces chrome.notifications, whose OS-level delivery fails
          silently on macOS and Windows. Renders null; toasts land in the
          <Toaster> host above. */}
      <ReminderAlerts snoozeMinutes={rs.snoozeMinutes} />
    </LazyMotion>
  );
}
