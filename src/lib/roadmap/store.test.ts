import { describe, expect, it } from "vitest";
import { normalizeApiKey } from "./store";

const HEX = "8f3a1c9e2b7d4a6f";

describe("normalizeApiKey", () => {
  it("passes a bare hex key through untouched", () => {
    expect(normalizeApiKey(HEX)).toBe(HEX);
  });

  it("strips the `Bearer ` prefix the plugin's settings screen displays", () => {
    expect(normalizeApiKey(`Bearer ${HEX}`)).toBe(HEX);
  });

  it("strips the prefix case-insensitively", () => {
    expect(normalizeApiKey(`bearer ${HEX}`)).toBe(HEX);
    expect(normalizeApiKey(`BEARER ${HEX}`)).toBe(HEX);
  });

  it("tolerates surrounding and internal whitespace from a sloppy copy", () => {
    expect(normalizeApiKey(`  Bearer   ${HEX}  `)).toBe(HEX);
    expect(normalizeApiKey(`\tBearer\t${HEX}\n`)).toBe(HEX);
  });

  it("collapses a double-pasted prefix (`Bearer Bearer <hex>`)", () => {
    expect(normalizeApiKey(`Bearer Bearer ${HEX}`)).toBe(HEX);
  });

  it("normalizes a key that is nothing but the prefix to empty (→ unconfigured, not 401)", () => {
    expect(normalizeApiKey("Bearer ")).toBe("");
    expect(normalizeApiKey("Bearer")).toBe("");
  });

  it("leaves an empty / whitespace-only input empty", () => {
    expect(normalizeApiKey("")).toBe("");
    expect(normalizeApiKey("   ")).toBe("");
  });

  it("does not eat a `bearer`-lookalike that is part of the token", () => {
    // No separating whitespace → not a prefix, so the token survives intact.
    expect(normalizeApiKey("bearerdeadbeef")).toBe("bearerdeadbeef");
  });
});
