import { describe, it, expect } from "vitest";
import { isoLocalSeconds } from "./sync";

describe("isoLocalSeconds", () => {
  it("formats local wall-clock to seconds precision with no Z/offset", () => {
    // Construct from LOCAL fields so the assertion is timezone-independent.
    const d = new Date(2026, 6, 6, 14, 23, 5); // 2026-07-06T14:23:05 local
    expect(isoLocalSeconds(d)).toBe("2026-07-06T14:23:05");
  });

  it("zero-pads every field", () => {
    const d = new Date(2026, 0, 3, 4, 5, 6); // 2026-01-03T04:05:06 local
    expect(isoLocalSeconds(d)).toBe("2026-01-03T04:05:06");
  });

  it("is not the UTC toISOString form", () => {
    const d = new Date(2026, 6, 6, 14, 23, 5);
    expect(isoLocalSeconds(d)).not.toContain("Z");
    expect(isoLocalSeconds(d).length).toBe(19);
  });
});
