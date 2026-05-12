# Gemini Nano (Chrome Prompt API) — research notes

Background research for the **Nano-track** integration, replacing the
Cloud-API approach that was reverted in commit `9547cd6`. Verified
against Chrome / web.dev docs current as of **May 2026**.

## Why this path

Proclivity needs an LLM that can chat with the user and modify
extension state (add todos, generate Gantt tasks, set reminders)
without:

- requiring an API key (the user has only a consumer Google AI
  Premium subscription — there's no OAuth bridge from that to a
  third-party Chrome extension);
- requiring a Google Cloud project setup;
- sending user prompts off-device.

Chrome's **built-in AI** ships a 4 GB Gemini Nano model directly in
the browser. Extensions call it via the **Prompt API**
(`LanguageModel.create() / prompt() / promptStreaming()`). It's free,
on-device, no auth, no quota.

## API shape

```ts
// All entry points are on the global LanguageModel namespace.
LanguageModel.availability(opts?): Promise<"available" | "downloadable" | "downloading" | "unavailable">
LanguageModel.params(): Promise<{ defaultTopK; maxTopK; defaultTemperature; maxTemperature; }>
LanguageModel.create(opts?): Promise<LanguageModelSession>

// On a session:
session.prompt(content, opts?): Promise<string>
session.promptStreaming(content, opts?): ReadableStream<string>
session.contextUsage / session.contextWindow: number
session.addEventListener("contextoverflow", handler)
session.destroy(): void
```

`opts` for `create()` accepts `temperature`, `topK`, `signal`
(AbortSignal), and `initialPrompts` (for system-prompt seeding).

`opts` for `prompt()` / `promptStreaming()` accepts `responseConstraint`
(a JSON Schema), `omitResponseConstraintInput` (bool), `signal`.

## Structured output (responseConstraint)

JSON Schema goes in as the `responseConstraint` field. Available
Chrome 137+, stable target Chrome 145-150.

```ts
const session = await LanguageModel.create();
const schema = {
  type: "array",
  minItems: 1,
  maxItems: 12,
  items: {
    type: "object",
    properties: {
      title: { type: "string" },
      scope: { type: "string", enum: ["today", "long"] },
    },
    required: ["title", "scope"],
    additionalProperties: false,
  },
};
const json = await session.prompt(
  "Suggest 6 todos to plan a weekend trip to Portland.",
  { responseConstraint: schema }
);
const todos = JSON.parse(json);  // typed array, valid
```

Schema features confirmed in the docs: objects with required, arrays
with min/maxItems, primitives, enums, additionalProperties. Refs and
unions are not explicitly documented; treat as untrusted until tested.

## Extension-specific notes

- **Permission**: `aiLanguageModelOriginTrial` is **deprecated** in
  Chrome 138+. No special manifest permission required today.
- **Where it runs**: in the newtab page (regular DOM context). **NOT
  available in service workers / web workers** per the doc — the API
  needs a "responsible document". This is fine for proclivity since
  the LLM is user-initiated from the newtab UI.
- **`LanguageModel.params()` is extension-only** — lets us pick
  temperature/topK explicitly; regular web pages get fixed values.
- **First-run cost**: when `availability()` returns `"downloadable"`,
  calling `create()` triggers a ~4 GB model download. Show a UX state
  ("Gemini Nano is downloading…"). Subsequent sessions are instant.

## Limits + failure modes

- `QuotaExceededError` thrown when context window overflows. The
  error carries `{ requested, contextWindow }`. Trim conversation or
  destroy + recreate the session.
- `contextoverflow` event fires when conversation history auto-trims.
- Model quality is genuinely lower than Gemini Pro / Flash. Useful
  for short structured-output tasks ("turn this brief into 6 todos");
  less reliable for nuanced summarization or planning.
- Hardware: needs ≥ 22 GB free disk for the download, ≥ 4 GB GPU
  VRAM on most platforms. Macs with Apple Silicon work well.

## What this enables in proclivity

The exact pattern the user asked for:

1. **Embedded chat** in the new-tab UI talks to Nano. Free, fast,
   private.
2. **Structured "tool calls"** from chat — the LLM's response is
   constrained to a JSON schema describing the action(s) the user
   wants taken (`{ type: "add_todo", title: "...", scope: "today" }`).
   The chat UI parses the JSON, applies via `useStore.update()`, and
   surfaces an "Undo" affordance.
3. **No login**, no Cloud, no quota meters, no privacy footprint.

The "tool call" pattern is what mimics the function-calling /
MCP-style behavior the user described as "chat that controls my
extension." Nano doesn't natively support tool/function calling, but
the JSON-schema-constrained output is functionally equivalent for our
needs.

## Open questions for the milestone

- Which Chrome channels are we targeting? Stable Chrome won't have
  Prompt API available without flags until the 145-150 window
  (rolling out late 2026 / early 2027). The user's current Chrome
  version determines whether the feature works today or requires a
  flag flip.
- How do we handle `LanguageModel.availability()` returning
  `"unavailable"` (older Chrome, unsupported hardware)? Hide the
  feature? Show an upgrade prompt? Decision deferred to m1's design.
- Schema-conformance rate on Nano vs Flash for our two specific
  schemas (todos, gantt tasks). Measure during m1 with a 20-prompt
  eval — same shape as the gemini-spike-3 plan, just retargeted to
  Nano.

## Verified against

- <https://developer.chrome.com/docs/extensions/ai/prompt-api>
- <https://developer.chrome.com/docs/ai/prompt-api>
- <https://developer.chrome.com/docs/ai/structured-output-for-prompt-api>
- <https://developer.chrome.com/docs/ai/get-started>
- <https://developer.chrome.com/docs/ai/built-in>

Fetched May 11–12, 2026.
