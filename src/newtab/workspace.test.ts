import { describe, expect, it } from "vitest";
import {
  surfacesInGroup,
  WORKSPACE_GROUPS,
  WORKSPACE_SURFACES,
  workspaceSurface,
} from "./workspace";

describe("workspace registry", () => {
  it("keeps every destination unique and discoverable", () => {
    const ids = WORKSPACE_SURFACES.map((surface) => surface.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([
      "osint",
      "today",
      "sprint",
      "long",
      "gantt",
      "calendar",
      "reminders",
      "finance",
      "photos",
      "closed",
    ]);
  });

  it("groups destinations by intent without creating an Issues placeholder", () => {
    expect(WORKSPACE_GROUPS.map((group) => group.label)).toEqual([
      "Intelligence",
      "Planning",
      "Finances",
      "Memory",
      "Archive",
    ]);
    expect(
      surfacesInGroup(WORKSPACE_SURFACES, "memory").map(
        (surface) => surface.id,
      ),
    ).toEqual(["photos"]);
    expect(
      WORKSPACE_SURFACES.some((surface) => surface.label === "Issues"),
    ).toBe(false);
  });

  it("returns the metadata used by the workspace header", () => {
    expect(workspaceSurface("finance")).toMatchObject({
      label: "Monarch",
      group: "money",
      kind: "embed",
    });
  });
});
