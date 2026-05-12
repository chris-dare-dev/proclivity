# gemini-nano-m3 — research synthesis

Both briefs validate; 0 injection attempts reported.

## The decisive finding (from brief-2)

`responseConstraint` in Chrome's Prompt API does **NOT** confirm support for `oneOf` or `enum`. Unsupported keywords raise a hard `NotSupportedError`, not silent degradation. The W3C TAG review (issue #181) explicitly flagged JSON-Schema interop as unresolved.

**Schema strategy:** use a **flat object** with a `type` string field (constrained by `pattern`) and four optional payload fields. The JS dispatch step does the actual union discrimination. This is the safe baseline; `enum`/`oneOf` can be tried later in a side eval if the maintainer wants.

```js
const TOOL_SCHEMA = {
  type: "object",
  properties: {
    type: { type: "string", pattern: "^(chat|add_todo|add_gantt_task|set_reminder)$" },
    text: { type: "string" },                  // populated when type="chat"
    todo: { type: "object", properties: { /* … */ }, additionalProperties: false },
    task: { type: "object", properties: { /* … */ }, additionalProperties: false },
    reminder: { type: "object", properties: { /* … */ }, additionalProperties: false },
  },
  required: ["type"],
  additionalProperties: false,
};
```

Other confirmed facts:
- `responseConstraint` is **per-call only** — pass on every `session.prompt()` in m3.
- System prompt mechanism is `initialPrompts: [{ role: "system", content: "..." }]` — only path.
- System prompt is guaranteed never to be evicted when context fills.
- Token budget for system prompt (~800–950 tokens for our schema + 10 tags + 5 charts) is well within Nano's window.

## Affected files

NEW:
- `src/llm/tools.ts` — schema constant, `buildSystemPrompt(ctx)`, `parseToolCall(text)`, `applyToolCall(state, call)`, types for the tagged-union shapes.
- `plans/gemini-nano-eval-snapshot.md` — eval template + the 20 prompts brief-2 drafted. Maintainer fills the result cells after running manually.

MODIFIED:
- `src/hooks/useChatSession.ts` — extend `send()` to build the system prompt (one-shot per session create), pass `responseConstraint` to `prompt()`, parse the JSON response, branch on `type`:
  - `chat` → existing assistant-text path.
  - `add_todo` / `add_gantt_task` / `set_reminder` → snapshot `state` BEFORE applying, apply via `update()`, append a `tool-result` message with an `undoToken`.
- `src/components/chat/ChatMessage.tsx` — accept the new `tool-result` payload variant; render a record card + 10-second Undo button with fade.
- `src/components/chat/ChatPanel.css` — tool-result card styles, Undo button fade animation.
- `src/llm/nano.ts` — no changes expected; the existing `prompt(text, { responseConstraint })` path is the entry point. The `promptStructured<T>` helper from m1 may be too eager (it parses + throws); use raw `session.prompt()` here so we can try/catch parse errors and demote to chat.

## Acceptance criteria (≤7, deduped)

1. `src/llm/tools.ts` exports the schema, system-prompt builder, and parse/dispatch helpers. Tagged-union TypeScript type compiles under strict + `noUncheckedIndexedAccess`.
2. The chat session passes `responseConstraint: TOOL_SCHEMA` on every `prompt()` call (per-call requirement). The system prompt is injected via `initialPrompts` at session-create time.
3. Three tool calls implemented: `add_todo` (writes `state.todos`), `add_gantt_task` (writes `state.ganttTasks`; `chartId` validated against `state.ganttCharts`), `set_reminder` (writes `state.reminders` with future `fireAt`). All three accept an optional `tagIds: string[]` referencing existing `state.tags` ids only (no tag creation).
4. Successful tool-call render: a record card in the chat thread ("Added todo: 'plan trip'") with an Undo button visible for 10 seconds, then fades. Undo reverts the mutation by restoring the pre-call snapshot.
5. Disambiguation: when `type: "chat"`, render plain assistant text (no card, no Undo). When parse fails or `type` is invalid, demote to a system-notice with the raw text.
6. `plans/gemini-nano-eval-snapshot.md` exists with the 20-prompt template, schema-discrimination decision recorded, model version + Chrome version cells, and parse-rate / false-positive-rate cells. **Maintainer runs the eval manually post-merge** (not part of the rect commit).
7. `npm run build` clean. Main chunk grows < 10 kB. No new runtime npm deps.

## external_writes_required

```yaml
external_writes_required:
  - "Maintainer runs the 20-prompt eval in plans/gemini-nano-eval-snapshot.md after m3 lands; fills result cells; commits separately. Not part of m3's rect commit."
```

## Open questions / implementer decisions

1. **`chartId` validation strategy** — schema-side `pattern` matching arbitrary IDs isn't useful. Validate in JS after parse: reject `add_gantt_task` calls where `chartId` isn't in `state.ganttCharts`. Demote to a system-notice "I couldn't find that chart — try naming it: …".
2. **`tagIds` validation** — same pattern. Drop unknown ids silently or surface? Recommend silent drop with a system-notice if the call lists tags that don't exist ("Note: tagged-with X wasn't found and was skipped").
3. **Pre-snapshot scope** — capture entire `ProclivityState` or just the slice being mutated? Whole state is cheap (small object, infrequent calls); simpler. Document the choice.
4. **Past `fireAt` reminders** — `set_reminder` AC says "future `fireAt`". If the model produces a past timestamp (relative date misparsed), validate and demote.
5. **Multi-action support** — the schema only supports one action per response. Brief-1 §3 considered allowing multiple but recommended single-action to keep parse predictable. Document that "add 3 todos" produces one call with one item (the assistant either picks one or returns chat asking for clarification).

## Implementation-path call

Estimated **~500 LOC across 6 files** (4 modified, 2 new). **Path: `delegated`** per the SKILL's threshold. Dispatch 1× general-purpose Sonnet in `isolation: "worktree"`. Per proclivity precedence, the implementer commits to `main` inside the worktree (or commits to the worktree branch and the orchestrator fast-forwards `main` — both work).

## Notes from external research

- `responseConstraint` is per-call: pass on every `session.prompt()`.
- `oneOf`/`enum` may not be supported → use flat-object + `pattern` on the discriminator.
- `initialPrompts` system message guaranteed never evicted.
- Token budget for our system prompt is fine on Nano (estimated 800-950 tokens; window ~4-8k).
- No external network; no new permissions.
