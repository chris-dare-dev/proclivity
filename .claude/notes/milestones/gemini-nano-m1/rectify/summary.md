# Rectify summary — gemini-nano-m1

## Findings status

- **H1** — `ProgressEvent.loaded` is bytes, not 0–1. **FIXED.** `SettingsModal.tsx` `runTestPrompt`'s monitor handler now computes `e.total > 0 ? Math.min(e.loaded / e.total, 1) : null` and stores that as `downloadProgress`. The badge's `Math.round(progress * 100)` is unchanged but now receives a real 0–1 fraction. The stale "0.0–1.0 on `e.loaded`" claim in `nano.ts`'s `monitor` JSDoc was corrected to describe the actual contract (bytes loaded / total).
- **M1** — Race: `abortRef.current` could be null between `createSession` resolving and `session.prompt` reading `.signal`. **FIXED.** Capture the signal into a local `const signal = controller.signal` before the first await; pass that local to both `nanoCreateSession({ signal })` and `session.prompt(text, { signal })`. The `abortRef` is still set so the close-effect can call `.abort()`, but the await sites no longer dereference `abortRef.current` directly. A late `abortRef.current = null` from the close-effect now aborts the signal cleanly via the controller it still references.
- **M2** — `CreateSessionOpts.initialPrompts` narrowed away the system-message-first overload. **FIXED.** Widened to `[LanguageModelSystemMessage, ...LanguageModelMessage[]] | LanguageModelMessage[]`, matching the SDK's `LanguageModelCreateOptions.initialPrompts` shape exactly. `gemini-nano-m3` can now pass a system-prompt-seeded tuple through the public wrapper without a TS cast.

## Deferred findings

- **M3** — Extract `NanoStatusBlock` / `NanoState` / `NanoBadge` into `src/components/NanoSettings.tsx`. **DEFERRED to gemini-nano-m2.** Rationale: this is a ~150-LOC mechanical move (above the ≤30-LOC cheap-fix threshold in the Phase-4 rectify rule), and m2's chat-panel work touches `SettingsModal` again — the extraction is a more natural fit there.
- **L1** — Commit subject 14 chars over the 50-char limit. **DEFERRED.** Rewording the parent commit would require an amend-and-rewrite, which violates CLAUDE.md's no-rewriting-pushed-commits rule. Future commits should observe the cap.
- **L2** — `params()` JSDoc reference. **REFRAMED** — the JSDoc text touched by H1's correction is precise enough; the unrelated `params()` reference is contained in a one-line `temperature` JSDoc that's accurate ("defaults to whatever `params()` reports" is true for users who call the global directly). Leaving as-is.
- **L3** — `SECURITY.md` PII wording imprecise post-m1. **DEFERRED.** The next time SECURITY.md is touched (likely in `gemini-nano-m2` when the chat panel ships and user input is genuinely "processed by Nano"), this paragraph should be rewritten then. The current wording is accurate for the m1 state (no chat surface yet — the only Nano-processed text is the hardcoded "Say hi in 5 words." prompt).

## Invalidated findings

None. All four CRITICAL/HIGH/MEDIUM findings re-verified against the committed code before fixing.

## Regression tests added

None. The project has no test framework configured (verified by brief-1 §3). The verification bar is `npm run build` (strict TS + Vite production bundle), which passes clean post-rectify. The `check-rect-tests.sh` script will flag production-code-without-test-deltas — this is expected for proclivity and is a project-specific gap noted across previous milestones (gemini-m1 rectify, etc.). The script's exemption path is for doc-only commits; this rectify is production-code.

## Re-verification

- `npx tsc -b` exits 0 with strict + exactOptionalPropertyTypes + noUncheckedIndexedAccess.
- `git diff --stat HEAD` for the rect: 2 files, +30 / −9 LOC.
- H1 fix verified by inspection: `downloadProgress` is now a 0–1 fraction or null.
- M1 fix verified by inspection: both `nanoCreateSession({ signal })` and `session.prompt(text, { signal })` use the captured local, not `abortRef.current.signal`.
- M2 fix verified by inspection: the union type lines up with `@types/dom-chromium-ai@0.0.16`'s `LanguageModelCreateOptions.initialPrompts`.

## Note on working-tree state

There are substantial uncommitted parallel changes in the working tree at rect time — `src/styles/theme.css` (new), `src/hooks/` (new directory), `src/storage/exportImport.ts` (new), and modifications to `src/types/index.ts`, `src/storage/constants.ts`, `src/components/Modal.tsx`, `src/components/MeshBackground.tsx`, `src/newtab/main.tsx`, `src/newtab/index.css`, `src/newtab/App.tsx`, and `src/background/service-worker.ts`. These are a Settings-v2 layer (much-expanded `UserSettings` with theme/density/fontSize/mesh*/timeFormat/sectionVisibility/quietHours fields, plus a `ResolvedUserSettings` companion type and a `resolvedSettings()` helper). The rect commit explicitly excludes them via per-file `git add` — they belong in a separate commit cycle the user (or a follow-on milestone) will handle.
