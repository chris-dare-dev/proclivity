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

import { lazy, Suspense, useState, type ReactNode } from "react";
import { ToggleSwitch } from "../SettingsControls";
import type { UserSettings } from "@/types";

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
}

export function AdvancedPane({
  debugEnabled,
  debugNamespaces,
  live,
}: AdvancedPaneProps) {
  const updateDebug = (next: { enabled: boolean; namespaces: string }) => {
    live("debug", next);
  };

  // Redact toggle is session-local — not persisted. Default OFF.
  // Flip on before sharing logs publicly (see plans/observability-plan.md).
  const [redact, setRedact] = useState(false);

  return (
    <div
      role="tabpanel"
      id="settings-pane-advanced"
      aria-labelledby="settings-tab-advanced"
      className="settings-pane"
    >
      {/* Agent B: insert 'Accessibility' sub-section here (above Debug section) */}
      {/* Sub-section should include: */}
      {/*   - 'focusRingMode' ToggleSwitch: "Always show focus ring" (staged) */}
      {/*   - Hint: "When on, focus rings appear on all interactive elements, */}
      {/*     not only when using keyboard navigation." */}

      {/* Agent B: insert 'Replay onboarding hints' button here (above Debug section) */}
      {/*   - Resets cardHintSeen + settingsV2Seen to false via immediate update() */}
      {/*   - Show a brief flash confirmation ("Hints reset") */}

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
