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
