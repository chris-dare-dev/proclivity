import type React from "react";

/**
 * Typed helper for setting CSS custom properties from JSX.
 *
 * TypeScript's `React.CSSProperties` doesn't allow arbitrary `--*` keys.
 * This helper centralises the cast so a single place can be audited if
 * the escape hatch ever needs to change (e.g. switch to `setProperty`).
 *
 * @example
 *   style={cssVars({ "--calendar-lanes": laneCount })}
 */
export type CSSVars = Record<`--${string}`, string | number>;
export const cssVars = (v: CSSVars): React.CSSProperties => v as React.CSSProperties;
