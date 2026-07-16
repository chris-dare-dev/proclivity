#!/usr/bin/env node
// PreToolUse / Edit|Write|MultiEdit — protect operating-instruction files
// from drive-by mid-task edits. These files define the project contract;
// agents occasionally "improve" them, which silently shifts the rules of
// engagement. Require an opt-in env flag.
//
// Override knob: set CLAUDE_ALLOW_OPS_EDITS=1 to bypass.

import { allow, block, readEvent } from "./_lib.mjs";

if (process.env.CLAUDE_ALLOW_OPS_EDITS === "1") allow();

const evt = readEvent();
const tool = evt.tool_name;
if (tool !== "Edit" && tool !== "Write" && tool !== "MultiEdit") allow();

const filePath = String(evt.tool_input?.file_path ?? "");
if (!filePath) allow();

const cwd = process.cwd();
let rel = filePath;
if (rel.startsWith(cwd + "/")) rel = rel.slice(cwd.length + 1);

// Match operating-instruction surfaces.
const protectedPatterns = [
  { test: /(^|\/)CLAUDE\.md$/, kind: "CLAUDE.md (project operating instructions)" },
  { test: /(^|\/)\.claude\/agents\/.+\.md$/, kind: "agent definition" },
  { test: /(^|\/)\.claude\/skills\/[^/]+\/SKILL\.md$/, kind: "skill definition" },
  { test: /(^|\/)\.claude\/settings\.json$/, kind: "project hook/permission settings" },
];

for (const { test, kind } of protectedPatterns) {
  if (test.test(rel)) {
    block(
      `Refusing to modify ${kind} mid-task. These files define the project ` +
        `contract — changes should be a deliberate, user-initiated action. ` +
        `If the user has approved this edit, re-run with ` +
        `CLAUDE_ALLOW_OPS_EDITS=1.\nPath: ${rel}`
    );
  }
}

allow();
