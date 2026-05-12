# Gemini Nano Tool-Call Eval Snapshot — m3

> **Template — run manually post-merge.**
> This document is filled in by the maintainer after `gemini-nano-m3` lands in `main`.
> Run each prompt in the Proclivity chat panel with Gemini Nano available in Chrome.
> Record the actual response type and whether the parse succeeded.

---

## Schema-discrimination decision

**Shipped:** flat-object schema with `type` discriminator constrained by `pattern`.

```json
{
  "type": "object",
  "properties": {
    "type": {
      "type": "string",
      "pattern": "^(chat|add_todo|add_gantt_task|set_reminder)$"
    },
    "text": { "type": "string" },
    "todo": { "type": "object", ... },
    "task": { "type": "object", ... },
    "reminder": { "type": "object", ... }
  },
  "required": ["type"],
  "additionalProperties": false
}
```

**Why:** Chrome's `responseConstraint` is confirmed to support `type`, `object`,
`array`, `properties`, `required`, `additionalProperties`, `items`, `maxItems`,
`pattern`, `number`, `string`, `boolean`. `oneOf` and `enum` are **not confirmed**
by any Chrome doc or spec example, and unsupported keywords throw a hard
`NotSupportedError` — killing 100% of prompts, not just some.

**Upgrade path:**
1. Test `enum` first: try `{ type: "object", properties: { x: { enum: ["a", "b"] } }, required: ["x"] } }` as a `responseConstraint`. If no `NotSupportedError`, upgrade the `type` discriminator from `pattern` to `enum`.
2. If `enum` works, also test `oneOf` with a two-arm schema. If confirmed, upgrade to a full tagged-union schema (drop-in replacement in `src/llm/tools.ts`).
3. Document the outcome here by filling in "Upgrade test results" below.

---

## Eval metadata

| Field | Value |
|-------|-------|
| Run date | *(fill in)* |
| Nano model version | *(from Chrome Settings → About or window.ai version info)* |
| Chrome version | *(from chrome://settings/help or navigator.userAgent)* |
| Schema shape used | flat-object + pattern |
| enum test result | *(NotSupportedError? or OK?)* |
| oneOf test result | *(NotSupportedError? or OK?)* |

---

## Upgrade test results

> Fill this section after running the `enum` and `oneOf` tests in a live Chrome session.

- [ ] `enum` test attempted
- [ ] `enum` supported (no error)
- [ ] `oneOf` test attempted (only if `enum` passed)
- [ ] `oneOf` supported (no error)

Notes:
*(record what happened)*

---

## Test setup

For each prompt below:
1. Open Proclivity newtab → open Chat panel.
2. Type the prompt exactly as written (or rephrase naturally if testing realistic input).
3. Record `Actual Type` (the `"type"` field in the JSON response, or "parse-failed" if non-JSON).
4. Record `Parse OK?` — yes if the response was valid JSON with the right shape; no otherwise.
5. For action prompts: record `Fields OK?` — yes if the required payload fields are present and valid.
6. For chat prompts: record `False Positive?` — yes if the model incorrectly emitted a tool call instead of `"chat"`.

---

## Action prompts (1–10) — expected to produce a tool-call response

| # | Prompt | Expected Type | Actual Type | Parse OK? | Fields OK? | Notes |
|---|--------|---------------|-------------|-----------|------------|-------|
| 1 | "add a todo to call the dentist tomorrow" | `add_todo` | | | | `title` contains "dentist"; `scope` = "today" or "long" |
| 2 | "remind me to take my medication at 9pm tonight" | `set_reminder` | | | | `title` contains "medication"; `fireAt` ≈ 9pm today |
| 3 | "add a task to my roadmap chart: finalize the API spec, starts today ends in 3 days" | `add_gantt_task` | | | | `chartId` valid; `title` contains "API spec"; `endsAt` > `startsAt` |
| 4 | "I need to pick up groceries this week — add it to my to-do list" | `add_todo` | | | | `title` contains "groceries" |
| 5 | "set a reminder to submit the quarterly report next Monday morning" | `set_reminder` | | | | `title` contains "quarterly" or "report"; `fireAt` ≈ next Monday |
| 6 | "add a long-term goal to learn Spanish" | `add_todo` | | | | `title` contains "Spanish"; `scope` = "long" |
| 7 | "create a gantt task for writing unit tests, due this Friday" | `add_gantt_task` | | | | `title` contains "unit tests"; `endsAt` ≈ Friday |
| 8 | "don't let me forget to reply to Sarah's email — remind me in an hour" | `set_reminder` | | | | `title` contains "Sarah" or "email"; `fireAt` ≈ now + 3 600 000 ms |
| 9 | "add pay the electric bill to my sprint tasks" | `add_todo` | | | | `title` contains "electric bill"; `scope` = "sprint" |
| 10 | "I want to track a new milestone: deploy to production. Add it to the planning chart starting next week" | `add_gantt_task` | | | | `title` contains "deploy" or "production"; `chartId` valid |

---

## Chat prompts (11–20) — expected to produce a conversational response (no record created)

| # | Prompt | Expected Type | Actual Type | Parse OK? | False Positive? | Notes |
|---|--------|---------------|-------------|-----------|-----------------|-------|
| 11 | "what should I work on first today?" | `chat` | | | | Classic planning question; no record intent. Watch for `add_todo` FP. |
| 12 | "how do I prioritize when everything feels urgent?" | `chat` | | | | Advice-seeking |
| 13 | "I'm feeling overwhelmed, I have too much to do" | `chat` | | | | Emotional; no action intent |
| 14 | "what's the difference between a sprint and a long-term goal?" | `chat` | | | | Meta question about the app |
| 15 | "how long should a sprint be?" | `chat` | | | | General advice |
| 16 | "I just finished a big project — what should I do next?" | `chat` | | | | Reflective; no specific action |
| 17 | "give me some tips for staying focused" | `chat` | | | | Self-improvement advice |
| 18 | "what are my most important tasks right now?" | `chat` | | | | Introspective; no state write. Watch for `add_todo` FP. |
| 19 | "can you help me think through my week?" | `chat` | | | | Planning conversation |
| 20 | "is it normal to have this many todos?" | `chat` | | | | Rhetorical; no action |

---

## Summary statistics

| Metric | Target | Actual |
|--------|--------|--------|
| Parse rate (all 20 prompts) | ≥ 90% (18/20) | *(fill in)* |
| False-positive rate (chat prompts 11–20) | ≤ 5% (≤ 1/10) | *(fill in)* |
| Action prompts correct | 10/10 ideal | *(fill in)* |
| Chat prompts correct | 10/10 ideal | *(fill in)* |

---

## Notes / observations

*(fill in after running the eval)*

- Which prompts failed and why?
- Any parse errors (`NotSupportedError`, `QuotaExceededError`)?
- Any surprising false positives?
- Recommendations for follow-up:
  - If parse rate < 90%: consider adjusting the system prompt wording.
  - If false-positive rate > 5%: strengthen the "chat" vs. action heuristic in the system prompt.
  - If `enum` is confirmed working: upgrade `type` discriminator in `src/llm/tools.ts`.
  - If `oneOf` is confirmed working: upgrade to full tagged-union schema for tighter model guidance.
