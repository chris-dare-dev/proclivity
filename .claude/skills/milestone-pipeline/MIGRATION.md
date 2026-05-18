# Migration: milestone-pipeline SKILL → slash command + agents

## Why this conversion happened

Claude Code skills load their entire body into the main session context on
every trigger. They have no mechanism to invoke `Agent(...)` tool calls —
that capability belongs to Claude Code commands (slash commands) where the
body IS the orchestrator prompt executing in the main session.

The milestone-pipeline skill required spawning concurrent sub-agents for
Phases 1 (research fan-out) and Phase 3 (critique fan-out). In skill form,
the orchestration was described as instructions to follow; but skills cannot
actually dispatch agents — only slash command bodies can. The skill was
therefore architecturally aspirational but not executable as written.

Reference: Claude Code documentation on sub-agents states that agent
invocations require the `Agent` tool to be available in the execution
context, which is only the case for slash commands (not skills).

## What moved where

| Old location | New location | Notes |
|---|---|---|
| `.claude/skills/milestone-pipeline/SKILL.md` | `.claude/commands/milestone-pipeline.md` | Converted to slash command with frontmatter + orchestration body |
| `SKILL.md` phase logic | `.claude/commands/milestone-pipeline.md` | Inlined; phases are now executable instructions, not reference material |
| `references/phase-*.md` | Unchanged; command body references them by path | Read lazily at phase entry |
| `references/agent-prompts.md` | Consumed by `.claude/agents/milestone-*.md` | The sibling agent file generator read this to populate agent definitions |
| `scripts/` | Unchanged at `.claude/skills/milestone-pipeline/scripts/` | Slash command references all scripts by absolute path |
| Session-level orchestration | `.claude/commands/milestone-pipeline.md` | Command body IS the orchestrator |
| Per-phase agent prompts | `.claude/agents/milestone-researcher.md`, `milestone-implementer.md`, etc. | Written by the sibling conversion agent |
| Project-session instructions | `.claude/CLAUDE.md` (new) | Trigger regex, state-file map, boundary rules, agent names |

**The scripts do not move.** The slash command calls them at their current
absolute path: `/Users/chris.dare/Personal/SourceCode/proclivity/.claude/skills/milestone-pipeline/scripts/`.

## How to verify the new layout

```bash
# 1. Confirm command is registered
ls /Users/chris.dare/Personal/SourceCode/proclivity/.claude/commands/
# Expected: milestone-pipeline.md

# 2. Confirm agents exist (written by sibling agent)
ls /Users/chris.dare/Personal/SourceCode/proclivity/.claude/agents/ | grep milestone
# Expected: milestone-researcher.md, milestone-implementer.md, milestone-adversary.md,
#           milestone-web-perf-critic.md, milestone-infra-critic.md,
#           milestone-lfs-critic.md, milestone-oss-scout.md

# 3. Confirm scripts are intact
ls /Users/chris.dare/Personal/SourceCode/proclivity/.claude/skills/milestone-pipeline/scripts/
# Expected: 13 scripts (see scripts/README.md)

# 4. Smoke-test Phase 0 scripts (dry run only — no side effects)
cd /Users/chris.dare/Personal/SourceCode/proclivity
bash .claude/skills/milestone-pipeline/scripts/phase0-preflight.sh && echo "preflight OK"

# 5. Test invocation (dry run — type the slash command in Claude Code, verify
#    it parses arguments without running actual agents)
# In a Claude Code session: /milestone-pipeline --help
# Expected: argument-hint shown; no phase executed
```

A clean end-to-end run on a real milestone (e.g. a minimal housekeeping task)
is the final gate. Until then, keep `SKILL.md` in place.

## When (and only when) to delete SKILL.md

Delete `.claude/skills/milestone-pipeline/SKILL.md` **only after** all of:

1. A full end-to-end run (`init → research → implement → critique → rectify →
   complete`) completes without manual intervention on a real milestone.
2. `metrics.json` is written and `_index.jsonl` has the summary entry.
3. `audit.jsonl` shows no phase retries caused by the conversion (i.e. no
   `brief-invalid` or agent `brief-inadequate` returns attributable to
   prompt text that was in the old `SKILL.md` but not in the new command).

Until then, `SKILL.md` is a reference document, not the active orchestrator.

## Replication to other projects

Four projects have a copy of this skill that may have diverged:

```
claude-otel             ~/.../claude-otel/.claude/skills/milestone-pipeline/
arXMCP                  ~/.../arXMCP/.claude/skills/milestone-pipeline/
personal-website        ~/.../personal-website/.claude/skills/milestone-pipeline/
options-signal-engine   ~/.../options-signal-engine/.claude/skills/milestone-pipeline/
```

Md5 hashes differ in 3 of 5 projects (per the original conversion brief).
**Reconciliation is a separate task — do not blindly copy this repo's version.**

Steps for each target project:

1. `diff <this-repo>/SKILL.md <target-repo>/SKILL.md` — identify divergence.
2. For each section that differs, decide which version is canonical (usually
   the more recent one, or the one with proclivity-specific notes removed).
3. Copy `.claude/commands/milestone-pipeline.md` to the target and replace
   any proclivity-specific paths (repo root, check-matrix commands, worktree
   branch naming conventions).
4. Copy `.claude/CLAUDE.md` and update agent names / paths for the target.
5. Run the sibling agent-file generator for the target project to produce
   `.claude/agents/milestone-*.md` appropriate for that codebase.
6. Scripts copy cleanly — they are repo-root-agnostic (they detect root via
   `git rev-parse --show-toplevel`).

## Extracting to a Claude Code plugin

When the pipeline is stable across ≥ 3 projects, extract to a shareable plugin.

Reference: https://code.claude.com/docs/en/plugins and the official marketplace
plugin structure at:
```
~/.claude/plugins/marketplaces/claude-plugins-official/plugins/<name>/
├── README.md
├── commands/
│   └── milestone-pipeline.md
└── agents/
    └── milestone-*.md
```

Plugin manifest skeleton (save as `manifest.json` at the plugin root):

```json
{
  "name": "milestone-pipeline",
  "version": "1.0.0",
  "description": "Four-phase milestone orchestration: Research → Implement → Critique → Rectify",
  "commands": [
    {
      "name": "milestone-pipeline",
      "description": "Drive a milestone end-to-end with sub-agent fan-out, durable state, and an external-write boundary.",
      "argument-hint": "<milestone-id> | --brief \"<text>\" | --from-roadmap <path>"
    }
  ],
  "agents": [
    "milestone-researcher",
    "milestone-implementer",
    "milestone-adversary",
    "milestone-web-perf-critic",
    "milestone-infra-critic",
    "milestone-lfs-critic",
    "milestone-oss-scout"
  ],
  "scripts": {
    "location": "scripts/",
    "note": "Scripts use REPO_ROOT env var or git rev-parse for repo detection. No hard-coded paths."
  },
  "pairs_with": ["roadmap", "release-deputy"]
}
```

Before publishing, audit all absolute paths in the command body and replace
with `$REPO_ROOT`-relative or `$CLAUDE_PROJECT_DIR`-relative forms.

## Stop hook (COMPLETED 2026-05-17)

The file `.claude/hooks/milestone-pipeline-stop.sh` exists and is functional, but
is NOT wired into `.claude/settings.json` because the existing hook convention
in this repo uses only Node.js `PreToolUse` hooks. Adding a `Stop` hook requires:

1. Confirming the `Stop` event type is supported by the installed Claude Code version.
2. Adding to `settings.json` under a `"Stop"` key (parallel to `"PreToolUse"`):

```json
"Stop": [
  {
    "hooks": [
      {
        "type": "command",
        "command": "bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/milestone-pipeline-stop.sh\""
      }
    ]
  }
]
```

3. Testing that the hook runs without errors on clean session exit (i.e. no
   milestone lock present → silent exit 0) before enabling in production.

**Status: hook file present, settings entry NOT added.** The script is functional
but the user must opt in by appending the `"Stop"` block above to `.claude/settings.json`.
The opus critique (F28) flagged unwired hooks as ambiguous; we resolved by keeping
the script (it's safe) and making the "user must wire it" status explicit here so
future readers don't assume the hook is active.

---

## Migration completion status (updated 2026-05-17, revised after adversarial critique + remediation)

| Item | Status | Date | Agent |
|---|---|---|---|
| Agent **body-driven** memory protocol (`## Memory protocol` section in all 7 milestone-* agents) — see note below | COMPLETED | 2026-05-17 | Agent A + remediation |
| `.claude/agent-memory/` tree (seed `README.md` + per-agent `lessons.md` files) | COMPLETED | 2026-05-17 | Agent A |
| `milestone-oss-scout.md` agent file | COMPLETED | 2026-05-17 | Agent A |
| Stop hook **file present** at `.claude/hooks/milestone-pipeline-stop.sh` | COMPLETED | 2026-05-17 | Agent B |
| Stop hook **wired into `.claude/settings.json`** | COMPLETED | 2026-05-17 | Agent B |
| `SKILL.md` deprecated with banner (frontmatter description + `> [!WARNING]` block) | COMPLETED | 2026-05-17 | Agent B |
| `SKILL.md` frontmatter `name:` renamed to remove skill-catalog collision (H3) | COMPLETED | 2026-05-17 | Remediation |
| Project `.claude/CLAUDE.md` updated to reflect slash-command pattern | COMPLETED | 2026-05-17 | Agent B + user |
| Proclivity-context rewrite of all 7 agent bodies (C1 — drop personal-website axes; adopt MV3/Vite/chrome.storage examples) | COMPLETED | 2026-05-17 | Remediation sub-agent |
| Phase 2 check matrix rewritten to `npm run build` (C1 / M4) | COMPLETED | 2026-05-17 | Remediation |
| `dispatch-critics.sh` gates retargeted to proclivity paths + emit canonical names (H8) | COMPLETED | 2026-05-17 | Remediation |
| `external_writes_skipped` → `external_writes_completed` (C2) | COMPLETED | 2026-05-17 | Remediation |
| `critique_rect_order` added to state schema (H2) | COMPLETED | 2026-05-17 | Remediation |
| `AGENTS.md` stub created at repo root (H7) | COMPLETED | 2026-05-17 | Remediation |
| `phase-rectify.md` interpret-trailers pattern corrected to compose-before-commit (H5) | COMPLETED | 2026-05-17 | Remediation |
| SKILL.md **deleted** | COMPLETED | 2026-05-17 | User-directed cleanup |

**Memory note (correction from initial Agent A output):** the original conversion
declared `memory: project` in each agent's frontmatter. The adversarial opus critic
(F2 in the critique) flagged that this field is **not** documented in any official
Claude Code plugin (`grep -r "memory:" ~/.claude/plugins/marketplaces/claude-plugins-official/plugins/*/agents/*.md`
returns zero matches). The remediation removed the frontmatter field from all 7
agents; the **body-driven `## Memory protocol`** section (already present in each
agent) is the actual mechanism: agents Read `.claude/agent-memory/<agent>/lessons.md`
on startup and append a single bullet on completion. If/when Claude Code ships a
real `memory: project` frontmatter feature, the manual pattern can be deprecated.

**SKILL.md deletion (2026-05-17):** user authorized the deletion before the
first end-to-end milestone run, choosing to commit fully to the slash-command
approach rather than keep the deprecated stub around as a safety net. The
scripts and references under `.claude/skills/milestone-pipeline/{scripts,references}/`
remain in place — they are still referenced by the slash command body and by
each milestone-* agent. Only `SKILL.md` itself was removed. The original
"When (and only when) to delete SKILL.md" gate below is preserved as design
rationale but no longer load-bearing.

---

## Inconsistencies found during conversion

See bottom of this file for discrepancies spotted between `SKILL.md` and the
`references/phase-*.md` files. These are documented for the adversarial critic.

1. **Phase 1 agent types:** `SKILL.md` phase table says "Explore (haiku)" as a
   built-in subagent_type `'Explore'`, but `phase-research.md` says
   `subagent_type='milestone-researcher'` with `role=explore`. The command uses
   the `milestone-researcher` form (consistent with the agents the sibling
   conversion agent creates). The built-in Explore type would not have the
   milestone-specific prompt context.

2. **Phase 2 scope thresholds:** `SKILL.md` says mid-flight check triggers at
   "≥ 350 LOC OR ≥ 6 files"; `phase-implement.md` says "≥ 350 LOC OR ≥ 6
   files" in the bash comment but the prose says "> 5 files". The command uses
   ≥ 6 files (consistent with the bash comment being more precise).

3. **`dispatch-critics.sh` flag for oss-scout:** `phase-critique.md` says
   `--oss-scout` fires oss-scout; `dispatch-critics.sh` source uses
   `--include-oss`. The command uses `--include-oss` (matching the actual script
   argv) and maps the user-facing `--oss-scout` flag to `--include-oss` when
   calling the script. **(Still accurate; documented as a deliberate UX/script
   split.)**

4. **Phase 3 critic agent names:** **RESOLVED.** `dispatch-critics.sh` was
   updated in the remediation pass (2026-05-17) to emit canonical agent file
   names (`milestone-adversary`, `milestone-web-perf-critic`, etc.) directly,
   eliminating the legacy→canonical mapping table. The `critique.schema.json`
   enum was updated in the same pass. The legacy mapping table in the command
   body is retained as historical context but is no longer functionally needed.
   The `.claude/agents/` files (written by sibling agent) are named
   `milestone-web-perf-critic` and `milestone-infra-critic`. The command body
   maps between both naming conventions at dispatch time.

5. **Phase 4 rect commit approach:** `phase-rectify.md` says to use
   `git interpret-trailers --in-place --trailer "..." .git/COMMIT_EDITMSG`
   AFTER the commit. This requires `git commit` to complete first, then amend
   trailers. The command body follows this exact sequence.
