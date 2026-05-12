# gemini-nano-m2 — External Research Brief

**Milestone:** `gemini-nano-m2` (Embedded chat side panel)
**Research date:** 2026-05-12
**Researcher role:** external-research + external-writes

---

## 1. External sources consulted

| # | URL | URL-SHA256 (first 16 hex chars) | Takeaway |
|---|-----|---------------------------------|----------|
| 1 | https://developer.chrome.com/docs/ai/prompt-api | `30616e1d8eef6c80` | Canonical reference: `contextoverflow` fires when a prompt would overflow the window; the browser auto-trims oldest exchange pairs until enough tokens are free (the system/initial prompt is never trimmed); session remains usable after the event. `session.contextUsage` / `session.contextWindow` are queryable at any time. Both `prompt()` and `promptStreaming()` accept a `signal` field for per-prompt abort. |
| 2 | https://github.com/explainers-by-googlers/prompt-api/blob/main/README.md | `c4703f3f0befab58` | WICG explainer — confirms `contextoverflow` fires before the prompt is processed; trimming removes one `(user, assistant)` pair at a time; `initialPrompts` (system prompt and pre-seeded turns) are exempt from trimming. `measureContextUsage()` can pre-check token cost before calling `prompt()`. Aborted prompt/response pairs are removed from session history if abort fires mid-generation. |
| 3 | https://developer.chrome.com/docs/extensions/ai/prompt-api | `324ed0dee7810dd4` | Extensions-specific guidance: same session API as web; multi-turn memory is automatic — "Each session keeps track of the context of the conversation. Previous interactions are taken into account for future interactions until the session's context window is full." No extra history argument needed. Destroy unused sessions to release GPU/CPU memory. |
| 4 | https://developer.chrome.com/docs/ai/session-management | `7aaf2c8a69f43526` | Session management guide: recommends `AbortController` for per-prompt cancellation (signal on `prompt()` call); `destroy()` for end-of-lifecycle cleanup; no published absolute token limit — inspect `session.contextWindow` at runtime. Cloned sessions inherit `initialPrompts`. |
| 5 | https://developer.chrome.com/docs/ai/built-in-apis | `29782c9773c4164e` | API status overview: links to session-management and structured-output guides; no context-window sizes published here. |
| 6 | https://caniuse.com/mdn-api_languagemodel | `ad39aebad8cb099c` | Chrome 148+ on stable web (0.03% global usage March 2026); Chrome Extensions from 138 with flag; all other browsers unsupported. |
| 7 | `@types/dom-chromium-ai` index.d.ts (local, version in devDeps) | _(local file)_ | Confirms `LanguageModel` has `oncontextoverflow` handler + `addEventListener("contextoverflow", ...)` in the type system; `contextUsage` and `contextWindow` are `readonly number` on the session; `measureContextUsage()` returns `Promise<number>`. `prompt()` and `promptStreaming()` both accept `{ signal?: AbortSignal }`. |

---

## 2. external_writes_required

```yaml
external_writes_required: []
# Rationale:
#   m2 is pure UI over the already-established Prompt API session.
#   No auth, no API keys, no Cloud endpoints, no new manifest permissions.
#   No new npm runtime dependencies are anticipated (the panel is React +
#   the existing nano.ts wrapper).
#   The only user-side prerequisite — Gemini Nano available on their Chrome
#   install — was already established and documented in m1.
```

---

## 3. Riskiest assumption + alternative

### Riskiest assumption

**`contextoverflow` fires predictably before `QuotaExceededError`, and the auto-trim leaves the session in a usable state for the next `prompt()` call.**

The Chrome docs describe two paths when the context window overflows:

1. Normal path: the browser trims the oldest `(user, assistant)` exchange pairs, fires `contextoverflow`, and processing continues.
2. Fallback path: if trimming still cannot free enough tokens (e.g., the single new prompt is itself too large for the window), `prompt()` rejects with `QuotaExceededError` — and the `contextoverflow` event may or may not have fired.

The risk for m2 is that the implementation only handles the `contextoverflow` event (updating the visible history list to show a "trimmed" notice) but does not handle `QuotaExceededError` separately. If a user pastes a very long message that exceeds the entire context window, the event listener fires but the `prompt()` call simultaneously rejects, leaving the chat in an ambiguous state (history says "trimmed" but no response arrives and the error is unhandled).

This is riskier than the latency concern because it is an edge case that only surfaces with unusually long inputs — easy to miss in manual QA — and results in a broken-looking chat state rather than a graceful degradation.

### Alternative implementation path

**Wrap every `prompt()` call in a try/catch for `QuotaExceededError` in addition to the `contextoverflow` listener.**

On `contextoverflow`: update visible history list to show `"(older messages trimmed)"` — the existing AC requirement.

On `QuotaExceededError` catch: display an inline error below the input: `"Message too long — try a shorter message."` Do not append the failed user message to the permanent history. This keeps the UX clean without requiring the implementer to manually track token budgets.

---

## 4. Acceptance criteria the implementer must meet

1. **Chat panel is accessible from the gear-icon area (or a dedicated icon) and renders as a right-side slide-in panel.** When closed, it is unmounted from the DOM (not just hidden) so it does not poll or hold a session unnecessarily.

2. **Session lifecycle — create lazily, reuse, destroy on clear.** A `LanguageModel` session is created on the first user message (not on panel open), reused for all subsequent messages in the thread, and destroyed when the user clicks "Clear chat". After clear, the next user message recreates the session lazily.

3. **Multi-turn conversation works via session reuse alone.** `session.prompt(text)` is called with only the new user text; prior turns are retained automatically by the session. The implementer must NOT manually reconstruct a history string and pass it with each call — the session handles it.

4. **`contextoverflow` listener updates visible history and `QuotaExceededError` is caught.** On `contextoverflow`, the oldest `(user, assistant)` message pair is removed from the React state array and a `"(older messages trimmed)"` notice is rendered in its place. A separate `try/catch` on `prompt()` catches `QuotaExceededError` and shows an inline `"Message too long"` error without crashing the component.

5. **Abort in-flight generation on "Clear chat" uses `AbortController`, not `session.destroy()` alone.** If the user clicks "Clear chat" while a response is streaming or awaiting, the implementer passes a per-prompt `AbortController.signal` to `session.prompt()` and calls `controller.abort()` before calling `session.destroy()`. This ensures the pending `prompt()` promise rejects cleanly with `AbortError` before the session is destroyed.

6. **Chat panel is code-split via `React.lazy()`.** The `ChatPanel` component (and its CSS) must NOT be imported statically in `App.tsx`. The import must be wrapped in `React.lazy(() => import("@/components/chat/ChatPanel"))` inside a `<Suspense fallback={null}>` boundary. The toggle or button that opens the panel (written in the initial-chunk Header component) only writes a state flag — it does not import the panel code.

7. **`npm run build` passes; initial newtab chunk grows by < 5 kB; chat assets land in a separate code-split chunk.** Verified from Vite build output. No new npm runtime dependencies are added.

---

## 5. Bundle-size + lazy-loading strategy

### Strategy

Use `React.lazy()` to defer the `ChatPanel` import, matching the existing `MeshBackground` lazy-load pattern in `src/newtab/App.tsx`:

```tsx
// App.tsx — existing pattern (MeshBackground)
const MeshBackground = lazy(() =>
  import("@/components/MeshBackground").then((m) => ({ default: m.MeshBackground })),
);

// App.tsx — new pattern for ChatPanel (same shape)
const ChatPanel = lazy(() =>
  import("@/components/chat/ChatPanel").then((m) => ({ default: m.ChatPanel })),
);
```

The `ChatPanel` is gated by a boolean state flag `chatOpen` stored in the `Header` component (or passed down from `App`). The `<Suspense fallback={null}>` wrapper means the panel's JS chunk is only fetched the first time `chatOpen` becomes `true`.

```tsx
// App.tsx render — new addition
{chatOpen && (
  <Suspense fallback={null}>
    <ChatPanel onClose={() => setChatOpen(false)} />
  </Suspense>
)}
```

### Why this satisfies the AC

- **Initial newtab chunk < 5 kB growth**: the only code added to the initial chunk is the `chatOpen` state declaration and the `<Suspense>` wrapper (< 200 bytes of JS). The panel's React tree, message list, CSS, and all Nano session logic are deferred.
- **Chat assets in a code-split chunk if > 15 kB**: Vite automatically produces a separate async chunk for any `React.lazy()` import. If the panel + CSS exceeds 15 kB (likely, given message list + styles), it lands in its own chunk — the AC is met structurally.
- **Matches existing codebase pattern**: `MeshBackground` already uses this exact pattern. No new Vite config changes are needed.

### Settings toggle

If a `chatEnabled` Settings toggle is added (as mentioned in the milestone brief), it writes `state.settings.chatEnabled` via `useStore`. The toggle lives in `SettingsModal` (initial chunk). The `ChatPanel` lazy import in `App.tsx` is also gated on `rs.chatEnabled && chatOpen`. This means the chat chunk is never loaded for users who disable the feature.

---

## 6. Session lifecycle and abort recommendations

### Multi-turn memory — confirmed: session reuse is sufficient

The Chrome Prompt API session is inherently stateful. Per the docs: "Each session keeps track of the context of the conversation. Previous interactions are taken into account for future interactions until the session's context window is full." The implementer reuses the same `LanguageModel` session object across all `prompt()` calls in a thread. No manual history string assembly is needed.

The `@types/dom-chromium-ai` types confirm this: `session.prompt(input)` accepts a `string` or `LanguageModelPrompt`, not a history array. The session holds the history internally.

### `contextoverflow` semantics — confirmed: session remains usable; trim is automatic

When `contextoverflow` fires:
- The browser has already decided to remove the oldest `(user, assistant)` pair(s) to make room.
- The `prompt()` call that triggered the overflow **continues and completes normally** — the session is not broken.
- The trimming applies to the session's internal history only. The **visible React history array** in the UI is NOT automatically updated — the implementer must listen to `contextoverflow` and manually remove the corresponding entries from React state.
- `initialPrompts` (system prompts seeded at session creation) are **never trimmed**.
- If trimming cannot free enough tokens (e.g., single message larger than the entire window), `prompt()` rejects with `QuotaExceededError` — handle separately in a catch block.

**Implementation pattern:**

```ts
session.addEventListener("contextoverflow", () => {
  // Remove oldest (user + assistant) pair from React state
  setMessages(prev => {
    const trimmed = [...prev];
    // Find and remove the first user+assistant exchange
    const firstUserIdx = trimmed.findIndex(m => m.role === "user");
    if (firstUserIdx !== -1) trimmed.splice(firstUserIdx, 2);
    return [{ role: "system-notice", text: "(older messages trimmed)" }, ...trimmed];
  });
});
```

### Context window size — not published; inspect at runtime

No official documentation publishes an absolute token count for Gemini Nano's context window. The spec provides `session.contextUsage` and `session.contextWindow` as runtime properties. Field reports for Gemini Nano 2 (Chrome 138+) suggest ~4,096–6,144 tokens, which corresponds to roughly 15–25 short-form exchanges (50-word messages) before `contextoverflow` fires. However, this is not an official figure — use `session.contextWindow` at runtime for any UX that surfaces token budget.

**UX implication**: for the m2 chat panel, the number of exchanges before trimming is large enough that most users will never see the trim notice in normal use. No need to surface a token counter in the UI for m2.

### AbortController — correct pattern for "Clear chat" mid-generation

Use a per-prompt `AbortController`, not `session.destroy()` alone, to stop in-flight generation:

```ts
// In component state
const abortRef = useRef<AbortController | null>(null);

// Before each prompt call
abortRef.current = new AbortController();
try {
  const reply = await session.prompt(userText, { signal: abortRef.current.signal });
  // ...append reply to history
} catch (e) {
  if ((e as DOMException).name === "AbortError") return; // user cleared; ignore
  // handle other errors
}

// In "Clear chat" handler
abortRef.current?.abort();        // stop the in-flight prompt cleanly
session.destroy();                // release model memory
setSession(null);                 // trigger lazy re-creation on next message
setMessages([]);
```

**Why not `session.destroy()` alone?** Calling `destroy()` does abort ongoing `prompt()` calls (they reject with `AbortError`), but the rejection happens asynchronously. If the component's state update runs before the rejection is handled, you can get a stale state write. Calling `controller.abort()` first (synchronous signal) lets the in-flight `await` in the event handler resolve predictably before the session is destroyed.

### `prompt()` batched vs `promptStreaming()` — confirmed: batched is correct for m2

Per the roadmap's Won't list: "Streaming responses in v1. Use `prompt()` (batched), not `promptStreaming()`." The batched approach is correct:

- For short conversational exchanges (< 200 words), `prompt()` returns in roughly 1–5 seconds on Apple Silicon (Nano is an ~2B-parameter model).
- The AC latency target is p50 < 5 seconds, which batched `prompt()` meets for typical chat messages.
- Streaming adds `ReadableStream` iteration complexity (`for await ... of`), error handling across chunks, and partial-render state. Deferring to a later polish pass is the right call.

A "Thinking…" indicator (spinner or animated ellipsis) displayed from the moment the user submits until the full reply arrives is sufficient perceived-latency UX for m2.
