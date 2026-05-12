/**
 * TagChip — renders a single tag pill.
 *
 * Color is a hex string passed through to the --chip-color custom property.
 * Background tint and text color are both derived in CSS via color-mix:
 *   background: 22% tag-color over transparent (composites over --panel)
 *   text:       60% tag-color blended with var(--text)
 *
 * The text-blend recipe auto-adjusts to theme — in dark mode --text is near
 * white, so labels lighten and stand out on the dark composite; in light mode
 * --text is near black, so labels darken and stand out on the light composite.
 *
 * The remove button (×) is shown only when `onRemove` is provided (edit context).
 * It uses opacity transitions, not visibility:hidden, keeping it in tab order
 * and the a11y tree (HIGH fix #9).
 */

import "./TagChip.css";

interface TagChipProps {
  label: string;
  color: string;
  /** When provided, renders a × remove button (edit context only). */
  onRemove?: (() => void) | undefined;
  /** Extra class names. */
  className?: string | undefined;
}

export function TagChip({ label, color, onRemove, className }: TagChipProps) {
  // Guard against empty/invalid color — use a safe default
  const safeColor = color && color.startsWith("#") ? color : "#7c9cff";

  return (
    <span
      className={`tag-chip${className ? ` ${className}` : ""}`}
      style={
        { "--chip-color": safeColor } as React.CSSProperties
      }
      title={label}
    >
      {label}
      {onRemove && (
        <button
          type="button"
          className="tag-chip-remove"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove tag ${label}`}
          tabIndex={0}
        >
          ×
        </button>
      )}
    </span>
  );
}
