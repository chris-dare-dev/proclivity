# Adversary Critique — gemini-nano-m3

**Critic role:** adversary  
**Commit reviewed:** `43560d8` (`6cff35f..HEAD`)  
**Review date:** 2026-05-12  
**Reviewer:** Claude Sonnet 4.6 (adversary agent)  
**LOC delta:** +969 / -31 (auto-HIGH threshold: 700 LOC)

---

## Verdict

**SHIP-WITH-FIXES**

The implementation is structurally sound and compiles clean under strict TypeScript. The schema strategy, parse/apply pipeline, and Undo UX mechanism are all correct in their happy paths. However, two milestone-closure criteria are unverified (parse rate ≥ 90% and false-positive rate ≤ 5%), one original acceptance criterion (disambiguation: accompanying prose alongside tool-call) is unimplemented and was silently re-scoped by the implementer, and several medium-priority runtime correctness issues need attention before the milestone is considered closed. None of the findings are CRITICAL (no compile failure, no external write, no schema rejection in happy path).

---

## Executive summary

- **Eval results blank**: The milestone brief states "Parse rate ≥ 90% to close the milestone. False-positive rate ≤ 5%." Both metric cells are `*(fill in)*`. No hardware Nano run has been performed. This is a **HIGH** blocker for milestone closure, deliberately deferred to the maintainer.
- **Auto-HIGH for diff size**: +969 LOC exceeds the 700-LOC threshold. Justified: 513 LOC is `tools.ts` (pure-new feature file) and 140 LOC is the eval template. Remaining 316 LOC is hook + component integration. No padding.
- **AC5 disambiguation not implemented**: Original milestone brief requires "when Nano's response parses as a tool call AND has accompanying prose, both render." The flat schema allows `{ "type": "add_todo", "todo": {...}, "text": "Done!" }` as a valid response; the parser silently ignores `text` for non-chat types. The implementer re-scoped AC5 in the synthesis without flagging this as a deliberate drop.
- **Undo timer not cancelled on `clear()` or unmount**: The `setTimeout` at `useChatSession.ts:245` is not stored in a ref and is not cancelled when `clear()` is called or the component unmounts. Functionally safe in React 18+ but fires against a stale closure.
- **`undo()` removes message before `update()` resolves**: If `update()` rejects, the message has already been removed from the UI but state was not rolled back. User loses undo affordance with no error feedback.
- **GanttTask `tagIds` schema mismatch**: The schema advertises `tagIds` on the `task` sub-object; the model will include tags; they are silently dropped with no system-notice. The user never learns their tags were not applied.
- **System prompt context staleness has no in-session signal**: If the user creates a chart or tag after the session starts, the model has no knowledge of it. No user-visible indicator exists; the only remediation is "Clear chat."
- **Prompt injection via user-controlled tag labels/chart names in system prompt**: User data is embedded verbatim in the system prompt via template literals. For a single-user local extension the practical risk is minimal, but the code is a latent concern.

---

## Findings

### HIGH

#### [HIGH] H1 — Eval results blank; parse rate and false-positive rate unverified

**File:** `plans/gemini-nano-eval-snapshot.md:49,122-125`

The milestone brief's acceptance criteria state:
> "Parse rate ≥ 90% to close the milestone. False-positive rate ≤ 5%."

All result cells in the eval snapshot are `*(fill in)*`. The synthesis explicitly defers the eval run to "the maintainer post-merge," but this makes the milestone's primary quantitative closure criterion unverified at merge time. The commit lands code that _could_ meet the 90% target — or could be 0% if the model frequently misses required fields — without any runtime confirmation.

**Risk:** The tool-call schema may produce lower-than-acceptable parse rates on real Nano inference. The flat schema requires the model to infer which payload sub-object to populate; this is harder for a 4B parameter model than a true tagged union.

**Fix:** Run the 20-prompt eval on a Chrome instance with Nano before declaring the milestone closed. Fill in the result cells and confirm both thresholds are met. If parse rate < 90%, iterate on the system prompt wording or schema hints before closing.

---

#### [HIGH] H2 — Auto-HIGH: diff > 700 LOC

**File:** `git show --stat 43560d8` — +969 / -31

+969 LOC exceeds the 700-LOC auto-HIGH threshold. Breakdown:
- `src/llm/tools.ts` (NEW): 513 LOC — justified as a new feature module
- `plans/gemini-nano-eval-snapshot.md` (NEW): 140 LOC — justified as eval template
- `src/hooks/useChatSession.ts` (MOD): +210 / -31 — justified integration
- `src/components/chat/ChatMessage.tsx` (MOD): +83 / -0 — justified
- `src/components/chat/ChatPanel.css` (MOD): +46 — justified
- `src/components/chat/ChatPanel.tsx` (MOD): +8 / -0 — justified

All LOC is productive; no padding. Demoted from auto-HIGH to documented HIGH because the per-file breakdown is coherent with the feature scope. No single file is bloated.

---

### MEDIUM

#### [MEDIUM] M1 — AC5 disambiguation not implemented (silent re-scope)

**File:** `src/hooks/useChatSession.ts:180-197`, `src/llm/tools.ts:255-257`

The original milestone brief AC5 states:
> "Disambiguation: when Nano's response parses as a tool call AND has accompanying prose, both render."

The flat schema allows `{ "type": "add_todo", "todo": {...}, "text": "Sure, I added that!" }` as a schema-valid response — the top-level `text` field is unrestricted for all types. The parser only reads `text` when `type === "chat"` (`tools.ts:255-257`); it is silently ignored for `add_todo`, `add_gantt_task`, and `set_reminder`.

The implementer re-scoped AC5 in the implementation synthesis to:
> "kind: 'chat' → plain assistant text; kind: 'parse-failed' → system-notice with raw output"

This re-scoping was not flagged as a deliberate AC drop in the synthesis document.

**Impact:** If the model returns a tool call with an explanatory `text` field (e.g. "I've added 'call the dentist' to your today list!"), that text is silently discarded and the user only sees the record card — no conversational reply.

**Fix (two options):**
1. **Full fix**: In `parseToolCall` for non-chat types, extract `text` if present. In `send()`, after appending the tool-result message, also append a plain assistant message with the extracted text.
2. **Minimal fix**: Add `text` to the non-chat dispatch path in the system prompt as "Do NOT include a text field alongside action types" to reduce the probability. Formally acknowledge the AC drop in the synthesis.

---

#### [MEDIUM] M2 — Undo timer not cancelled on `clear()` or component unmount

**File:** `src/hooks/useChatSession.ts:244-257`

```typescript
setTimeout(() => {
  setMessages((prev) =>
    prev.map((m) => { ... })
  );
}, 10_000);
```

The `setTimeout` return value is not stored in a ref. Consequences:
1. `clear()` (called when the user clicks "Clear chat") resets `messages` to `[]` but does not cancel pending undo-expiry timers. After 10 seconds, the timer fires, calls `setMessages(prev => prev.map(...))` on an empty array — a no-op, but wasteful.
2. On component unmount (panel closed before 10 seconds), the timer continues to fire. React 18+ does not throw on state updates after unmount, but the call is unnecessary.
3. If the user clicks Undo before the timer fires, the message is removed; the timer later fires on an already-absent id — again a no-op, but a missed opportunity to cancel cleanly.

**Fix:** Store timer ids in a `useRef<Set<ReturnType<typeof setTimeout>>>`:
```typescript
const undoTimerIdsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
// in send():
const timerId = setTimeout(() => { ... }, 10_000);
undoTimerIdsRef.current.add(timerId);
// in clear() and the unmount useEffect:
for (const id of undoTimerIdsRef.current) clearTimeout(id);
undoTimerIdsRef.current.clear();
// in undo() after removing the message:
// (no additional cleanup needed; the timer fires as a no-op)
```

---

#### [MEDIUM] M3 — `undo()` removes message before `update()` resolves; no error recovery

**File:** `src/hooks/useChatSession.ts:297-304`

```typescript
setMessages((prev) => {
  const next = prev.filter((m) => m.id !== msgId);
  messagesRef.current = next;
  return next;
});

await update(() => snapshotToRestore);
```

The tool-result message (including the Undo button) is removed from the UI synchronously _before_ the async `update()` completes. If `update()` rejects (storage write error, quota exceeded, etc.), the following state exists:
- The tool-result message is gone from the chat (user can no longer undo)
- The state was NOT rolled back (the record still exists)
- No error message is shown to the user

**Fix:** Wrap in try/catch; only remove the message if the update succeeds, or re-add an error notice if it fails:
```typescript
try {
  await update(() => snapshotToRestore);
  setMessages((prev) => {
    const next = prev.filter((m) => m.id !== msgId);
    messagesRef.current = next;
    return next;
  });
} catch {
  appendMessages([makeMsg("system-notice", "Undo failed — could not restore previous state.")]);
}
```

---

#### [MEDIUM] M4 — GanttTask `tagIds` accepted by schema but silently dropped without user notice

**File:** `src/llm/tools.ts:78-82, 426-444, 455`

The `TOOL_SCHEMA.properties.task` sub-object includes `tagIds` (lines 78-82). The system prompt instructs the model to include tags from the available list. When the model emits `tagIds` in an `add_gantt_task` call, `applyToolCall` calls `resolveTagIds` (line 426-428) but then voids both results (lines 443-444) and returns `systemNotice: null` (line 455).

**Impact:** The user asks "add a 'work' task to the planning chart" with the "work" tag selected. The model includes `"tagIds": ["work-id"]`. The task is created without tags. No message tells the user the tags were ignored.

**Fix (two options):**
1. **Remove `tagIds` from the `task` schema** — the model won't try to include them. Document that Gantt tasks don't support tags yet.
2. **Emit a system-notice** — same pattern as for todos/reminders, e.g. "Note: tags are not yet supported for Gantt chart tasks and were skipped."

Option 1 is cleaner; it removes a misleading schema field.

---

#### [MEDIUM] M5 — Undo concurrency: `undo()` can race with in-flight `send()`

**File:** `src/hooks/useChatSession.ts:286-306`

`undo()` does not guard against `generating === true`. If the user triggers an undo during an active generation:
1. `undo()` reads `messagesRef`, finds a previous tool-call message, removes it from the UI.
2. `undo()` calls `update(() => snapshotToRestore)` — the snapshot pre-dates the currently-generating tool call.
3. The in-flight `send()` completes and calls `update(() => result.newState)` — its result overwrites the undo snapshot.
4. Net result: the old undo's target record is removed, but the new record from the in-flight call might be overwritten as well, depending on write-chain ordering.

**Fix:** Add `if (generating) return;` at the top of `undo()`, mirroring the guard already in `send()`.

---

### LOW

#### [LOW] L1 — System prompt includes user-controlled content without sanitization (low-risk prompt injection)

**File:** `src/llm/tools.ts:189, 195`

Tag labels (`t.label`) and chart names (`c.name`) are embedded verbatim into the system prompt template literal. A tag label containing newlines or adversarial instructions could theoretically influence the model's behavior.

**Context:** Per `SECURITY.md` §1, physical-access or self-attack scenarios are explicitly out of scope. This is a single-developer local extension. The practical risk is the developer accidentally creating a tag whose label looks like an instruction. Risk level: minimal.

**Note for future:** If tags or chart names ever accept untrusted input (e.g., imported from a shared file), this becomes a real concern. Consider escaping newlines in user-provided strings before embedding in the system prompt.

---

#### [LOW] L2 — Orphaned system-notice after undo (tag-drop notice outlives the undone action)

**File:** `src/hooks/useChatSession.ts:228-232, 297-302`

When an `add_todo` call has dropped tags, two messages are appended:
1. A system-notice: "Note: tag X wasn't found and was skipped."
2. A tool-result message with the Undo button.

`undo()` only removes the tool-result message by its `msgId`. The preceding system-notice (different id, no payload) is left in the chat. After undo, the user sees the tag-drop notice but the action has been reverted — a confusing orphan message.

**Fix:** Tag the system-notice with the same `undoToken` as the tool-result message (e.g., add an optional `undoToken?: string` to `ChatMessage`). On undo, remove all messages that share the same `undoToken`.

---

#### [LOW] L3 — Stale system-prompt context has no in-session visual indicator

**File:** `src/hooks/useChatSession.ts:113-126`

The system prompt (tag list + chart list) is baked in at session-create time. If the user creates a new chart or tag while the chat session is open, the model's context is stale and will not know about the new items. The only remediation is "Clear chat." No in-session indicator tells the user this is happening.

**Impact:** User creates chart "Q3 Roadmap," then asks the assistant to add a task to it. The model either refuses (no chart id available) or hallucinates an id (triggering `applyToolCall` validation failure and system-notice). Confusing without context.

**Fix (low priority):** Show a subtle indicator when `state.ganttCharts.length` or `state.tags.length` has changed since session creation. A "Context may be stale — Clear chat to refresh" tooltip next to the Clear button would be sufficient.

---

#### [LOW] L4 — Module-level `nextId` counter shared across all hook instances

**File:** `src/hooks/useChatSession.ts:45`

```typescript
let nextId = 0;
```

This module-level mutable counter is shared across all instances of `useChatSession`. In practice only one instance exists (the `ChatPanel`), but if a future feature renders multiple panels, message ids would collide. Not a current bug; a future footgun.

**Fix:** Move `nextId` into a `useRef<number>` initialized to `0` inside the hook body.

---

#### [LOW] L5 — Empty `text` on `chat` response renders a blank assistant message

**File:** `src/llm/tools.ts:256`

```typescript
const text = typeof obj["text"] === "string" ? obj["text"] : "";
```

If the model emits `{ "type": "chat" }` with no `text` field, `parseToolCall` returns `{ kind: "chat", text: "" }`. The UI renders an assistant message with an empty body — a blank chat bubble.

**Fix:** Treat empty `text` as a parse failure: `if (!text) return { kind: "parse-failed", raw };`.

---

## Acceptance Criteria Walk

| AC | Met? | File:Line | Notes |
|----|------|-----------|-------|
| AC1: Schema + system-prompt builder in `src/llm/` | YES | `src/llm/tools.ts:1-226` | In sibling file `tools.ts`, not `nano.ts` — explicitly allowed |
| AC2: Three tool-call shapes (add_todo, add_gantt_task, set_reminder) | YES | `src/llm/tools.ts:382-494` | All three write correct state slices |
| AC3: Record card + Undo button on successful tool call | YES | `src/components/chat/ChatMessage.tsx:38-113` | ToolResultCard renders with Undo |
| AC4: Undo reverses mutation within 10 s; fades after | YES | `src/hooks/useChatSession.ts:244-257`, `ChatMessage.tsx:79-87` | Timer in hook + component useEffect |
| AC5: Disambiguation — tool call + prose both render | **PARTIAL** | `src/hooks/useChatSession.ts:180-197` | `text` field ignored for non-chat types; see M1 |
| AC6: Conversational response on non-action prompts | YES | `src/hooks/useChatSession.ts:182-186` | `kind: "chat"` path renders plain text |
| AC7: Eval snapshot with 20 prompts, schema decision, blank result cells | PARTIAL | `plans/gemini-nano-eval-snapshot.md` | Template complete; result cells blank (intentional deferral) — parse rate ≥ 90% **unverified**; see H1 |
| AC8: Parse rate ≥ 90% | **UNVERIFIED** | — | Eval not run; see H1 |
| AC9: False-positive rate ≤ 5% | **UNVERIFIED** | — | Eval not run; see H1 |
| AC10: `npm run build` clean; main chunk < 10 kB growth | YES | Build output: 195.56 kB → 195.56 kB initial chunk | No growth |
| AC11: `responseConstraint` passed on every `prompt()` call | YES | `src/hooks/useChatSession.ts:175-178` | Confirmed per-call |
| AC12: System prompt via `initialPrompts` at session-create | YES | `src/hooks/useChatSession.ts:119-123` | Index 0 system message |
| AC13: No tag creation from tool calls | YES | `src/llm/tools.ts:496-513` | `state.tags` only read, never written |
| AC14: No external writes / no fetch calls | YES | `grep -rn "fetch\|XMLHttpRequest" src/` returns zero hits | |
| AC15: Conventional commit, signed, co-author, ≤ 50 chars subject | YES | `43560d8` — `G` sig, 34-char subject after prefix | |

---

## What was done well

- **Schema strategy is correct and well-documented.** The flat-object + `pattern` discriminator approach is the right call given that `oneOf`/`enum` support is unconfirmed. The decision is clearly explained in `tools.ts:1-16`, the eval template, and the research synthesis.

- **No external writes, no fetch, no new permissions.** `grep -rn "fetch\|XMLHttpRequest" src/` returns zero hits. All inference is on-device, all writes are `chrome.storage.local`. SECURITY.md compliance is perfect.

- **TypeScript strict compliance.** The build passes cleanly under `strict: true`, `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`. No `any` types, no `@ts-ignore`, no escape hatches. The `as Record<string, unknown>` assertions in `parseToolCall` are narrowing after a proper runtime check, not unsound.

- **`applyToolCall` validation is thorough.** `chartId` is validated against `state.ganttCharts` before writing. `fireAt` is validated as future-only. Unknown `tagIds` are filtered, not rejected. Each validation failure emits a specific, actionable system-notice to the user.

- **Pre-snapshot is captured before `update()` runs.** `const preSnapshot = stateRef.current` (line 200) is captured before `await update(() => result.newState)` (line 223). The snapshot correctly reflects pre-mutation state and is used faithfully for rollback.

- **Multiple concurrent Undo tokens are correctly isolated.** Each tool call generates its own `undoToken` via `uid()`, stored in the message's `payload`. `undo()` looks up by token, not by position, so multiple pending undos coexist without interference.

- **`ToolResultCard` timer is properly cleaned up on unmount.** The `useEffect` in `ChatMessage.tsx:79-87` returns `() => clearTimeout(t)`, preventing setState-after-unmount on the component-level expiry timer.

- **`stateRef` pattern avoids dependency-array churn.** Mirroring `state` in `stateRef` and reading at call time keeps `ensureSession` and `send` callbacks stable, avoiding unnecessary session recreation on every state change.

- **Tag-creation guard is solid.** Zero code paths in `tools.ts` or `useChatSession.ts` add to `state.tags`. The schema allows `tagIds` to reference existing tags only; `resolveTagIds` enforces this by filtering against the known set.

- **Eval template is high quality.** The 20 prompts are realistic (not contrived), the expected types and field verifications are specific, the schema-discrimination decision is documented with an upgrade path, and the "run manually post-merge" instruction is unambiguous. This is a solid eval methodology even in template form.

---

## Recommended Rectification Order

1. **[H1] Run the eval** — before declaring the milestone closed, run the 20 prompts in a live Chrome session and fill in the parse/false-positive rate cells. If rate < 90%, adjust the system prompt or schema hints and re-run. This is the milestone's primary closure gate.

2. **[M1] Implement or formally drop disambiguation** — either render the `text` field alongside a tool-call result (2-line fix in `send()`), or explicitly acknowledge the AC drop in the synthesis and update the milestone brief's AC to reflect the re-scope.

3. **[M3] Fix `undo()` error handling** — move `setMessages` to after the `await update()` succeeds, wrapped in try/catch that emits a system-notice on failure.

4. **[M2] Track and cancel undo timers** — add a `Set<ReturnType<typeof setTimeout>>` ref; clear it in `clear()` and the unmount useEffect.

5. **[M4] Fix GanttTask tag mislead** — remove `tagIds` from the `task` schema sub-object, or emit a system-notice if tags are dropped. The schema-level fix is cleaner.

6. **[M5] Guard `undo()` against concurrent `send()`** — add `if (generating) return;` at the top of the `undo` callback.

7. **[L2] Remove orphaned system-notice on undo** — tag the system-notice with the same `undoToken` as its paired tool-result message; filter both on undo.

8. **[L5] Treat empty `text` in chat responses as parse failure** — prevents blank assistant bubbles.

9. **[L4] Localize `nextId` into a `useRef`** — prevents future id collisions if multiple hook instances ever exist.

10. **[L3] Add stale-context indicator** — out of scope for this rectification commit; defer to a follow-up.
