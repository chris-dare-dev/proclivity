# Gemini Nano (Chrome Prompt API) — Roadmap

**Slug:** `gemini-nano`
**Created:** 2026-05-12
**Status:** active
**Replaces:** [`plans/gemini-roadmap.md`](gemini-roadmap.md) (deprecated — Cloud-API path; reverted in commit `9547cd6`).
**Research anchor:** [`plans/gemini-nano-research.md`](gemini-nano-research.md).

---

## Phase 1 — Refine

### How Might We

How might we let a single user chat with an LLM **embedded in the new-tab page** that can read and modify their planner state, without API keys, without a Google Cloud project, and without their typed prompts ever leaving the device?

### Assumptions

- `[MUST]` Chrome's Prompt API + Gemini Nano is available on the user's Chrome installation (138+ with flags, or current Dev/Canary). Spike `gn-spike-1` validates by detecting `LanguageModel.availability()` on a fresh install.
- `[MUST]` `responseConstraint` (JSON Schema) produces parseable JSON ≥ 90% of the time for our concrete schemas (todos, Gantt tasks). Lower than the 95% bar from the Cloud roadmap because Nano is a smaller model; failure paths are explicit (retry once, then surface the raw response with an apology).
- `[SHOULD]` The 4 GB model download is acceptable one-time cost. The Settings UI surfaces "Downloading Gemini Nano… (~4 GB)" when `availability() === "downloading"` so the user knows what's happening.
- `[MIGHT]` Streaming responses meaningfully improve the chat UX over batched. Defer streaming to a later polish pass.

### Objective

Ship an embedded, on-device LLM chat that can both have an open conversation and structurally modify Proclivity records — without ever touching the network for inference.

### Key Results

1. **Connect flow takes zero clicks.** Either Nano is available (chat is ready) or it's not (Settings shows availability state). No OAuth, no token, no console. Verified in `gn-m1`.
2. **First todo generated in ≤ 4 seconds** from chat-message submitted to record-in-state. Latency target accounts for Nano being slower than Flash. Verified in `gn-m3`.
3. **≥ 90% structured-output parse rate** on a 20-prompt eval recorded in `plans/gemini-nano-eval-snapshot.md` at end of `gn-m3`.
4. **Zero network calls.** Verified by inspecting the chat code: `grep -rn "fetch\|XMLHttpRequest" src/llm/` returns no remote URLs.
5. **Chat actions are reversible.** Every record created via an LLM tool-call has a one-click Undo affordance visible for ≥ 10 seconds.

### Won't (out of scope for this roadmap)

- Cloud Gemini API. Anything that requires a Google Cloud project, an OAuth Client ID, or a billing account. Done; reverted.
- Claude integration of any flavor. Separate effort; needs the MCP-server approach discussed earlier.
- Multi-turn memory beyond the active session. When the user closes the side panel / clears chat, history is gone.
- Voice or audio modalities. Text only.
- Streaming responses in v1. Use `prompt()` (batched), not `promptStreaming()`.
- Internet-connected fallback when Nano is unavailable. The whole point is "no cloud" — show an empty state, don't fall back to Flash.
- Persisting raw LLM prompts/responses to `chrome.storage.local`. Only the parsed records get saved.

---

## Phase 2 — Decompose

### Technique

Vertical slicing — each epic ships one full user-visible feature backed by the same Nano module. The first epic carries the auth-less-but-still-not-trivial plumbing (availability detection, model download UX, session lifecycle); the next two reuse the plumbing for higher-value affordances.

### Epics

#### gemini-nano-e1 — Connected and capable

- **Type:** value + enabler hybrid
- **Outcome:** From Settings, the user can see "Gemini Nano: ready" (or "downloading…" or "unavailable on this Chrome version"). A `src/llm/nano.ts` module wraps the Prompt API with availability, session lifecycle, prompt, structured-output. Tests-shape: a single demo affordance ("Test Nano with a hello prompt") in Settings proves the chain end-to-end.
- **Estimated size:** S (≤ 1 week)
- **INVEST check:** I clean, N clean, V clean (a visible status surface is genuine value, not pure plumbing), E clean, S clean, T clean.
- **Dependencies:** none.

#### gemini-nano-e2 — Embedded chat sidekick

- **Type:** value
- **Outcome:** A persistent side panel (or modal) reachable from the gear icon or a dedicated icon. Free-text chat with Nano: user types a message, Nano responds, conversation history rendered as a list. Context-window overflow auto-trims the oldest exchange. No tool-calling yet — pure conversation. This is the "embedded chat" piece of the user's request.
- **Estimated size:** M (1–3 weeks)
- **INVEST check:** I depends on e1 for the module; N clean; V clean; E clean; S clean; T clean.
- **Dependencies:** `gemini-nano-e1`.

#### gemini-nano-e3 — Chat that does

- **Type:** value
- **Outcome:** The chat from e2 gains structured tool actions. Nano's responses can include "tool calls" — JSON-schema-constrained directives like `{ "type": "add_todo", "title": "…", "scope": "today" }`. The chat applies them via `useStore.update()` and surfaces an Undo affordance for ≥ 10 seconds. Supported actions in v1: `add_todo`, `add_gantt_task`, `set_reminder`. This is the "controls my extension" piece — the headline of the whole pivot.
- **Estimated size:** M (1–3 weeks)
- **INVEST check:** I depends on e2 (it extends the chat UX); N clean; V clean; E clean; S clean; T clean.
- **Dependencies:** `gemini-nano-e1`, `gemini-nano-e2`.

---

## Phase 3 — Sequence

### MoSCoW

- **Must** (≤ 60% effort): `gemini-nano-e1`
- **Should**: `gemini-nano-e2`, `gemini-nano-e3`

Effort breakdown: e1=1, e2=2.5, e3=2.5 (in weeks). Must = 1 / 6 = 16.7%, well under cap.

### Now / Next / Later

- **Now**: `gemini-nano-e1`
- **Next**: `gemini-nano-e2`, `gemini-nano-e3`
- **Later**: —

### Spike lane

- `gemini-nano-spike-1` — Walk the Prompt API end-to-end on the user's actual Chrome installation. Detect availability state. If `"downloadable"`, trigger the model download and time it. If `"unavailable"`, capture the user-agent + version so the m1 design knows what to gracefully degrade to. (≤ 0.5 day, validates `[MUST]` #1.)
- `gemini-nano-spike-2` — 20-prompt structured-output eval against the planned `Todo` and `GanttTask` schemas. Record parse rate. (≤ 1 day, validates `[MUST]` #2. Folds into `gemini-nano-m3`'s eval doc.)

### Milestones — Now lane

### gemini-nano-m1 — Plumbing + availability surface

**Description.** Create `src/llm/nano.ts` exporting a thin TypeScript wrapper around the Prompt API: `availability()`, `params()`, `createSession(opts?)`, plus typed `prompt(text, opts?)` and a `promptStructured<T>(text, schema, opts?)` helper that returns the parsed JSON. Surface availability state in the existing gear-icon `SettingsModal` (new "Gemini Nano" section showing one of `ready` / `downloading…` / `downloadable (≈4 GB)` / `unavailable`). Add a "Test prompt" affordance that runs `await session.prompt("Say hi in 5 words")` and displays the response inline. No chat UI yet, no tool calling. The point is to prove the pipe and give the user a visible status indicator.

**Acceptance criteria.**
- [ ] `src/llm/nano.ts` exists, exports the helpers, compiles under strict TS.
- [ ] `SettingsModal` shows a "Gemini Nano" sub-section with the live availability state (refreshes when the modal opens).
- [ ] Clicking the "Test prompt" button calls Nano and renders the response in the modal.
- [ ] If `availability()` returns `"unavailable"`, the section displays a one-sentence explanation pointing at `chrome://flags/#prompt-api-for-gemini-nano` (or the equivalent for the user's Chrome version) and a link to docs.
- [ ] If `availability()` returns `"downloadable"`, clicking Test prompt triggers `LanguageModel.create()` which begins the download; the UI shows progress (poll `availability()` until `"downloading"` flips to `"available"`).
- [ ] `npm run build` passes; initial newtab chunk grows by < 5 kB (the wrapper is tiny; no new npm deps).
- Given Nano is `available`, When the user opens Settings and clicks Test prompt, Then a friendly response appears within ≤ 5 seconds.

**Dependencies.** `gemini-nano-spike-1` reports green (or surfaces "unavailable" with a documented graceful-degrade plan).

**Complexity.** M (1–2 days).

### gemini-nano-m2 — Embedded chat side panel

**Description.** Add a chat affordance — a persistent right-side panel (or modal — design decision in m2's research phase). Single-conversation thread with Nano. Free-text prompt input, message history rendered as a list with role badges (user / assistant). Auto-trim oldest exchanges when `contextoverflow` fires. A "Clear chat" button destroys the session. No structured tool calls yet — just conversation. Reuses `src/llm/nano.ts` from m1.

**Acceptance criteria.**
- [ ] A new chat affordance is reachable from the gear icon area (or its own icon — m2 decides). When opened, it slides in as a side panel or appears as a modal.
- [ ] The chat starts a `LanguageModelSession` on first open and reuses it across messages.
- [ ] User-typed messages submit on Enter and append to the history; Nano's response appends below.
- [ ] On `contextoverflow`, the oldest exchange is removed from the visible history and a small "(older messages trimmed)" line shows in its place.
- [ ] "Clear chat" destroys the session and empties the history.
- [ ] Session is recreated lazily on the next user message after clear.
- [ ] `npm run build` passes; chat assets in a code-split chunk if they exceed 15 kB; initial newtab chunk grows by < 5 kB.
- Given Nano is ready and a chat panel is open, When the user types a message, Then a reply appears in < 5 seconds (p50).

**Dependencies.** `gemini-nano-m1`.

**Complexity.** M (2–3 days).

### gemini-nano-m3 — Tool actions from chat

**Description.** Teach the chat to do things. Define a JSON schema for "tool calls" — a tagged-union of three action shapes (`add_todo`, `add_gantt_task`, `set_reminder`). The chat prepends a system prompt that explains the schema and tells Nano: when the user's intent is to create records, respond with a tool-call JSON; otherwise respond conversationally. On each response, attempt to parse as the tool-call schema first; on success, apply via `useStore.update()` and surface the created records inline in the chat with an "Undo" affordance visible ≥ 10 seconds; on failure, treat the response as plain text. Includes a 20-prompt eval at `plans/gemini-nano-eval-snapshot.md` documenting parse-rate on the union schema.

**Acceptance criteria.**
- [ ] System prompt + schema constant live in `src/llm/nano.ts` (or a sibling file in `src/llm/`).
- [ ] Three tool-call shapes implemented: `add_todo` (writes `state.todos`), `add_gantt_task` (writes `state.ganttTasks`, requires a `chartId` field), `set_reminder` (writes `state.reminders` with future `fireAt`).
- [ ] When a tool call is parsed, the chat shows a record card ("Added todo: 'plan trip'") with Undo button.
- [ ] Undo button reverses the state mutation within 10 seconds of the action; after 10 s the affordance fades.
- [ ] Disambiguation: when Nano's response parses as a tool call AND has accompanying prose, both render.
- [ ] When the user prompt isn't an action ("how should I plan my week?"), Nano responds conversationally; no record is created.
- [ ] `plans/gemini-nano-eval-snapshot.md` exists with: 20 prompts (10 action, 10 conversational), the tool-call parse rate, the false-positive rate (tool-call inferred when none was intended), Nano model version, Chrome version.
- [ ] Parse rate ≥ 90% to close the milestone. False-positive rate ≤ 5%.
- [ ] `npm run build` passes; main chunk grows < 10 kB.
- Given a connected chat, When the user types "add a todo to call the dentist tomorrow", Then a new `state.todos` entry appears with title matching and a card with Undo shows in the chat within 5 s.

**Dependencies.** `gemini-nano-m2`.

**Complexity.** M (2–3 days).

---

## Phase 4 — Materialize

### Validation

- `validate-roadmap.py`: pending (run before closing this phase).
- Must-cap: 16.7%.
- Now-lane milestones with AC: 3/3.
- Slug format valid: yes (`gemini-nano` matches `^[a-z][a-z0-9-]{2,30}$`).

### GitHub tickets

Not requested. The roadmap doc is the tracking artifact.

### Next step

First Now-lane milestone: `gemini-nano-m1`. To execute it end-to-end:

```
/milestone-pipeline gemini-nano-m1
```

That dispatches the milestone-pipeline skill which will Research → Implement → Critique → Rectify the milestone and land a signed commit on `main`.

Alternative: walk `gemini-nano-spike-1` first as a standalone investigation to confirm Nano is actually available on the maintainer's Chrome installation before committing to m1. Recommended if the maintainer is on Chrome stable and hasn't enabled `chrome://flags/#prompt-api-for-gemini-nano` yet.
