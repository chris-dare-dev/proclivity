/*
 * Shared types for the observability subsystem. Kept tiny and dependency-
 * free so any module (newtab, service worker, build-time tooling) can
 * import them without dragging the runtime logger along.
 */

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error";

/** A log entry as it appears in the future ring buffer (phase 3). */
export interface LogEntry {
  /** ISO-8601 timestamp. */
  ts: string;
  level: LogLevel;
  /** Namespace, e.g. "nano", "storage", "sw". */
  ns: string;
  msg: string;
  ctx?: Record<string, unknown> | undefined;
}

/** Runtime configuration for the logger. */
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
