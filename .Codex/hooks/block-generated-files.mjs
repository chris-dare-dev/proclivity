#!/usr/bin/env node
// PreToolUse / Edit|Write|MultiEdit — prevent hand-edits to generated emit,
// build output, secrets, and lockfiles. These are either gitignored
// (see .gitignore) or owned by tooling that will overwrite the change.
//
// Override knob: set CLAUDE_ALLOW_GENERATED_EDITS=1 to bypass.

import { allow, block, readEvent } from "./_lib.mjs";

if (process.env.CLAUDE_ALLOW_GENERATED_EDITS === "1") allow();

const evt = readEvent();
const tool = evt.tool_name;
if (tool !== "Edit" && tool !== "Write" && tool !== "MultiEdit") allow();

const filePath = String(evt.tool_input?.file_path ?? "");
if (!filePath) allow();

// Normalize: strip CWD prefix so we match on a project-relative path.
const cwd = process.cwd();
let rel = filePath;
if (rel.startsWith(cwd + "/")) rel = rel.slice(cwd.length + 1);

// Rule table: [test, reason]
const rules = [
  [
    (p) => /(^|\/)\.env(\.|$)/.test(p) || /(^|\/)\.env$/.test(p),
    ".env files contain secrets and are gitignored. Refusing to write.",
  ],
  [
    (p) => p.endsWith(".tsbuildinfo"),
    "*.tsbuildinfo is emit from `tsc -b` (gitignored). Edit the source instead.",
  ],
  [
    (p) =>
      /(^|\/)vite\.config\.(js|d\.ts)$/.test(p) ||
      /(^|\/)manifest\.config\.(js|d\.ts)$/.test(p),
    "This file is generated from the .ts source by tsc -b (gitignored). " +
      "Edit the corresponding .ts file.",
  ],
  [
    (p) => p === "dist" || p.startsWith("dist/"),
    "dist/ is Vite build output (gitignored). It will be overwritten by " +
      "`npm run build`.",
  ],
  [
    (p) => p.includes("node_modules/"),
    "Refusing to write inside node_modules/. Modify package.json instead.",
  ],
  [
    (p) => /(^|\/)package-lock\.json$/.test(p),
    "Do not hand-edit package-lock.json. Use `npm install` to regenerate it.",
  ],
];

for (const [test, reason] of rules) {
  if (test(rel)) block(`${reason}\nPath: ${rel}`);
}

allow();
