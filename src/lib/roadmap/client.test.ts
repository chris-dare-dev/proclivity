import { describe, expect, it } from "vitest";
import { derivePaths } from "./client";

describe("derivePaths", () => {
  it("reuses `repo` for both roots when no vaultProject is given", () => {
    const { compiledPath, progressPath } = derivePaths(
      "arXMCP",
      "paper-metadata",
    );
    expect(compiledPath).toBe(
      "Projects/arXMCP/Roadmaps/paper-metadata/roadmap.compiled.json",
    );
    expect(progressPath).toBe(
      "Source Code/arXMCP/plans/paper-metadata/progress/proclivity.jsonl",
    );
  });

  it("decouples the read root from the write root when vaultProject differs (the Proclivity case)", () => {
    const { compiledPath, progressPath } = derivePaths(
      "proclivity",
      "gemini-nano",
      "Proclivity",
    );
    // Read comes from the capital-P Obsidian vault folder…
    expect(compiledPath).toBe(
      "Projects/Proclivity/Roadmaps/gemini-nano/roadmap.compiled.json",
    );
    // …while write-back stays in the lowercase Source Code repo dir.
    expect(progressPath).toBe(
      "Source Code/proclivity/plans/gemini-nano/progress/proclivity.jsonl",
    );
  });

  it("treats an empty-string vaultProject as absent (falls back to repo)", () => {
    const { compiledPath } = derivePaths("arXMCP", "paper-metadata", "");
    expect(compiledPath).toBe(
      "Projects/arXMCP/Roadmaps/paper-metadata/roadmap.compiled.json",
    );
  });
});
