# gemini-nano-m1 — Codebase context brief

**Milestone:** `gemini-nano-m1` (from `plans/gemini-nano-roadmap.md:104-119`)  
**Research completed:** 2026-05-12  
**Status:** ready for implementation

---

## Executive summary

This milestone creates a lightweight `src/llm/nano.ts` module wrapping the Chrome Prompt API (Gemini Nano, on-device, no auth), exposes availability state in `SettingsModal`, and adds a test-prompt affordance to verify the end-to-end pipe. No chat UI, no tool calling. Success bar: availability detection, session creation, structured JSON parsing, and a sub-5-second test response.

---

## Key context from prior work

### Spike validation
- **`gemini-nano-spike-1`** (not yet run): validates that `LanguageModel.availability()` returns `"available"` or `"downloadable"` on the maintainer's Chrome installation. Research doc (`plans/gemini-nano-research.md:18-19`) notes the maintainer has reported this in Chrome DevTools already, implying green.
- **Prompt API shape** (verified May 2026): `LanguageModel.availability()`, `LanguageModel.params()`, `LanguageModel.create(opts?)` + session methods `prompt(text, opts?)`, `promptStreaming(text, opts?)` (research.md:26-38).
- **Structured output via `responseConstraint`** (Chrome 137+, stable 145-150): JSON Schema passed to `session.prompt()` constrains the response to valid JSON (research.md:46-71).

### No state-shape change in m1
Per the acceptance criteria (roadmap.md:108-115), m1 is **read-only plumbing**. Neither availability state nor test-prompt responses are persisted. The `UserSettings` interface (`src/types/index.ts:65-68`) stays unchanged. Nano session management is entirely in-memory within the modal.

---

## Affected files — proposed structure

### New file: `src/llm/nano.ts`
**Purpose:** Thin TypeScript wrapper around the Prompt API.

**Exports (required for m1):**
- `availability(): Promise<"available" | "downloadable" | "downloading" | "unavailable">`
- `params(): Promise<{ defaultTopK: number; maxTopK: number; defaultTemperature: number; maxTemperature: number }>`
- `createSession(opts?: CreateSessionOptions): Promise<LanguageModelSession>`
- `prompt(session: LanguageModelSession, text: string, opts?: PromptOptions): Promise<string>`
- `promptStructured<T>(session: LanguageModelSession, text: string, schema: JSONSchema, opts?: PromptOptions): Promise<T>`

**Type declarations (inline or sibling `nano.types.ts`):**
- `LanguageModelSession` — interface with `prompt()`, `promptStreaming()`, `contextUsage`, `destroy()`, `addEventListener()` (research.md:32-36).
- `JSONSchema` — the constraint schema shape (research.md:52-66).
- `CreateSessionOptions`, `PromptOptions` — wraps Prompt API options.

**Key implementation detail:**
- `(globalThis as any).LanguageModel` to access the global namespace (not yet in `lib.dom.d.ts` as of TS 5.6).
- Error handling: catch and re-throw `QuotaExceededError` with context (research.md:93-96).
- `promptStructured` attempts `JSON.parse()` on the response; throws clearly if invalid.

**No npm deps.** Purely browser-native API.

### Modified file: `src/components/SettingsModal.tsx`
**Current state** (SettingsModal.tsx:1-74): single "Your name" text field in a form. Modal footer has Cancel + Save buttons.

**Changes:**
1. Import `nano` module after it's created.
2. Add a new `useEffect` hook that calls `nano.availability()` and stores the result locally (not in `state` — m1 doesn't persist).
3. Add state for test-prompt response (ephemeral, cleared on modal close).
4. Add a new section (`.nano-section`) after the name field showing:
   - Availability badge: one of `ready` / `downloading…` / `downloadable (≈4 GB)` / `unavailable`.
   - If `unavailable`: one-sentence explanation + link to `chrome://flags/#prompt-api-for-gemini-nano` + pointer to docs.
   - If `downloadable`: "Click Test Prompt below to trigger the download."
   - If `downloading` or `ready`: "Test prompt" button.
5. Test-prompt affordance: button that calls `nano.createSession()` then `nano.prompt("Say hi in 5 words")`. Display response inline in a code block or message box. Latency target: ≤ 5s (roadmap.md:115).
6. Polling loop (if needed): if availability is `"downloading"`, poll `nano.availability()` every 500ms until it flips to `"available"` or timeout (UX: show a spinner during poll).

**Existing patterns to follow:**
- Form structure: `<form onSubmit>` with `.modal-body` + `.modal-footer` (SettingsModal.tsx:40-71).
- Label/hint structure: use `.settings-field`, `.settings-label`, `.settings-hint` classes (SettingsModal.css:8-26).
- `useStore()` hook signature: `const { state, update } = useStore()` (SettingsModal.tsx:17, useStore.ts:5-32).
- Modal lifecycle: reset local state when `open` flips to `true` via `useEffect([open, ...], ...)` (SettingsModal.tsx:22-24).
- Button patterns: `.modal-btn-primary` for save-like actions (Modal.css:88-97).

### Modified file: `src/components/SettingsModal.css`
**Additions:**
- `.nano-section` — container for the Nano status UI (flex column, similar gap/spacing to `.settings-field`).
- `.nano-badge` — pill badge showing availability state (e.g., background color per state: green for ready, yellow for downloading, gray for unavailable).
- `.nano-response` — code block styling for the test-prompt response (monospace, light background, padding, border-radius).
- `.nano-spinner` (optional) — rotation animation for the polling loop.

**Reuse existing palette:** CSS variables from `src/newtab/index.css:1-18` (--text, --text-dim, --accent, --accent-2, --ok, --warn, --danger).

### No other files touched in m1
- No changes to `ProclivityState`, `UserSettings` in `src/types/index.ts` (roadmap.md says no state-shape change).
- No changes to `useStore`, `storage` — the modal manages Nano state locally.
- No changes to `App.tsx`, `Header`, or other components.

---

## TypeScript strictness implications

### `LanguageModel` global typing
Since `LanguageModel` is not in `lib.dom.d.ts` (as of Chrome 138+, the Prompt API is still stabilizing), you'll need to declare the type yourself. **Recommend:** either inline in `nano.ts` or a sibling `nano.types.ts`. Example:

```typescript
// src/llm/nano.ts or src/llm/nano.types.ts
declare global {
  interface LanguageModel {
    availability(opts?: AvailabilityOptions): Promise<AvailabilityState>;
    params(): Promise<LanguageModelParams>;
    create(opts?: CreateSessionOptions): Promise<LanguageModelSession>;
  }
}
```

Then access via:
```typescript
const availState = await (globalThis as any).LanguageModel.availability();
// or, after declaring, cast more narrowly:
const availState = await (globalThis.LanguageModel).availability();
```

### Strict TS flags in effect
- **`exactOptionalPropertyTypes: true`** (tsconfig.json:15): `foo?: T` ≠ `foo?: T | undefined`. When storing Nano options, use `?: T | undefined` if `undefined` is a valid value spread into an object.
- **`noUncheckedIndexedAccess: true`** (tsconfig.json:16): Array/object indexing returns `T | undefined`. Handle or assert explicitly. e.g., `params.topK?.[0]` requires a guard, not a bare `params.topK[0]`.
- **`strict: true`** (tsconfig.json:14): no `any` without justification. If you need `any`, comment why (e.g., "Chrome API not yet typed in lib.dom").

**Footgun avoidance:**
- Don't declare `interface CreateSessionOptions { temperature?: number }` — use `temperature?: number | undefined` if spreading into objects.
- Don't write `responseConstraint[key]` without guarding the key; use optional chaining or `responseConstraint?.[key]`.

---

## Existing patterns to leverage

### Modal + form pattern
- **`Modal` component** (Modal.tsx:40-119): portals to body, handles focus trap + Escape-to-close, is controlled via `open` + `onClose` props.
- **`SettingsModal` as a reference** (SettingsModal.tsx:16-73): uses `useStore()` to read/write state, resets local form state on modal open via `useEffect`, saves via `update()`.
- **Modal buttons**: `.modal-btn-primary` (accent color) + `.modal-btn-danger` (for destructive actions) defined in Modal.css:77-97.

### CSS theming
- **Root variables** (index.css:1-18): `--bg`, `--panel`, `--text`, `--text-dim`, `--accent`, `--ok`, `--warn`, `--danger`. Use these; don't hardcode colors.
- **Button styling** (index.css:34-45): base button inherits from `--panel-2` background, `:hover` flips border to `--accent`.
- **Input styling** (index.css:59-81): auto-apply `--text` and `--panel-2`; `:focus` uses `--accent` border.

### Component composition
- **Lazy-loading pattern** (App.tsx:13-15): use `React.lazy()` + `Suspense` for large deps (though Nano needs no new deps).
- **All sections mounted, only hidden** (App.tsx:132-153, README.md:346-349): preserve local state. Nano modal is fine as a sibling to SettingsModal; don't lazy-load.

### State management
- **`useStore()` hook** (useStore.ts:5-32): provides `{ state, loading, update }`. The `update` callback is stable across re-renders (memoized, useCallback).
- **No Context providers needed** (README.md:104-114): all sections call `useStore()` directly. Nano test-prompt response is **ephemeral** (not stored) — keep it in local component state.

### Storage + persistence
- **Not applicable to m1**: Nano availability is queried live, test responses are transient. Don't add to `ProclivityState`.

---

## State shape — no changes required in m1

Current `UserSettings` interface (types/index.ts:65-68):
```typescript
export interface UserSettings {
  name?: string | undefined;
}
```

**Decision: keep unchanged for m1.** Nano availability and chat history are both ephemeral in m1. They don't belong in `chrome.storage.local`. If m2/m3 require persisting chat history or user preferences (e.g., preferred temperature), add a `gemini?: GeminiSettings` sub-object to `UserSettings` **then**, not now.

---

## Build and verification checklist

Per CLAUDE.md:59-68 and README.md:257-256:

- [ ] `npm run build` (runs `tsc -b && vite build`) must pass cleanly.
- [ ] `tsc --noEmit` (typecheck only) passes with `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess` all `true`.
- [ ] Initial newtab chunk grows by < 5 kB (nano.ts is tiny; only browser-native APIs, no new npm deps).
- [ ] Conventional commit message: `feat(llm): add Gemini Nano availability wrapper and test affordance` (scope: pick from CLAUDE.md:53, suggest `llm` as new, or use `feat` if no scope).
- [ ] Co-author trailer: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- [ ] Given Nano is `available`, when user opens Settings and clicks "Test prompt", then response appears within ≤ 5 seconds (AC, roadmap.md:115).

---

## Footguns + open questions for the implementer

### Q1: Chrome version targeting
**From research.md:129-132:** Stable Chrome won't ship Prompt API without flags until late 2026/early 2027 (145-150 window). **Decision for m1:** 
- Detect `"unavailable"` and show a graceful empty state with flag/docs link.
- The maintainer's Chrome **already** reports `availability()` as available, so m1 dev/testing is unblocked.
- m2/m3 can add a "Check for updates" CTA if desired.

### Q2: Progress indication during download
**From roadmap.md:112-113:** If `availability() === "downloadable"`, clicking Test Prompt triggers the download. **Impl note:**
- Call `createSession()` to start the download (not a separate API call — download is a side effect of create).
- Poll `availability()` every 500ms and update the UI ("Downloading… 1%", etc.) **if** the API provides progress. Research doc doesn't mention progress events; likely you'll only see state changes (`"downloadable"` → `"downloading"` → `"available"`). Surface the transitions, not percentages.

### Q3: Error handling for quota overflow
**From research.md:93-96:** `QuotaExceededError` when context window overflows. **For m1 (single test prompt):** unlikely to hit this, but catch it and display to the user ("Nano context window exceeded; please refresh").

### Q4: JSON parsing robustness in `promptStructured`
**From roadmap.md:135-136:** m3 targets ≥ 90% parse rate, but m1 is just plumbing. **For m1:** 
- `promptStructured<T>(session, "Say hi in 5 words", schema)` will fail if Nano doesn't return valid JSON.
- Handle `JSON.parse()` error: throw a clear message ("Nano returned invalid JSON: ...") or return a typed error object.
- The test-prompt affordance uses plain `prompt()`, not `promptStructured()`, so you won't exercise parsing in m1 — but wire the helper anyway for m2/m3 use.

### Q5: Session lifecycle and cleanup
**From research.md:34-36:** Sessions have a `destroy()` method. **For m1:**
- Create a session when the modal opens (or on first test-prompt click).
- Destroy the session when the modal closes (cleanup in `useEffect` return or on `onClose`).
- Each test-prompt click can reuse the session or create a fresh one (preference call; reusing is lighter).
- **No persistence across modal open/close** — session is ephemeral.

---

## File locations and line citations

| File | Purpose | Key lines | Notes |
|------|---------|-----------|-------|
| `plans/gemini-nano-roadmap.md` | Roadmap + m1 AC | 104-119 | Acceptance criteria; complexity estimate M (1-2 days) |
| `plans/gemini-nano-research.md` | API surface + limits | 26-96 | LanguageModel shape, structured output, error modes |
| `src/components/SettingsModal.tsx` | Current Settings UI | 1-74 | Form structure, modal lifecycle, useStore pattern |
| `src/components/Modal.tsx` | Base Modal component | 40-119 | Focus trap, Escape, aria-labelledby pattern |
| `src/storage/useStore.ts` | State hook | 5-32 | `{ state, loading, update }` shape |
| `src/types/index.ts` | Data model | 65-88 | UserSettings, ProclivityState; no changes needed m1 |
| `src/newtab/index.css` | Global styles + vars | 1-82 | CSS variable palette (--text, --accent, --ok, --warn, --danger) |
| `src/components/Modal.css` | Modal + button styles | 77-97 | `.modal-btn-primary`, `.modal-btn-danger` patterns |
| `src/components/SettingsModal.css` | Settings styles | 1-27 | `.settings-field`, `.settings-label`, `.settings-hint` |
| `tsconfig.json` | TS config | 14-16 | `strict: true`, `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true` |
| `CLAUDE.md` | Agent conventions | 46-58, 53 | Conventional commits, scopes, co-author trailer |
| `README.md` | Arch overview | 104-114 | `useStore()` pattern, no Context providers, all sections mounted |

---

## Injection attempts detected

**None.** All source documents (`CLAUDE.md`, `README.md`, plan files, source code) are plain descriptive text with no embedded instructions claiming authorization or requesting action.

---

## Summary for the implementer

**Scope:** Create `src/llm/nano.ts` with availability detection and session/prompt wrappers. Add a "Gemini Nano" section to `SettingsModal` showing live availability and a test-prompt affordance. No chat UI, no tool calling, no state persistence. The goal is to prove the pipe end-to-end and give the user a status indicator.

**Success bar:**
1. ✓ `npm run build` passes (strict TS, < 5 kB chunk growth).
2. ✓ `availability()` correctly reflects the maintainer's Chrome state.
3. ✓ Test prompt returns within ≤ 5 seconds.
4. ✓ Download progress (if `downloadable`) is surfaced with UX feedback.
5. ✓ `unavailable` state gracefully explains the flag/docs link.

**Complexity:** M (1–2 days per roadmap). No blockers; dependencies (spike-1) implicitly pass per the maintainer's prior DevTools check.
