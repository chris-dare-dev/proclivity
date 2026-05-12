import { useId, type ReactNode } from "react";

/* ─── SegmentedControl ────────────────────────────────────────
 * Radio group styled as adjacent buttons. Native arrow-key navigation
 * within the group; Tab moves on. The hidden <input type="radio">
 * carries the focus and selection state for screen readers.
 */

export interface SegmentOption<T extends string | number> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string | number> {
  name: string;
  legend: string;
  options: ReadonlyArray<SegmentOption<T>>;
  value: T;
  onChange: (value: T) => void;
  hint?: ReactNode | undefined;
  /** When supplied the legend visually reads as "Legend (extra)". */
  legendSuffix?: string | undefined;
}

export function SegmentedControl<T extends string | number>({
  name,
  legend,
  options,
  value,
  onChange,
  hint,
  legendSuffix,
}: SegmentedControlProps<T>) {
  const hintId = useId();
  return (
    <fieldset
      className="settings-field"
      aria-describedby={hint ? hintId : undefined}
    >
      <legend className="settings-label">
        {legend}
        {legendSuffix ? (
          <span className="settings-label-suffix"> {legendSuffix}</span>
        ) : null}
      </legend>
      <div className="settings-segmented" role="radiogroup">
        {options.map((opt) => {
          const checked = opt.value === value;
          return (
            <label
              key={String(opt.value)}
              className={`settings-segmented-option${
                checked ? " is-active" : ""
              }`}
            >
              <input
                type="radio"
                name={name}
                value={String(opt.value)}
                checked={checked}
                onChange={() => onChange(opt.value)}
                className="settings-segmented-input"
              />
              <span>{opt.label}</span>
            </label>
          );
        })}
      </div>
      {hint ? (
        <span className="settings-hint" id={hintId}>
          {hint}
        </span>
      ) : null}
    </fieldset>
  );
}

/* ─── ToggleSwitch ────────────────────────────────────────────
 * Checkbox styled as a sliding switch. Visually hidden checkbox
 * remains the keyboard / a11y target.
 */

interface ToggleSwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: ReactNode | undefined;
  disabled?: boolean | undefined;
  /**
   * When provided, appended to the label as a parenthetical hint
   * (e.g., "(on — your OS prefers reduced motion)") and the toggle
   * is rendered as if `checked`.
   */
  systemForced?: string | undefined;
}

export function ToggleSwitch({
  label,
  checked,
  onChange,
  hint,
  disabled,
  systemForced,
}: ToggleSwitchProps) {
  const hintId = useId();
  const effectiveChecked = systemForced ? true : checked;
  const effectiveDisabled = disabled || Boolean(systemForced);
  return (
    <div className="settings-field">
      <label className="settings-toggle-row">
        <span className="settings-toggle-label">
          {label}
          {systemForced ? (
            <span className="settings-label-suffix"> {systemForced}</span>
          ) : null}
        </span>
        <span className="settings-toggle">
          <input
            type="checkbox"
            checked={effectiveChecked}
            onChange={(e) => onChange(e.target.checked)}
            disabled={effectiveDisabled}
            aria-describedby={hint ? hintId : undefined}
            className="settings-toggle-input"
          />
          <span className="settings-toggle-track" aria-hidden="true">
            <span className="settings-toggle-thumb" />
          </span>
        </span>
      </label>
      {hint ? (
        <span className="settings-hint" id={hintId}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

/* ─── ColorSwatchGrid ─────────────────────────────────────────────
 * Shared color-preset swatch grid used by Appearance (accent color)
 * and the Tags section. Mirrors the accent-swatch-grid pattern but
 * is parameterised over a generic onChange callback so both callers
 * don't inline duplicate markup.
 */

export interface ColorPreset {
  name: string;
  value: string;
}

interface ColorSwatchGridProps {
  /** The 8 (or N) preset colors to display. */
  presets: ReadonlyArray<ColorPreset>;
  /** The currently selected hex value. */
  value: string;
  /** Called with a hex value when a preset or custom color is chosen. */
  onChange: (hex: string) => void;
  /** ARIA label for the radio group. */
  ariaLabel?: string;
}

export function ColorSwatchGrid({
  presets,
  value,
  onChange,
  ariaLabel = "Color",
}: ColorSwatchGridProps) {
  const isCustom = !presets.some(
    (p) => p.value.toLowerCase() === value.toLowerCase(),
  );
  return (
    <div
      className="accent-swatch-grid"
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {presets.map((color) => {
        const checked = color.value.toLowerCase() === value.toLowerCase();
        return (
          <label
            key={color.value}
            className={`accent-swatch-label${checked ? " is-active" : ""}`}
            title={color.name}
          >
            <input
              type="radio"
              name={`${ariaLabel}-color`}
              value={color.value}
              checked={checked}
              onChange={() => onChange(color.value)}
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
        className={`accent-swatch-label accent-swatch-label--custom${isCustom ? " is-active" : ""}`}
        title="Custom color"
      >
        <input
          type="color"
          value={isCustom ? value : "#7c9cff"}
          onChange={(e) => onChange(e.target.value)}
          className="accent-color-input"
          aria-label="Custom color"
        />
        <span className="accent-swatch accent-swatch--custom" aria-hidden="true" />
      </label>
    </div>
  );
}
