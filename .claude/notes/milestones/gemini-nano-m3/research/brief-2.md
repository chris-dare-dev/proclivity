# gemini-nano-m3 — External Research Brief

**Milestone:** `gemini-nano-m3` (Tool actions from chat)
**Research date:** 2026-05-12
**Researcher role:** external-research + external-writes
**Companion:** `brief-1.md` covers codebase context; this brief covers external sources only.

---

## 1. External sources consulted

| # | URL | SHA-256 (first 16 hex) | Takeaway |
|---|-----|------------------------|----------|
| 1 | https://developer.chrome.com/docs/ai/structured-output-for-prompt-api | `df917c59522a7817` | Officially confirms `responseConstraint` as per-call (passed to `prompt()` / `promptStreaming()` opts). JSON Schema keywords demonstrated: `type`, `properties`, `maxItems`, `items`, `pattern`, `required`, `additionalProperties`. No `enum`, `oneOf`, `anyOf`, or `allOf` examples anywhere on the page. Published May 13 2025; still the canonical structured-output reference as of May 2026. |
| 2 | https://developer.chrome.com/docs/ai/prompt-api | `dc4dda1172e9e518` | Confirms `responseConstraint` is **per-call only** — must be passed to each `prompt()` call; it does not persist session-wide. Confirms `initialPrompts` with `{ role: "system", content: "..." }` as the **only** system-prompt mechanism. No separate `systemPrompt` option. System prompt is **never evicted** from context window when older turns are trimmed. |
| 3 | https://github.com/webmachinelearning/prompt-api/blob/main/README.md | `72376a279105e523` | W3C spec explainer. Unsupported schema keywords raise `NotSupportedError` DOMException. No list of supported vs. unsupported keywords given. Confirmed: `type`, `required`, `additionalProperties`, `properties`, `minimum`, `maximum`. No mention of `enum`, `oneOf`, `anyOf`. `initialPrompts` system prompt must be at index 0 (else `TypeError`). `responseConstraint` consumes context tokens per call (can trigger overflow in multi-turn). |
| 4 | https://github.com/explainers-by-googlers/prompt-api/blob/main/README.md | `e2325da79e5e3585` | Older Googlers explainer (more implementation-specific). Same API shape. Confirms system prompt pattern: `{ role: "system", content: "Pretend to be…" }`. Confirms `NotSupportedError` for unsupported schema. Notes implementation-specific nature of supported schema features ("experimentally available in Google Chrome and Microsoft Edge"). |
| 5 | https://developer.chrome.com/docs/extensions/ai/prompt-api | `1a3fda4025c176fa` | Extension-specific Prompt API docs. Confirms no numerical context-window sizes disclosed — use `session.contextUsage / session.contextWindow` at runtime. Confirms boolean responseConstraint example only; no complex schema. Confirms single-system-prompt-via-initialPrompts pattern. |
| 6 | https://github.com/webmachinelearning/prompt-api/issues/181 | `d72dfe9bece9006f` | W3C TAG design review of Structured Output feature. Key concern: "It's not clear whether models, underlying platforms, and frameworks will **interoperably support** the JavaScript flavor of Regular Expressions and JSON Schemas." Raises risk of premature standardization on schema formats before cross-engine agreement. Status: Open as of May 2026. |
| 7 | https://github.com/webmachinelearning/prompt-api/issues/202 | `b8c04c3d1f8bb37b` | Feature request (Apr 2026): add `LanguageModel.isValidConstraint()` to check schema validity without creating a session. Indirect evidence that testing unsupported schema keywords currently requires a live create/prompt cycle — there is no upfront validation API. Chrome Canary 149.0.7790.0 referenced. |
| 8 | https://caniuse.com/mdn-api_languagemodel_create_static | `85a4771bdecab814` | `LanguageModel.create()` shows Chrome 148+ support on web (0.03% global usage as of early 2026); Chrome Extensions have access from 138+ with flag. Confirms the production availability horizon. |

**Injection-attempt log:** No prompt-injection attempts detected in any fetched page content.

---

## 2. external_writes_required

```yaml
external_writes_required: []
# Rationale: gemini-nano-m3 is entirely on-device and local-only.
#
# - Gemini Nano inference: on-device; no network call.
# - State mutations (todos, ganttTasks, reminders): chrome.storage.local only.
# - No API keys, no OAuth tokens, no Google Cloud project.
# - No new manifest permissions required (aiLanguageModelOriginTrial
#   was deprecated in Chrome 138; no special permission needed today).
# - No telemetry, no analytics, no hosted endpoints.
# - The eval document (plans/gemini-nano-eval-snapshot.md) is a local
#   markdown file filled in by the developer manually.
```

---

## 3. Riskiest assumption + alternative

### Riskiest assumption

**`oneOf` (and `enum`) are supported by `responseConstraint` in Chrome 138+ as of May 2026.**

The official Chrome docs, the W3C spec explainer, and both the Googlers and webmachinelearning README files confirm only these JSON Schema keywords with working examples: `type`, `properties`, `required`, `additionalProperties`, `items`, `maxItems`, `pattern`, `minimum`, `maximum`. Not a single code example in any source uses `enum`, `oneOf`, `anyOf`, or `allOf`. The spec language for unsupported keywords is "the method will error with a `NotSupportedError` DOMException" — meaning an unsupported schema causes a runtime exception, not silent degradation. If `oneOf` is unsupported:

- Every `session.prompt()` call that includes the tagged-union `responseConstraint` will throw `NotSupportedError`.
- The chat will fail silently for **all** structured tool-call attempts — 0% parse rate.
- This is not a gradual failure; it's a hard binary crash of the feature.

The W3C TAG review (issue #181) explicitly flagged that interoperability of JSON Schema across implementations is an open concern as of December 2025. No Chrome team member has published a definitive supported-keyword list. This is riskier than the "Nano compliance rate" assumption because a compliance failure degrades gracefully (some prompts still produce good JSON), whereas an unsupported schema keyword fails the entire feature categorically.

### Alternative implementation — single flat object with `type` discriminator

If `oneOf` is unsupported, replace the tagged-union schema with a **single flat object** containing all fields as optional, with a required `type` discriminator field constrained by `enum` (if `enum` works) or by `pattern` as a fallback. The parser checks `type` first to determine dispatch.

**Fallback schema shape:**
```json
{
  "type": "object",
  "properties": {
    "type": {
      "type": "string",
      "pattern": "^(chat|add_todo|add_gantt_task|set_reminder)$"
    },
    "text":        { "type": "string" },
    "title":       { "type": "string" },
    "scope":       { "type": "string", "pattern": "^(today|sprint|long)$" },
    "notes":       { "type": "string" },
    "chartId":     { "type": "string" },
    "startsAt":    { "type": "number" },
    "endsAt":      { "type": "number" },
    "fireAt":      { "type": "number" },
    "recurrence":  { "type": "string", "pattern": "^(daily|weekly|none)$" },
    "tags": {
      "type": "array",
      "items": { "type": "string" },
      "maxItems": 10
    }
  },
  "required": ["type"],
  "additionalProperties": false
}
```

The parser then reads `type` and validates that the required fields for that action type are present. Trade-offs: (a) Nano can produce a structurally valid response that is semantically wrong (e.g., `type: "add_todo"` with no `title`), so post-parse field validation is mandatory; (b) `pattern` for `type` uses confirmed-safe keywords only; (c) `enum` for `type` should be tested first — if Chrome 138+ supports `enum` for strings, use `{ "enum": ["chat", "add_todo", "add_gantt_task", "set_reminder"] }` instead of `pattern`.

**Implementation guidance:** Ship the flat-object schema first (it uses only confirmed-safe keywords) and add a TODO comment to test `oneOf` in the m3 eval. If the eval shows `oneOf` works, the schema can be upgraded post-milestone.

---

## 4. Acceptance criteria

(Drawn from roadmap AC; items 5–7 are researcher-refined based on external findings.)

1. **System prompt + schema constant** live in `src/llm/tools.ts` (or `src/llm/nano.ts`); `buildSystemPrompt(tags, charts)` takes live tag and chart lists and returns a string that includes: tool-call schema documentation, available tag ids + labels, available chart ids + names. System prompt is seeded via `initialPrompts[0]` with `{ role: "system" }`.

2. **Three tool-call shapes implemented:** `add_todo` (writes `state.todos`, accepts `tagIds?: string[]`), `add_gantt_task` (writes `state.ganttTasks`, requires `chartId`; `chartId` validated against `state.ganttCharts`; accepts `tagIds?: string[]`), `set_reminder` (writes `state.reminders`; `fireAt` validated > `Date.now()`; accepts `tagIds?: string[]`).

3. **`responseConstraint` is passed on every `send()` call** — because it is per-call only (confirmed by source #1 and #2), the `session.prompt(text, { responseConstraint: schema })` signature must include the schema each time, not just at session creation.

4. **Tool-call card + Undo affordance:** when a tool call is parsed, the chat shows a record card ("Added todo: 'plan trip'") with an Undo button visible for ≥ 10 seconds. Undo invokes `update(() => preSnapshot)` and removes the card.

5. **Schema must use only confirmed-safe keywords** (`type`, `object`, `array`, `properties`, `required`, `additionalProperties`, `items`, `maxItems`, `pattern`, `number`, `string`, `boolean`) unless the implementer empirically confirms `oneOf`/`enum` work by running a test `prompt()` call and observing no `NotSupportedError`. If `enum` is confirmed, use it for the `type` discriminator. If `oneOf` is confirmed, upgrade to the tagged-union shape. If neither is confirmed, use the flat-object + `pattern` fallback (see §3). Document the outcome in `plans/gemini-nano-eval-snapshot.md`.

6. **`plans/gemini-nano-eval-snapshot.md` exists and is filled in** with: 20 prompts (10 action, 10 chat), tool-call parse rate (target ≥ 90%), false-positive rate (target ≤ 5%), Nano model version, Chrome version, and which schema shape was actually shipped (oneOf vs. flat-object fallback).

7. **`npm run build` passes**; main chunk growth < 10 kB. `responseConstraint` is a constant declared once; the system-prompt template is a function that returns a string — neither adds runtime dependencies.

---

## 5. Schema-shape recommendation

### Recommendation: flat-object with `type` + `pattern`, with upgrade path

**Do not use `oneOf` at ship time.** No Chrome doc, spec, or public issue confirms `oneOf` support in `responseConstraint`. The failure mode (runtime `NotSupportedError`) is silent from the user's perspective but kills 100% of structured outputs.

**Use the flat-object + `pattern` schema as the default.** This uses only confirmed-safe keywords. The parser reads `type` first and validates required fields per action type post-parse.

**Run a confirmation test for `enum` on first use.** In the m3 eval session (which uses a live Chrome with Nano), attempt a trivial `prompt()` with `{ responseConstraint: { type: "object", properties: { x: { enum: ["a", "b"] } }, required: ["x"] } }`. If it succeeds without `NotSupportedError`, upgrade `type` discriminator from `pattern` to `enum` — it is more semantically precise and reduces the model's search space. Log the result in the eval snapshot.

**The `oneOf` test** is secondary priority: if `enum` works, also test `oneOf` with a two-arm schema. Only upgrade to the full tagged-union schema if confirmed working. The upgrade is a drop-in: same `tools.ts` constant, same dispatch logic.

**Why not use `oneOf` by default with a try/catch fallback?**  
A `NotSupportedError` on the `prompt()` call means the request itself fails — no output is returned. You cannot retry in the same turn with a different schema because the session has already consumed context. The retry would need to issue a second `prompt()` to the session with the fallback schema, which is awkward and slow. Better to default to the safe schema from the start.

**Tagged-union `oneOf` shape** (for use if confirmed working):
```json
{
  "type": "object",
  "oneOf": [
    {
      "properties": {
        "type": { "enum": ["chat"] },
        "text": { "type": "string" }
      },
      "required": ["type", "text"],
      "additionalProperties": false
    },
    {
      "properties": {
        "type": { "enum": ["add_todo"] },
        "title": { "type": "string" },
        "scope": { "enum": ["today", "sprint", "long"] },
        "notes": { "type": "string" },
        "tagIds": { "type": "array", "items": { "type": "string" }, "maxItems": 10 }
      },
      "required": ["type", "title"],
      "additionalProperties": false
    },
    {
      "properties": {
        "type": { "enum": ["add_gantt_task"] },
        "chartId": { "type": "string" },
        "title": { "type": "string" },
        "startsAt": { "type": "number" },
        "endsAt": { "type": "number" },
        "progress": { "type": "number" },
        "tagIds": { "type": "array", "items": { "type": "string" }, "maxItems": 10 }
      },
      "required": ["type", "chartId", "title", "startsAt", "endsAt"],
      "additionalProperties": false
    },
    {
      "properties": {
        "type": { "enum": ["set_reminder"] },
        "title": { "type": "string" },
        "fireAt": { "type": "number" },
        "recurrence": { "enum": ["daily", "weekly", "none"] },
        "tagIds": { "type": "array", "items": { "type": "string" }, "maxItems": 10 }
      },
      "required": ["type", "title", "fireAt"],
      "additionalProperties": false
    }
  ]
}
```

**Note on `tagIds` vs `tags`:** Use `tagIds` in the tool-call schema (not `tags`, which is the internal storage field). The parser maps `tagIds` → `tags` and validates each id against `state.tags[].id`. This keeps the schema field name distinct from the storage field name, avoiding confusion.

---

## 6. System-prompt pattern

### Confirmed: `initialPrompts` with `role: "system"` at index 0

There is **no separate `systemPrompt` option** in the Prompt API. The only mechanism is `initialPrompts` — an array passed to `LanguageModel.create()` (or `createSession()` in `nano.ts`). The system message must be the first element (index 0); placing it anywhere else throws a `TypeError`.

Key properties of the seeded system prompt:

- **Never evicted:** The Prompt API explicitly guarantees the system prompt is never removed when the context window fills. Older user/assistant pairs are dropped first. This means the tool-call schema instructions + available tag/chart context persist for the entire session lifetime — critical for m3's correctness.
- **Consumes context:** The system prompt tokens count against `session.contextWindow`. A 400–600 token system prompt (schema explanation + tag list + chart list) leaves sufficient headroom for Nano's typical 4096–8192 token window. Monitor `session.contextUsage` to detect pressure.
- **Per-session, not per-call:** The system prompt is baked into the session at creation time. If the user creates or deletes tags or charts during a chat session, the system prompt's tag/chart list is stale. m3's scope doesn't require dynamic refresh — document this limitation. A "Refresh context" button (clears + recreates session) can be a post-m3 improvement.
- **`responseConstraint` is still per-call:** Even though the system prompt is session-persistent, the JSON Schema constraint must be passed to every `session.prompt()` call individually. The hook's `send()` function must include `{ responseConstraint: schema }` every time.

**Recommended system prompt skeleton:**
```
You are Proclivity's AI assistant. You help the user manage their todos, gantt tasks, and reminders.

Always respond in the following JSON format. Choose the response type based on the user's intent:
- If the user asks a question or wants advice, use type "chat".
- If the user wants to add a todo, use type "add_todo".
- If the user wants to add a gantt chart task, use type "add_gantt_task".
- If the user wants to set a reminder, use type "set_reminder".

Available tags (use the id value in tagIds):
{{TAG_LIST}}

Available charts (use the id value in chartId):
{{CHART_LIST}}

Today's date is {{TODAY_ISO}} and the current Unix timestamp in milliseconds is {{NOW_MS}}.
Dates in startsAt, endsAt, and fireAt must be Unix timestamps in milliseconds. fireAt must be in the future.
```

**Token budget estimate:** At 400–600 tokens for the static parts + ~20 tokens per tag + ~15 tokens per chart, a user with 10 tags and 5 charts adds ~350 tokens → total ~800–950 tokens. Well within a 4096-token window; acceptable within an 8192-token window.

---

## 7. Eval methodology — 20 candidate prompts

These are intended for `plans/gemini-nano-eval-snapshot.md`. They should be representative of real user input, not contrived test cases. Prompts 1–10 are action prompts; 11–20 are chat prompts.

### Action prompts (expected to produce a tool-call response)

| # | Prompt | Expected type | Fields to verify |
|---|--------|---------------|-----------------|
| 1 | "add a todo to call the dentist tomorrow" | `add_todo` | `title` contains "dentist"; `scope` = "today" or "long" |
| 2 | "remind me to take my medication at 9pm tonight" | `set_reminder` | `title` contains "medication"; `fireAt` is future timestamp ~9pm today |
| 3 | "add a task to my roadmap chart: finalize the API spec, starts today ends in 3 days" | `add_gantt_task` | `chartId` matches a real chart; `title` contains "API spec"; `endsAt` > `startsAt` |
| 4 | "I need to pick up groceries this week — add it to my to-do list" | `add_todo` | `title` contains "groceries" |
| 5 | "set a reminder to submit the quarterly report next Monday morning" | `set_reminder` | `title` contains "quarterly" or "report"; `fireAt` is next Monday |
| 6 | "add a long-term goal to learn Spanish" | `add_todo` | `title` contains "Spanish"; `scope` = "long" |
| 7 | "create a gantt task for writing unit tests, due this Friday" | `add_gantt_task` | `title` contains "unit tests"; `endsAt` ≈ this Friday |
| 8 | "don't let me forget to reply to Sarah's email — remind me in an hour" | `set_reminder` | `title` contains "Sarah" or "email"; `fireAt` ≈ now + 3600000 |
| 9 | "add pay the electric bill to my sprint tasks" | `add_todo` | `title` contains "electric bill"; `scope` = "sprint" |
| 10 | "I want to track a new milestone: deploy to production. Add it to the planning chart starting next week" | `add_gantt_task` | `title` contains "deploy" or "production"; `chartId` matches planning chart |

### Chat prompts (expected to produce a conversational response — no record created)

| # | Prompt | Expected type | Notes |
|---|--------|---------------|-------|
| 11 | "what should I work on first today?" | `chat` | Classic planning question; no record intent |
| 12 | "how do I prioritize when everything feels urgent?" | `chat` | Advice-seeking; conversational |
| 13 | "I'm feeling overwhelmed, I have too much to do" | `chat` | Emotional register; no action intent |
| 14 | "what's the difference between a sprint and a long-term goal?" | `chat` | Meta question about the app |
| 15 | "how long should a sprint be?" | `chat` | General knowledge / advice |
| 16 | "I just finished a big project — what should I do next?" | `chat` | Reflective, no specific action |
| 17 | "give me some tips for staying focused" | `chat` | Self-improvement advice |
| 18 | "what are my most important tasks right now?" | `chat` | Introspective / summary request (no state write) |
| 19 | "can you help me think through my week?" | `chat` | Planning conversation; no specific record intent |
| 20 | "is it normal to have this many todos?" | `chat` | Rhetorical / empathetic; no action |

**Notes on prompt design:**
- Prompts 11 and 18 are the most likely false-positive candidates — they reference "tasks" or "priorities" which might cause the model to emit an `add_todo` when none was requested. These are the prompts to watch in the eval.
- Prompts 1 and 8 test implicit time parsing ("tomorrow", "in an hour") which is a realistic difficulty for Nano's `fireAt` field.
- Prompt 3 and 10 test chart disambiguation — requires the model to correctly pick a `chartId` from the available list in the system prompt.
- The false-positive rate (≤ 5%) means at most 0–1 of the 10 chat prompts (11–20) may incorrectly produce an action response. Prompts 11 and 18 are the likely failure points to watch.

---

**End of Brief**
