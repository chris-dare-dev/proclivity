/**
 * AppearancePane — settings pane for visual appearance and background.
 *
 * Owns (all live-preview):
 *   - Theme (light / dark / system)
 *   - Accent color (preset swatches + custom picker)
 *   - Font size (sm / md / lg)
 *   - Density (compact / default / spacious)
 *   - Reduce motion
 *   - [sub-section] Background: mesh enabled, mesh intensity
 *
 * No Agent B additions planned for this pane (meshColor / meshColorMode deferred).
 */

import { useMemo, type ReactNode } from "react";
import { SegmentedControl, ToggleSwitch } from "../SettingsControls";
import type { DensityLevel, FontSizeScale, ThemeMode, UserSettings } from "@/types";

function SectionHeader({ children }: { children: ReactNode }) {
  return <h3 className="settings-section-heading">{children}</h3>;
}

interface LiveUpdater {
  <K extends keyof UserSettings>(key: K, value: UserSettings[K]): void;
}

const ACCENT_PRESETS: ReadonlyArray<{ name: string; value: string }> = [
  { name: "Indigo", value: "#7c9cff" },
  { name: "Teal", value: "#5be3c3" },
  { name: "Rose", value: "#ff6b9d" },
  { name: "Amber", value: "#ffb86b" },
  { name: "Violet", value: "#a78bfa" },
  { name: "Sky", value: "#38bdf8" },
  { name: "Lime", value: "#86efac" },
  { name: "Orange", value: "#fb923c" },
];

export interface AppearancePaneProps {
  // Appearance (all live)
  theme: ThemeMode;
  accentColor: string;
  fontSize: FontSizeScale;
  density: DensityLevel;
  reducedMotion: boolean;
  // Background (all live)
  meshEnabled: boolean;
  meshIntensity: number;
  live: LiveUpdater;
  liveDebounced: (k: keyof UserSettings, v: unknown) => void;
}

export function AppearancePane({
  theme,
  accentColor,
  fontSize,
  density,
  reducedMotion,
  meshEnabled,
  meshIntensity,
  live,
  liveDebounced,
}: AppearancePaneProps) {
  const osReducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const isCustomAccent = !ACCENT_PRESETS.some(
    (p) => p.value.toLowerCase() === accentColor.toLowerCase(),
  );

  return (
    <div
      role="tabpanel"
      id="settings-pane-appearance"
      aria-labelledby="settings-tab-appearance"
      className="settings-pane"
    >
      {/* ── Appearance ─────────────────────────────────────────── */}
      <section className="settings-section">
        <SectionHeader>Appearance</SectionHeader>

        <SegmentedControl<ThemeMode>
          name="settings-theme"
          legend="Theme"
          options={[
            { value: "system", label: "System" },
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
          value={theme}
          onChange={(v) => live("theme", v)}
          hint="Follows your OS appearance when set to System."
        />

        <fieldset className="settings-field">
          <legend className="settings-label">Accent color</legend>
          <div
            className="accent-swatch-grid"
            role="radiogroup"
            aria-label="Accent color presets"
          >
            {ACCENT_PRESETS.map((color) => {
              const checked =
                color.value.toLowerCase() === accentColor.toLowerCase();
              return (
                <label
                  key={color.value}
                  className={`accent-swatch-label${checked ? " is-active" : ""}`}
                  title={color.name}
                >
                  <input
                    type="radio"
                    name="accent-color"
                    value={color.value}
                    checked={checked}
                    onChange={() => live("accentColor", color.value)}
                    className="accent-swatch-input"
                    aria-label={color.name}
                  />
                  <span
                    className="accent-swatch"
                    style={{ "--swatch-color": color.value } as React.CSSProperties}
                    aria-hidden="true"
                  />
                </label>
              );
            })}
            <label
              className={`accent-swatch-label accent-swatch-label--custom${
                isCustomAccent ? " is-active" : ""
              }`}
              title="Custom color"
            >
              <input
                type="color"
                value={isCustomAccent ? accentColor : "#7c9cff"}
                onChange={(e) => liveDebounced("accentColor", e.target.value)}
                className="accent-color-input"
                aria-label="Custom accent color"
              />
              <span
                className="accent-swatch accent-swatch--custom"
                aria-hidden="true"
              />
            </label>
          </div>
          <span className="settings-hint">
            Sets the highlight color for buttons, focus rings, and active
            elements.
          </span>
        </fieldset>

        <SegmentedControl
          name="settings-fontsize"
          legend="Font size"
          options={[
            { value: "sm", label: "S" },
            { value: "md", label: "M" },
            { value: "lg", label: "L" },
          ]}
          value={fontSize}
          onChange={(v) => live("fontSize", v)}
          hint="Adjusts text size across the entire page."
        />

        <SegmentedControl<DensityLevel>
          name="settings-density"
          legend="Density"
          options={[
            { value: "compact", label: "Compact" },
            { value: "default", label: "Default" },
            { value: "spacious", label: "Spacious" },
          ]}
          value={density}
          onChange={(v) => live("density", v)}
          hint="Controls row heights and spacing between elements."
        />

        <ToggleSwitch
          label="Reduce motion"
          checked={reducedMotion}
          onChange={(v) => live("reducedMotion", v)}
          systemForced={
            osReducedMotion && !reducedMotion
              ? "(on — your OS prefers reduced motion)"
              : undefined
          }
          hint="Pauses the mesh animation and disables UI transitions."
        />
      </section>

      {/* ── Background ─────────────────────────────────────────── */}
      <section className="settings-section">
        <SectionHeader>Background</SectionHeader>
        <ToggleSwitch
          label="Mesh background"
          checked={meshEnabled}
          onChange={(v) => live("meshEnabled", v)}
          hint="Animated 3D wireframe behind the page. Disable on older hardware."
        />
        <div
          className={`settings-field${meshEnabled ? "" : " is-disabled"}`}
        >
          <label
            className="settings-label"
            htmlFor="settings-mesh-intensity"
          >
            Intensity
          </label>
          <div className="settings-range-row">
            <input
              id="settings-mesh-intensity"
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(meshIntensity * 100)}
              disabled={!meshEnabled}
              onChange={(e) =>
                liveDebounced(
                  "meshIntensity",
                  Number(e.target.value) / 100,
                )
              }
              aria-label="Mesh intensity"
            />
            <output className="settings-range-value">
              {Math.round(meshIntensity * 100)}%
            </output>
          </div>
          <span className="settings-hint">Opacity of the mesh wires.</span>
        </div>
      </section>
    </div>
  );
}
