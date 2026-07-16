// Shared helpers for Proclivity Claude Code hooks.
// Hooks receive a JSON event on stdin. To block, write a message to stderr
// and exit 2 — Claude Code will surface stderr back to the agent.

import { readFileSync } from "node:fs";

export function readEvent() {
  const raw = readFileSync(0, "utf8");
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function block(reason) {
  process.stderr.write(`[proclivity-hook] BLOCKED: ${reason}\n`);
  process.exit(2);
}

export function allow() {
  process.exit(0);
}
