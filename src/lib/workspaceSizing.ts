export const WORKSPACE_COMPANION_MIN_WIDTH = 280;
export const WORKSPACE_COMPANION_DEFAULT_WIDTH = 390;
export const WORKSPACE_COMPANION_MAX_WIDTH = 720;
export const WORKSPACE_PRIMARY_MIN_WIDTH = 540;
export const WORKSPACE_DIVIDER_WIDTH = 12;

export interface CompanionWidthBounds {
  min: number;
  max: number;
}

/**
 * Runtime companion bounds for the measured workspace content box.
 *
 * The companion never exceeds half of the panel space: promoting a surface
 * to primary via Swap is clearer than letting the secondary slot dominate.
 * The primary also keeps a 540px floor. When no measurement is available,
 * only the absolute persisted bounds are applied.
 */
export function companionWidthBounds(
  contentInlineSize?: number,
): CompanionWidthBounds {
  if (
    contentInlineSize === undefined ||
    !Number.isFinite(contentInlineSize) ||
    contentInlineSize <= 0
  ) {
    return {
      min: WORKSPACE_COMPANION_MIN_WIDTH,
      max: WORKSPACE_COMPANION_MAX_WIDTH,
    };
  }

  const panelSpace = Math.max(0, contentInlineSize - WORKSPACE_DIVIDER_WIDTH);
  const runtimeMax = Math.min(
    WORKSPACE_COMPANION_MAX_WIDTH,
    Math.floor(panelSpace / 2),
    panelSpace - WORKSPACE_PRIMARY_MIN_WIDTH,
  );

  return {
    min: WORKSPACE_COMPANION_MIN_WIDTH,
    max: Math.max(WORKSPACE_COMPANION_MIN_WIDTH, runtimeMax),
  };
}

/** Resolve an unknown stored or interactive value into the current bounds. */
export function clampCompanionWidth(
  value: unknown,
  contentInlineSize?: number,
): number {
  const width =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : WORKSPACE_COMPANION_DEFAULT_WIDTH;
  const { min, max } = companionWidthBounds(contentInlineSize);
  return Math.round(Math.min(max, Math.max(min, width)));
}

/**
 * Convert horizontal divider movement into a right-hand companion width.
 * Moving left widens the companion; moving right narrows it.
 */
export function companionWidthFromDividerDelta(
  startWidth: number,
  startClientX: number,
  currentClientX: number,
  contentInlineSize?: number,
): number {
  return clampCompanionWidth(
    startWidth + startClientX - currentClientX,
    contentInlineSize,
  );
}
