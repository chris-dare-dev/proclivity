# gemini-nano-m2 — research synthesis

Both briefs validate; both reported 0 injection attempts.

## Affected files (deduped)

New (in `src/components/chat/` and `src/hooks/`):
- `src/components/chat/ChatPanel.tsx` — main container, message list, lazy-imported.
- `src/components/chat/ChatMessage.tsx` — single message renderer with role badge.
- `src/components/chat/ChatInput.tsx` — Enter-to-send text input + Send button.
- `src/components/chat/ChatPanel.css` — slide-in panel + responsive bottom-drawer styles.
- `src/hooks/useChatSession.ts` — session lifecycle (createSession lazy, contextoverflow listener, clear/destroy, AbortController).

Modified:
- `src/newtab/App.tsx` — chat-bubble icon in header (visible only when `chatEnabled`), `<Suspense fallback={null}><ChatPanel /></Suspense>` lazy mount.
- `src/components/settings/NanoSection.tsx` — add "Enable chat panel" `ToggleSwitch` that writes `state.settings.geminiNano.chatEnabled`.
- `src/types/index.ts` — already pre-declared; may need `chatPanelOpen` ephemeral state (probably not — keep it component-local).
- `src/storage/constants.ts` — `DEFAULT_SETTINGS.geminiNano = { chatEnabled: false }` and `resolvedSettings()` branch.

## Acceptance criteria (≤7, deduped from both briefs)

1. The chat affordance is gated by `state.settings.geminiNano.chatEnabled` (toggle in Settings → Gemini Nano). When disabled, no header icon and no panel.
2. When enabled, a chat-bubble button appears in `.header-right` next to the gear icon. Clicking it opens a right-side slide-in panel (≈380px wide); on viewports under 900px it presents as a bottom drawer.
3. Session is created lazily on the first user message via `nanoCreateSession()`; kept in a `useRef` for the panel's lifetime. Multi-turn memory comes for free because `session.prompt(text)` includes prior turns automatically (verified, brief-2 §1).
4. `contextoverflow` listener: when fired, drop the oldest visible exchange from the React history and insert a "(older messages trimmed)" line. Distinguish from `QuotaExceededError` (single message too large — surface an inline error instead).
5. "Clear chat" button: `controller.abort()` any in-flight request, then `session.destroy()`, null the ref, empty the history. Next user message recreates the session lazily.
6. `npm run build` clean. Chat assets in a code-split chunk (via `React.lazy()` mirroring `MeshBackground`). Initial newtab chunk grows by < 5 kB.
7. Given Nano is `available` and the panel is open, When user submits a message, Then a reply renders within ≤ 5 s p50. AbortController on each prompt() for the "Clear during generation" path.

## external_writes_required

```yaml
external_writes_required: []
```

Nano is keyless. No new permissions, no Cloud, no auth. Maintainer already confirmed `availability() === "available"` on their Chrome install.

## Open questions / implementer-decision items

1. **Header attribution badge**: should the panel header display "Powered by Gemini Nano (on-device)" so users know the model is local? Brief-1 leaves it open. Recommend yes — single short line in the panel header — to set expectations on quality.
2. **Send-while-generating behavior**: queue, reject, or interrupt? Recommend **reject** with the input disabled during generation; cleanest UX, no race.
3. **Visible history cap**: contextoverflow handles model-side; should we cap the React history at, e.g., 100 messages to keep the DOM bounded? Recommend yes — bound at 50 exchanges (100 messages), trim oldest from view (separate from contextoverflow's session-side trim).
4. **Persisting the chat-panel open state across reloads**: roadmap Won't list says no persistence. Honor it — `panelOpen` is component-local.
5. **Default `chatPosition`**: pre-declared in types as `"right" | "bottom"`. Recommend `"right"` as default (desktop-first). The narrow-viewport breakpoint can drive bottom mode at runtime without changing the setting.

## Implementation-path call

Estimated ~650 LOC across 5 new files + 4 modified. **Path: `delegated`** per the SKILL's threshold (>300 LOC and >5 files). Dispatch 1× general-purpose Sonnet in `isolation: "worktree"`. Per proclivity's worktree-vs-main precedence in [phase-implement.md](.claude/skills/milestone-pipeline/references/phase-implement.md), the delegated implementer commits to `main` inside the worktree.

## Notes from external research

- `session.prompt(text)` auto-includes prior turns when the session is reused (no manual history assembly).
- `contextoverflow` fires *before* trim is finalized; session stays usable; `initialPrompts` are never trimmed.
- Clear-during-generation: `controller.abort()` first (synchronous), then `session.destroy()`. Avoid `destroy()` alone — stale state writes risk.
- No published context-window size; runtime `session.contextWindow` is authoritative. Field estimates: ~4k–6k tokens.
- Use `React.lazy(() => import("@/components/chat/ChatPanel"))` matching the existing `MeshBackground` lazy-load pattern.
