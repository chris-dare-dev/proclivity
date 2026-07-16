#!/usr/bin/env node
// PreToolUse / Bash — guard the 200kB initial-chunk budget by blocking
// dependency additions that haven't been explicitly authorized.
//
// Allows: bare `npm install`, `npm ci`, `npm update`, `npm uninstall <pkg>`,
//         scripts like `npm run build`.
// Blocks: `npm install <pkg>`, `npm i <pkg>`, `npm add <pkg>`, and the
//         equivalent yarn/pnpm/bun commands.
//
// Override knob: set CLAUDE_ALLOW_NPM_INSTALL=1 to bypass.

import { allow, block, readEvent } from "./_lib.mjs";

if (process.env.CLAUDE_ALLOW_NPM_INSTALL === "1") allow();

const evt = readEvent();
if (evt.tool_name !== "Bash") allow();

const cmd = String(evt.tool_input?.command ?? "").trim();
if (!cmd) allow();

// Split on shell separators so chained commands (`foo && npm i react`) are
// inspected in pieces.
const segments = cmd.split(/&&|\|\||;|\|/).map((s) => s.trim()).filter(Boolean);

for (const seg of segments) {
  // npm install <pkg>, npm i <pkg>, npm add <pkg>
  const npmMatch = seg.match(/^npm\s+(install|i|add)\b(.*)$/);
  if (npmMatch) {
    const rest = (npmMatch[2] ?? "").trim();
    // Bare `npm install` / `npm i` is fine (lockfile refresh).
    if (!rest) continue;
    // Strip flags; if anything non-flag remains, it's a package argument.
    const tokens = rest.split(/\s+/).filter((t) => !t.startsWith("-"));
    if (tokens.length > 0) {
      block(
        `Adding npm dependencies requires explicit justification ` +
          `(CLAUDE.md: 200kB initial-chunk budget). Blocked: '${seg}'. ` +
          `Discuss with the user, then re-run with CLAUDE_ALLOW_NPM_INSTALL=1.`
      );
    }
  }

  // yarn add / pnpm add / bun add
  if (/^(yarn|pnpm|bun)\s+add\b/.test(seg)) {
    block(
      `This repo uses npm. Refusing to invoke '${seg.split(/\s+/)[0]} add' — ` +
        `it would diverge package-lock.json or add an unintended dependency.`
    );
  }
}

allow();
