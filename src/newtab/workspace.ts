import type { Tab } from "@/types";

export type WorkspaceGroupId =
  | "intelligence"
  | "planning"
  | "money"
  | "memory"
  | "archive";

export interface WorkspaceSurface {
  id: Tab;
  label: string;
  group: WorkspaceGroupId;
  description: string;
  kind: "embed" | "planning" | "media" | "archive";
}

export interface WorkspaceGroup {
  id: WorkspaceGroupId;
  label: string;
}

export const WORKSPACE_GROUPS: readonly WorkspaceGroup[] = [
  { id: "intelligence", label: "Intelligence" },
  { id: "planning", label: "Planning" },
  { id: "money", label: "Money" },
  { id: "memory", label: "Memory" },
  { id: "archive", label: "Archive" },
];

export const WORKSPACE_SURFACES: readonly WorkspaceSurface[] = [
  {
    id: "osint",
    label: "OSINT",
    group: "intelligence",
    description: "Investigation workspace · live external surface",
    kind: "embed",
  },
  {
    id: "today",
    label: "Today",
    group: "planning",
    description: "Immediate work and quick capture",
    kind: "planning",
  },
  {
    id: "sprint",
    label: "Sprint",
    group: "planning",
    description: "Active horizon and backlog",
    kind: "planning",
  },
  {
    id: "long",
    label: "Long-term",
    group: "planning",
    description: "Long-horizon work and due dates",
    kind: "planning",
  },
  {
    id: "gantt",
    label: "Gantt",
    group: "planning",
    description: "Timeline, dependencies, and progress",
    kind: "planning",
  },
  {
    id: "calendar",
    label: "Calendar",
    group: "planning",
    description: "Monthly commitments across planning surfaces",
    kind: "planning",
  },
  {
    id: "reminders",
    label: "Reminders",
    group: "planning",
    description: "Scheduled prompts and recurring alarms",
    kind: "planning",
  },
  {
    id: "finance",
    label: "Finances",
    group: "money",
    description: "Monarch workspace · protected external surface",
    kind: "embed",
  },
  {
    id: "photos",
    label: "Photos",
    group: "memory",
    description: "Your locally cached Google Photos selection",
    kind: "media",
  },
  {
    id: "closed",
    label: "Closed",
    group: "archive",
    description: "Completed work and restore controls",
    kind: "archive",
  },
];

const SURFACE_BY_ID = new Map<Tab, WorkspaceSurface>(
  WORKSPACE_SURFACES.map((surface) => [surface.id, surface]),
);

export function workspaceSurface(tab: Tab): WorkspaceSurface {
  const surface = SURFACE_BY_ID.get(tab);
  if (!surface) {
    throw new Error(`Unknown workspace surface: ${tab}`);
  }
  return surface;
}

export function surfacesInGroup(
  surfaces: readonly WorkspaceSurface[],
  groupId: WorkspaceGroupId,
): WorkspaceSurface[] {
  return surfaces.filter((surface) => surface.group === groupId);
}
