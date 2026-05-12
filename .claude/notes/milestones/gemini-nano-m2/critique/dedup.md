# Critique — gemini-nano-m2 — DEDUPED MERGE

**Sources:** adversary
**Counts:** C=0 H=2 M=2 L=2

## Verdict

**SHIP-WITH-FIXES** (aggregated from: SHIP-WITH-FIXES)

## Executive summary

- [HIGH] useChatSession: no useEffect cleanup on unmount
- [HIGH] ChatPanel mounted in DOM when chatOpen=false, violating brief-2 AC #1
- [MEDIUM] Nested aria-live regions cause double-announcement
- [MEDIUM] No focus trap in ChatPanel
- [LOW] Module-level `nextId` counter accumulates across StrictMode double-renders
- [LOW] `contextoverflow` handler comment misrepresents invariant

## Findings

### CRITICAL

### HIGH

#### [HIGH] H1 — useChatSession: no useEffect cleanup on unmount

- **File:** `src/hooks/useChatSession.ts`
- **Line:** 43–167 (entire hook body — no `useEffect` is present)
- **Anchor:** `export function useChatSession(): UseChatSessionResult {`
- **What:** The hook holds a `LanguageModel` session (GPU/CPU memory) in `sessionRef` and an `AbortController` in `abortRef`, but registers no `useEffect` cleanup function. When `chatEnabled` goes `false` in Settings, React unmounts `ChatPanel` and tears down the hook instance without aborting the in-flight prompt or destroying the session.
- **Why it matters:** A `LanguageModel` session occupies dedicated GPU/CPU inference slots. Chrome's docs recommend `destroy()` explicitly to release model memory. An in-flight `prompt()` call continues executing against a session that is no longer referenced — burning resources until the microtask resolves and the promise is garbage-collected. Additionally, brief-2 axis 8 explicitly requires "Component unmount must also clean up (abort + destroy + null ref)."
- **Proposed fix:** Add a mount-time cleanup effect at the bottom of the hook body:
- **Regression-guard:** Add a test that renders `useChatSession` in a wrapper, calls `send()`, and unmounts the wrapper while the prompt is in flight; assert that the mock session's `destroy()` and `AbortController.abort()` are both called exactly once.
- **Source critic:** adversary
- **Source axis:** 8. Session-lifecycle correctness; 12. Race/re-mount correctness
- **Original id:** H1

#### [HIGH] H2 — ChatPanel mounted in DOM when chatOpen=false, violating brief-2 AC #1

- **File:** `src/newtab/App.tsx`
- **Line:** 119–123
- **Anchor:** `      {chatEnabled && (`
- **What:** `ChatPanel` is wrapped in `{chatEnabled && <Suspense>...</Suspense>}`, which keeps it mounted in the DOM for the entire time `chatEnabled=true`, regardless of whether the user has the panel open (`chatOpen`). The `open` prop only drives a CSS `translateX` transform. Brief-2 AC #1 says: "When closed, it is unmounted from the DOM (not just hidden) so it does not poll or hold a session unnecessarily." The research synthesis (`.claude/notes/milestones/gemini-nano-m2/research/synthesis.md`) shows the intended pattern as `{chatOpen && <Suspense>...</Suspense>}`.
- **Why it matters:** Once the user sends their first message, the session persists in `sessionRef` for as long as `chatEnabled=true`, even while the panel is visually closed. This is the "hold a session unnecessarily" case the AC explicitly targets. If fixing H1 (cleanup on unmount), fixing H2 should be done together — otherwise unmounting on close would destroy the session each time, which may be a UX regression. The recommended resolution is: gate on `chatEnabled && chatOpen` and remove the `open` prop (panel is always visually open when mounted).
- **Proposed fix:** ```tsx
- **Regression-guard:** Integration test: render App with `chatEnabled=true`, `chatOpen=false`; assert `ChatPanel` is not in the document. Then set `chatOpen=true`; assert it mounts. Then set `chatOpen=false` again; assert it unmounts and `session.destroy()` is called.
- **Source critic:** adversary
- **Source axis:** 8. Session-lifecycle correctness; 6. Acceptance criteria (brief-2 AC #1)
- **Original id:** H2

### MEDIUM

#### [MEDIUM] M1 — Nested aria-live regions cause double-announcement

- **File:** `src/components/chat/ChatPanel.tsx`
- **Line:** 82 and 94
- **Anchor:** `      <div className="chat-panel__messages" aria-live="polite" aria-atomic="false">`
- **What:** The `.chat-panel__messages` container has `aria-live="polite"`, and the `.chat-panel__thinking` div nested inside it also has `aria-live="polite"`. When the thinking indicator appears, some screen readers (NVDA on Windows, Talkback on Android) announce the change from both regions, resulting in a duplicate announcement or garbled output.
- **Why it matters:** The intended behavior is for the messages list to announce new messages and for the thinking indicator to announce its own state. Nesting two live regions defeats both: the outer region grabs the mutation and may swallow or duplicate the inner one.
- **Proposed fix:** Remove `aria-live` from the outer `.chat-panel__messages` container. Keep `aria-live="polite"` only on the inner `.chat-panel__thinking` div and on each `<ChatMessage>` with `role="system-notice"` (which already has `aria-live="polite"` in `ChatMessage.tsx`). New assistant messages can be announced via a visually-hidden `aria-live` status region outside the scroll container, or by keeping `aria-live` on the message container while removing it from `.chat-panel__thinking`.
- **Source critic:** adversary
- **Source axis:** 11. A11y
- **Original id:** M1

#### [MEDIUM] M2 — No focus trap in ChatPanel

- **File:** `src/components/chat/ChatPanel.tsx`
- **Line:** 47–110 (entire rendered output)
- **Anchor:** `      className={`chat-panel${open ? " chat-panel--open" : ""}`}`
- **What:** `ChatPanel` has `role="complementary"` and renders interactive controls (Clear button, Close button, textarea, Send button) but implements no focus trap. When the panel is open and the user tabs past the Send button, focus escapes into the main dashboard (which is rendered behind the panel). Since the panel is not a modal (no overlay), this is a lesser issue than a modal without a trap, but users navigating by keyboard cannot keep focus within the panel area without a trap.
- **Why it matters:** Users who navigate by keyboard (especially users with motor disabilities) will lose their position in the chat panel and have to re-navigate back. The existing `Modal.tsx` implements a full focus-trap pattern that could be adapted here. This is a "cheaply fixable a11y gap" per the rubric.
- **Proposed fix:** Extract the focus-trap logic from `Modal.tsx` into a shared `useFocusTrap(panelRef, isActive)` hook and apply it in `ChatPanel` when `open` is true. Alternatively, wrap the panel content in a `<FocusTrap>` utility component. At minimum, add `Tab` key interception in the panel's `keydown` handler (analogous to `Modal.tsx:74-91`).
- **Source critic:** adversary
- **Source axis:** 11. A11y
- **Original id:** M2

### LOW

#### [LOW] L1 — Module-level `nextId` counter accumulates across StrictMode double-renders

- **File:** `src/hooks/useChatSession.ts`
- **Line:** 30
- **Anchor:** `let nextId = 0;`
- **What:** `nextId` is a module-level `let`. In React 18 StrictMode (development), component functions are invoked twice to detect side effects; `makeMsg()` calls inside these double-renders increment `nextId`, burning IDs that are then discarded. IDs remain globally unique, so React keying is unaffected in production.
- **Why it matters:** No production impact. In dev mode only, message IDs jump non-sequentially (0, 2, 4…) which can be confusing when inspecting React DevTools. If `useChatSession` is ever used in more than one panel simultaneously, a shared module-level counter is also incorrect architecture (though this use case is not present).
- **Proposed fix:** Move the counter inside a `useRef`:
- **Source critic:** adversary
- **Source axis:** 3. Strict TS / correctness
- **Original id:** L1

#### [LOW] L2 — `contextoverflow` handler comment misrepresents invariant

- **File:** `src/hooks/useChatSession.ts`
- **Line:** 60–64
- **Anchor:** `        // Find the first user message index. The paired assistant message`
- **What:** The comment states "The paired assistant message is immediately after it (our send() always appends them in order)." This invariant holds only after a completed exchange. If `contextoverflow` were to fire while a prompt is in flight, the "pair" at the tail would be user-only (no assistant yet). In practice, `contextoverflow` fires only after many completed exchanges (field estimate: 15-25 exchanges before hitting the context window), so this code path is correct for all realistic inputs. The comment is misleading.
- **Why it matters:** A future maintainer adding streaming support or pre-seeding `initialPrompts` might rely on this documented invariant and introduce a bug. No production impact in the current implementation.
- **Proposed fix:** Update the comment to: "The oldest user message and its paired assistant response are at indices 0 and 1 (after any notice messages). contextoverflow fires only after multiple completed exchanges, so the pair is guaranteed to be complete before overflow occurs."
- **Source critic:** adversary
- **Source axis:** 8. Session-lifecycle correctness
- **Original id:** L2

## What was done well

  - **Wrapper isolation is clean.** `useChatSession` imports `nanoCreateSession` from `@/llm/nano` exclusively and uses `LanguageModel` only as a TypeScript type annotation. Zero direct `LanguageModel` global access at runtime — exactly as the brief requires.  _(adversary)_
  - **`contextoverflow` is wired correctly.** `session.addEventListener("contextoverflow", ...)` is used (not the deprecated `oncontextoverflow` handler property), and the listener uses the functional `setMessages` updater form, avoiding stale-closure issues.  _(adversary)_
  - **`QuotaExceededError` is distinguished from `contextoverflow`.** The `catch` block checks `err.name === "QuotaExceededError"` separately from `"AbortError"`, surfacing a human-readable inline error without crashing or corrupting session state. This correctly implements brief-2's "alternative implementation path" recommendation.  _(adversary)_
  - **Abort ordering is correct.** `clear()` calls `abortRef.current?.abort()` before `sessionRef.current?.destroy()`, matching brief-2 §1's explicit pattern. The `finally` block cleans `abortRef` and resets `generating`, making it safe even if abort and destroy race.  _(adversary)_
  - **Code-splitting is structural.** `React.lazy(() => import("@/components/chat/ChatPanel"))` produces a separate `ChatPanel-*.js` chunk (4.43 kB) and `ChatPanel-*.css` chunk (4.36 kB). The initial newtab chunk grows by ~1.8 kB (well under the 5 kB AC #6 budget). This matches the `MeshBackground` pattern in the codebase.  _(adversary)_
  - **State-shape integrity is solid.** `ResolvedUserSettings.geminiNano` is non-optional with both `chatEnabled` and `chatPosition`. `DEFAULT_SETTINGS` and `resolvedSettings()` correctly apply defaults via `??` chaining. `App.tsx` reads from `resolvedSettings()` (not raw `state.settings`) for the gating decision.  _(adversary)_
  - **TypeScript compilation is clean.** `tsc -b` passes with `strict`, `exactOptionalPropertyTypes`, and `noUncheckedIndexedAccess` all enabled. No `any`, no unsafe index accesses, and no optional-property violations in any of the 9 new/modified files.  _(adversary)_
  - **Security posture is unchanged.** `grep -rn "fetch\|XMLHttpRequest" src/` returns zero hits in the new chat code. No new manifest permissions. No new npm runtime dependencies. SECURITY.md §3 ("No data leaves the device") continues to hold.  _(adversary)_
  - **Accessible interactive affordances.** The chat-bubble toggle button has `aria-label="Chat with Nano"` and `aria-pressed={chatOpen}`. The textarea has `aria-label="Chat message"`. The close and clear buttons both have `aria-label`. The panel itself has `role="complementary"` and `aria-label="Gemini Nano chat"`. The system-notice messages render with `aria-live="polite"`.  _(adversary)_
  - **Conventional commit is correctly formatted.** Subject `on-device chat panel (gemini-nano-m2)` is 37 characters (under the 50-char limit after the `feat(chat): ` prefix). Commit is GPG-signed (`G`). Co-author trailer is present. No `--no-verify` was used.  _(adversary)_

## Recommended rectification order

H1, H2, M1, M2, L1, L2
