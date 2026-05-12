# gemini-nano-m2 Research Brief — Embedded Chat Side Panel

**Milestone:** gemini-nano-m2 — Embedded chat side panel  
**Created:** 2026-05-12  
**Status:** research phase  
**Acceptance Criteria Source:** `plans/gemini-nano-roadmap.md` lines 121–137

---

## 1. Overview

The m2 milestone ships a persistent chat interface that runs a long-lived `LanguageModelSession` with Gemini Nano. The affordance is reachable via a new icon or toggle in the header/settings, slides in as a side panel or appears as a modal (design decision), and allows free-text conversation with auto-trimming on `contextoverflow`. No structured tool-calling yet; m3 adds that. Reuses `src/llm/nano.ts` from m1.

---

## 2. Affected Files & Proposed Structure

### New files (create)

| File | Role | Est. LOC | Notes |
|------|------|---------|-------|
| `src/components/chat/ChatPanel.tsx` | Main chat component; renders panel/modal shell, message list, input field, session lifecycle. | 200–250 | Uses `useRef` for session, local state for message history. Mounts conditionally based on `state.settings.geminiNano.chatEnabled` and local open state. |
| `src/components/chat/ChatMessage.tsx` | Renders one message (user or assistant) with role badge and optional styling. | 60–80 | Simple presentational; receives `{ role, text }`. |
| `src/components/chat/ChatInput.tsx` | Text input + send button; submits on Enter (Shift+Enter for newline). | 80–100 | Manages local input state, disables send while Nano is generating. |
| `src/hooks/useChatSession.ts` | Custom hook wrapping session lifecycle, message history, contextoverflow listener. | 100–120 | Exported so future e3 tool-call parsing can live in a separate hook (`useToolCallParser`) and compose cleanly. |
| `src/components/chat/ChatPanel.css` | Styling for panel/modal container, message list, input, trim indicator. | 80–120 | Follows existing design tokens (`--panel`, `--border`, `--text`, `--accent`). Handles narrow viewport collapse if needed. |

### Modified files (touch)

| File | Role | Est. Δ LOC | Specific changes |
|------|------|-----------|------------------|
| `src/newtab/App.tsx` | Add chat panel mount, toggle state, affordance (icon or button). | +30–50 | (1) Import `ChatPanel` lazily via `React.lazy` if >15 kB. (2) Mount `ChatPanel` conditionally: `{rs.geminiNano?.chatEnabled && <ChatPanel open={chatOpen} onClose={…} />}`. (3) Add icon next to gear button or in header to toggle `chatOpen`. (4) Handle narrow viewport: optionally hide chat on `max-width: 900px` or collapse to bottom drawer. |
| `src/components/settings/NanoSection.tsx` | Add "Enable chat panel" and "Chat position" toggles. | +40–60 | (1) Add `ToggleSwitch` to control `state.settings.geminiNano.chatEnabled` via `live()`. (2) Add `SegmentedControl` for `chatPosition: "right" | "bottom"` (optional for m2, can be deferred to m2.5 if time-tight). (3) Add a hint explaining the feature. |
| `src/types/index.ts` | Extend `ResolvedUserSettings` with `geminiNano` defaults. | +5–10 | (1) Add `geminiNano?: { chatEnabled: boolean; chatPosition?: "right" \| "bottom"; }` to `ResolvedUserSettings`. (2) Types already pre-declared in `UserSettings` (m1 recovery commit `eee58db`), so this just resolves them in the resolved form. |
| `src/storage/constants.ts` | Add default for `geminiNano` in `DEFAULT_SETTINGS` and `resolvedSettings()`. | +15–20 | (1) Set `geminiNano: { chatEnabled: false, chatPosition: "right" }` in `DEFAULT_SETTINGS`. (2) Update `resolvedSettings()` to merge the nested `geminiNano` object with fallback to defaults. |
| `src/newtab/App.css` | Optional: support for narrow-viewport chat drawer collapse. | 0–20 | (1) If chat moves to bottom on `max-width: 900px`, add a `.chat-panel--bottom` variant with `position: fixed; bottom: 0; width: 100%; max-height: 50vh;` (or similar). (2) If chat stays side-panel, no CSS change needed. |

**Total estimated new LOC:** ~650–950 (mostly new chat components + hooks).  
**Total estimated delta LOC (modified):** ~90–160.

---

## 3. Design Decision: Side Panel vs Modal

### Recommendation: **Right-side slide-in panel (primary) with bottom drawer fallback on narrow viewports**

#### Rationale

1. **Layout:** `src/newtab/App.tsx` wraps all content in `.app` (max-width 1100px, centered). The planner sections (Today, Sprint, etc.) consume the full width within that container.
   - **Side panel:** A 350–400px panel positioned `fixed` to the right of the viewport (not constrained to `.app`) slides in without pushing the planner. On wide screens (>1200px), it sits beside the centered content. On narrow screens (<900px), it can collapse to a bottom drawer or be hidden entirely until explicitly opened.
   - **Modal:** Would overlay the entire viewport, dimming the planner behind it. Heavier UX — user loses context of their task list while typing prompts.

2. **Mesh background:** The `.app` container has `position: relative; z-index: 1;` to sit above the fixed `<MeshBackground>`. A side panel should also sit above the mesh (e.g., `z-index: 2;`), so no conflict.

3. **Section visibility:** Settings allow users to hide tabs. The chat panel is **independent** of section visibility — it's a global feature that floats above the dashboard, not a section. So no need to check `rs.sectionVisibility.*`.

4. **Mobile/narrow behavior:** Proclivity currently renders OK at `min-width: 900px` (per CSS and the layout assumptions). The chat panel, if side-fixed, would overflow on narrower screens. **Solution:** On `max-width: 900px`, collapse the side panel to a `position: fixed; bottom: 0; right: 0; width: 100%; max-height: 50vh;` bottom drawer. Handles tablets and small laptops gracefully. Defer full mobile responsiveness (further optimization) to later if needed.

5. **Existing design precedent:** Proclivity uses modals (Settings, Modal.tsx) for major mode-switches. A side panel is lighter, non-modal, leaves the dashboard visible, and feels more like a concurrent tool (which chat is). Aligns with modern IDEs (sidebar inspector panels) and Slack (side threads).

**Chosen layout:**
- Default: `position: fixed; right: 0; top: 0; width: 380px; max-height: 100vh; z-index: 2; border-left: 1px solid var(--border); background: var(--panel);`
- Narrow (media query `max-width: 900px`): `position: fixed; bottom: 0; right: 0; left: 0; width: 100%; max-height: 50vh;`
- Slide-in animation: translate from `right: -380px` (hidden) to `right: 0` (visible) on open.

---

## 4. Affordance: How Users Open the Chat

### Recommendation: **Combination approach**

**Primary toggle (settable in Settings):**
- Add a checkbox in `NanoSection` (Settings → Gemini Nano): "**Enable chat panel**" (defaults to `false`).
- This controls `state.settings.geminiNano.chatEnabled`.
- When disabled, the chat panel is not mounted at all (no DOM, no overhead).

**Runtime open/close (icon in header):**
- Add a **chat-bubble icon** next to the gear-icon in the header (or replace gear with a dual-icon button).
- Icon position: `header-right`, after the clock, before or instead of the gear.
- Icon visibility: Only shows if `rs.geminiNano?.chatEnabled === true`.
- Clicking the icon toggles `chatOpen` state in `App`.
- Tooltip/aria-label: "Chat with Nano" or "Open chat panel".

**Optional: Keyboard shortcut (future polish)**
- Defer to post-m2 if time runs out.
- Candidate: Cmd/Ctrl+Shift+K (common in editors/VS Code).
- Would dispatch `chatOpen = true` from a global keydown listener.

**Rationale:**
- **Settings toggle:** Respects user choice; doesn't clutter header if they don't use chat.
- **Icon affordance:** One-click access for enabled users; discoverable in the header area (same zone as gear).
- **No auto-open:** Never surprise the user with a floating panel; they must explicitly enable + click.

---

## 5. Session Lifecycle & State Management

### Pattern (based on m1's `NanoSection.tsx` and `src/llm/nano.ts`)

**Session creation:**
```typescript
// In useChatSession.ts hook:
const sessionRef = useRef<LanguageModel | null>(null);

const ensureSession = useCallback(async () => {
  if (sessionRef.current) return sessionRef.current;
  // Create on first user message.
  sessionRef.current = await createSession(); // from src/llm/nano.ts
  return sessionRef.current;
}, []);
```

**Message send:**
```typescript
const sendMessage = useCallback(async (userText: string) => {
  const session = await ensureSession();
  addMessageToHistory({ role: "user", text: userText });
  
  try {
    const response = await session.prompt(userText);
    addMessageToHistory({ role: "assistant", text: response });
  } catch (err) {
    // Handle error (render inline error in chat)
  }
}, []);
```

**contextoverflow listener:**
- SDK fires `session.addEventListener("contextoverflow", (event) => { … })` when the token limit is hit.
- On overflow, **remove the oldest exchange** (one user message + one assistant message) from the visible history.
- Render a `"(older messages trimmed)"` line in its place (single grey text line, small font).
- Do NOT persist trimmed messages; they're gone.
- Cite `@types/dom-chromium-ai` or SDK docs for the exact event shape once confirmed.

**Clear chat button:**
```typescript
const handleClearChat = useCallback(() => {
  sessionRef.current?.destroy();
  sessionRef.current = null;
  setMessages([]); // empty history
}, []);
```

**Lazy recreation:**
- Next message after clear calls `ensureSession()`, which sees `sessionRef.current === null` and creates a fresh session.
- No special logic needed; the pattern is idempotent.

---

## 6. State Storage: Component-Local (Ephemeral)

### Decision: **Component-local React state only (no persistence)**

**Rationale:**

1. **Explicit won't-list:** From `plans/gemini-nano-roadmap.md` line 40: *"Multi-turn memory beyond the active session. When the user closes the side panel / clears chat, history is gone."*
   - This is a feature, not a limitation. Chat is ephemeral by design.

2. **Simplicity:** No need for `chrome.storage.local` key, no migration logic, no schema versioning.

3. **Privacy:** Raw prompts/responses are never persisted. Only user actions that modify records (m3 tool-calls) are saved as state mutations.

4. **Reload behavior:** If the user refreshes the page, the chat history is lost. They can start a new conversation. This is acceptable for a sidebar chat.

**Implementation:**
```typescript
// In useChatSession.ts:
const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);

// In ChatPanel.tsx:
{messages.map((msg, i) => (
  <ChatMessage key={i} role={msg.role} text={msg.text} />
))}
```

---

## 7. Existing Patterns to Follow

### `useStore()` pattern (`src/storage/useStore.ts:5–33`)

The app uses a custom `useStore()` hook for global state:
```typescript
const { state, loading, update } = useStore();
```

**For m2 chat:**
- Do NOT store message history in `ProclivityState`.
- Chat state is local to the `ChatPanel` component (`useState`).
- If m3 needs to apply tool-calls, the `update()` callback from `useStore()` is available and should be called to mutate `state.todos`, `state.ganttTasks`, etc.

### Settings modal pattern (`src/components/settings/SettingsModal.tsx:75–331`)

**How to add chat toggles to NanoSection:**

1. NanoSection already imports `useStore()` and can call `live(key, value)` callbacks.
2. Add two new state vars in NanoSection (or accept them as props from SettingsModal like other sections):
   ```typescript
   const [pendingChatEnabled, setPendingChatEnabled] = useState(rs.geminiNano?.chatEnabled ?? false);
   const [pendingChatPosition, setPendingChatPosition] = useState(rs.geminiNano?.chatPosition ?? "right");
   ```
3. On `handleDone()`, write these to `state.settings.geminiNano`:
   ```typescript
   await update((s) => ({
     ...s,
     settings: {
       ...s.settings,
       geminiNano: {
         chatEnabled: pendingChatEnabled,
         chatPosition: pendingChatPosition,
       },
     },
   }));
   ```

### NanoSection abort pattern (`src/components/settings/NanoSection.tsx:56–84`)

- NanoSection uses `useRef<AbortController | null>(null)` to cancel in-flight prompts when the modal closes.
- **For ChatPanel:** Use the same pattern — store the active prompt's `AbortSignal` so that if the user closes the panel mid-response, the fetch aborts gracefully.

### Lazy-loading pattern (`src/newtab/App.tsx:14–18`)

```typescript
const MeshBackground = lazy(() =>
  import("@/components/MeshBackground").then((m) => ({ default: m.MeshBackground })),
);
```

- **For ChatPanel:** If the combined `.tsx` + `.css` for all chat components exceeds ~15 kB, lazy-load it:
  ```typescript
  const ChatPanel = lazy(() => import("@/components/chat/ChatPanel").then(m => ({ default: m.ChatPanel })));
  ```
  - Wrap with `<Suspense fallback={null}>` in `App.tsx`.
  - This keeps the initial newtab chunk under budget.

---

## 8. Footguns from CLAUDE.md

1. **Strict TypeScript:**
   - All new code must compile under `strict: true`, `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`.
   - `ChatMessage` props must be explicitly typed; no implicit `any`.
   - `messages` array state must be `Array<{ role: "user" | "assistant"; text: string }>`, not `any[]`.

2. **Bundle size:**
   - Initial newtab chunk must stay <200 kB.
   - Chat panel is a code-split candidate: if `src/components/chat/**` + CSS > 15 kB, lazy-load it (see pattern above).
   - No new npm dependencies (e.g., don't add a markdown renderer yet; m3+ can scope that).

3. **Lazy loading:**
   - `React.lazy` + `Suspense` are already in use (see MeshBackground).
   - Use the same pattern for ChatPanel if needed.

4. **Conventional commits:**
   - Scope suggestions: `chat`, `nano`, `settings`, `style`.
   - Examples:
     - `feat(chat): add ChatPanel side panel component`
     - `feat(chat): integrate contextoverflow auto-trim`
     - `feat(settings): expose chat enable/position toggles in NanoSection`
   - Subject ≤ 50 chars after prefix.

5. **GPG signing:**
   - Every commit must have `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer.
   - Use `git commit -m "…" && git commit --amend --no-edit` if trailer is missing (or bake into the flow so it's automatic).
   - CLAUDE.md line 39: *"Add a co-author trailer on commits you author."*

6. **Pre-commit hooks:**
   - `npm run build` must pass before pushing.
   - Pre-commit hooks run automatically; never use `--no-verify`.

7. **`npm run build` must pass cleanly:**
   - Full `tsc -b && vite build` pipeline.
   - No warnings, no console.warn during build.

---

## 9. Open Questions for the Implementer

1. **Chat panel header & branding:**
   - Should the panel show a header like *"Chat with Gemini Nano (on-device)"*?
   - Or just the message list + input, minimal chrome?
   - Recommend: minimal header with a close button (X) and maybe a "Clear chat" option in a dropdown.

2. **Maximum visible message history:**
   - The SDK's `contextoverflow` event auto-trims from the oldest exchange.
   - Should the UI also cap, say, 50 visible messages (regardless of token budget) to avoid tall scrolls?
   - Recommend: defer to m3's eval; if users hit overflow frequently, add a soft cap then.

3. **Typing indicator while Nano is generating:**
   - When awaiting `session.prompt()`, show a "Nano is thinking…" spinner or typing animation?
   - Recommend: simple animated ellipsis ("…") next to "Assistant" in the pending message line, fades when response arrives.

4. **Message submission on Shift+Enter:**
   - Standard textarea behavior: Enter sends, Shift+Enter inserts newline.
   - Implement in `ChatInput.tsx` via `onKeyDown` check.
   - Disable send button while `status === "generating"` to prevent double-sends.

5. **Error handling & retry:**
   - If `session.prompt()` throws (e.g., network error, model crash), what UX?
   - Recommend: inline error message below the input ("Failed to get response. Try again?"), no auto-retry yet.
   - m3 can add a "Retry" button if needed.

---

## 10. Key Files to Read Before Implementing

| File | Why |
|------|-----|
| `src/llm/nano.ts` | Understand `createSession()`, `prompt()`, contextoverflow signature. |
| `src/types/index.ts` | See existing `UserSettings` shape; note `geminiNano?:` pre-declared (m1 recovery). |
| `src/storage/constants.ts` | Pattern for `DEFAULT_SETTINGS` and `resolvedSettings()` merge logic. |
| `src/storage/useStore.ts` | Pattern for `update()` callback; understand `ProclivityState` updates. |
| `src/components/settings/SettingsModal.tsx` | Pattern for `live()` callbacks, snapshot/restore on cancel, section layout. |
| `src/components/settings/NanoSection.tsx` | Pattern for abort-signal management, availability checking. |
| `src/newtab/App.tsx` | Where to mount `ChatPanel`, how to add icon, toggle state. |
| `src/newtab/App.css` | Layout + z-index patterns. |
| `src/components/Modal.tsx` | If we later want a modal variant; focus trap, Escape key handling. |
| `plans/gemini-nano-roadmap.md` | Accept criteria, e3 sneak-peek for how m2 chat will be extended. |
| `@types/dom-chromium-ai` (types) | Exact SDK types for `LanguageModel`, `LanguageModelSession`, event signatures. |

---

## 11. Acceptance Criteria Checklist (from roadmap)

- [ ] A new chat affordance is reachable from the gear icon area (or its own icon). When opened, it slides in as a side panel or appears as a modal.
- [ ] The chat starts a `LanguageModelSession` on first open and reuses it across messages.
- [ ] User-typed messages submit on Enter and append to the history; Nano's response appends below.
- [ ] On `contextoverflow`, the oldest exchange is removed from the visible history and a small "(older messages trimmed)" line shows in its place.
- [ ] "Clear chat" destroys the session and empties the history.
- [ ] Session is recreated lazily on the next user message after clear.
- [ ] `npm run build` passes; chat assets in a code-split chunk if they exceed 15 kB; initial newtab chunk grows by < 5 kB.
- [ ] Given Nano is ready and a chat panel is open, When the user types a message, Then a reply appears in < 5 seconds (p50).

---

## 12. Dependencies & Prerequisites

- **m1 must land first.** m2 depends on `src/llm/nano.ts` and the Settings section infrastructure from m1.
- **No external npm packages.** Keep chat simple; use React hooks + CSS grid/flexbox.
- **Chrome 138+ with Prompt API flags enabled.** Same requirement as m1. If user's Chrome lacks Nano, the chat icon doesn't show (chat affordance is hidden when `availability() === "unavailable"`).

---

## Summary

**m2 is a focused vertical slice:** it ships end-to-end chat UX (panel/modal, input, message list, session reuse, contextoverflow trim) without tool-calling. The implementation reuses m1's session wrapper and the settings infrastructure, adding ~650 LOC of new chat-specific components + hooks. Side-panel layout is recommended; component-local state keeps it ephemeral by design. Expect 2–3 days of work; no new npm deps; initial chunk grows by <5 kB.

