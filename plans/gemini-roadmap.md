# Gemini LLM integration — Roadmap

**Slug:** `gemini`
**Created:** 2026-05-12T01:21:28Z
**Status:** init

<!--
This roadmap is itself the state. Re-invoking the `roadmap` skill on
this file resumes from the first un-populated phase. Sections below
contain `{{TOKEN}}` placeholders until their phase runs.

Phases:
  1. REFINE     — How-Might-We, sharpening questions, assumptions, OKR, Won't list
  2. DECOMPOSE  — technique, epics, INVEST, specialist suggestions
  3. SEQUENCE   — MoSCoW, RICE, Now/Next/Later, spike lane, Now-lane milestones
  4. MATERIALIZE — validation results, optional GitHub bundle, next-step handoff
-->

---

## Phase 1 — Refine

### How Might We

How might we let a solo planner turn natural-language briefs into structured Proclivity records (todos, Gantt tasks, reminders) **without asking them to manage an API key**, while staying inside a free or near-free quota envelope?

### Sharpening questions answered

1. **Who is the user, exactly?** A single Chrome user running Proclivity unpacked, signed into a personal Google account. No multi-user, no shared install. → Implies `chrome.identity.getAuthToken` over `launchWebAuthFlow`; per-extension Client ID is fine.
2. **What does success look like in one screen?** User types "plan the holiday trip" in a Today-section brainstorm input, clicks a button, and 4-8 todos appear in the list within ~3 seconds. No JSON shown to them. No quota messaging unless the day's budget is gone. → Sets latency target and UX bar for the first cut.
3. **Where does the prompt live and where does the response land?** Prompt is whatever the user types into a per-feature input (Today brainstorm, Gantt break-down). Response writes directly into `state.todos` / `state.ganttTasks` via the existing `useStore.update()` write-queue. No intermediate "review" step in v1 — destructive enough that one-click-undo via the existing delete buttons is the recovery affordance. → Removes a screen; ships the value faster.
4. **What happens when the user is offline or has hit the day's 250-request limit?** Show an inline error message with the actual cause ("Out of free quota for today" vs "Network error"). No silent fallback to a different model. → Quota UX is explicit; the user can decide whether to enable billing.
5. **Could we use Gemini Nano (on-device) instead and skip OAuth entirely?** Yes for prompt → text, no for the structured-output use cases — Chrome 138's Prompt API does not yet support `response_schema` (per `plans/gemini-integration-research.md` §5.6). Defer Nano to a later milestone as a non-OAuth fallback for free-form brainstorm; the cloud path is required for the structured generators. → Two-track future, single-track for v1.

### Assumptions

- `[MUST]` Anthropic's January 2026 OAuth ban on third-party Claude access has no equivalent Google policy — `chrome.identity.getAuthToken` against the user's own Google account, calling the user's own GCP project, remains compliant with Google ToS through 2026. Validated by research doc §1, §2; spike `gemini-spike-1` confirms by walking the consent flow end-to-end before any other work lands.
- `[MUST]` The free-tier limit on Gemini 2.5 Flash (250 RPD as of Dec 2025) is enough for a single user's planner use case (≤30 generations/day typical). Wrong = the feature is unusable without billing; we'd need to surface a "Enable billing on your GCP project" CTA in the Settings modal.
- `[MUST]` `response_mime_type: "application/json"` + `response_schema` constraint produces valid parseable JSON ≥95% of the time at Gemini 2.5 Flash quality, for our Todo and GanttTask schemas. Wrong = need to add a retry-and-repair loop, which the research doc punts on.
- `[SHOULD]` The user is willing to register a single OAuth Client ID in their own Google Cloud Console as part of first-time setup (one-time, ≤5 minutes). Alternative if wrong: ship a pre-registered Client ID baked into the public extension, which constrains the extension to the published Chrome Web Store path and is incompatible with the "local-only, unpacked" stack — would force a fundamental distribution change.
- `[SHOULD]` Snake-case REST body fields (`response_mime_type`, `response_schema`) are the stable contract on `generativelanguage.googleapis.com/v1beta` through end of 2026. Wrong = silent regression to free-form text output; mitigated by an integration test that asserts the response is parseable JSON.
- `[MIGHT]` A "review before apply" step will become valuable when the model occasionally hallucinates dates 6 months out or task counts of 20+. Wrong = users get frustrated with the one-click-write design; address only when a regression is observed.
- `[MIGHT]` Adding linked-todo support to reminders (Gemini generates a reminder tied to a specific todo) is high-value. Wrong = it ships and users ignore it; cheap to revert.

### Objective

Give the user a fast, account-linked LLM assist for creating Proclivity records, without operational burden (no API key management) and without leaving the local-only, single-user posture of the extension.

### Key Results

1. **OAuth handshake completes in ≤2 minutes from scratch.** Measured as wall-clock from clicking "Connect Google account" in Settings to seeing the green "Connected as X" state, given a pre-registered Client ID. Target ships in `gemini-m1`.
2. **First brainstorm produces 4-8 todos in ≤3 seconds (p50).** Measured against Gemini 2.5 Flash with a 200-token user prompt. Target ships in `gemini-m1`; verified via a smoke test that times one round-trip.
3. **≥95% of `generateTodos` and `generateGanttTasks` responses parse as the declared schema** on the first attempt. Verified via 20-prompt eval recorded in `plans/gemini-eval-snapshot.md` at the end of `gemini-m3`.
4. **Zero static API keys in the repo.** Verified by `grep -rE 'AIza[0-9A-Za-z_-]{35}' src/` returning empty at every milestone close.
5. **All four LLM-touched UI affordances explicitly indicate the call sends the prompt to Google.** Done state defined by: a visible disclaimer next to the brainstorm/breakdown buttons, in the form of a short label or info icon with hover/click reveal. Verified in `gemini-m2` rectify.

### Won't (explicit out-of-scope)

- **No Claude integration** — Anthropic's OAuth ban makes account-linked Claude infeasible; per the deep-dive conversation, the Claude path is a separate Desktop-Extension/MCP-server effort, not part of this roadmap.
- **No multi-account / account-switching UI.** One Google account connected at a time. If the user wants to change accounts they Disconnect and reconnect.
- **No prompt history / conversation memory.** Each call is one-shot. The user's prompt is sent fresh; nothing accumulates server-side.
- **No "edit before apply" preview screen in v1.** Records write directly to state on response. Delete buttons are the undo path. Revisit only if hallucinations become a regression.
- **No on-device Gemini Nano in this roadmap.** Tracked as a future enhancement; current Prompt API lacks `response_schema` support per research doc §5.6.
- **No Bearer-token storage in `chrome.storage.local`.** Tokens stay in Chrome's identity cache; only the connected-state boolean and the user's email/name go in storage.
- **No Gemini 2.5 Pro default.** Pro has no free tier; Flash is the only sensible default. Pro is an opt-in setting if added later.
- **No paid-API-key fallback.** The whole point of this work is no-key. If a user wants Pro quality, the path is "enable billing on your GCP project," not "paste a key into Settings."

---

## Phase 2 — Decompose

### Technique

Vertical slicing + enabler stories. Each value epic ships one full user-visible LLM-generation flow (input → call → records written → visible result). Reuses the same `src/llm/gemini.ts` module across epics so the first slice carries the auth + transport burden; subsequent slices are mostly UI + a new schema.

### Epics

#### gemini-e1 — Connected planner can brainstorm todos in one click

- **Type:** value (with embedded enabler — the OAuth plumbing + `src/llm/gemini.ts` skeleton)
- **Specialist suggestion:** `security-reviewer` — see `.claude/skills/roadmap/references/specialist-contracts.md`. Touches network egress (Gemini fetch), tool input validation (the prompt is user-controlled), credential handling (OAuth tokens).
- **Outcome:** From a connected state, typing a brief in the Today section and clicking "Brainstorm with Gemini" produces 4–8 todos in `state.todos` within ~3 seconds (KR2). This is the first end-to-end proof that the whole chain works.
- **Estimated size:** M (1–3 weeks)
- **INVEST check:** I clean, N clean, V clean, E clean, S clean, T clean.
- **Dependencies:** none.
- **Won't conflict check:** none.

#### gemini-e2 — Gantt charts breakable from a brief

- **Type:** value
- **Specialist suggestion:** `—` (no specialist; the auth + fetch pattern is fixed by `gemini-e1`, this epic only adds a new JSON schema and a new UI surface).
- **Outcome:** In any open Gantt chart, typing "break this into a 4-week plan" and clicking "Generate tasks" populates `state.ganttTasks` with the right `chartId`, valid date ranges, and at most one level of nesting via `parentId`. Same response-time bar as e1.
- **Estimated size:** S (≤ 1 week)
- **INVEST check:** I depends on e1 for the gemini module (note borderline I); N clean; V clean; E clean; S clean; T clean. Independence is acceptable because e1 owns the shared module by design — e2 imports, doesn't fork.
- **Dependencies:** `gemini-e1` (the gemini module + connected state must exist).
- **Won't conflict check:** none.

#### gemini-e3 — Reminders + quota/quality polish

- **Type:** value (with quality-bar work folded in to avoid a fourth small epic)
- **Specialist suggestion:** `—` (no path match; the polish work is broad but routine).
- **Outcome:** Two deliverables in one slice — (a) a "Generate reminders" affordance in the Reminders section that produces records compatible with `chrome.alarms` (dates always future, recurrence values validated against the union type); (b) a `plans/gemini-eval-snapshot.md` doc validating the ≥95% parse-rate KR across 20 prompts on Flash, plus quota-exhaustion UX (inline 429 messaging citing the user's GCP project), plus the visible "data sent to Google" disclaimer required by KR5.
- **Estimated size:** M (1–3 weeks)
- **INVEST check:** I depends on e1; N clean; V clean — quota/eval is genuine value not just polish; E clean; S clean (folded polish keeps it within M); T clean.
- **Dependencies:** `gemini-e1`. May overlap with `gemini-e2` in scheduling.
- **Won't conflict check:** none.

---

## Phase 3 — Sequence

### MoSCoW assignment

- **Must** (≤ 60% of total effort): `gemini-e1`
- **Should**: `gemini-e2`, `gemini-e3`
- **Could**: —
- **Won't (this cycle)**: —

Effort breakdown via `score-moscow.py`: Must = 41.7% of 6 person-weeks total (≤ 60% cap, passes). Only `gemini-e1` is a true gating Must — without OAuth + the gemini module + one demonstrable generator, nothing else in this roadmap can land. The other two epics are valuable extensions and may slip without invalidating the integration.

### RICE ranking — Musts

| ID | Reach | Impact | Confidence | Effort | Score |
|---|---:|---:|---:|---:|---:|
| gemini-e1 | 1 | 3.00 | 80% | 2.50 | 1.0 |

_Reach is normalized to 1 (single-user personal app); Impact 3 reflects that e1 unlocks everything downstream; Confidence 80% reflects the thorough research doc at `plans/gemini-integration-research.md`._

### Now / Next / Later

- **Now** (fully spec'd, in-flight or next-up): `gemini-e1`
- **Next** (shaped, awaiting capacity): `gemini-e2`, `gemini-e3`
- **Later** (outcome-only): —

### Spike / discovery lane

- `gemini-spike-1` — Validate OAuth + ToS end-to-end: register a test OAuth Client ID in GCP, walk the consent flow with `chrome.identity.getAuthToken`, confirm a real bearer-token-authed call to `generativelanguage.googleapis.com` returns 200, and re-verify Google ToS still permits this account-linked use for a personal Chrome extension (≤ 2 days, validates `[MUST]` assumption: Anthropic-style OAuth ban has no Google equivalent).
- `gemini-spike-2` — Quota fit analysis: log expected usage for a representative planning week (estimate todos/Gantt-task generations triggered by the user's actual workflow), compare against 250 RPD free-tier ceiling, document as `plans/gemini-usage-estimate.md` (≤ 1 day, validates `[MUST]` assumption: free-tier quota is enough for single-user planner use).
- `gemini-spike-3` — Parse-rate eval: run 20 representative prompts (10 todo-generation, 10 Gantt-breakdown) against `gemini-2.5-flash` with the proposed `response_schema`, record JSON parseability rate, write to `plans/gemini-eval-snapshot.md` (≤ 1 day, validates `[MUST]` assumption: `response_schema` produces ≥ 95% parseable JSON; folds naturally into `gemini-m3`'s eval).

### Milestones — Now lane

### gemini-m1 — Stable extension ID + OAuth Client registration

**Description.** Stabilize the unpacked extension's ID across reinstalls by adding a Base64-encoded public key to the manifest, then register a corresponding OAuth 2.0 Client ID of type "Chrome Extension" in Google Cloud Console. Document the GCP-side steps in a developer-only setup doc so future-you can re-register if the key rotates. Ships the manifest delta + the setup doc only — no `gemini.ts` code yet. Runs concurrently with `gemini-spike-1` (the spike validates the end-to-end consent flow against the same Client ID).

**Acceptance criteria.**
- [ ] `manifest.config.ts` includes a `key` field (Base64 RSA public key).
- [ ] The private key is stored at `.proclivity-key.pem` and `.gitignore` excludes it.
- [ ] Re-deriving the extension ID from the public key (per `plans/gemini-integration-research.md` §1.3) yields the same string as `chrome://extensions` shows after loading unpacked.
- [ ] A new `plans/gemini-setup.md` doc walks the GCP-console flow (project creation, OAuth consent screen, Client ID type "Chrome Extension", extension-ID binding).
- [ ] `manifest.config.ts` declares the `identity` permission and includes the `oauth2` block with the registered Client ID + the `generative-language.retriever` scope.
- [ ] `manifest.config.ts` declares `host_permissions: ["https://generativelanguage.googleapis.com/*"]`.
- [ ] `npm run build` passes; no new TypeScript errors; bundle delta < 1 kB.
- Given a fresh `npm install` + `npm run build`, When the extension is loaded unpacked, Then the extension ID matches the value precomputed from the public key.

**Dependencies.** `gemini-spike-1` must report green (OAuth flow returns a token).

**Complexity.** S (≤ 1 day of actual editing; bulk is the offline GCP work).

**Specialist suggestion.** `security-reviewer` — see `.claude/skills/roadmap/references/specialist-contracts.md`. Touches credentials, network egress, manifest permissions.

### gemini-m2 — `src/llm/gemini.ts` auth + Settings UI Connect/Disconnect

**Description.** Land the gemini module's auth wrappers (`getToken`, `disconnect`, `isConnected`) backed by `chrome.identity.getAuthToken` and `chrome.identity.clearAllCachedAuthTokens`. Surface a "Connect Google account" button in the existing `SettingsModal`, show the connected user's email/name when connected, and a "Disconnect Google account" button (labeled deliberately broad per KR/research finding). Store connection state in `UserSettings.gemini` (new sub-shape). No generation logic yet.

**Acceptance criteria.**
- [ ] `src/llm/gemini.ts` exports `async getToken(): Promise<string>`, `async disconnect(): Promise<void>`, `async isConnected(): Promise<boolean>`.
- [ ] `UserSettings` extends with `gemini?: { connected: boolean; email?: string; name?: string; }`.
- [ ] `SettingsModal` shows the Connect/Disconnect affordance based on `state.settings.gemini?.connected`.
- [ ] Disconnect button label reads literally "Disconnect Google account" (NOT "Disconnect from Gemini").
- [ ] Token retrieval and clear-cache both round-trip via `chrome.identity` — no raw `fetch` against Google identity endpoints from our code.
- [ ] No bearer tokens are written to `chrome.storage.local`. Verified by `grep -n "token" src/storage` returning no token-storage writes.
- [ ] `npm run build` passes; initial newtab chunk grows by < 5 kB.
- Given a fresh state, When the user clicks "Connect Google account", Then the Chrome consent dialog appears, Then on Allow the Settings modal updates to show the connected email within 2 seconds.
- Given a connected state, When the user clicks "Disconnect Google account", Then the connection state clears and the button label flips back to "Connect Google account".

**Dependencies.** `gemini-m1` (the manifest must declare `identity` + `oauth2` before `chrome.identity` works).

**Complexity.** M (2 days).

**Specialist suggestion.** `security-reviewer`.

### gemini-m3 — `generateTodos` + Today-section brainstorm UI

**Description.** Implement `generateTodos(prompt: string): Promise<Omit<Todo, 'id' | 'createdAt' | 'done'>[]>` in `src/llm/gemini.ts` using `response_mime_type: "application/json"` + a `response_schema` for the Todo shape. Wire a "Brainstorm with Gemini" button (next to the existing Add-todo input) in the Today section that opens a small textarea, sends the prompt to `generateTodos`, writes the returned records to `state.todos` via `useStore.update`. Include the visible "Sends your prompt to Google" disclaimer next to the button (KR5). Quota-exhaustion (429) and network errors render inline; happy-path latency ≤ 3s p50 (KR2). Folds `gemini-spike-3`'s 20-prompt parse-rate eval into a snapshot at `plans/gemini-eval-snapshot.md`.

**Acceptance criteria.**
- [ ] `src/llm/gemini.ts` exports `async generateTodos(prompt: string): Promise<TodoDraft[]>` where `TodoDraft` excludes server-side fields.
- [ ] Request body uses snake_case field names: `response_mime_type`, `response_schema` (REST contract per research §4.2).
- [ ] Schema constrains output to an array of 1-12 items with `{ title: string, scope: "today" }`.
- [ ] Today section gains a "Brainstorm with Gemini" button that's disabled when `!state.settings.gemini?.connected`.
- [ ] Disclaimer text "Sends your typed prompt to Google's Gemini API" is visible next to the button (or hover-revealed via an info icon).
- [ ] 429 responses surface as inline message "Out of Gemini free quota for today — try again tomorrow or enable billing on your GCP project." Network errors as "Couldn't reach Gemini — check your connection."
- [ ] On success, generated todos are written via `update()` with `scope: "today"`, `done: false`, fresh `id` + `createdAt`.
- [ ] `plans/gemini-eval-snapshot.md` exists with: 20 prompts, the JSON parseability rate, p50/p95 latency, model version. Parse-rate must be ≥ 95% to close the milestone.
- [ ] `npm run build` passes; main chunk grows by < 10 kB.
- Given a connected state and the active free-tier quota, When the user types "plan a weekend trip to Portland" and clicks Brainstorm, Then 4–8 todos appear in `state.todos` within 3 seconds and the textarea closes.
- Given a 429 response, When the user clicks Brainstorm, Then the inline quota message appears and no todos are written.

**Dependencies.** `gemini-m2`.

**Complexity.** M (2–3 days).

**Specialist suggestion.** `security-reviewer` (input flows to a remote API; validates the response shape before writing to storage).

---

## Phase 4 — Materialize

### Validation

- `validate-roadmap.py`: pass
- Must-cap: 41.7% (≤ 60%)
- All Now-lane milestones have AC: yes
- Slug format valid: yes

### GitHub tickets

Not requested (`--github` was deliberately omitted — Proclivity has no active Issues board; the roadmap doc itself is the tracking artifact per `.claude/skills/roadmap/references/proclivity-integration.md`).

### Next step

First Now-lane milestone: `gemini-m1`. To execute it end-to-end, run:

    milestone-pipeline gemini-m1

This skill will not invoke milestone-pipeline. Cache stays warmer if you start the milestone-pipeline session within 5 minutes.

---

<!-- end:roadmap -->
