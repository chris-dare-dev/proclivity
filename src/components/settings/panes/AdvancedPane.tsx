/**
 * AdvancedPane — settings pane for advanced / developer options.
 *
 * Renamed from "Developer" to "Advanced" per the research brief. Owns:
 *   - Verbose debug logging toggle (live)
 *   - Namespace filter text input (live)
 *   - Redact toggle + LogViewer (session-local state; not persisted)
 *
 * Agent B inserts into this pane:
 *   - 'focusRingMode' ToggleSwitch (Auto / Always visible) under an
 *     "Accessibility" sub-header above the Debug section (staged, apply on Done)
 *   - 'Replay onboarding hints' button that resets cardHintSeen and
 *     settingsV2Seen to false (immediate action, no Done/Cancel lifecycle)
 */

import { lazy, Suspense, useCallback, useState, type ReactNode } from "react";
import { ToggleSwitch } from "../SettingsControls";
import type { FocusRingMode, UserSettings } from "@/types";
import { useStore } from "@/storage/useStore";

// LogViewer is lazy so its bundle only loads when the user opens the Advanced
// pane with debug enabled. Same pattern as the previous DeveloperSection.
const LogViewer = lazy(() =>
  import("../LogViewer").then((m) => ({ default: m.LogViewer })),
);

function SectionHeader({ children }: { children: ReactNode }) {
  return <h3 className="settings-section-heading">{children}</h3>;
}

interface LiveUpdater {
  <K extends keyof UserSettings>(key: K, value: UserSettings[K]): void;
}

export interface AdvancedPaneProps {
  debugEnabled: boolean;
  debugNamespaces: string;
  live: LiveUpdater;
  // Staged
  pendingFocusRingMode: FocusRingMode;
  setPendingFocusRingMode: (v: FocusRingMode) => void;
}

export function AdvancedPane({
  debugEnabled,
  debugNamespaces,
  live,
  pendingFocusRingMode,
  setPendingFocusRingMode,
}: AdvancedPaneProps) {
  const updateDebug = (next: { enabled: boolean; namespaces: string }) => {
    live("debug", next);
  };

  // Redact toggle is session-local — not persisted. Default OFF.
  // Flip on before sharing logs publicly (see plans/observability-plan.md).
  const [redact, setRedact] = useState(false);

  // Replay hints: resets all one-shot onboarding flags immediately.
  const { update } = useStore();
  const [hintsResetFlash, setHintsResetFlash] = useState(false);
  const handleReplayHints = useCallback(() => {
    void update((s) => ({
      ...s,
      settings: {
        ...s.settings,
        settingsV2Seen: false,
        cardHintSeen: false,
        geminiNanoSeen: false,
      },
    }));
    setHintsResetFlash(true);
    window.setTimeout(() => setHintsResetFlash(false), 2500);
  }, [update]);

  return (
    <div
      role="tabpanel"
      id="settings-pane-advanced"
      aria-labelledby="settings-tab-advanced"
      className="settings-pane"
    >
      {/* ── Accessibility ─────────────────────────────────────── */}
      <section className="settings-section">
        <SectionHeader>Accessibility</SectionHeader>
        <ToggleSwitch
          label="Always show focus ring"
          checked={pendingFocusRingMode === "always"}
          onChange={(checked) =>
            setPendingFocusRingMode(checked ? "always" : "auto")
          }
          hint="When on, focus rings appear on all interactive elements, not only when navigating with a keyboard."
        />
      </section>

      {/* ── Onboarding hints ──────────────────────────────────── */}
      <section className="settings-section">
        <SectionHeader>Onboarding</SectionHeader>
        <div className="settings-field">
          <div className="settings-action-row">
            <button
              type="button"
              className="settings-action-btn"
              onClick={handleReplayHints}
            >
              Replay onboarding hints
            </button>
            {hintsResetFlash ? (
              <span className="settings-action-flash" role="status">
                Hints reset
              </span>
            ) : null}
          </div>
          <span className="settings-hint">
            Resets all first-run hints so they reappear the next time you
            interact with each feature.
          </span>
        </div>
      </section>

      <section className="settings-section">
        <SectionHeader>Debug</SectionHeader>

        <ToggleSwitch
          label="Verbose debug logging"
          checked={debugEnabled}
          onChange={(checked) =>
            updateDebug({ enabled: checked, namespaces: debugNamespaces })
          }
          hint={
            <>
              When on, <code>trace</code> and <code>debug</code> logs from
              matching namespaces print to the DevTools console, and{" "}
              <code>info</code> records persist to the on-device ring buffer
              (along with <code>warn</code>/<code>error</code>, which always
              persist).
            </>
          }
        />

        <div className="settings-field">
          <label
            className="settings-label"
            htmlFor="settings-debug-namespaces"
          >
            Namespace filter
          </label>
          <input
            id="settings-debug-namespaces"
            type="text"
            value={debugNamespaces}
            onChange={(e) =>
              updateDebug({
                enabled: debugEnabled,
                namespaces: e.target.value,
              })
            }
            placeholder="*"
            spellCheck={false}
          />
          <span className="settings-hint">
            Comma-separated DEBUG-style globs.{" "}
            <code>&quot;*&quot;</code> matches everything,{" "}
            <code>&quot;nano:*&quot;</code> matches the LLM namespaces only,{" "}
            <code>&quot;nano:*,!nano:download&quot;</code> matches all of{" "}
            <code>nano:</code> except <code>nano:download</code>.
          </span>
        </div>

        <div className="settings-field">
          <span className="settings-label">Log viewer</span>
          <ToggleSwitch
            label="Redact user-typed content"
            checked={redact}
            onChange={setRedact}
            hint={
              <>
                When on, fields likely to carry user-typed content (raw model
                output, prompts, titles, tag labels) are masked as{" "}
                <code>[redacted len=N]</code> in the rendered rows AND in any
                JSON copy/export. Default off; flip on before sharing logs.
              </>
            }
          />
          <Suspense
            fallback={<span className="settings-hint">Loading viewer…</span>}
          >
            <LogViewer redact={redact} />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
