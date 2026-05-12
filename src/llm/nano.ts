/*
 * Thin wrapper around Chrome's on-device Prompt API (Gemini Nano).
 *
 * Why on-device: the user has a consumer Google AI Premium subscription
 * that cannot be OAuth'd from a third-party Chrome extension. The Prompt
 * API ships a 4 GB Gemini Nano model directly in Chrome — no API key,
 * no Cloud project, no quota. See plans/gemini-nano-research.md.
 *
 * Types come from @types/dom-chromium-ai (devDependency) which augments
 * the global namespace with `LanguageModel`, `Availability`, etc. No
 * runtime dependency added.
 *
 * NOT available in service workers — only in regular DOM contexts. All
 * callers in proclivity are user-initiated from the newtab page, so
 * this is fine.
 */

/** Re-export of the SDK's Availability union for callers. */
export type NanoAvailability = Availability;

/** Thrown when a `promptStructured` response cannot be JSON.parse'd. */
export class NanoParseError extends Error {
  constructor(
    message: string,
    public readonly raw: string,
  ) {
    super(message);
    this.name = "NanoParseError";
  }
}

/** Thrown when the global Prompt API isn't present at runtime. */
export class NanoUnavailableError extends Error {
  constructor() {
    super(
      "Chrome Prompt API not present on globalThis. Requires Chrome 138+ " +
        "with the model available; enable chrome://flags/#prompt-api-for-gemini-nano " +
        "on older stable channels.",
    );
    this.name = "NanoUnavailableError";
  }
}

function nanoGlobal(): typeof LanguageModel {
  // The package's global is a `declare abstract class LanguageModel` —
  // it's a runtime constructor, not a TS-only declaration. Check before
  // dereferencing so callers get a clean error on unsupported browsers.
  if (typeof LanguageModel === "undefined") {
    throw new NanoUnavailableError();
  }
  return LanguageModel;
}

/**
 * Query whether Gemini Nano is ready to use.
 * Returns one of: `"available"` | `"downloadable"` | `"downloading"` | `"unavailable"`.
 *
 * `"downloadable"` means the user must trigger a `create()` call (which
 * requires sticky user activation, e.g. a click) to start the ~4 GB
 * model download.
 */
export async function availability(): Promise<Availability> {
  if (typeof LanguageModel === "undefined") return "unavailable";
  return LanguageModel.availability();
}

interface CreateSessionOpts {
  /** 0.0–1.0 range; controls randomness. Defaults to whatever `params()` reports. */
  temperature?: number;
  /** Smaller = more deterministic. Defaults to model-specific. */
  topK?: number;
  /** Aborts an in-flight `create()` / `prompt()`. */
  signal?: AbortSignal;
  /**
   * Initial messages seeded into the session before the user's first
   * turn. The SDK accepts either a plain user/assistant array OR a
   * tuple whose first element is a system message — we mirror that
   * shape exactly so callers in gemini-nano-m3 can seed a system
   * prompt (the tool-call schema instruction) at creation time.
   * See `LanguageModelCreateOptions.initialPrompts`.
   */
  initialPrompts?:
    | [LanguageModelSystemMessage, ...LanguageModelMessage[]]
    | LanguageModelMessage[];
  /**
   * Called once with a `CreateMonitor` while the model is downloading.
   * Listen for "downloadprogress" events; `e.loaded` is bytes
   * transferred and `e.total` is total bytes — divide to get a 0–1
   * fraction. (Earlier doc claimed 0–1 directly; that was wrong.
   * Corrected in rect H1.)
   */
  monitor?: CreateMonitorCallback;
}

/**
 * Create a long-lived session. Caller is responsible for `.destroy()`
 * when finished. Returns the underlying SDK session — typed via
 * `@types/dom-chromium-ai`.
 */
export async function createSession(
  opts: CreateSessionOpts = {},
): Promise<LanguageModel> {
  const LM = nanoGlobal();
  // exactOptionalPropertyTypes: we can only pass keys we actually set.
  const args: LanguageModelCreateOptions = {};
  if (opts.temperature !== undefined) args.temperature = opts.temperature;
  if (opts.topK !== undefined) args.topK = opts.topK;
  if (opts.signal !== undefined) args.signal = opts.signal;
  if (opts.initialPrompts !== undefined) args.initialPrompts = opts.initialPrompts;
  if (opts.monitor !== undefined) args.monitor = opts.monitor;
  return LM.create(args);
}

interface PromptOpts {
  signal?: AbortSignal;
}

/**
 * One-shot prompt — creates a session, calls `prompt`, destroys the
 * session. Convenient for the m1 Test Prompt button and any other
 * fire-and-forget query. For multi-turn conversation (m2), use
 * `createSession` and reuse the session.
 */
export async function prompt(
  text: string,
  opts: PromptOpts & CreateSessionOpts = {},
): Promise<string> {
  const session = await createSession(opts);
  try {
    const promptArgs: LanguageModelPromptOptions = {};
    if (opts.signal !== undefined) promptArgs.signal = opts.signal;
    return await session.prompt(text, promptArgs);
  } finally {
    session.destroy();
  }
}

interface StructuredPromptOpts<_T> extends PromptOpts, CreateSessionOpts {
  /**
   * When true, `omitResponseConstraintInput` is passed to the SDK so
   * the schema isn't echoed back to the model in the visible prompt.
   * Reduces token usage; the model is still constrained by the schema.
   */
  omitSchemaInPrompt?: boolean;
}

/**
 * One-shot prompt constrained to a JSON-Schema response. Returns the
 * parsed value typed as `T`. Throws `NanoParseError` if the model's
 * response is non-JSON despite the constraint.
 *
 * Schema features confirmed by Chrome 137+ docs: object/array/string/
 * number/boolean primitives, `properties`, `required`,
 * `additionalProperties`, `items`, `maxItems`, `pattern`. Treat
 * `enum`/`oneOf`/`anyOf`/`$ref` as unverified until empirically tested
 * (m3 will measure parse-rate on the union schemas it ships).
 */
export async function promptStructured<T>(
  text: string,
  schema: Record<string, unknown>,
  opts: StructuredPromptOpts<T> = {},
): Promise<T> {
  const session = await createSession(opts);
  try {
    const promptArgs: LanguageModelPromptOptions = {
      responseConstraint: schema,
    };
    if (opts.signal !== undefined) promptArgs.signal = opts.signal;
    if (opts.omitSchemaInPrompt) {
      promptArgs.omitResponseConstraintInput = true;
    }
    const raw = await session.prompt(text, promptArgs);
    try {
      return JSON.parse(raw) as T;
    } catch (e) {
      throw new NanoParseError(
        `promptStructured: response was not valid JSON: ${(e as Error).message}`,
        raw,
      );
    }
  } finally {
    session.destroy();
  }
}
