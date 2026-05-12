# gemini-nano-m3: Codebase-Context Research Brief

**Status:** Complete
**Date:** 2026-05-12
**Scope:** Read-only exploration of types, hooks, storage, and integration patterns for tool-call implementation.

---

## 1. Current State Shape and Types

### Reference: `src/types/index.ts`

#### Todo — required and optional fields for `add_todo` tool call
- **From:** `src/types/index.ts:25–38`
- **Auto-generated fields (exclude from schema):** `id`, `createdAt`, `done`
- **Required in tool call:** `title` (string)
- **Optional in tool call:**
  - `scope` (TodoScope = "today" | "sprint" | "long"; default "today")
  - `notes` (string | undefined)
  - `dueAt` (number | undefined; reserved for future — tool call may set, but no UI for it yet)
  - `sprintId` (string | undefined; must validate against existing `state.sprints[].id`)
  - `tags` (string[]; references existing `state.tags[].id`; empty array if none)

**Tool-call field shape:**
```typescript
{
  title: string;
  scope?: TodoScope;
  notes?: string;
  dueAt?: number;
  sprintId?: string;
  tags?: string[];
}
```

#### GanttTask — required and optional fields for `add_gantt_task` tool call
- **From:** `src/types/index.ts:47–60`
- **Auto-generated fields (exclude from schema):** `id`, `done`, `collapsed`
- **Required in tool call:**
  - `chartId` (string; must validate against existing `state.ganttCharts[].id`)
  - `title` (string)
  - `startsAt` (number; Unix timestamp in ms)
  - `endsAt` (number; Unix timestamp in ms; must be ≥ startsAt)
- **Optional in tool call:**
  - `parentId` (string | undefined; must validate against existing `state.ganttTasks[].id` in same chart)
  - `progress` (number; 0–100 integer, defaults to 0)
  - `tags` (string[]; references existing `state.tags[].id`; empty array if none)

**Tool-call field shape:**
```typescript
{
  chartId: string;
  title: string;
  startsAt: number;
  endsAt: number;
  parentId?: string;
  progress?: number;
  tags?: string[];
}
```

#### Reminder — required and optional fields for `set_reminder` tool call
- **From:** `src/types/index.ts:68–77`
- **Auto-generated fields (exclude from schema):** `id`, `fired`
- **Required in tool call:**
  - `title` (string)
  - `fireAt` (number; Unix timestamp in ms; must be > Date.now())
- **Optional in tool call:**
  - `recurrence` ("daily" | "weekly" | "none" | undefined; defaults to "none")
  - `linkedTodoId` (string | undefined; must validate against existing `state.todos[].id`)
  - `tags` (string[]; references existing `state.tags[].id`; empty array if none)

**Tool-call field shape:**
```typescript
{
  title: string;
  fireAt: number;
  recurrence?: "daily" | "weekly" | "none";
  linkedTodoId?: string;
  tags?: string[];
}
```

#### Tag availability for tool calls
- **From:** `src/types/index.ts:18–23` and `src/storage/tags.ts:22–34`
- All three tool calls accept `tags?: string[]` where each string references `state.tags[].id`
- Tool calls **cannot create new tags** — only assign existing ones. This preserves full user control over tag color selection (per `src/storage/tags.ts:42–50` design).
- System prompt should include the list of available tags as `{ id, label, color }` so the model can make intelligent choices when assigning tags.

---

## 2. `src/llm/nano.ts` — Module structure and integration

### Module exports (from `src/llm/nano.ts:1–184`)

**Key functions:**
- `availability()` (line 62–65): Returns Promise<Availability>; one of "available" | "downloadable" | "downloading" | "unavailable"
- `createSession(opts?: CreateSessionOpts)` (line 100–112): Returns Promise<LanguageModel>; caller must `.destroy()` when finished
- `prompt(text, opts?)` (line 124–136): Fire-and-forget one-shot prompt; creates session, calls prompt, destroys session
- `promptStructured<T>(text, schema, opts?)` (line 158–184): One-shot prompt constrained by JSON Schema; returns Promise<T>; throws NanoParseError if response is non-JSON

**Initializing with system prompt (via `CreateSessionOpts.initialPrompts`):**
- **From:** `src/llm/nano.ts:67–92`
- The `initialPrompts` field accepts either:
  - `LanguageModelMessage[]` (user/assistant array, no system prompt)
  - `[LanguageModelSystemMessage, ...LanguageModelMessage[]]` (system prompt + messages)
- m3 should use the second form to prepend a tool-call system prompt at session creation time
- Per line 82–84, the SDK mirrors the LanguageModel API exactly: `createSession({ initialPrompts: [systemMsg, ...otherMsgs] })`

**Constraints on `responseConstraint` (used by `promptStructured`):**
- **From:** `src/llm/nano.ts:138–145`
- Chrome 137+ docs confirm: object, array, string, number, boolean primitives; properties, required, additionalProperties, items, maxItems, pattern
- **Unverified:** enum, oneOf, anyOf, $ref — m3 should test these empirically
- The milestone's eval snapshot (`plans/gemini-nano-eval-snapshot.md`) will measure parse rate on the concrete union schema

### Integration pattern for m3

**Two approaches to tool-call responses:**

**Option A: `responseConstraint` + tagged union with a `chat` arm (recommended)**
- Constrain every response to a tagged-union JSON schema
- The union includes four arms: `chat`, `add_todo`, `add_gantt_task`, `set_reminder`
- Model is forced to always return JSON; conversational responses wrap in `{ type: "chat", text: "..." }`
- **Benefit:** ~100% parse rate, deterministic behavior
- **Trade-off:** Every response is JSON, even "how should I plan my week?" must be wrapped
- **Schema outline:**
```typescript
{
  type: "object",
  discriminator: { propertyName: "type" },
  oneOf: [
    { type: "object", properties: { type: { const: "chat" }, text: { type: "string" } }, required: ["type", "text"] },
    { type: "object", properties: { type: { const: "add_todo" }, todo: { /* todo schema */ } }, required: ["type", "todo"] },
    { type: "object", properties: { type: { const: "add_gantt_task" }, task: { /* task schema */ } }, required: ["type", "task"] },
    { type: "object", properties: { type: { const: "set_reminder" }, reminder: { /* reminder schema */ } }, required: ["type", "reminder"] }
  ]
}
```

**Option B: System prompt + soft parse (fallback only)**
- Include tool-call schema in the system prompt as documentation (no `responseConstraint`)
- Model decides whether to emit JSON or conversational text
- Parse attempt: try JSON.parse(); on failure, treat as prose
- **Benefit:** Cleaner conversational responses don't force wrapping
- **Trade-off:** Failures are common ("looks like JSON but isn't quite") — catch and demote to prose

**Recommendation:** Use Option A (responseConstraint + union with chat arm). The 100% parse rate and deterministic behavior outweigh the minor wrapping cost for chat responses. The milestone's eval will validate this choice.

---

## 3. Chat hook integration point: `src/hooks/useChatSession.ts`

### Current send() flow (line 90–148)

1. User types message and calls `send(userText)`
2. Trim and early-return if empty (line 94–95)
3. Append user message to visible history (line 100–108)
4. Create AbortController for this prompt (line 110–112)
5. Ensure session exists or create lazily (line 116–117)
6. **Call `session.prompt(trimmed, { signal })` and await reply** (line 117)
7. Create assistant message and append (line 118–125)
8. Handle QuotaExceededError and AbortError (line 126–141)
9. Clear abort ref and set generating=false (line 143–144)

### m3 integration point

**After line 117 (after `session.prompt()` returns):**
1. Capture the live `state` snapshot **before** any mutations: `const preSnapshot = { ...state }`
2. Attempt to parse the assistant reply as a tool-call union (Option A from §2)
3. If parse succeeds and the response has a tool-call arm (not "chat"):
   - Extract the record (todo, task, or reminder)
   - Generate an `undoToken` (e.g., `uid()` from `src/storage/storage.ts:95–99`)
   - Call `update()` to apply the record to state
   - Create a new message with role `"tool-result"` (or new discriminated payload; see §4)
   - Append both the tool-result message and (if present) any accompanying text as a regular assistant message
   - Render the Undo button with 10-second visibility window
4. If parse succeeds and the response is "chat" or if parse fails:
   - Treat the raw reply as a regular assistant message
   - Create a regular message with role `"assistant"` and text = reply

### Current teardown (clear, unmount)

The existing cleanup pattern (line 155–180) already handles abort-before-destroy correctly — m3 doesn't change this.

---

## 4. ChatMessage component and payload enrichment: `src/components/chat/ChatMessage.tsx`

### Current structure (line 8–38)

**Current props:**
```typescript
interface ChatMessageProps {
  role: ChatRole;
  text: string;
}
```

**Current roles:** "user" | "assistant" | "system-notice"

### m3 enrichment: Discriminated message payload approach (recommended)

Instead of adding a fourth role, enrich the payload to support tool-result cards with Undo buttons:

**New message type:**
```typescript
export interface ChatMessage {
  id: number;
  role: ChatRole; // still "user" | "assistant" | "system-notice"
  text: string;
  payload?: {
    type: "tool-result";
    record: { kind: "todo" | "gantt_task" | "reminder"; data: Todo | GanttTask | Reminder };
    undoToken: string;
    undoWindow: number; // ms; start time (Date.now()) when the undo button visibility started
  };
}
```

**Rationale:**
- Keeps role narrowly scoped to message origin (user, assistant, system-notice)
- Payload carries optional rich metadata without cluttering the type union
- Type narrows cleanly when checking `msg.payload?.type === "tool-result"`

### ChatMessage component updates

**Render logic:**
1. If role is "system-notice", render notice as before (line 24–29)
2. If role is "assistant" and payload?.type === "tool-result":
   - Render a tool-result card showing: "Added [kind]: [title]"
   - Include the Undo button (active if `Date.now() - msg.payload.undoWindow < 10000`, else fade out)
   - On Undo click: call `update(() => undoSnapshot)` and remove the message from history
3. Otherwise render as a regular user/assistant message (line 32–38)

---

## 5. The Undo mechanism: snapshot-and-rollback pattern

### Pattern overview

**Snapshot (before tool-call is applied):**
```typescript
const preSnapshot = state; // full ProclivityState before update
```

**Apply (via useStore.update):**
```typescript
await update((s) => {
  // Create the new record
  const newTodo = { id: uid(), createdAt: Date.now(), done: false, ...parsedToolCall.todo };
  return { ...s, todos: [...s.todos, newTodo] };
});
```

**Undo (within 10-second window):**
```typescript
await update(() => preSnapshot);
```

**Why this works:**
- Each tool-call is isolated: its snapshot captures state at that moment
- Rollback is a single `update(() => snapshot)` call — no diff/merge needed
- If a second tool-call is issued in the same 10-second window, it has its own `preSnapshot`, so its Undo independently reverts only that change
- No race conditions: `update()` is serialized by the write chain in `src/storage/storage.ts:30–70`

### Implementation in useChatSession

1. Before calling `update()` to apply the record, capture: `const preSnapshot = state`
2. After applying the record and rendering the tool-result message, set a timeout:
   ```typescript
   setTimeout(() => {
     setMessages((prev) =>
       prev.map((m) => m.id === toolResultMsg.id ? { ...m, payload: { ...m.payload, undoActive: false } } : m)
     );
   }, 10000);
   ```
3. On Undo button click:
   ```typescript
   const handleUndo = async () => {
     await update(() => preSnapshot);
     setMessages((prev) => prev.filter((m) => m.id !== toolResultMsg.id));
   };
   ```

---

## 6. Tags handling in tool-call schemas

### Tag field in each schema

All three tool-call shapes include: `tags?: string[]` (optional list of tag ids)

**Validation:**
- Each string in the array must match an existing `state.tags[].id`
- Empty array or omitted field means "no tags"
- **Tool calls cannot create new tags** — this is an invariant. Only existing tags can be assigned.

### System prompt context

The system prompt should include a list of available tags, formatted for the model:

```
Available tags:
- "tag_id_1" (label: "Work", color: "#7c9cff")
- "tag_id_2" (label: "Personal", color: "#ff6b9d")
- ...
```

This lets the model make informed choices when assigning tags. If a tag id in a tool-call response doesn't match any id in the list, the tool-call parser should reject it (validation error). The system prompt + schema constraints should make this rare.

---

## 7. Gantt chart wrinkle: chartId resolution

### Problem

The chat doesn't know which chart the user is targeting. Example: "add a task to my roadmap chart called 'Finalize API spec'".

### Solution: enum-constrained chartId

Include the list of available charts in the system prompt AND constrain the `chartId` field in the JSON Schema:

**System prompt excerpt:**
```
Available charts:
- "chart_abc123" (name: "Roadmap")
- "chart_def456" (name: "Q3 Planning")
```

**Schema for chartId:**
```typescript
{
  type: "string",
  enum: ["chart_abc123", "chart_def456"]
}
```

**Fallback:** If the model returns an invalid `chartId` not in the schema, the parse succeeds (the schema constraint should catch it, but if it doesn't), the tool-call parser validates post-parse and raises an error. This is caught as a parse failure, and the response is demoted to plain text.

### Alternative considered (not recommended)

"Let the model match the name" — e.g., chartId is just a string, and the parser looks up by name. This is error-prone: the model might hallucinate a chart name that doesn't exist.

---

## 8. Eval snapshot — `plans/gemini-nano-eval-snapshot.md` format

### Template structure

The eval is a manual, single-run document. It's not part of CI. The implementer fills it in **after** m3 lands and is connected to a real Chrome with Nano available.

**Format: Markdown table + summary stats**

```markdown
# Gemini Nano Tool-Call Eval Snapshot — m3

**Run date:** [date]
**Nano model version:** [e.g., "Gemini 2.0" — this is the user-reported version from their browser, not a precise build ID]
**Chrome version:** [e.g., "Chrome 138.0.0.0"]

## Test Prompts

| # | Prompt | Expected Type | Actual Type | Parse OK? | False Positive? | Notes |
|---|--------|---------------|-------------|-----------|-----------------|-------|
| 1 | "add a todo to call the dentist tomorrow" | add_todo | add_todo | Y | N | |
| 2 | "remind me to buy milk in 30 minutes" | set_reminder | set_reminder | Y | N | |
| ... | ... | ... | ... | ... | ... | |
| 20 | ... | ... | ... | ... | ... | |

## Summary Statistics

- **Parse rate:** 18/20 = 90%
- **False-positive rate:** 1/10 = 10% (chat prompts misclassified as actions)
  - False positive on prompt #X: expected "chat", got "add_todo"
- **Passing test count:** 18
- **Failing test count:** 2

## Notes

- All action prompts (1–10) passed parse. Chat prompts (11–20) had 1 false positive on #18.
- The schema's union discriminator is working as expected.
- No NanoParseError or non-JSON responses observed.
```

**Key fields:**
- Nano model version: User reports this from Settings; Chrome's Prompt API doesn't expose a version field directly
- Chrome version: `navigator.userAgent.match(/Chrome\/\d+/)`
- Parse rate: (# of correct parses) / (total # of prompts); goal ≥ 90%
- False-positive rate: (# of chat prompts misclassified as actions) / (total # of chat prompts); goal ≤ 5%

**Closure:** The milestone closes when the implementer pastes actual results into this doc with both rates meeting the acceptance criteria (≥ 90% parse, ≤ 5% FP).

---

## 9. Affected files — proposed structure

### NEW files

- **`src/llm/tools.ts`** — Core m3 logic:
  - `ToolCallSchema` constant: JSON Schema for the tagged union (Option A from §2)
  - `buildSystemPrompt(tags, charts)` function: Generates system prompt with tool documentation + available tags/charts
  - `parseAndDispatch(response, preSnapshot, update)` function: Parses response as union, applies via update, returns { success: boolean, record?: Todo|GanttTask|Reminder, undoToken?: string }
  - Utility types: `ToolCall` union, `ToolCallChat`, `ToolCallAddTodo`, `ToolCallAddGanttTask`, `ToolCallSetReminder`

- **`plans/gemini-nano-eval-snapshot.md`** — Eval template with placeholder cells; filled in by hand after m3 lands

### MODIFIED files

- **`src/llm/nano.ts`** (line 82–84) — No changes needed; `initialPrompts` already supports system prompt
- **`src/hooks/useChatSession.ts`** (line 117) — After `session.prompt()` returns:
  - Import `parseAndDispatch` from `@/llm/tools`
  - Capture `preSnapshot = state`
  - Call `parseAndDispatch(reply, preSnapshot, update)`
  - If success: append tool-result message with Undo button
  - If failure: append regular assistant message

- **`src/components/chat/ChatMessage.tsx`** (line 10–38) — Enrich message type:
  - Add optional `payload` field to `ChatMessage`
  - Check for `payload?.type === "tool-result"` and render card + Undo button
  - Fade Undo button after 10 seconds (via `Date.now() - payload.undoWindow > 10000`)

- **`src/components/chat/ChatPanel.css`** (line 200+) — Add styles:
  - `.chat-message--tool-result` container for the card
  - `.chat-message__tool-card` badge showing record type and title
  - `.chat-message__undo-button` with fade transition (opacity: 1 → 0 after 10s)

---

## 10. CLAUDE.md footguns and constraints that apply

### Strict TypeScript

**From:** `.claude/CLAUDE.md` (lines enforcing strict mode)

- `strict: true`, `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true` in `tsconfig.json`
- The tool-call union type must be tightly discriminated so TypeScript can narrow correctly
- All array accesses (e.g., `state.todos[idx]`) require existence checks when the index comes from user input or model output

### Bundle size

**From:** `.claude/CLAUDE.md` (build constraint)

- Main chunk must grow < 10 kB (per milestone AC)
- m3 adds ~5–8 kB:
  - `src/llm/tools.ts`: schema constant + validation logic (~2 kB)
  - ChatMessage enrichment: payload type + Undo rendering (~1 kB)
  - CSS for tool-result card and Undo button (~0.5 kB)
  - msgId/undoToken helpers: minimal (~0.2 kB)

### Conventional commits

**From:** `.claude/CLAUDE.md` (scopes)

- Scope should be `llm` or `chat` for m3 changes
- Example: `feat(llm): add tool-call schema and dispatch logic for m3` or `feat(chat): render tool-result cards with undo affordance`
- Co-author: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`

### No push without verification

**From:** `.claude/CLAUDE.md` (build gate)

- `npm run build` must pass before committing
- `npm run typecheck` must pass (strict flags)
- Existing tests (if any) must not regress

---

## 11. Open questions for the implementer

1. **Schema discrimination:** Does Chrome's `responseConstraint` support `oneOf` with a `discriminator` field (per JSON Schema 2020-12), or should the schema use an object with four optional fields (one per action type)? The milestone eval will measure this.

2. **Tag validation:** Should invalid tag ids in a tool-call response be silently filtered (empty the tags array) or cause a parse failure (demote to prose)? Recommend: **filter silently** — the model may occasionally hallucinate a tag id, and silently dropping it is more forgiving than rejecting the whole record.

3. **Undo button auto-fade timing:** After 10 seconds, should the Undo button:
   - Stay visible but become visually dim/disabled?
   - Fully disappear from the DOM?
   - Recommend: Stay visible but dim (opacity: 0.3, cursor: not-allowed) so the layout doesn't shift.

4. **Tool-result message placement:** Should the tool-result card appear as a separate message in the chat history, or as a visual annotation on the assistant's prose (if present)? Recommend: **separate message** — cleaner history, easier to undo independently.

5. **Validation of fireAt:** Should the parser enforce `fireAt > Date.now()` at parse time, or should `update()` reject reminders with past timestamps? Recommend: **Parse-time validation** — give immediate feedback to the user if the model picks a past date.

---

## 12. Research confidence and gaps

### High confidence ✓

- Type shapes (§1): Read directly from `src/types/index.ts`
- Module integration (§2): `nano.ts` exports are finalized; system prompt mechanism is tested in m1
- Storage and Undo pattern (§5): `src/storage/storage.ts` write chain is solid; snapshot-and-rollback is a standard pattern
- Tags system (§6): Live in the codebase; CRUD helpers in `src/storage/tags.ts`

### Medium confidence ~

- responseConstraint schema features (§2): Chrome 137+ docs mention object/array/string/number/boolean/properties/required/items/maxItems/pattern, but enum/oneOf/discriminator unverified. The milestone eval will test this.
- ParseErrorhandling (§3): Recommendation is Option A (responseConstraint + union), but fallback to Option B (soft parse) is viable if the model struggles with the union shape.
- Undo visibility timing (§11): "Fade after 10s" is from the milestone AC; exact CSS transition is implementer's choice.

### Low confidence (not researched)

- Chrome 138+ model performance on the concrete union schemas — this is unknowable until the eval is run
- Whether the system prompt context (available tags, charts) is sufficient for the model to make correct choices without frequent retries

---

## Summary of Integration

1. **Create `src/llm/tools.ts`** with system prompt builder, ToolCall union, and parseAndDispatch()
2. **Update `src/hooks/useChatSession.ts`** to capture preSnapshot, call parseAndDispatch, append tool-result messages
3. **Enrich ChatMessage type** in `src/hooks/useChatSession.ts` and `src/components/chat/ChatMessage.tsx` with optional payload for tool-results
4. **Render tool-result cards and Undo buttons** in ChatMessage component; fade after 10 seconds
5. **Add CSS** for card styling and Undo button transitions
6. **Create eval template** at `plans/gemini-nano-eval-snapshot.md` for the implementer to fill in post-launch

---

**End of Brief**
