# Rectify summary — gemini-nano-m3

## Findings status

- **H1** — Eval result cells blank in `plans/gemini-nano-eval-snapshot.md`; parse-rate ≥ 90% and false-positive ≤ 5% are unverified at merge. **DEFERRED.** The synthesis explicitly scoped the 20-prompt eval as a maintainer-run task post-merge (it requires real Chrome + a downloaded Nano model). Already recorded under `external_writes_required`. Closing the milestone with this finding still open is the documented policy.
- **H2** — Auto-HIGH for diff > 700 LOC. **REFRAMED.** The critic's own analysis demoted this from auto-HIGH to "documented HIGH" because the per-file breakdown is justified (513 LOC for the new `tools.ts` feature module + 140 LOC for the eval template account for the bulk; no padding). No code change needed.
- **M1** — AC5 disambiguation: accompanying prose alongside a tool call was silently dropped. **FIXED.** `parseToolCall` now extracts `obj["text"]` as `accompanyingText` for non-chat kinds; the chat hook appends a sibling assistant message when present.
- **M2** — Undo-expiry `setTimeout`s never cancelled. **FIXED.** Added `undoTimersRef: Set<TimerId>`; every scheduled timer is recorded; `clear()` and the unmount cleanup `useEffect` walk and `clearTimeout()` the set; timers self-remove from the set when they fire.
- **M3** — `undo()` removed the message before `update()` resolved; storage rejection would leave the user with no Undo and no rollback. **FIXED.** Restructured `undo()` to `await update()` FIRST, only filter the message out of state on resolve, and emit a `system-notice` ("Undo failed — could not restore previous state. The action was not reverted.") on reject.
- **M4** — `tagIds` on the Gantt-task schema was silently dropped by `applyToolCall`. **FIXED.** Removed `tagIds` from the schema, the parser branch, and the `ToolCallAddGanttTask` type. System prompt no longer mentions tags for tasks. Comments explain that the field can be added back when the GanttTask type gains a `tags` slot.
- **M5** — `undo()` could race with an in-flight `send()`. **FIXED.** Added `if (generating) return;` guard at the top of `undo()`, mirroring the guard already in `send()`.

## Deferred findings

- **L1** — System-prompt content includes user-controlled tag labels / chart names. SECURITY.md §1 scopes self-attack out; risk is minimal. Future work: escape newlines in user-provided strings if tags/charts ever accept untrusted input.
- **L2** — Orphaned tag-drop system-notice after an undo. Cosmetic. Worth doing alongside a future undo-grouping pass; not cheap here without restructuring the message id model.
- **L3** — Stale system-prompt context (tag/chart list baked at session create). UX polish; "Clear chat to refresh" hint can land in a follow-on.
- **L4** — Module-level `nextId` counter. Same as gemini-nano-m2 L1; dev-mode-only cosmetic.
- **L5** — Empty `text` on a chat response renders a blank assistant message. Edge case; cleanly handleable as part of a future general "trim empty assistant messages" pass.

## Invalidated findings

None. All seven CRITICAL/HIGH/MEDIUM findings re-verified against `43560d8` before fixing.

## Regression tests added

None — no test framework in the project (verified across prior milestones). The verification bar is `npm run build` (strict TS + Vite production bundle), which passes clean post-rectify. `check-rect-tests.sh` will flag the production-code delta without test deltas; that's the project-specific gap, not a per-milestone problem.

## Re-verification

- `npx tsc -b` clean under `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`.
- `npm run build` clean. Initial newtab chunk unchanged at 195.56 kB. ChatPanel chunk 13.79 → 14.15 kB (+0.36 kB from M1/M2/M3 additions). New tiny `nano-*.js` chunk at 0.78 kB (split out by Vite; functionally part of the chat chunk).
- M1 manual check: `parseToolCall` reads `obj["text"]` once into `topText`, applies to chat (existing path) AND adds `accompanyingText` to the three tool variants when present.
- M2 manual check: every `setTimeout` call goes into the ref; both cleanup paths walk it.
- M3 manual check: `undo()` now awaits `update()` first; the try/catch routes failure to a system-notice without removing the message from history.
- M4 manual check: `grep "tagIds" src/llm/tools.ts` shows tagIds in todo + reminder branches only; gantt branches no longer reference it.
- M5 manual check: `if (generating) return;` at the top of `undo()`; `generating` is in the dep array for the memoized callback.

## Note on external writes

The H1 deferral is recorded in `state.external_writes_required` from the research phase. After this rect commit, the next step for the maintainer is to:
1. Load the built extension unpacked.
2. Run the 20 prompts from `plans/gemini-nano-eval-snapshot.md` through the Nano chat.
3. Fill in the result cells.
4. Commit the eval doc separately.

If the parse-rate falls below 90% or the false-positive rate exceeds 5%, iterate on the system prompt wording in `src/llm/tools.ts:185-225` before declaring m3 fully closed.
