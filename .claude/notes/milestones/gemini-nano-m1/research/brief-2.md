# gemini-nano-m1 — External Research Brief

**Milestone:** `gemini-nano-m1` (Plumbing + availability surface)
**Research date:** 2026-05-11
**Researcher role:** external-research + external-writes

---

## 1. External sources consulted

| # | URL | URL-SHA256 (first 16 hex chars) | Takeaway |
|---|-----|---------------------------------|----------|
| 1 | https://developer.chrome.com/docs/ai/prompt-api | `30616e1d8eef6c80` | Canonical Prompt API reference: exact method signatures, `availability()` return values (`"available"/"downloadable"/"downloading"/"unavailable"`), download monitor pattern, `contextoverflow` event, `destroy()` semantics. |
| 2 | https://github.com/explainers-by-googlers/prompt-api/blob/main/README.md | `c4703f3f0befab58` | WICG explainer — full `LanguageModel` + session interface, `QuotaExceededError` with `requested` + `contextWindow` props, `monitor` callback for progress events, `LanguageModelStatic` shape. No `@types` package mentioned. |
| 3 | https://developer.chrome.com/docs/ai/structured-output-for-prompt-api | `e3fcd9888fc53adf` | `responseConstraint` is **camelCase** (not snake_case); accepts JSON Schema or `RegExp`; supported keywords confirmed: `type`, `properties`, `required`, `additionalProperties`, `array`, `items`, `maxItems`, `pattern`, `boolean`; **`enum`/`oneOf`/`anyOf`/`allOf`/$ref not confirmed** as supported. Available Chrome 137+. |
| 4 | https://developer.chrome.com/docs/ai/built-in-apis | `29782c9773c4164e` | Official `@types/dom-chromium-ai` npm package explicitly recommended for TypeScript typings; API in Chrome Extensions from Chrome 138, web from Chrome 148. |
| 5 | https://developer.chrome.com/docs/ai/get-started#user-activation | `2c2d6a00d664ad1c` | When `availability() === "downloadable"`, `create()` requires **sticky activation** (user must have meaningfully interacted since page load); exact error on violation not documented. |
| 6 | https://caniuse.com/mdn-api_languagemodel | `ad39aebad8cb099c` | `LanguageModel` API supported Chrome 148+ on web (0.03% global usage as of March 2026); Chrome Extensions have access from 138 via flag. |

---

## 2. external_writes_required

```yaml
external_writes_required: []
# Rationale: The Prompt API is keyless, on-device, and requires no API keys,
# no server endpoints, no auth tokens, and no manifest permission changes for
# Chrome Extensions. The only "external" action a user might need is enabling
# chrome://flags/#prompt-api-for-gemini-nano on Chrome < 148, but:
#   (a) the maintainer's install already reports availability() === "available"
#   (b) the UI will surface a graceful fallback with the flag link when unavailable
# No writes to external services, APIs, or stores are made by the implementation.
```

---

## 3. Riskiest assumption + alternative

### Riskiest assumption

**`responseConstraint` supports `object`, `array`, and `enum` JSON Schema features across Chrome 138–150.**

The official docs only demonstrate `boolean` and object-with-array schemas in code examples. The structured-output page confirms `type`, `properties`, `required`, `items`, `maxItems`, and `pattern` — but **`enum`, `oneOf`, `anyOf`, and `$ref` are not confirmed**. Gemini Nano's on-device inference engine uses a constrained decoding layer that may only support a subset of JSON Schema. If the implementer writes `promptStructured<T>()` using `enum` or `oneOf` in schemas and Nano silently ignores or mishandles these keywords, m2/m3 structured outputs will fail non-deterministically (the model will produce syntactically valid JSON that doesn't match the schema semantics).

This is riskier than the Chrome version stability concern because: the Chrome 138 flag path already works for the maintainer, but the schema coverage gap would only surface when m2/m3 add richer schemas — and at that point the root cause would be obscure.

### Alternative implementation path

**Constrain `promptStructured<T>()` to a "safe subset" schema type and add a schema validator guard.**

Rather than accepting arbitrary `JSONSchema` as the constraint, define a `NanoSchema` type that only permits the confirmed-safe keywords (`type: "object" | "array" | "string" | "number" | "boolean"`, `properties`, `required`, `items`, `maxItems`, `pattern`, `additionalProperties`). Any attempt to pass `enum`, `oneOf`, or `$ref` raises a `TypeError` at call time rather than silently failing at inference time. Document the restriction clearly in JSDoc. This confines the risk surface and makes schema failures loud and early, even if it limits expressiveness. When Nano's schema coverage is officially documented (expected with Chrome 150 release notes), the type can be widened.

---

## 4. Acceptance criteria the implementer must meet

1. **`src/llm/nano.ts` compiles cleanly** under `strict: true`, `exactOptionalPropertyTypes: true`, and `noUncheckedIndexedAccess: true` with zero `any` usages that lack a `// TS: Chrome API not yet in lib.dom` comment.

2. **Global `LanguageModel` is typed locally** — either inline in `nano.ts` or in a sibling `src/llm/nano.types.ts` — using a `declare global` block or module-augmentation; `@types/dom-chromium-ai` is installed as a `devDependency` (zero runtime bytes) and referenced in `tsconfig.json` `types` or `lib` if it provides the typings, OR the implementer documents why the package is not used (e.g., version incompatibility).

3. **`SettingsModal` reflects live availability** — `availability()` is called on every modal open (via `useEffect([open], ...)`) and the result drives a badge showing one of: `ready` (green), `downloading…` (yellow + spinner), `downloadable (~4 GB)` (yellow), `unavailable` (grey). The unavailable state includes a sentence pointing to `chrome://flags/#prompt-api-for-gemini-nano`.

4. **Test Prompt button works end-to-end** — clicking it calls `createSession()` then `session.prompt("Say hi in 5 words")`, displays the response inline, and the session is destroyed on modal close (cleanup in `useEffect` return). If `availability()` was `"downloadable"`, `create()` is called only after confirming sticky user activation has occurred (the click itself satisfies this); download progress is surfaced via the `monitor` callback's `downloadprogress` events updating a percentage or spinner.

5. **`promptStructured<T>()` helper exists and parses correctly** — it passes `responseConstraint: schema` to `session.prompt()`, calls `JSON.parse()` on the result, and throws a typed `NanoParseError` (not a bare `Error`) if the result is not valid JSON; m1 need not exercise it in the test prompt UI, but it must compile and be exported.

6. **`QuotaExceededError` and `AbortError` are caught and surfaced to the user** — both in the test-prompt affordance (show an inline error message in the modal) and in the `promptStructured` helper (re-throw as a `NanoQuotaError`). The modal never crashes silently.

7. **`npm run build` passes and the initial newtab chunk grows by < 5 kB** — verified by checking Vite build output; no new `npm` runtime dependencies are added; `@types/dom-chromium-ai` is devDependency only.

---

## 5. Recommended TypeScript declarations

The implementer should either install `@types/dom-chromium-ai` (devDependency, per Chrome docs) or write the following declarations in `src/llm/nano.types.ts`. These reflect the 2026 Prompt API surface as verified above.

```typescript
// src/llm/nano.types.ts
// Chrome Prompt API — not yet in lib.dom.d.ts as of TS 5.6 / Chrome 148.
// Source: https://developer.chrome.com/docs/ai/prompt-api (May 2026)

export type AvailabilityState =
  | "available"
  | "downloadable"
  | "downloading"
  | "unavailable";

export interface LanguageModelParams {
  defaultTopK: number;
  maxTopK: number;
  defaultTemperature: number;
  maxTemperature: number;
}

/** Confirmed-safe JSON Schema subset for Gemini Nano's constrained decoding.
 *  Do NOT add enum, oneOf, anyOf, allOf, $ref — support is unconfirmed as of Chrome 148.
 */
export type NanoSchema =
  | { type: "boolean" }
  | { type: "string"; pattern?: string | undefined }
  | { type: "number" }
  | {
      type: "object";
      properties: Record<string, NanoSchema>;
      required?: string[] | undefined;
      additionalProperties?: boolean | undefined;
    }
  | {
      type: "array";
      items: NanoSchema;
      maxItems?: number | undefined;
    };

export interface AvailabilityOptions {
  expectedInputs?: Array<{ type: "text" | "image" | "audio"; languages?: string[] | undefined }> | undefined;
  expectedOutputs?: Array<{ type: "text"; languages?: string[] | undefined }> | undefined;
}

export interface DownloadMonitor extends EventTarget {
  addEventListener(
    type: "downloadprogress",
    listener: (e: ProgressEvent) => void
  ): void;
}

export interface CreateSessionOptions {
  temperature?: number | undefined;
  topK?: number | undefined;
  signal?: AbortSignal | undefined;
  initialPrompts?: Array<{
    role: "system" | "user" | "assistant";
    content: string;
    prefix?: boolean | undefined;
  }> | undefined;
  monitor?: ((monitor: DownloadMonitor) => void) | undefined;
}

export interface PromptOptions {
  signal?: AbortSignal | undefined;
  responseConstraint?: NanoSchema | RegExp | undefined;
  omitResponseConstraintInput?: boolean | undefined;
}

export interface LanguageModelSession {
  prompt(
    input: string,
    options?: PromptOptions | undefined
  ): Promise<string>;
  promptStreaming(
    input: string,
    options?: Omit<PromptOptions, "responseConstraint"> | undefined
  ): ReadableStream<string>;
  append(messages: Array<{ role: "user" | "assistant"; content: string }>): Promise<void>;
  clone(options?: { signal?: AbortSignal | undefined } | undefined): Promise<LanguageModelSession>;
  measureContextUsage(input: string): Promise<number>;
  destroy(): void;
  readonly contextUsage: number;
  readonly contextWindow: number;
  addEventListener(type: "contextoverflow", listener: EventListener): void;
  removeEventListener(type: "contextoverflow", listener: EventListener): void;
}

export interface LanguageModelStatic {
  availability(options?: AvailabilityOptions | undefined): Promise<AvailabilityState>;
  /** Chrome Extensions only; returns null on web contexts */
  params(): Promise<LanguageModelParams | null>;
  create(options?: CreateSessionOptions | undefined): Promise<LanguageModelSession>;
}

declare global {
  // TS: Chrome Prompt API is not yet in lib.dom.d.ts as of Chrome 148 / TS 5.6.
  // Access via (globalThis as { LanguageModel?: LanguageModelStatic }).LanguageModel
  // to handle gracefully when the API is absent (Firefox, older Chrome, etc.).
  interface Window {
    LanguageModel?: LanguageModelStatic | undefined;
  }
}

/** Typed errors for nano.ts consumers */
export class NanoParseError extends Error {
  readonly raw: string;
  constructor(raw: string, cause?: unknown) {
    super(`Nano returned invalid JSON: ${raw.slice(0, 200)}`);
    this.name = "NanoParseError";
    this.raw = raw;
    if (cause !== undefined) this.cause = cause;
  }
}

export class NanoQuotaError extends Error {
  readonly requested: number;
  readonly contextWindow: number;
  constructor(requested: number, contextWindow: number) {
    super(
      `Nano context window exceeded: requested ${requested} tokens, window is ${contextWindow}`
    );
    this.name = "NanoQuotaError";
    this.requested = requested;
    this.contextWindow = contextWindow;
  }
}
```

### Key implementation notes for the implementer

- **`globalThis.LanguageModel` access pattern:** Use `(globalThis as { LanguageModel?: LanguageModelStatic }).LanguageModel` rather than `(globalThis as any).LanguageModel`. The narrower cast is still an `any`-escape but is less lossy. Add `// TS: Chrome API not yet in lib.dom.d.ts` comment.

- **`availability()` return values confirmed:** `"available"` | `"downloadable"` | `"downloading"` | `"unavailable"` — NOT the old `"readily"` / `"after-download"` naming used in some 2024 docs. The 2026 explainer is authoritative.

- **Download requires sticky activation:** When status is `"downloadable"`, the user must have clicked something since page load. The Test Prompt button click itself satisfies sticky activation, so the implementation can call `create()` directly in the button's click handler without additional checks.

- **`create()` blocks until download completes** — the promise does not resolve until the model is ready. Use the `monitor` callback to stream `downloadprogress` events (0.0 to 1.0 on `e.loaded`) for UI progress feedback during download. Polling `availability()` is a fallback but less accurate than the monitor events.

- **`params()` is Chrome Extension–only** — the wrapper should guard with `try/catch` and return `null` if the call throws `NotSupportedError`.

- **`@types/dom-chromium-ai` package:** Official Chrome docs explicitly recommend this npm package for TypeScript typings. The implementer should check the version and whether it covers the 2026 API surface before preferring it over the hand-written declarations above.
