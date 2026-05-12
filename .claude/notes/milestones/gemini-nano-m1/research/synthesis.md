# gemini-nano-m1 — research synthesis

Both briefs validate; both reported 0 injection attempts.

## Affected files

- `src/llm/nano.ts` (new) — Prompt API wrapper: availability(), params(), createSession(), prompt(), promptStructured<T>().
- `src/components/SettingsModal.tsx` (modify) — new "Gemini Nano" section with live availability state + Test Prompt button.
- `src/components/SettingsModal.css` (modify) — styles for status badge + response display.
- `package.json` (modify) — add `@types/dom-chromium-ai` to devDependencies.

## Acceptance criteria (≤7, deduped)

1. `src/llm/nano.ts` exists with `availability()`, `createSession(opts?)`, `prompt(text, opts?)`, `promptStructured<T>(text, schema, opts?)`, compiling under strict TS with `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`.
2. Global `LanguageModel` typed via `@types/dom-chromium-ai` (officially recommended by Chrome docs) installed as devDependency; verified to cover the 2026 API surface before preferring it over hand-written declarations.
3. `SettingsModal` calls `LanguageModel.availability()` on each modal open and renders a badge: `ready` / `downloading…` / `downloadable (~4 GB)` / `unavailable`. The unavailable variant links to `chrome://flags/#prompt-api-for-gemini-nano`.
4. "Test prompt" button visible when state ∈ {available, downloadable}. Clicking runs `session.prompt("Say hi in 5 words")` and renders the response inline. If state was "downloadable", `create()` is called inside the click handler (satisfies sticky activation) and a download-progress indicator is shown via the `monitor` callback.
5. Session lifecycle: create on first prompt; destroy on modal close (cleanup in `useEffect` return).
6. `promptStructured<T>()` exported and compiles; it need not be exercised by the m1 UI, but is the foundation for m3.
7. `npm run build` passes; initial newtab chunk grows by < 5 kB. Zero new runtime dependencies.

## external_writes_required

```yaml
external_writes_required: []
```

The implementation is keyless and Cloud-free. No external writes pending closing the milestone.

## Open questions

1. **`responseConstraint` schema features**: `enum`/`oneOf`/`anyOf` not confirmed in the 2026 docs. For m1, `promptStructured<T>` just needs to compile and accept arbitrary JSON-schema-shaped objects — m3 will test schema features empirically. m1 is safe.
2. **Test prompt content**: `"Say hi in 5 words"` is a quick check. Some teams use `"Say hello"` or just `"hi"`. Keep the 5-words version for deterministic short output.
3. **Where to declare the global type**: `@types/dom-chromium-ai` is the preferred path. Inline `declare global` is the fallback if the package's coverage is stale. The implementer must verify the package version covers `availability()` returning the 2026 string union (`"available"|"downloadable"|"downloading"|"unavailable"`), not the older `"readily"|"after-download"`.

## Notes from external research

- `responseConstraint` is **camelCase** (Chrome Prompt API) vs `response_schema` snake_case (Cloud Gemini API). Don't conflate.
- `create()` blocks until download completes; use the `monitor: (m) => m.addEventListener("downloadprogress", ...)` pattern for progress UI.
- Sticky user activation: the Test Prompt button click satisfies it for `create()` when state is downloadable.
- No manifest changes needed for the Prompt API (`aiLanguageModelOriginTrial` permission deprecated in Chrome 138+).
