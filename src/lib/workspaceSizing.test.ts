import { describe, expect, it } from "vitest";
import {
  clampCompanionWidth,
  companionWidthBounds,
  companionWidthFromDividerDelta,
  WORKSPACE_COMPANION_DEFAULT_WIDTH,
} from "./workspaceSizing";

describe("workspace companion sizing", () => {
  it("falls back to the canonical default for invalid persisted values", () => {
    expect(clampCompanionWidth(undefined)).toBe(
      WORKSPACE_COMPANION_DEFAULT_WIDTH,
    );
    expect(clampCompanionWidth(Number.NaN)).toBe(
      WORKSPACE_COMPANION_DEFAULT_WIDTH,
    );
    expect(clampCompanionWidth("640")).toBe(
      WORKSPACE_COMPANION_DEFAULT_WIDTH,
    );
  });

  it("clamps persisted values to the absolute 280–720px range", () => {
    expect(clampCompanionWidth(120)).toBe(280);
    expect(clampCompanionWidth(390)).toBe(390);
    expect(clampCompanionWidth(920)).toBe(720);
  });

  it("preserves the primary floor and a 50/50 hierarchy at runtime", () => {
    expect(companionWidthBounds(1080)).toEqual({ min: 280, max: 528 });
    expect(companionWidthBounds(900)).toEqual({ min: 280, max: 348 });
    expect(companionWidthBounds(2200)).toEqual({ min: 280, max: 720 });
  });

  it("widens when the divider moves left and narrows when it moves right", () => {
    expect(companionWidthFromDividerDelta(390, 800, 720, 1200)).toBe(470);
    expect(companionWidthFromDividerDelta(390, 800, 860, 1200)).toBe(330);
  });

  it("clamps divider movement to the measured runtime bounds", () => {
    expect(companionWidthFromDividerDelta(390, 800, 0, 900)).toBe(348);
    expect(companionWidthFromDividerDelta(390, 800, 1200, 900)).toBe(280);
  });
});
