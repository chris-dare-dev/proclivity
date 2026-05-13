/**
 * GeminiNanoPane — settings pane for the on-device Gemini Nano model.
 *
 * Renders the existing NanoSection content as a full-pane view.
 * NanoSection is a self-contained component that handles its own state
 * (availability check, test prompt, download progress), so this pane
 * simply mounts it inside the tabpanel wrapper.
 */

import { type ReactNode } from "react";
import { NanoSection } from "../NanoSection";
import { SegmentedControl } from "../SettingsControls";

function SectionHeader({ children }: { children: ReactNode }) {
  return <h3 className="settings-section-heading">{children}</h3>;
}

export interface GeminiNanoPaneProps {
  pendingChatPosition: "right" | "bottom";
  setPendingChatPosition: (v: "right" | "bottom") => void;
}

export function GeminiNanoPane({
  pendingChatPosition,
  setPendingChatPosition,
}: GeminiNanoPaneProps) {
  return (
    <div
      role="tabpanel"
      id="settings-pane-geminiNano"
      aria-labelledby="settings-tab-geminiNano"
      className="settings-pane"
    >
      <NanoSection />
      <section className="settings-section">
        <SectionHeader>Chat panel</SectionHeader>
        <SegmentedControl<"right" | "bottom">
          name="settings-chat-position"
          legend="Position"
          options={[
            { value: "right", label: "Right" },
            { value: "bottom", label: "Bottom" },
          ]}
          value={pendingChatPosition}
          onChange={setPendingChatPosition}
          hint="Controls where the chat panel slides in. Right is the default; bottom works better on wide monitors."
        />
      </section>
    </div>
  );
}
