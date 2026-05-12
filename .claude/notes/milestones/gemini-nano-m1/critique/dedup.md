# Critique — gemini-nano-m1 — DEDUPED MERGE

**Sources:** adversary
**Counts:** C=0 H=1 M=3 L=3

## Verdict

**SHIP-WITH-FIXES** (aggregated from: SHIP-WITH-FIXES)

## Executive summary

- [HIGH] ProgressEvent.loaded is bytes, not 0–1; progress display will be wildly wrong
- [MEDIUM] Race: abortRef.current can be null when session.prompt reads .signal
- [MEDIUM] CreateSessionOpts.initialPrompts narrows away the system-message-first overload
- [MEDIUM] SettingsModal.tsx at 292 lines; Nano block is an extraction candidate
- [LOW] Commit subject exceeds 50-char limit (CLAUDE.md policy)
- [LOW] JSDoc references params() which is not exported and is deprecated
- [LOW] SECURITY.md §3 PII claim is imprecise post-m1

## Findings

### CRITICAL

### HIGH

#### [HIGH] H1 — ProgressEvent.loaded is bytes, not 0–1; progress display will be wildly wrong

- **File:** `src/components/SettingsModal.tsx`
- **Line:** 111–115
- **Anchor:** `// ProgressEvent.loaded is 0.0–1.0 per the SDK docs.`
- **What:** The code stores `e.loaded` directly as `downloadProgress` and then displays `Math.round(progress * 100)` as a percentage; but `ProgressEvent.loaded` is the number of bytes transferred (a large integer), not a normalised 0–1 fraction per the W3C/WHATWG ProgressEvent spec.
- **Why it matters:** During a 4 GB model download `e.loaded` could be e.g. 400,000,000 bytes; `Math.round(400_000_000 * 100)` = 40,000,000,000, so the badge would display "Downloading 40000000000%" — completely meaningless to the user and contradicting the AC "UI shows progress".
- **Proposed fix:** Normalise to 0–1 using `e.total`: `downloadProgress: e.total > 0 ? e.loaded / e.total : null`. In `NanoBadge` the existing `Math.round(progress * 100)` then produces the correct percent. Also update the JSDoc and comment to remove the "0.0–1.0 per the SDK docs" claim.
- **Regression-guard:** Add a unit test or a manual QA step that asserts `downloadProgress` stored from a synthetic `ProgressEvent({ loaded: 2_147_483_648, total: 4_294_967_296 })` equals `0.5` (not `2147483648`).
- **Source critic:** adversary
- **Source axis:** 8. Settings UX correctness
- **Original id:** H1

### MEDIUM

#### [MEDIUM] M1 — Race: abortRef.current can be null when session.prompt reads .signal

- **File:** `src/components/SettingsModal.tsx`
- **Line:** 122
- **Anchor:** `signal: abortRef.current.signal,`
- **What:** The abort-on-close `useEffect` sets `abortRef.current = null` synchronously when `open` flips to `false`; if the close fires between `nanoCreateSession` resolving and the inner `session.prompt` line executing (a microtask gap), `abortRef.current` is `null` at line 122 and `null.signal` throws `TypeError: Cannot read properties of null`.
- **Why it matters:** The `TypeError` bubbles to the outer `catch (err: unknown)` block, which checks `err.name === "AbortError"` — this fails — and then displays the error string to the user ("Cannot read properties of null (reading 'signal')"), breaking the expected "silent abort on close" contract.
- **Proposed fix:** Capture the signal into a local variable before the first `await`: `const signal = abortRef.current.signal;` then use `signal` at both lines 108 and 122. The local binding holds the `AbortSignal` object reference regardless of what `abortRef.current` is set to later.
- **Source critic:** adversary
- **Source axis:** 9. Abort + cleanup
- **Original id:** M1

#### [MEDIUM] M2 — CreateSessionOpts.initialPrompts narrows away the system-message-first overload

- **File:** `src/llm/nano.ts`
- **Line:** 78
- **Anchor:** `initialPrompts?: LanguageModelMessage[];`
- **What:** The SDK's `LanguageModelCreateOptions.initialPrompts` is typed as `[LanguageModelSystemMessage, ...LanguageModelMessage[]] | LanguageModelMessage[]`, but the wrapper's `CreateSessionOpts.initialPrompts` is only `LanguageModelMessage[]`. `LanguageModelSystemMessage` has `role: "system"` which is absent from `LanguageModelMessage`, so callers cannot pass a system message as the first prompt element through the public wrapper API.
- **Why it matters:** `gemini-nano-m3` plans to seed the session with a system prompt (the tool-call schema instruction). If that seeding goes through `createSession({ initialPrompts: [systemMsg, ...] })`, TS will reject it because `systemMsg.role === "system"` is not assignable to `"user" | "assistant"`.
- **Proposed fix:** Widen the wrapper type to match the SDK: `initialPrompts?: [LanguageModelSystemMessage, ...LanguageModelMessage[]] | LanguageModelMessage[];`. The `args.initialPrompts = opts.initialPrompts` assignment at line 100 remains valid.
- **Source critic:** adversary
- **Source axis:** 3. Strict TS
- **Original id:** M2

#### [MEDIUM] M3 — SettingsModal.tsx at 292 lines; Nano block is an extraction candidate

- **File:** `src/components/SettingsModal.tsx`
- **Line:** 197–292
- **Anchor:** `/* ─── Gemini Nano status block ─────`
- **What:** The Nano-specific types (`NanoState`, `initialNanoState`), sub-components (`NanoStatusBlock`, `NanoBadge`), and their props interfaces occupy ~150 lines inside `SettingsModal.tsx`, a file that is also responsible for name editing, save/cancel logic, and modal lifecycle.
- **Why it matters:** As m2 and m3 add a chat panel and tool-call actions, the Nano surface will grow further. Keeping it inline now makes the file harder to navigate and tests harder to scope.
- **Proposed fix:** Extract `NanoState`, `initialNanoState`, `NanoStatusBlock`, and `NanoBadge` into `src/components/NanoSettings.tsx`. `SettingsModal.tsx` imports and renders `<NanoStatusBlock>` as it does today. This is a mechanical refactor with no behaviour change.
- **Source critic:** adversary
- **Source axis:** 11. SettingsModal complexity
- **Original id:** M3

### LOW

#### [LOW] L1 — Commit subject exceeds 50-char limit (CLAUDE.md policy)

- **File:** `.git/COMMIT_EDITMSG` (commit b849eb0)
- **Line:** 1
- **Anchor:** `feat(llm): nano.ts wrapper + Settings availability`
- **What:** The commit subject after the `feat(llm): ` prefix is 64 characters; CLAUDE.md specifies "subject ≤ 50 chars after the prefix".
- **Why it matters:** Low practical impact, but the project policy exists to keep one-line summaries readable in `git log --oneline` and CI output.
- **Proposed fix:** Shorten to e.g. `feat(llm): Nano wrapper and Settings availability surface` (50 chars) and move the milestone id to the body.
- **Source critic:** adversary
- **Source axis:** 2. Conventional commit
- **Original id:** L1

#### [LOW] L2 — JSDoc references params() which is not exported and is deprecated

- **File:** `src/llm/nano.ts`
- **Line:** 68
- **Anchor:** `/** 0.0–1.0 range; controls randomness. Defaults to whatever `params()` reports. */`
- **What:** The `temperature` field JSDoc references `params()` as if callers can query it, but `params()` is not exported from `nano.ts` and is marked `@deprecated` in `@types/dom-chromium-ai@0.0.16`.
- **Why it matters:** A caller reading the JSDoc will look for a `params()` export that does not exist, wasting time.
- **Proposed fix:** Update the JSDoc to "Defaults to the model-specific default; see `LanguageModel.params()` (Chrome Extensions only, deprecated as of Chrome 138+)." or simply "Defaults to the model's built-in value."
- **Source critic:** adversary
- **Source axis:** 5. Doc drift
- **Original id:** L2

#### [LOW] L3 — SECURITY.md §3 PII claim is imprecise post-m1

- **File:** `SECURITY.md`
- **Line:** 45
- **Anchor:** `**PII boundary:** the only PII is whatever the user types as todo/reminder`
- **What:** The claim "Nothing is processed, transmitted, or replicated" is now imprecise: after m1, any text the user types into a future test prompt WILL be processed by the on-device Nano model. The "not transmitted" part remains accurate; the "not processed" part does not.
- **Why it matters:** The SECURITY.md is the canonical data-handling statement for the project. Imprecision here could cause confusion when m2 ships a real chat panel (where user messages ARE clearly processed by Nano).
- **Proposed fix:** Update §3 to read: "The only PII is whatever the user types as todo/reminder titles or, from gemini-nano-m1 onwards, into the Nano chat (processed entirely on-device; nothing is transmitted or replicated)."
- **Source critic:** adversary
- **Source axis:** 5. Doc drift
- **Original id:** L3

## What was done well

  - The `exactOptionalPropertyTypes`-safe pattern (conditional assignment of each optional field into `args`) is applied consistently and correctly throughout `createSession`; `tsc --noEmit` exits 0 with all strict flags active.  _(adversary)_
  - `@types/dom-chromium-ai` is correctly placed in `devDependencies` — it emits zero runtime bytes and the build output confirms the 3.93 kB delta stays under the 5 kB AC cap.  _(adversary)_
  - The abort/cleanup design correctly uses a cancellable `cancelled` flag in the availability `useEffect` and an `AbortController` ref for in-flight prompts; the two mechanisms are correctly independent.  _(adversary)_
  - `NanoUnavailableError` and `NanoParseError` are typed error classes with distinct `.name` values, enabling precise `instanceof` checks in both the wrapper and callers.  _(adversary)_
  - The `promptStructured<T>` helper is exported and compiles cleanly without exercising unverified schema features in m1's UI — the JSDoc explicitly calls out which keywords are unconfirmed, deferring empirical validation to m3.  _(adversary)_
  - The unavailable-state hint block (SettingsModal.tsx:225–239) satisfies AC4 precisely: it explains the situation, links to `chrome://flags/#prompt-api-for-gemini-nano`, and includes an external docs link with `rel="noreferrer"`.  _(adversary)_
  - The session lifecycle is disciplined: `session.destroy()` is in a `finally` block in both the one-shot `prompt()` helper and `promptStructured<T>()`, and in `SettingsModal.tsx`'s `runTestPrompt` function.  _(adversary)_
  - No outbound `fetch` or `XMLHttpRequest` calls were introduced; `grep -rn "fetch\|XMLHttpRequest" src/` returns zero hits — the on-device constraint from SECURITY.md is preserved.  _(adversary)_
  - The commit is GPG-signed (`G` status), carries the required `Co-Authored-By` trailer, and uses a valid conventional-commit type+scope prefix.  _(adversary)_
  - The build chunk delta (+3.93 kB) is accurately reported in the commit message and verified by re-running `npm run build` — the claim is not aspirational.  _(adversary)_

## Recommended rectification order

H1, M1, M2, M3, L1, L2, L3
