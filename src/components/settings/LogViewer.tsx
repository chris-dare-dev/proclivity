/*
 * LogViewer — in-app debug-log inspector. Phase 4 of
 * plans/observability-plan.md.
 *
 * Reads from src/observability/ring-buffer.ts, lets the maintainer
 * filter by level / namespace / free-text / time, copy filtered or
 * full output as JSON, and clear the buffer.
 *
 * Mounted lazily inside DeveloperSection only when the user toggles
 * "Verbose debug logging" on, so the ~10 kB cost is paid only when
 * someone actually wants the viewer.
 */

import { useEffect, useMemo, useState } from "react";
import {
  clearAll,
  readAll,
  RING_BUFFER_MAX,
  subscribe,
} from "@/observability/ring-buffer";
import type { LogEntry, LogLevel } from "@/observability/types";
import "./LogViewer.css";

type LevelOrAll = LogLevel | "all";
type TimeRange = "all" | "5m" | "15m" | "1h" | "24h";

const TIME_RANGE_MS: Record<Exclude<TimeRange, "all">, number> = {
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
  "24h": 24 * 60 * 60_000,
};

const LEVELS: LevelOrAll[] = ["all", "trace", "debug", "info", "warn", "error"];
const REFRESH_MS = 5_000;

interface Props {
  /**
   * When true, fields likely to carry user-typed content
   * (`ctx.rawPreview`, `ctx.prompt`, `ctx.title`, etc.) are masked in the
   * rendered output AND in the JSON-copy/export. Default off per the
   * Phase 4 decision the maintainer made when shipping. Useful before
   * pasting logs into a bug report.
   */
  redact?: boolean;
}

export function LogViewer({ redact = false }: Props) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [levelFilter, setLevelFilter] = useState<LevelOrAll>("all");
  const [nsFilter, setNsFilter] = useState("");
  const [search, setSearch] = useState("");
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [copyFlash, setCopyFlash] = useState<"" | "ok" | "err">("");

  // Read on mount + on a slow poll. Also subscribe to same-context
  // appends so a freshly-emitted log surfaces immediately. The poll
  // catches cross-context writes (SW appending while the viewer is open).
  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      void readAll().then((next) => {
        if (!cancelled) setEntries(next);
      });
    };
    refresh();
    const id = window.setInterval(refresh, REFRESH_MS);
    const unsubscribe = subscribe((next) => {
      if (!cancelled) setEntries([...next]);
    });
    return () => {
      cancelled = true;
      window.clearInterval(id);
      unsubscribe();
    };
  }, []);

  const visible = useMemo(() => {
    const cutoff =
      timeRange === "all" ? 0 : Date.now() - TIME_RANGE_MS[timeRange];
    const q = search.trim().toLowerCase();
    const nsq = nsFilter.trim();
    return entries.filter((e) => {
      if (levelFilter !== "all" && e.level !== levelFilter) return false;
      if (nsq && !e.ns.startsWith(nsq)) return false;
      if (cutoff > 0) {
        const ts = Date.parse(e.ts);
        if (!Number.isFinite(ts) || ts < cutoff) return false;
      }
      if (q) {
        const hay =
          e.msg.toLowerCase() +
          " " +
          (e.ctx ? JSON.stringify(e.ctx).toLowerCase() : "");
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [entries, levelFilter, nsFilter, search, timeRange]);

  const handleCopyFiltered = () => {
    const payload = visible.map((e) => (redact ? redactEntry(e) : e));
    void navigator.clipboard
      .writeText(JSON.stringify(payload, null, 2))
      .then(() => flashCopy("ok"))
      .catch(() => flashCopy("err"));
  };

  const handleExport = () => {
    const payload = entries.map((e) => (redact ? redactEntry(e) : e));
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `proclivity-logs-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleClearConfirm = () => {
    void clearAll().then(() => {
      setEntries([]);
      setConfirmingClear(false);
    });
  };

  const flashCopy = (status: "ok" | "err") => {
    setCopyFlash(status);
    window.setTimeout(() => setCopyFlash(""), 1600);
  };

  return (
    <div className="log-viewer">
      <div className="log-viewer__bar">
        <div className="log-viewer__count">
          {visible.length} / {entries.length} of {RING_BUFFER_MAX}
        </div>
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value as LevelOrAll)}
          aria-label="Filter by level"
        >
          {LEVELS.map((lv) => (
            <option key={lv} value={lv}>
              {lv}
            </option>
          ))}
        </select>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value as TimeRange)}
          aria-label="Filter by time range"
        >
          <option value="all">all time</option>
          <option value="5m">last 5 min</option>
          <option value="15m">last 15 min</option>
          <option value="1h">last hour</option>
          <option value="24h">last 24 h</option>
        </select>
        <input
          type="text"
          className="log-viewer__ns"
          placeholder="namespace prefix"
          value={nsFilter}
          onChange={(e) => setNsFilter(e.target.value)}
          aria-label="Filter by namespace prefix"
          spellCheck={false}
        />
        <input
          type="text"
          className="log-viewer__search"
          placeholder="search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search log messages"
          spellCheck={false}
        />
      </div>

      <div className="log-viewer__actions">
        <button type="button" onClick={handleCopyFiltered}>
          {copyFlash === "ok"
            ? "Copied!"
            : copyFlash === "err"
              ? "Copy failed"
              : "Copy filtered"}
        </button>
        <button type="button" onClick={handleExport}>
          Export all (JSON)
        </button>
        {confirmingClear ? (
          <>
            <button
              type="button"
              className="modal-btn-danger"
              onClick={handleClearConfirm}
            >
              Confirm clear all
            </button>
            <button
              type="button"
              onClick={() => setConfirmingClear(false)}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingClear(true)}
            disabled={entries.length === 0}
          >
            Clear all
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="log-viewer__empty">
          No persisted log entries yet. Warnings and errors are recorded
          automatically; info records are recorded while verbose logging
          is on.
        </p>
      ) : visible.length === 0 ? (
        <p className="log-viewer__empty">
          No entries match the current filter.
        </p>
      ) : (
        <ol className="log-viewer__rows">
          {visible.map((entry, i) => (
            <LogRow key={`${entry.ts}-${i}`} entry={entry} redact={redact} />
          ))}
        </ol>
      )}
    </div>
  );
}

/* ── Single row ────────────────────────────────────────────────────── */

function LogRow({ entry, redact }: { entry: LogEntry; redact: boolean }) {
  const [open, setOpen] = useState(false);
  const displayed = redact ? redactEntry(entry) : entry;
  const hasCtx =
    displayed.ctx !== undefined && Object.keys(displayed.ctx).length > 0;
  const time = formatTs(displayed.ts);
  return (
    <li className={`log-viewer__row log-viewer__row--${displayed.level}`}>
      <button
        type="button"
        className="log-viewer__row-head"
        onClick={() => hasCtx && setOpen((v) => !v)}
        aria-expanded={hasCtx ? open : undefined}
        disabled={!hasCtx}
      >
        <span className="log-viewer__time">{time}</span>
        <span className="log-viewer__level">{displayed.level}</span>
        <span className="log-viewer__ns">[{displayed.ns}]</span>
        <span className="log-viewer__msg">{displayed.msg}</span>
        {hasCtx && (
          <span className="log-viewer__caret" aria-hidden="true">
            {open ? "▾" : "▸"}
          </span>
        )}
      </button>
      {hasCtx && open && (
        <pre className="log-viewer__ctx">
          {JSON.stringify(displayed.ctx, null, 2)}
        </pre>
      )}
    </li>
  );
}

/* ── Helpers ──────────────────────────────────────────────────────── */

/**
 * Fields likely to carry user-typed content. When `redact` is on, these
 * are replaced with a `[redacted len=N]` placeholder so the maintainer
 * can share logs without leaking todo titles, tag labels, chat prompts,
 * or raw model output.
 */
const SENSITIVE_KEYS = new Set([
  "rawPreview",
  "raw",
  "prompt",
  "title",
  "label",
  "userMessage",
  "input",
  "text",
]);

function redactEntry(entry: LogEntry): LogEntry {
  if (entry.ctx === undefined) return entry;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(entry.ctx)) {
    if (SENSITIVE_KEYS.has(k) && typeof v === "string") {
      out[k] = `[redacted len=${v.length}]`;
    } else {
      out[k] = v;
    }
  }
  return { ts: entry.ts, level: entry.level, ns: entry.ns, msg: entry.msg, ctx: out };
}

function formatTs(iso: string): string {
  // "2026-05-12T09:14:22.103Z" → "09:14:22.103" (UTC; cheap and stable)
  const t = iso.indexOf("T");
  if (t === -1) return iso;
  const z = iso.indexOf("Z");
  return iso.slice(t + 1, z === -1 ? undefined : z);
}
