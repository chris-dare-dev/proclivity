/**
 * TagChip — renders a single tag pill.
 *
 * Color is a hex string. Background is a 15% tint using color-mix(in srgb, ...)
 * which is supported in Chrome 111+ (baseline 2023). A hex fallback is declared
 * first so older Chrome degrades to a transparent background rather than
 * invisible text (CRITICAL fix #7 from critique).
 *
 * Text color is computed via relative-luminance contrast math so that the label
 * is always readable regardless of the chip's hue (HIGH fix #11 — no empty-string
 * color sentinel; callers must supply a non-empty hex).
 *
 * The remove button (×) is shown only when `onRemove` is provided (edit context).
 * It uses opacity transitions, not visibility:hidden, keeping it in tab order
 * and the a11y tree (HIGH fix #9).
 */

import "./TagChip.css";

/** Compute relative luminance for an 8-bit sRGB channel (0-255). */
function linearize(c: number): number {
  const n = c / 255;
  return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
}

/** Relative luminance of a hex color string (#rrggbb or #rgb). */
function luminance(hex: string): number {
  // Expand shorthand #rgb → #rrggbb
  const full =
    hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex;
  const r = parseInt(full.slice(1, 3), 16);
  const g = parseInt(full.slice(3, 5), 16);
  const b = parseInt(full.slice(5, 7), 16);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/**
 * Returns "#fff" or "#0b0e14" whichever achieves ≥ 4.5:1 contrast against
 * the given hex color. Used so chip text is always legible.
 */
export function getContrastingText(hex: string): "#fff" | "#0b0e14" {
  try {
    const l = luminance(hex);
    // Contrast against white: (1 + 0.05) / (l + 0.05)
    // Contrast against near-black #0b0e14 (≈ lum 0.0035): (l + 0.05) / 0.0535
    const contrastWhite = 1.05 / (l + 0.05);
    const contrastDark = (l + 0.05) / 0.0535;
    return contrastWhite >= contrastDark ? "#fff" : "#0b0e14";
  } catch {
    return "#fff";
  }
}

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
        {
          // Hex fallback first (older Chrome), then color-mix (CRITICAL #7)
          // Using in srgb because inputs are hex — matches existing reminder-badge
          // pattern in reminders.css and is correct for Chrome 111+.
          "--chip-color": safeColor,
          color: getContrastingText(safeColor),
        } as React.CSSProperties
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
