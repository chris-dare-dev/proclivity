# Observability Design — Proclivity Chrome Extension

_Architecture document. Produced in parallel with `observability-audit.md`.
This document describes the system; the audit describes what to instrument._

---

## 1. TL;DR

- **Single logger, two sinks.** A `getLogger(namespace)` factory returns a
  `Logger` instance that writes to the DevTools console and (for `warn`/`error`
  and optionally `info`) to a separate ring buffer in `chrome.storage.local`.
  The service worker uses the same ring-buffer key.
- **Zero-import cost for prod.** The core `logger.ts` module is under 4 kB
  minified. The ring-buffer persistence layer and the in-app viewer are
  lazy-loaded; they add nothing to the initial newtab chunk.
- **Runtime verbosity controlled via existing settings shape.** A new
  `debug` field is added to `UserSettings`. A "Developer" section in the
  Settings modal flips it on. Default off. The service worker reads it from
  `chrome.storage.onChanged`; newtab reads it through `useStore`.
- **Separate storage key.** Logs live at `proclivity:logs:v1`, never mixed
  into `proclivity:state:v1`. They can be cleared independently without
  touching app data.
- **Non-throwing assertion helper.** `assert(condition, label, ctx)` logs a
  `warn` and keeps running. Safe to leave on in production.
- **4-phase rollout.** Each phase ships independently, gives immediate value,
  and does not block the others.

---

## 2. Design Constraints and Non-Goals

### Hard constraints

| Constraint | Source |
|---|---|
| No remote ingest | SECURITY.md §3, CLAUDE.md |
| No new manifest permissions | SECURITY.md §2 policy |
| No `fetch()` / `XMLHttpRequest` | SECURITY.md §7 |
| Initial newtab chunk < ~200 kB | CLAUDE.md, SECURITY.md §5 |
| `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess` | `tsconfig.json` |
| Write-queue pattern must not be bypassed | SECURITY.md §7 |

### What we will NOT build

**No OpenTelemetry.** The OTel browser SDK is ~80 kB gzipped; its trace/span
model is designed for distributed systems with a remote collector. Neither
fits here.

**No Sentry / Datadog / LogRocket.** All require a remote ingest endpoint
and add host permissions or network calls. SECURITY.md §7 explicitly
prohibits outbound network calls from the extension.

**No source-mapped stack-trace upload.** Source maps ship with the build
(`sourcemap: true` in `vite.config.ts`) for local DevTools use. Uploading
them anywhere would require a remote endpoint and creates PII risk.

**No `localStorage` fallback for the ring buffer.** The dev environment uses
`localStorage` for the main state, but the ring buffer only makes sense inside
the extension. Outside the extension context, the ring buffer silently no-ops.

**No structured distributed tracing (spans, trace IDs).** The system is
single-user, single-device, same-process (except the SW). Timestamps and
namespace filtering are sufficient for correlation.

---

## 3. Architecture

### Module map

```
src/observability/
  logger.ts          — public API: getLogger, Logger interface, assert helper
  ring-buffer.ts     — storage persistence (lazy-loaded from logger on demand)
  filter.ts          — DEBUG-style glob match (shared, tiny, sync)
  types.ts           — LogEntry, LogLevel, shared type exports
```

```
src/components/settings/
  LogViewer.tsx      — in-app viewer (React.lazy, loaded only when visible)
  LogViewer.css
```

### Data flow

```
                  getLogger("nano")
                       │
                       ▼
               ┌──────────────┐
               │   logger.ts  │  (always synchronous, < 1 ms hot path)
               └──────┬───────┘
          ┌───────────┴────────────┐
          ▼                        ▼
   console.debug/               ring-buffer.ts
   info/warn/error               (async, deferred)
   (always, subject             writes to
    to level filter)            chrome.storage.local
                                 "proclivity:logs:v1"
```

### Public API sketch

```ts
// src/observability/logger.ts

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error";

export interface Logger {
  trace(msg: string, ctx?: Record<string, unknown>): void;
  debug(msg: string, ctx?: Record<string, unknown>): void;
  info(msg: string, ctx?: Record<string, unknown>): void;
  warn(msg: string, ctx?: Record<string, unknown>): void;
  error(msg: string, ctx?: Record<string, unknown>): void;

  /**
   * Time an async or sync operation. Returns the value, re-throws errors
   * after logging them. Adds `durationMs` to the log context.
   */
  time<T>(label: string, fn: () => Promise<T> | T): Promise<T>;

  /**
   * Increment a named counter. Useful for tracking retry counts,
   * queue depth watermarks, etc. Emits at `debug` level.
   */
  count(label: string, delta?: number): void;
}

/**
 * Get or create a logger for the given namespace.
 * Calling with the same namespace returns the same instance.
 */
export function getLogger(namespace: string): Logger;

/**
 * Non-throwing assertion. Logs a `warn` if condition is false; never throws.
 * Safe to leave on in production builds.
 */
export function assert(
  condition: boolean,
  label: string,
  ctx?: Record<string, unknown>,
): void;

/**
 * Re-configure global verbosity from settings. Called once on init and
 * on every storage-change event. Pure synchronous.
 */
export function configure(opts: ObservabilityConfig): void;

export interface ObservabilityConfig {
  /** When false, trace/debug are suppressed globally. Default: false. */
  enabled: boolean;
  /**
   * DEBUG-style glob filter, e.g. "proclivity:*" or "nano:*,storage:*".
   * Only evaluated when `enabled` is true.
   * Default: "*" (all namespaces).
   */
  namespaces: string;
}
```

### LogEntry type (lives in `src/observability/types.ts`)

```ts
export interface LogEntry {
  /** ISO-8601 timestamp. */
  ts: string;
  level: LogLevel;
  ns: string;
  msg: string;
  ctx?: Record<string, unknown> | undefined;
}
```

---

## 4. Runtime Toggle

### Settings shape extension

Add to `UserSettings` in `src/types/index.ts`:

```ts
/** Observability / developer debug settings. Default: all off. */
debug?: {
  /** Master switch. When false, trace/debug emit nothing. Default: false. */
  enabled?: boolean | undefined;
  /**
   * DEBUG-style namespace glob filter. Only active when `enabled` is true.
   * Examples: "*", "nano:*", "storage:*,sw:*".
   * Default: "*".
   */
  namespaces?: string | undefined;
} | undefined;
```

And to `ResolvedUserSettings`:

```ts
debug: {
  enabled: boolean;
  namespaces: string;
};
```

With a default in `DEFAULT_SETTINGS`:

```ts
debug: { enabled: false, namespaces: "*" },
```

### Initialization: newtab context

In the newtab entry point (`src/newtab/main.tsx` or wherever `useStore`
is first consumed), read the resolved settings and call `configure()`:

```ts
import { configure } from "@/observability/logger";

// Inside a useEffect that subscribes to useStore:
configure({
  enabled: resolvedState.settings.debug?.enabled ?? false,
  namespaces: resolvedState.settings.debug?.namespaces ?? "*",
});
```

The `storage.subscribe` listener in `useStore` already fires on every
storage change, so `configure()` re-runs automatically when the user flips
the debug toggle.

### Initialization: service worker

At the top of `service-worker.ts`, after the imports, add:

```ts
import { configure, getLogger } from "@/observability/logger";

const swLog = getLogger("sw");

// Read settings on first load.
chrome.storage.local.get(STORAGE_KEY).then((r) => {
  const state = r[STORAGE_KEY] as ProclivityState | undefined;
  const d = state?.settings.debug;
  configure({ enabled: d?.enabled ?? false, namespaces: d?.namespaces ?? "*" });
});

// Re-configure on every storage change.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes[STORAGE_KEY]) return;
  const newState = changes[STORAGE_KEY].newValue as ProclivityState | undefined;
  const d = newState?.settings.debug;
  configure({ enabled: d?.enabled ?? false, namespaces: d?.namespaces ?? "*" });
});
```

### Filtering logic

`filter.ts` implements a tiny (~0.5 kB minified) glob matcher:

```ts
// src/observability/filter.ts
export function matchesFilter(namespace: string, pattern: string): boolean {
  // Split comma-separated patterns. First match wins.
  for (const segment of pattern.split(",")) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    if (trimmed === "*") return true;
    if (trimmed.endsWith(":*")) {
      const prefix = trimmed.slice(0, -1); // "nano:"
      if (namespace.startsWith(prefix)) return true;
    } else if (trimmed === namespace) {
      return true;
    }
  }
  return false;
}
```

### Level filtering rules

| Level | Console (debug off) | Console (debug on) | Ring buffer (debug off) | Ring buffer (debug on) |
|---|---|---|---|---|
| `trace` | suppressed | namespace-filtered | suppressed | suppressed |
| `debug` | suppressed | namespace-filtered | suppressed | suppressed |
| `info` | emitted | emitted | suppressed | emitted |
| `warn` | emitted | emitted | emitted | emitted |
| `error` | emitted | emitted | emitted | emitted |

Rationale: `info` is useful historical signal (session creates, reconcile
runs) but noisy in production. `warn` and `error` always go to the ring
buffer so you can reconstruct recent failures without DevTools open.

### Settings UI

A new `DeveloperSection` component lives in `SettingsModal.tsx`, following
the same `SectionHeader` + `ToggleSwitch` pattern used by every other
section:

```tsx
function DeveloperSection() {
  const { state, update } = useStore();
  const rs = useMemo(() => resolvedSettings(state.settings), [state.settings]);
  const debugEnabled = rs.debug.enabled;

  return (
    <section className="settings-section">
      <SectionHeader>Developer</SectionHeader>
      <ToggleSwitch
        label="Debug logging"
        checked={debugEnabled}
        onChange={(v) =>
          void update((s) => ({
            ...s,
            settings: {
              ...s.settings,
              debug: { ...s.settings.debug, enabled: v },
            },
          }))
        }
        hint="Enables verbose logging and the log viewer. Off by default."
      />
      {debugEnabled && (
        <label className="settings-field">
          <span className="settings-label">Namespace filter</span>
          <input
            type="text"
            defaultValue={rs.debug.namespaces}
            placeholder="* (all)"
            onBlur={(e) =>
              void update((s) => ({
                ...s,
                settings: {
                  ...s.settings,
                  debug: { ...s.settings.debug, namespaces: e.target.value || "*" },
                },
              }))
            }
          />
          <span className="settings-hint">
            Comma-separated globs, e.g. "nano:*,storage:*". Use * for all.
          </span>
        </label>
      )}
    </section>
  );
}
```

---

## 5. Ring Buffer for Persistent Event History

### Storage key

```ts
export const LOG_STORAGE_KEY = "proclivity:logs:v1";
```

This key is entirely separate from `proclivity:state:v1`. The app's
import/export, schema migration, and clear-all flows never touch it. It
can be cleared via the log viewer or wiped manually from DevTools.

### LogEntry format

Each entry is a compact JSON object. At ~200 bytes each, 500 entries consume
~100 kB — well inside `chrome.storage.local`'s ~10 MB cap.

```ts
interface LogEntry {
  ts: string;          // ISO-8601, e.g. "2026-05-12T09:14:22.103Z"
  level: LogLevel;
  ns: string;          // namespace, e.g. "nano" or "storage"
  msg: string;
  ctx?: Record<string, unknown> | undefined;
}
```

### Ring buffer mechanics

`ring-buffer.ts` is imported lazily from `logger.ts` only when the logger
needs to persist an entry (i.e., only for `warn`/`error` unconditionally,
and for `info` when debug is enabled). The dynamic import is hidden inside
the logger and never appears in any consumer's import tree:

```ts
// Inside logger.ts — called only on warn/error/info(debug)
function scheduleWrite(entry: LogEntry): void {
  void import("@/observability/ring-buffer").then(({ appendEntry }) => {
    appendEntry(entry);
  });
}
```

`ring-buffer.ts` maintains its own single-promise write chain (same pattern
as `storage.ts`'s `writeChain`):

```ts
// src/observability/ring-buffer.ts
const MAX_ENTRIES = 500;
let chain: Promise<void> = Promise.resolve();

export function appendEntry(entry: LogEntry): void {
  chain = chain.then(async () => {
    const r = await chrome.storage.local.get(LOG_STORAGE_KEY);
    const existing = (r[LOG_STORAGE_KEY] as LogEntry[] | undefined) ?? [];
    const next = [...existing, entry];
    // Drop oldest when over cap.
    const trimmed = next.length > MAX_ENTRIES
      ? next.slice(next.length - MAX_ENTRIES)
      : next;
    await chrome.storage.local.set({ [LOG_STORAGE_KEY]: trimmed });
  }).catch(() => undefined); // swallow; never block future writes
}

export async function readAll(): Promise<LogEntry[]> {
  const r = await chrome.storage.local.get(LOG_STORAGE_KEY);
  return (r[LOG_STORAGE_KEY] as LogEntry[] | undefined) ?? [];
}

export async function clearAll(): Promise<void> {
  await chrome.storage.local.remove(LOG_STORAGE_KEY);
}
```

### Service-worker writes

The SW imports the same `ring-buffer.ts` module. Because the SW bundle is
its own chunk (via `@crxjs/vite-plugin`), the ring-buffer's `chain` variable
is a separate instance from the newtab's chain. Both write to the same
storage key, which means they can interleave at the `chrome.storage.local`
level. This is acceptable: a read-modify-write race between two concurrent
writes would cause at most one entry to be silently dropped — a negligible
risk for a debug log.

If stricter ordering is ever needed, the two write chains can be coordinated
using a `chrome.storage.local` lock key. For now, the simple chain is
sufficient.

---

## 6. In-App Log Viewer

### Placement

The log viewer renders inside the Settings modal as a lazy-loaded section,
gated behind `debug.enabled`. It appears below `DeveloperSection`. Because
the Settings modal already uses `<section>` components, the viewer follows
the same structural idiom.

Alternative considered: a `?debug=1` query-string route on the newtab page.
Rejected because it requires adding routing logic (no router exists today)
and forces the user to navigate away from the main dashboard. The modal
approach is consistent with existing UI patterns and keeps the feature
self-contained.

### Bundle impact

`LogViewer.tsx` is loaded with `React.lazy`:

```ts
// Inside SettingsModal.tsx
const LogViewer = React.lazy(() =>
  import("@/components/settings/LogViewer").then((m) => ({
    default: m.LogViewer,
  })),
);

// In DeveloperSection render:
{debugEnabled && (
  <Suspense fallback={<span className="settings-hint">Loading viewer…</span>}>
    <LogViewer />
  </Suspense>
)}
```

The `LogViewer` chunk is never fetched unless the user has enabled debug mode
and opened Settings. Initial chunk impact: 0 kB.

### Component file shape

```
src/components/settings/LogViewer.tsx
src/components/settings/LogViewer.css
```

`LogViewer.tsx` is a self-contained React component (~250 LOC target) that:

1. On mount, calls `readAll()` from `ring-buffer.ts` and populates local state.
2. Re-reads every 5 seconds if the panel is open (simple `setInterval`; no
   real-time streaming is needed for a debug viewer).
3. Renders a filterable, searchable table of `LogEntry` rows.
4. Provides "Export as JSON" (downloads `proclivity-logs-<date>.json`),
   "Clear" (calls `clearAll()` and empties local state), and level/namespace
   filter dropdowns.

```tsx
// src/components/settings/LogViewer.tsx (shape only)
import { useEffect, useState } from "react";
import { readAll, clearAll } from "@/observability/ring-buffer";
import type { LogEntry, LogLevel } from "@/observability/types";

export function LogViewer() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [levelFilter, setLevelFilter] = useState<LogLevel | "all">("all");
  const [nsFilter, setNsFilter] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    void readAll().then(setEntries);
    const id = setInterval(() => void readAll().then(setEntries), 5000);
    return () => clearInterval(id);
  }, []);

  const visible = entries.filter((e) => {
    if (levelFilter !== "all" && e.level !== levelFilter) return false;
    if (nsFilter && !e.ns.startsWith(nsFilter)) return false;
    if (search && !e.msg.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  });

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `proclivity-logs-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ... filter controls, table render, export + clear buttons
}
```

### Features

- **Level filter:** dropdown (`all | trace | debug | info | warn | error`).
- **Namespace filter:** text input, prefix-match against `LogEntry.ns`.
- **Free-text search:** matches against `LogEntry.msg` (case-insensitive).
- **Time range:** optional "last N minutes" preset (simple `Date.now() - N*60000`).
- **Export:** downloads all entries (not filtered view) as JSON.
- **Clear:** two-step confirm matching `DataSection`'s Clear-All pattern.
- **Entry count badge** in the section header showing how many entries are in the buffer.

---

## 7. Specific Instrumentation Idioms

### Storage writes

Wrap `storage.update` to measure duration and log byte-delta:

```ts
// src/observability/instrumented-storage.ts
import { storage } from "@/storage/storage";
import { getLogger } from "@/observability/logger";
import type { ProclivityState } from "@/types";

const log = getLogger("storage");

export const instrumentedStorage = {
  ...storage,
  update(fn: (s: ProclivityState) => ProclivityState): Promise<ProclivityState> {
    const caller = getCaller(); // see below
    const t0 = performance.now();
    return storage.update((s) => {
      const next = fn(s);
      const prevSize = JSON.stringify(s).length;
      const nextSize = JSON.stringify(next).length;
      const durationMs = Math.round(performance.now() - t0);
      log.debug("storage.update", {
        caller,
        durationMs,
        byteDelta: nextSize - prevSize,
        nextSizeBytes: nextSize,
      });
      return next;
    });
  },
};

/** Extract the calling function name from the current stack. */
function getCaller(): string {
  try {
    const stack = new Error().stack ?? "";
    // Skip Error, getCaller, instrumentedStorage.update frames.
    const lines = stack.split("\n");
    return lines[3]?.trim() ?? "unknown";
  } catch {
    return "unknown";
  }
}
```

Callers replace `import { storage }` with
`import { instrumentedStorage as storage }` — or, if a single canonical
re-export is preferred, update `src/storage/storage.ts` to re-export the
instrumented wrapper when the logger is initialized.

### LLM sessions

In `useChatSession.ts`, add logging at the three key moments:

```ts
// At hook scope
const log = getLogger("nano");

// In ensureSession():
log.info("session.create", { tags: stateRef.current.tags.length });
// ...after nanoCreateSession resolves:
log.debug("session.created", { durationMs });

// In send():
const t0 = performance.now();
// ...after session.prompt() resolves:
const durationMs = Math.round(performance.now() - t0);
log.info("prompt.complete", {
  durationMs,
  parsedKind: parsed.kind,
  toolApplied: parsed.kind !== "chat" && parsed.kind !== "parse-failed",
});

// In the catch block:
log.error("prompt.error", { name: err.name, message: err.message });

// contextoverflow listener:
log.warn("context.overflow", { messageCount: prev.length });

// In clear():
log.debug("session.destroy");
```

In `nano.ts`, instrument `createSession` and `promptStructured`:

```ts
const log = getLogger("nano");

export async function createSession(opts: CreateSessionOpts = {}): Promise<LanguageModel> {
  return log.time("LanguageModel.create", () => {
    const LM = nanoGlobal();
    // ...existing args build
    return LM.create(args);
  });
}
```

### Service worker lifecycle

At the top of `service-worker.ts`:

```ts
import { configure, getLogger } from "@/observability/logger";
const log = getLogger("sw");

chrome.runtime.onInstalled.addListener(() => {
  log.info("lifecycle.installed");
  reconcileAlarms().catch((err) => {
    log.error("reconcileAlarms.failed", { phase: "install", error: String(err) });
    console.error("[proclivity] reconcileAlarms failed on install:", err);
  });
});

chrome.runtime.onStartup.addListener(() => {
  log.info("lifecycle.startup");
  reconcileAlarms().catch((err) => {
    log.error("reconcileAlarms.failed", { phase: "startup", error: String(err) });
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  log.debug("alarm.fired", { name: alarm.name });
  handleAlarm(alarm).catch((err) => {
    log.error("alarm.handler.failed", { name: alarm.name, error: String(err) });
  });
});
```

Each listener is wrapped with try/catch + `log.error` so failures are
surfaced in the ring buffer even when DevTools is not open.

### State-invariant assertions

```ts
// src/observability/logger.ts (already in public API)
export function assert(
  condition: boolean,
  label: string,
  ctx?: Record<string, unknown>,
): void {
  if (condition) return;
  getLogger("assert").warn(`assert.failed: ${label}`, ctx);
}
```

Usage at a call site:

```ts
import { assert } from "@/observability/logger";

// Before applying a tool call:
assert(
  result.newState.todos.length >= state.todos.length,
  "add_todo.length_invariant",
  { before: state.todos.length, after: result.newState.todos.length },
);
```

The assertion never throws — it only emits a `warn`. The extension keeps
running. This is appropriate for production where a broken invariant is
better reported and survived than crashing the session.

---

## 8. Performance and Bundle Plan

### Initial chunk impact target: < 4 kB minified

The core `logger.ts` module consists of:
- A module-level `Map<string, Logger>` for instance caching.
- A `LogLevel` enum and the `matchesFilter` function from `filter.ts`
  (tree-shaken inline).
- Five `console.*` calls per logger instance.
- The `configure()` synchronous state setter.
- No async I/O, no imports of `ring-buffer.ts` at module load time.

Estimate: ~3.5 kB minified, ~1.5 kB gzipped.

`ring-buffer.ts` adds ~1.5 kB and is dynamically imported only on the first
`warn`/`error` call. `LogViewer.tsx` and its CSS add ~8 kB and are
`React.lazy`-loaded only when the user opens the viewer. Neither appears in
the initial chunk.

### Tree-shaking

Each consumer imports `getLogger` from `@/observability/logger`. Vite's
rollup pass can eliminate entire logger namespaces when their containing
module is not reachable from the entry point — but practically, all four
active namespaces (`nano`, `storage`, `sw`, `assert`) are always reachable.
Tree-shaking benefit is therefore near zero for this module, which is fine
given the 4 kB budget.

### Service-worker bundle

The SW has its own Vite/rollup chunk. `logger.ts` is included in the SW
bundle as a separate instance (module scope is not shared with newtab).
The SW's logger can skip `console.debug` emission entirely in non-dev builds
by checking `import.meta.env.DEV`. For now, `console.*` is always emitted
because the SW console is viewable in `chrome://serviceworker-internals`.

---

## 9. Migration / Phasing

### Phase 1 — Logger module + console sink + runtime toggle

**Goal:** get a typed, namespace-filtered logger into the codebase. No
persistence, no viewer. Immediate value: all future instrumentation can
reference the stable API.

**Deliverables:**

| File | Status | Est. LOC |
|---|---|---|
| `src/observability/types.ts` | new | 20 |
| `src/observability/filter.ts` | new | 25 |
| `src/observability/logger.ts` | new | 120 |
| `src/types/index.ts` | edit: add `debug` field | 12 |
| `src/storage/constants.ts` | edit: add default + resolver | 8 |
| `src/components/settings/SettingsModal.tsx` | edit: add `DeveloperSection` | 40 |

Total: ~225 LOC. No persistence. No viewer. Bundle delta: ~3.5 kB.

### Phase 2 — Instrument high-value call sites

**Goal:** instrument storage writes, LLM sessions, and SW lifecycle using
the Phase 1 logger. Each site is 3–8 LOC of added instrumentation.

**Deliverables:**

| File | Change |
|---|---|
| `src/background/service-worker.ts` | add `getLogger("sw")`, wrap listeners |
| `src/hooks/useChatSession.ts` | add session/prompt/error/overflow logging |
| `src/llm/nano.ts` | add `log.time` around `LanguageModel.create` |
| `src/observability/instrumented-storage.ts` | new wrapper (~60 LOC) |

Total: ~90 LOC added across files. At this point the DevTools console is the
only output — no persistence yet.

### Phase 3 — Ring buffer

**Goal:** persist `warn`/`error` (and `info` when debug is on) to
`proclivity:logs:v1`. The buffer survives SW restarts and tab closes.

**Deliverables:**

| File | Status | Est. LOC |
|---|---|---|
| `src/observability/ring-buffer.ts` | new | 70 |
| `src/observability/logger.ts` | edit: add `scheduleWrite` call | 15 |
| `src/storage/constants.ts` | edit: add `LOG_STORAGE_KEY` | 2 |
| `SECURITY.md` | edit: document new storage key | 5 |

Total: ~92 LOC. `chrome.storage.local` impact: max ~100 kB at 500 entries.

### Phase 4 — In-app log viewer

**Goal:** a filterable, exportable, clearable log viewer inside the Settings
modal. Lazy-loaded; zero impact on initial chunk.

**Deliverables:**

| File | Status | Est. LOC |
|---|---|---|
| `src/components/settings/LogViewer.tsx` | new | 220 |
| `src/components/settings/LogViewer.css` | new | 50 |
| `src/components/settings/SettingsModal.tsx` | edit: add `React.lazy` + `Suspense` | 15 |

Total: ~285 LOC. Lazy chunk impact: ~8 kB gzipped.

---

## 10. Open Questions for the Maintainer

1. **Should the ring buffer persist across extension reinstalls?**
   `chrome.storage.local` survives reinstalls by default. If old logs are
   confusing after a fresh install, add a version-check: if the newest log
   entry's `ts` predates the extension install time, clear the buffer. The
   install time is available from `chrome.management.getSelf()` (requires
   the `management` permission — a new permission, so explicit sign-off is
   needed).

2. **Should user-typed content be redacted from the log?**
   Currently, `reminder.title`, `todo.title`, and chat messages could appear
   in log context objects. These are PII for the user (who is also the only
   consumer of the logs), but if the user ever shares the JSON export with a
   bug report, titles would be visible. Consider redacting any field named
   `title`, `text`, or `msg` in log context before persisting, replacing with
   `"[redacted]"`. A flag `redactPII: boolean` on `ObservabilityConfig` would
   allow opting in.

3. **Should the log export be shareable (e.g., one-click copy to clipboard)?**
   A "Copy to clipboard" button next to "Export as JSON" in the viewer would
   make sharing easier. This uses only `navigator.clipboard.writeText`, which
   is already available in a newtab page extension context and requires no new
   permissions.

4. **What is the right `MAX_ENTRIES` cap?**
   500 entries at ~200 bytes each is ~100 kB. `chrome.storage.local` is capped
   at ~10 MB, so there is room to grow — but larger ring buffers make the
   viewer slower to load. 500 is a reasonable starting point; it covers roughly
   the last 1–2 hours of activity in a busy session.

5. **Should `trace`/`debug` entries optionally be written to the ring buffer when debug mode is on?**
   The current design keeps `trace`/`debug` console-only. In some debugging
   scenarios, you want the full trace even when DevTools was not open at the
   time. An `persistDebugLevel` option on `ObservabilityConfig` could enable
   this. It should default to `false` because it fills the buffer quickly and
   obscures `warn`/`error` signal.

---

## 11. TypeScript Surface (Verbatim)

The complete public surface that instrumentation call sites import. This is
what ships in `src/observability/logger.ts` — the implementation is omitted
here; only the types and function signatures that callers depend on.

```ts
// src/observability/logger.ts — public surface (~85 lines)

// ── Shared types ──────────────────────────────────────────────────────────

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error";

/** A persisted log entry. Written only for warn/error (and info when debug on). */
export interface LogEntry {
  /** ISO-8601 timestamp. */
  ts: string;
  level: LogLevel;
  /** Namespace, e.g. "nano", "storage", "sw". */
  ns: string;
  msg: string;
  ctx?: Record<string, unknown> | undefined;
}

// ── Configuration ─────────────────────────────────────────────────────────

export interface ObservabilityConfig {
  /** Master switch for trace/debug emission. Default: false. */
  enabled: boolean;
  /**
   * Comma-separated namespace globs. Only evaluated when `enabled` is true.
   * Supported forms: "*", "nano:*", "storage:*,sw:*", "exact-namespace".
   * Default: "*".
   */
  namespaces: string;
}

/**
 * Re-configure global verbosity. Pure synchronous — safe to call inside
 * storage-change handlers in both newtab and the service worker.
 */
export declare function configure(opts: ObservabilityConfig): void;

// ── Logger interface ───────────────────────────────────────────────────────

export interface Logger {
  /** Finest granularity. Console-only. Suppressed when debug is off. */
  trace(msg: string, ctx?: Record<string, unknown>): void;

  /** Verbose detail. Console-only. Suppressed when debug is off. */
  debug(msg: string, ctx?: Record<string, unknown>): void;

  /**
   * Noteworthy lifecycle event (session created, alarm reconciled, etc.).
   * Console always. Ring buffer when debug is enabled.
   */
  info(msg: string, ctx?: Record<string, unknown>): void;

  /**
   * Recoverable abnormal condition.
   * Console always. Ring buffer always.
   */
  warn(msg: string, ctx?: Record<string, unknown>): void;

  /**
   * Non-recoverable failure (thrown error, parse failure, storage error).
   * Console always. Ring buffer always.
   */
  error(msg: string, ctx?: Record<string, unknown>): void;

  /**
   * Time a sync or async operation. Re-throws errors after logging them.
   * Always emits at `info` level with `durationMs` added to ctx.
   */
  time<T>(label: string, fn: () => Promise<T> | T): Promise<T>;

  /**
   * Increment a named counter; delta defaults to 1.
   * Emits at `debug` level with `{ label, total }` as ctx.
   */
  count(label: string, delta?: number): void;
}

// ── Factory ───────────────────────────────────────────────────────────────

/**
 * Get or create a logger for the given namespace.
 * Same namespace string → same Logger instance (identity guarantee).
 *
 * Convention: use colon-separated segments, e.g. "nano", "storage",
 * "sw", "ui:chat", "ui:gantt".
 */
export declare function getLogger(namespace: string): Logger;

// ── Assertion helper ──────────────────────────────────────────────────────

/**
 * Non-throwing production assertion.
 *
 * Logs a `warn` via the "assert" namespace when `condition` is false.
 * Never throws. Safe to leave on in production builds.
 *
 * @example
 * assert(
 *   result.newState.todos.length >= state.todos.length,
 *   "add_todo.length_invariant",
 *   { before: state.todos.length, after: result.newState.todos.length },
 * );
 */
export declare function assert(
  condition: boolean,
  label: string,
  ctx?: Record<string, unknown>,
): void;
```

### Worked example: instrumenting `useChatSession.send`

Before (excerpt from the existing `send` callback):

```ts
const send = useCallback(async (userText: string): Promise<void> => {
  if (generating) return;
  const trimmed = userText.trim();
  if (!trimmed) return;
  setGenerating(true);
  const userMsg = makeMsg("user", trimmed);
  appendMessages([userMsg]);
  const controller = new AbortController();
  abortRef.current = controller;
  const signal = controller.signal;
  try {
    const session = await ensureSession();
    const raw = await session.prompt(trimmed, { signal, responseConstraint: TOOL_SCHEMA });
    const parsed = parseToolCall(raw.trim());
    // ...dispatch
  } catch (err: unknown) {
    // ...error handling
  } finally {
    abortRef.current = null;
    setGenerating(false);
  }
}, [generating, ensureSession, update, appendMessages]);
```

After (additions in context):

```ts
import { getLogger } from "@/observability/logger";

// At hook scope (outside send callback):
const log = getLogger("nano");

const send = useCallback(async (userText: string): Promise<void> => {
  if (generating) return;
  const trimmed = userText.trim();
  if (!trimmed) return;
  setGenerating(true);
  const userMsg = makeMsg("user", trimmed);
  appendMessages([userMsg]);
  const controller = new AbortController();
  abortRef.current = controller;
  const signal = controller.signal;

  // ADDED: mark prompt start
  const t0 = performance.now();
  log.debug("prompt.start", { msgLen: trimmed.length });

  try {
    const session = await ensureSession();
    const raw = await session.prompt(trimmed, { signal, responseConstraint: TOOL_SCHEMA });
    const parsed = parseToolCall(raw.trim());

    // ADDED: log parse outcome with latency
    log.info("prompt.complete", {
      durationMs: Math.round(performance.now() - t0),
      parsedKind: parsed.kind,
    });

    if (parsed.kind === "parse-failed") {
      // ADDED: warn-level so it lands in ring buffer
      log.warn("prompt.parse-failed", { rawSnippet: parsed.raw.slice(0, 100) });
    }
    // ...existing dispatch unchanged
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") return;
    const isQuota = err instanceof Error && err.name === "QuotaExceededError";

    // ADDED: error always goes to ring buffer
    log.error("prompt.error", {
      name: err instanceof Error ? err.name : "unknown",
      isQuota,
      durationMs: Math.round(performance.now() - t0),
    });

    const errorText = isQuota
      ? "Message too long — try a shorter message."
      : err instanceof Error ? `Error: ${err.message}` : "Unknown error — try again.";
    appendMessages([makeMsg("system-notice", errorText)]);
  } finally {
    abortRef.current = null;
    setGenerating(false);
  }
}, [generating, ensureSession, update, appendMessages, log]);
// Note: `log` is a stable reference (getLogger caches by namespace),
// but including it makes the exhaustive-deps lint rule happy.
```

Net additions: 7 lines, one import. The instrumentation is additive —
no existing logic changes. The `log` reference is guaranteed stable
because `getLogger` returns the cached instance after the first call.

---

_End of design document. Companion: `plans/observability-audit.md` (produced by sibling agent)._
