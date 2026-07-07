import { describe, it, expect } from "vitest";
import { isoLocalSeconds, shouldSuppressWriteBack } from "./sync";
import { mkTodoId } from "./ingest";
import type { RoadmapSource, RoadmapStoreState } from "./types";

describe("isoLocalSeconds", () => {
  it("emits offset-aware local ISO to seconds (matches Python astimezone().isoformat)", () => {
    // Construct from LOCAL fields; the offset is machine-dependent, so assert
    // the wall-clock prefix exactly and the trailing offset by shape.
    const d = new Date(2026, 6, 6, 14, 23, 5); // 2026-07-06T14:23:05 local
    const s = isoLocalSeconds(d);
    expect(s.startsWith("2026-07-06T14:23:05")).toBe(true);
    expect(s).toMatch(/T\d\d:\d\d:\d\d[+-]\d\d:\d\d$/);
  });

  it("zero-pads every field and always carries an offset", () => {
    const d = new Date(2026, 0, 3, 4, 5, 6); // 2026-01-03T04:05:06 local
    const s = isoLocalSeconds(d);
    expect(s.startsWith("2026-01-03T04:05:06")).toBe(true);
    expect(s).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/);
  });

  it("is never the UTC toISOString `Z` form", () => {
    const s = isoLocalSeconds(new Date(2026, 6, 6, 14, 23, 5));
    expect(s).not.toContain("Z");
  });
});

describe("shouldSuppressWriteBack", () => {
  const SRC = "arXMCP/paper-metadata";
  const source: RoadmapSource = {
    repo: "arXMCP",
    slug: "paper-metadata",
    title: null,
    enabled: true,
  };
  const mid = mkTodoId(SRC, "paper-metadata-t-a");
  const cfg = (over: Partial<RoadmapStoreState>): RoadmapStoreState => ({
    host: "",
    apiKey: "",
    sources: [source],
    writtenBack: {},
    droppedMirrors: [],
    knownMirrors: [mid],
    lastSyncAt: null,
    lastSyncError: null,
    ...over,
  });

  it("allows a known, enabled, non-dropped mirror", () => {
    expect(shouldSuppressWriteBack(cfg({}), mid)).toBe(false);
  });

  it("suppresses reopening a mirror whose SOURCE item is dropped", () => {
    expect(shouldSuppressWriteBack(cfg({ droppedMirrors: [mid] }), mid)).toBe(true);
  });

  it("suppresses a mirror whose source item is gone from the last-ingested set", () => {
    const other = mkTodoId(SRC, "paper-metadata-t-b");
    expect(shouldSuppressWriteBack(cfg({ knownMirrors: [other] }), mid)).toBe(true);
  });

  it("suppresses a mirror from a DISABLED source", () => {
    expect(
      shouldSuppressWriteBack(cfg({ sources: [{ ...source, enabled: false }] }), mid),
    ).toBe(true);
  });

  it("suppresses a mirror from an unknown / removed source", () => {
    expect(shouldSuppressWriteBack(cfg({ sources: [] }), mid)).toBe(true);
  });
});
