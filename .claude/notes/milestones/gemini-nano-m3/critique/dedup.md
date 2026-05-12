# Critique — gemini-nano-m3 — DEDUPED MERGE

**Sources:** adversary
**Counts:** C=0 H=2 M=5 L=5

## Verdict

**SHIP-WITH-FIXES** (aggregated from: SHIP-WITH-FIXES)

## Executive summary

- [HIGH] Eval results blank; parse rate and false-positive rate unverified
- [HIGH] Auto-HIGH: diff > 700 LOC
- [MEDIUM] AC5 disambiguation not implemented (silent re-scope)
- [MEDIUM] Undo timer not cancelled on `clear()` or component unmount
- [MEDIUM] `undo()` removes message before `update()` resolves; no error recovery
- [MEDIUM] GanttTask `tagIds` accepted by schema but silently dropped without user notice
- [MEDIUM] Undo concurrency: `undo()` can race with in-flight `send()`
- [LOW] System prompt includes user-controlled content without sanitization (low-risk prompt injection)

## Findings

### CRITICAL

### HIGH

#### [HIGH] H1 — Eval results blank; parse rate and false-positive rate unverified

- **File:** 
- **Line:** 
- **Anchor:** 
- **What:** 
- **Why it matters:** 
- **Proposed fix:** 
- **Source critic:** adversary
- **Original id:** H1

#### [HIGH] H2 — Auto-HIGH: diff > 700 LOC

- **File:** 
- **Line:** 
- **Anchor:** 
- **What:** 
- **Why it matters:** 
- **Proposed fix:** 
- **Source critic:** adversary
- **Original id:** H2

### MEDIUM

#### [MEDIUM] M1 — AC5 disambiguation not implemented (silent re-scope)

- **File:** 
- **Line:** 
- **Anchor:** 
- **What:** 
- **Why it matters:** 
- **Proposed fix:** 
- **Source critic:** adversary
- **Original id:** M1

#### [MEDIUM] M2 — Undo timer not cancelled on `clear()` or component unmount

- **File:** 
- **Line:** 
- **Anchor:** 
- **What:** 
- **Why it matters:** 
- **Proposed fix:** 
- **Source critic:** adversary
- **Original id:** M2

#### [MEDIUM] M3 — `undo()` removes message before `update()` resolves; no error recovery

- **File:** 
- **Line:** 
- **Anchor:** 
- **What:** 
- **Why it matters:** 
- **Proposed fix:** 
- **Source critic:** adversary
- **Original id:** M3

#### [MEDIUM] M4 — GanttTask `tagIds` accepted by schema but silently dropped without user notice

- **File:** 
- **Line:** 
- **Anchor:** 
- **What:** 
- **Why it matters:** 
- **Proposed fix:** 
- **Source critic:** adversary
- **Original id:** M4

#### [MEDIUM] M5 — Undo concurrency: `undo()` can race with in-flight `send()`

- **File:** 
- **Line:** 
- **Anchor:** 
- **What:** 
- **Why it matters:** 
- **Proposed fix:** 
- **Source critic:** adversary
- **Original id:** M5

### LOW

#### [LOW] L1 — System prompt includes user-controlled content without sanitization (low-risk prompt injection)

- **File:** 
- **Line:** 
- **Anchor:** 
- **What:** 
- **Why it matters:** 
- **Proposed fix:** 
- **Source critic:** adversary
- **Original id:** L1

#### [LOW] L2 — Orphaned system-notice after undo (tag-drop notice outlives the undone action)

- **File:** 
- **Line:** 
- **Anchor:** 
- **What:** 
- **Why it matters:** 
- **Proposed fix:** 
- **Source critic:** adversary
- **Original id:** L2

#### [LOW] L3 — Stale system-prompt context has no in-session visual indicator

- **File:** 
- **Line:** 
- **Anchor:** 
- **What:** 
- **Why it matters:** 
- **Proposed fix:** 
- **Source critic:** adversary
- **Original id:** L3

#### [LOW] L4 — Module-level `nextId` counter shared across all hook instances

- **File:** 
- **Line:** 
- **Anchor:** 
- **What:** 
- **Why it matters:** 
- **Proposed fix:** 
- **Source critic:** adversary
- **Original id:** L4

#### [LOW] L5 — Empty `text` on `chat` response renders a blank assistant message

- **File:** 
- **Line:** 
- **Anchor:** 
- **What:** 
- **Why it matters:** 
- **Proposed fix:** 
- **Source critic:** adversary
- **Original id:** L5

## What was done well

  - **Schema strategy is correct and well-documented.** The flat-object + `pattern` discriminator approach is the right call given that `oneOf`/`enum` support is unconfirmed. The decision is clearly explained in `tools.ts:1-16`, the eval template, and the research synthesis.  _(adversary)_
  - **No external writes, no fetch, no new permissions.** `grep -rn "fetch\|XMLHttpRequest" src/` returns zero hits. All inference is on-device, all writes are `chrome.storage.local`. SECURITY.md compliance is perfect.  _(adversary)_
  - **TypeScript strict compliance.** The build passes cleanly under `strict: true`, `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`. No `any` types, no `@ts-ignore`, no escape hatches. The `as Record<string, unknown>` assertions in `parseToolCall` are narrowing after a proper runtime check, not unsound.  _(adversary)_
  - **`applyToolCall` validation is thorough.** `chartId` is validated against `state.ganttCharts` before writing. `fireAt` is validated as future-only. Unknown `tagIds` are filtered, not rejected. Each validation failure emits a specific, actionable system-notice to the user.  _(adversary)_
  - **Pre-snapshot is captured before `update()` runs.** `const preSnapshot = stateRef.current` (line 200) is captured before `await update(() => result.newState)` (line 223). The snapshot correctly reflects pre-mutation state and is used faithfully for rollback.  _(adversary)_
  - **Multiple concurrent Undo tokens are correctly isolated.** Each tool call generates its own `undoToken` via `uid()`, stored in the message's `payload`. `undo()` looks up by token, not by position, so multiple pending undos coexist without interference.  _(adversary)_
  - **`ToolResultCard` timer is properly cleaned up on unmount.** The `useEffect` in `ChatMessage.tsx:79-87` returns `() => clearTimeout(t)`, preventing setState-after-unmount on the component-level expiry timer.  _(adversary)_
  - **`stateRef` pattern avoids dependency-array churn.** Mirroring `state` in `stateRef` and reading at call time keeps `ensureSession` and `send` callbacks stable, avoiding unnecessary session recreation on every state change.  _(adversary)_
  - **Tag-creation guard is solid.** Zero code paths in `tools.ts` or `useChatSession.ts` add to `state.tags`. The schema allows `tagIds` to reference existing tags only; `resolveTagIds` enforces this by filtering against the known set.  _(adversary)_
  - **Eval template is high quality.** The 20 prompts are realistic (not contrived), the expected types and field verifications are specific, the schema-discrimination decision is documented with an upgrade path, and the "run manually post-merge" instruction is unambiguous. This is a solid eval methodology even in template form.  _(adversary)_

## Recommended rectification order

H1, H2, M1, M2, M3, M4, M5, L1, L2, L3, L4, L5
