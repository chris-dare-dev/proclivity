/**
 * GeminiNanoPane — settings pane for the on-device Gemini Nano model.
 *
 * Renders the existing NanoSection content as a full-pane view.
 * NanoSection is a self-contained component that handles its own state
 * (availability check, test prompt, download progress), so this pane
 * simply mounts it inside the tabpanel wrapper.
 *
 * Agent B inserts into this pane:
 *   - 'chatPosition' SegmentedControl (Right / Bottom) below the
 *     existing "Enable chat panel" toggle. Prop is already declared on
 *     UserSettings.geminiNano.chatPosition.
 */

import { NanoSection } from "../NanoSection";

export function GeminiNanoPane() {
  return (
    <div
      role="tabpanel"
      id="settings-pane-geminiNano"
      aria-labelledby="settings-tab-geminiNano"
      className="settings-pane"
    >
      <NanoSection />
      {/* Agent B: insert 'geminiNano.chatPosition' SegmentedControl (Right / Bottom) */}
      {/* Place it immediately after the NanoSection component above. */}
      {/* Note: NanoSection owns the chatEnabled toggle; chatPosition lives here */}
      {/* as a sibling control, not inside NanoSection, to avoid modifying that file. */}
    </div>
  );
}
