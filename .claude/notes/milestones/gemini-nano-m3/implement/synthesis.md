# gemini-nano-m3 — Implementation Synthesis

**Commit SHA:** `43560d8`
**Branch:** `worktree-agent-a81999307e9c39ca8` (orchestrator must fast-forward `main`)
**Build:** clean — `tsc -b && vite build` passes under strict + exactOptionalPropertyTypes + noUncheckedIndexedAccess
**Date:** 2026-05-12

---

## Built — AC Mapping

| AC | Description | File:Line |
|----|-------------|-----------|
| AC1 | `src/llm/tools.ts` exports `TOOL_SCHEMA`, `buildSystemPrompt`, `parseToolCall`, `applyToolCall`, and all typed union shapes | `src/llm/tools.ts:1–336` |
| AC2 | `responseConstraint: TOOL_SCHEMA` passed on every `session.prompt()` call; system prompt injected via `initialPrompts` at session-create | `src/hooks/useChatSession.ts:169–172`, `111–120` |
| AC3 | Three tool calls: `add_todo` (writes `state.todos`), `add_gantt_task` (writes `state.ganttTasks`, `chartId` validated), `set_reminder` (writes `state.reminders`, `fireAt` validated > now) | `src/llm/tools.ts:225–310` |
| AC4 | Tool-result card in chat thread with summary text and Undo button (10-second fade via CSS + expired state) | `src/components/chat/ChatMessage.tsx:55–110`, `src/components/chat/ChatPanel.css:284–324` |
| AC5 | `kind: "chat"` → plain assistant text; `kind: "parse-failed"` → system-notice with raw output | `src/hooks/useChatSession.ts:176–190` |
| AC6 | `plans/gemini-nano-eval-snapshot.md` — 20-prompt template with schema-discrimination decision, upgrade path, and blank result cells | `plans/gemini-nano-eval-snapshot.md` |
| AC7 | Build clean; initial chunk unchanged (195.56 kB); ChatPanel chunk grew ~8.8 kB (4.99 → 13.79 kB); no new npm deps | Build output above |

---

## Files Touched

| File | Status | Purpose |
|------|--------|---------|
| `src/llm/tools.ts` | NEW | Schema constant, TypeScript union types, `buildSystemPrompt`, `parseToolCall`, `applyToolCall` |
| `src/hooks/useChatSession.ts` | MODIFIED | Integrated tool schema, system prompt, parse/apply dispatch, Undo mechanism |
| `src/components/chat/ChatMessage.tsx` | MODIFIED | Accepts `msg: ChatMessageData` + `onUndo?`; renders `ToolResultCard` for tool-result payloads |
| `src/components/chat/ChatPanel.tsx` | MODIFIED | Destructures `undo` from hook; passes it to `ChatMessage` |
| `src/components/chat/ChatPanel.css` | MODIFIED | `.chat-panel__tool-result`, `.chat-panel__undo-btn`, `.chat-panel__undo-btn--expired` styles |
| `plans/gemini-nano-eval-snapshot.md` | NEW | 20-prompt eval template; maintainer fills result cells post-merge |

---

## Key Design Decisions Implemented

1. **Flat-object schema with `pattern` discriminator** — `oneOf`/`enum` not used (unverified, `NotSupportedError` risk). Upgrade path documented in eval template.

2. **`stateRef` pattern** — state is mirrored in a ref to keep `ensureSession` and `send` callbacks stable (no rebuilding on every state change). `stateRef.current` is read at call time.

3. **`messagesRef` pattern** — messages state mirrored in a ref so `undo` can read current messages without a functional-updater side-effect anti-pattern.

4. **Pre-snapshot scope** — entire `ProclivityState` captured before each tool-call apply. Cheap, simple, avoids slice complexity.

5. **Undo expiry** — `expiresAt` field on `ToolResultPayload`; `setTimeout` in `send()` sets it to 0; `ToolResultCard` reads `expiresAt` via `useEffect` + `useState(expired)` + CSS class.

6. **GanttTask tags** — `GanttTask` type in `src/types/index.ts` has no `tags` field, so `tagIds` from `add_gantt_task` tool calls are silently dropped. No system-notice emitted (no user-visible promise was made for Gantt task tags). The schema still accepts `tagIds` so the model can include them without error.

---

## Deferred

- `oneOf` / `enum` schema upgrade — deferred to post-m3 eval (documented in eval template).
- Stale system-prompt context (tags/charts list) when user adds/deletes items during an open session — deferred; "Clear chat" creates a new session with fresh context.
- GanttTask tag support — requires adding `tags: string[]` to the `GanttTask` type and the storage backfill, out of m3 scope.

---

## external_writes_required

```yaml
external_writes_required:
  - "Orchestrator must fast-forward `main` to SHA 43560d8 (worktree branch commit). Run: git checkout main && git merge --ff-only worktree-agent-a81999307e9c39ca8"
  - "Maintainer runs the 20-prompt eval in plans/gemini-nano-eval-snapshot.md after m3 lands; fills result cells; commits separately."
```

---

## Test Deltas

None. No new test files added (project has no test suite at this milestone level). The eval template at `plans/gemini-nano-eval-snapshot.md` serves as the manual verification gate.

---

## Build Delta

| Chunk | Before | After | Delta |
|-------|--------|-------|-------|
| `index.html-*.js` (initial newtab) | 195.56 kB | 195.56 kB | 0 kB |
| `ChatPanel-*.js` (code-split chat) | 4.99 kB | 13.79 kB | +8.8 kB |
| `ChatPanel-*.css` | 4.36 kB | 5.12 kB | +0.76 kB |
| All others | unchanged | unchanged | 0 kB |
