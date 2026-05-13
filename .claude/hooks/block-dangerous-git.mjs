#!/usr/bin/env node
// PreToolUse / Bash — enforce CLAUDE.md git safety rules:
//   - Never use --no-verify
//   - git push --force to main requires explicit user authorization
//   - Never --amend a pushed commit
//   - Never rm -rf or git reset --hard without explicit authorization
//
// Override knob: set CLAUDE_ALLOW_DANGEROUS_GIT=1 in the environment to bypass.

import { execSync } from "node:child_process";
import { allow, block, readEvent } from "./_lib.mjs";

if (process.env.CLAUDE_ALLOW_DANGEROUS_GIT === "1") allow();

const evt = readEvent();
if (evt.tool_name !== "Bash") allow();

const cmd = String(evt.tool_input?.command ?? "");
if (!cmd) allow();

// Normalize whitespace for matching but keep original for error messages.
const c = cmd.replace(/\s+/g, " ").trim();

// 1) --no-verify anywhere in a git command.
if (/\bgit\b[^|;&]*\s--no-verify\b/.test(c)) {
  block(
    "git --no-verify is forbidden by CLAUDE.md. Fix the underlying hook " +
      "failure instead of skipping it."
  );
}

// 2) git push --force / -f. Block always when targeting main, and otherwise
//    when no explicit non-main ref is supplied (defensive).
if (/\bgit\s+push\b/.test(c) && /\s(-f|--force|--force-with-lease)\b/.test(c)) {
  // If main is referenced explicitly OR no branch is specified (defaults to current,
  // which on this repo is always main per CLAUDE.md), block.
  const mentionsMain = /\bmain\b/.test(c);
  const mentionsOtherRef = /\s(origin\s+\S+|HEAD:\S+)/.test(c) && !mentionsMain;
  if (mentionsMain || !mentionsOtherRef) {
    block(
      "git push --force to main requires explicit user authorization " +
        "(CLAUDE.md). If the user has approved, re-run with " +
        "CLAUDE_ALLOW_DANGEROUS_GIT=1."
    );
  }
}

// 3) git commit --amend on a commit that is already on the remote.
if (/\bgit\s+commit\b[^|;&]*\s--amend\b/.test(c)) {
  let pushed = false;
  try {
    const out = execSync("git branch -r --contains HEAD 2>/dev/null", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    pushed = out.trim().length > 0;
  } catch {
    // If git fails, default to blocking — safer than the alternative.
    pushed = true;
  }
  if (pushed) {
    block(
      "git commit --amend would rewrite a commit that is already on the " +
        "remote. CLAUDE.md: 'Never use --amend on a commit that has been " +
        "pushed.' Create a new commit instead."
    );
  }
}

// 4) git reset --hard.
if (/\bgit\s+reset\b[^|;&]*\s--hard\b/.test(c)) {
  block(
    "git reset --hard is destructive and requires explicit user " +
      "authorization (CLAUDE.md). Consider git stash or a soft reset first."
  );
}

// 5) rm -rf / rm -fr — block outright. The agent can almost always use
//    `rm -r` (still recursive) or target specific files. The narrow case
//    where -f is needed (read-only files) is rare enough to warrant an
//    explicit override.
if (/\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r)\b/.test(c)) {
  block(
    "rm -rf is blocked (CLAUDE.md). Use 'rm -r <path>' for non-destructive " +
      "recursive removal, or target specific files. If you genuinely need " +
      "to force-delete read-only files, set CLAUDE_ALLOW_DANGEROUS_GIT=1."
  );
}

allow();
