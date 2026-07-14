/**
 * Settings sidebar pane registry.
 *
 * PANE_ORDER defines the visual order of sidebar entries and is the single
 * source of truth shared by SettingsSidebar.tsx and SettingsModal.tsx.
 * Add entries here; both the nav and the pane-switch dispatcher pick them up.
 */

import type { SettingsPaneId } from "@/types";

export interface PaneEntry {
  id: SettingsPaneId;
  label: string;
}

export const PANE_ORDER: ReadonlyArray<PaneEntry> = [
  { id: "general", label: "General" },
  { id: "appearance", label: "Appearance" },
  { id: "notifications", label: "Notifications" },
  { id: "todos", label: "Todos" },
  { id: "geminiNano", label: "Gemini Nano" },
  { id: "googlePhotos", label: "Google Photos" },
  { id: "googleCalendar", label: "Google Calendar" },
  { id: "outlookCalendar", label: "Outlook snapshot" },
  { id: "roadmaps", label: "Roadmaps" },
  { id: "tags", label: "Tags" },
  { id: "data", label: "Data" },
  { id: "advanced", label: "Advanced" },
] as const;
