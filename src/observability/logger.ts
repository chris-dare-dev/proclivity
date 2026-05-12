/*
 * Public observability surface. Phase 1 of the rollout planned in
 * `plans/observability-plan.md` — typed namespace logger with a console
 * sink and a runtime DEBUG-style toggle. No persistence in this phase
 * (ring buffer is phase 3, viewer is phase 4).
 *
 * Design notes:
 *   - `info`/`warn`/`error` always emit to the console.
 *   - `trace`/`debug` emit only when `configure()` has been called with
 *     `{ enabled: true }` AND the logger's namespace matches the filter.
 *   - Same namespace → same Logger instance (identity guarantee).
 *   - `time<T>(label, fn)` measures and re-throws.
 *   - `count(label, delta?)` keeps a per-logger counter; emits at debug.
 *   - `assert()` is a non-throwing warn-level invariant check.
 *
 * Works in both the newtab page and the MV3 service worker. The two
 * contexts have separate module scopes (the SW can be killed and
 * revived at any time), so each context calls `configure()` on init.
 */

import { matchesFilter } from "./filter";
import type { LogLevel, ObservabilityConfig } from "./types";

export type { LogLevel, LogEntry, ObservabilityConfig } from "./types";

// ── Runtime config (mutable singleton) ──────────────────────────────────

let currentConfig: ObservabilityConfig = { enabled: false, namespaces: "*" };

/**
 * Re-configure global verbosity. Pure synchronous — safe to call inside
 * storage-change handlers in both newtab and the service worker.
 */
export function configure(opts: ObservabilityConfig): void {
  currentConfig = { enabled: opts.enabled, namespaces: opts.namespaces };
}

function levelEnabled(level: LogLevel, ns: string): boolean {
  // info/warn/error always emit. trace/debug gated on config.
  if (level === "info" || level === "warn" || level === "error") return true;
  if (!currentConfig.enabled) return false;
  return matchesFilter(ns, currentConfig.namespaces);
}

// ── Logger interface ────────────────────────────────────────────────────

export interface Logger {
  trace(msg: string, ctx?: Record<string, unknown>): void;
  debug(msg: string, ctx?: Record<string, unknown>): void;
  info(msg: string, ctx?: Record<string, unknown>): void;
  warn(msg: string, ctx?: Record<string, unknown>): void;
  error(msg: string, ctx?: Record<string, unknown>): void;
  /**
   * Time a sync or async operation. Re-throws errors after logging them
   * with `error` level. Successful runs log at `info`. The duration is
   * added to the ctx as `durationMs`.
   */
  time<T>(label: string, fn: () => Promise<T> | T): Promise<T>;
  /**
   * Increment a named counter (default delta 1). Emits at debug level
   * with `{ label, total }` as ctx.
   */
  count(label: string, delta?: number): void;
}

// ── Factory ─────────────────────────────────────────────────────────────

const cache = new Map<string, Logger>();

/**
 * Get or create a logger for the given namespace. Same namespace string
 * returns the same Logger instance.
 *
 * Convention: colon-separated segments — e.g. "nano", "storage", "sw",
 * "ui:chat", "ui:gantt".
 */
export function getLogger(namespace: string): Logger {
  let l = cache.get(namespace);
  if (!l) {
    l = makeLogger(namespace);
    cache.set(namespace, l);
  }
  return l;
}

// ── Implementation ──────────────────────────────────────────────────────

function consoleMethod(level: LogLevel): (...args: unknown[]) => void {
  // console.trace prints a stack trace, which is noisy and confusing for
  // structured logs. Use console.debug for both trace and debug levels.
  switch (level) {
    case "trace":
    case "debug":
      return console.debug.bind(console);
    case "info":
      return console.info.bind(console);
    case "warn":
      return console.warn.bind(console);
    case "error":
      return console.error.bind(console);
  }
}

function emit(
  level: LogLevel,
  ns: string,
  msg: string,
  ctx?: Record<string, unknown>,
): void {
  if (!levelEnabled(level, ns)) return;
  const tag = `[${ns}]`;
  if (ctx !== undefined) {
    consoleMethod(level)(tag, msg, ctx);
  } else {
    consoleMethod(level)(tag, msg);
  }
}

function makeLogger(ns: string): Logger {
  const counters = new Map<string, number>();

  const log: Logger = {
    trace(msg, ctx) {
      emit("trace", ns, msg, ctx);
    },
    debug(msg, ctx) {
      emit("debug", ns, msg, ctx);
    },
    info(msg, ctx) {
      emit("info", ns, msg, ctx);
    },
    warn(msg, ctx) {
      emit("warn", ns, msg, ctx);
    },
    error(msg, ctx) {
      emit("error", ns, msg, ctx);
    },
    async time<T>(label: string, fn: () => Promise<T> | T): Promise<T> {
      const t0 = performance.now();
      try {
        const result = await fn();
        const durationMs = Math.round(performance.now() - t0);
        emit("info", ns, label, { durationMs });
        return result;
      } catch (err) {
        const durationMs = Math.round(performance.now() - t0);
        emit("error", ns, label, {
          durationMs,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    },
    count(label, delta = 1) {
      const total = (counters.get(label) ?? 0) + delta;
      counters.set(label, total);
      emit("debug", ns, label, { count: total, delta });
    },
  };

  return log;
}

// ── Assertion helper ────────────────────────────────────────────────────

const assertLog = getLogger("assert");

/**
 * Non-throwing production assertion. Logs a `warn` via the "assert"
 * namespace when `condition` is false. Never throws — safe to leave on.
 */
export function assert(
  condition: boolean,
  label: string,
  ctx?: Record<string, unknown>,
): void {
  if (condition) return;
  assertLog.warn(label, ctx);
}
