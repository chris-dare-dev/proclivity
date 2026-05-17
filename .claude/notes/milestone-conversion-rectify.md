# Rectify summary — milestone-pipeline skill → slash-command conversion

**Date:** 2026-05-17
**Critique source:** `.claude/notes/milestone-conversion-critique.md` (opus-adversary)
**Critique counts:** 2 CRITICAL · 8 HIGH · 7 MEDIUM · 4 LOW · 3 INFO

## Fixed (16 of 24 findings)

| ID | Severity | Status | Notes |
|---|---|---|---|
| C1 | CRITICAL | **fixed** | All 7 agent bodies rewritten for proclivity (Vite/MV3/chrome.storage) by a focused sub-agent. Phase 2 check matrix in command body now uses `npm run build` only. `dispatch-critics.sh` retargeted to proclivity paths (`src/`, `public/`, `.github/workflows/`, binary assets). |
| C2 | CRITICAL | **fixed** | Renamed `external_writes_skipped` → `external_writes_completed` in command Phase 4e + `phase-rectify.md` §5. Both authorize and skip replies append to `external_writes_completed`. |
| H1 | HIGH | **fixed** | Removed the dead `dedupe-findings.py` re-invocation + `grep "dedup complete:"` block. The first invocation's JSON output (`{counts, rect_order, path}`) is the canonical source. |
| H2 | HIGH | **fixed** | Added `critique_rect_order` to `state.schema.json` (pattern `^[CHMLI][0-9]+$`). |
| H3 | HIGH | **fixed** | Renamed SKILL.md frontmatter `name: milestone-pipeline` → `name: milestone-pipeline-archive`. Skill catalog no longer collides with the slash command. |
| H4 | HIGH | **fixed** | `.claude/CLAUDE.md` and `.claude/agent-memory/README.md` now correctly state that `memory: project` is NOT a documented Claude Code field. Memory is body-driven via each agent's `## Memory protocol` section. |
| H5 | HIGH | **fixed** | `phase-rectify.md` rewritten to instruct compose-trailers-before-commit pattern; explicitly warns against `git interpret-trailers --in-place .git/COMMIT_EDITMSG` after a commit. |
| H6 | HIGH | **fixed** | `references/agent-prompts.md` Phase 1 prompt no longer tells researchers to consult "any relevant SKILL.md files"; explicitly says to skip files whose frontmatter description begins with `DEPRECATED`. |
| H7 | HIGH | **fixed** | Created `AGENTS.md` stub at repo root pointing to `CLAUDE.md`. Researcher prompt updated to handle stub gracefully. |
| H8 | HIGH | **fixed** | `dispatch-critics.sh` emits canonical `milestone-*` names; `critique.schema.json` enum updated; command body legacy→canonical mapping table removed; Phase 4d trailer loop simplified (no more case-mapping). |
| L1 | LOW | **fixed** | `--deep` and `--single` documented as MUTUALLY EXCLUSIVE in command argument-parsing section. |
| L2 | LOW | **fixed** | `agents/README.md` "Inconsistency notes" section removed; trigger conditions in the table now match `dispatch-critics.sh` reality. |
| L3 | LOW | **fixed** | `agent-prompts.md` LFS section now describes `milestone-lfs-critic` as a sub-agent invocation, not a Bash call. |
| L4 | LOW | **fixed** | `agent-prompts.md` Phase 3 critic section headings use canonical `milestone-*` names. |
| I1 | INFO | **fixed** | `.claude/agent-memory/README.md` no longer claims `compute-metrics.py` reads memory files. Memory may be consumed by future tooling only. |
| M5 | MEDIUM | **fixed** | Removed unused `WebFetch, WebSearch` from `milestone-adversary` frontmatter `tools:`. |
| M7 | MEDIUM | **fixed** | Removed dead `IS_RESUME` variable from command argument-parsing section. `init-state.sh` is the single source of truth for resume detection. |
| M1 | MEDIUM | **fixed** | `phase-research.md` agent table reconciled with command body — all three Phase 1 slots dispatch the single `milestone-researcher` agent with `role` substituted. |
| M3 | MEDIUM | **fixed** | Added comment to `milestone-pipeline-stop.sh` explaining `set -uo pipefail` (no `-e`) is intentional — Stop hook must not block session exit. |
| M4 | MEDIUM | **fixed** | (Subsumed by C1.) Phase 2 check matrix rewritten to `npm run build` + clean working tree; `bun`/`bats`/`bin/site`/`lfs-doctor.sh` references removed. |
| M6 | MEDIUM | **fixed** | (Subsumed by C1/M4.) Command body no longer references the nonexistent `lfs-doctor.sh`. The lfs-critic agent body already handled its absence gracefully. |

## Deferred (4 of 24 findings) — rationale per item

| ID | Severity | Defer reason |
|---|---|---|
| M2 | MEDIUM | False-positive flag in Agent B's deliverable summary; no code change required. The flag was that `dispatch-critics.sh` doesn't gate on `.github/workflows/`, but it does. **No fix needed; documented in MIGRATION.md.** |
| I2 | INFO | Severity rubric duplicated across 5 critics. Architectural refactor (centralize via dispatch-time substitution or extract to `references/severity-rubric.md`) is non-trivial and orthogonal to the conversion. Track separately. |
| I3 | INFO | `init-state.sh` lock-take is TOCTOU non-atomic. Theoretical concern only — proclivity is solo-use, `state-schema.md` explicitly says multi-milestone parallelism is not supported. Wrap in `flock` if/when this becomes a real concern. |
| (open) | — | A clean end-to-end run on a real milestone is required before `SKILL.md` itself can be deleted (per `MIGRATION.md` § "When (and only when) to delete SKILL.md"). The deprecation banner + frontmatter rename make the file inert as an orchestrator. |

## Files touched in this remediation

### Sub-agent (C1 body rewrites)

- `.claude/agents/milestone-adversary.md` (axes 1–13 rewritten; M5 tools fix)
- `.claude/agents/milestone-implementer.md` (check matrix → `npm run build`)
- `.claude/agents/milestone-infra-critic.md` (refactored for GitHub Actions)
- `.claude/agents/milestone-lfs-critic.md` (refactored for binary asset hygiene)
- `.claude/agents/milestone-oss-scout.md` (proclivity dep examples)
- `.claude/agents/milestone-researcher.md` (AGENTS.md stub note; proclivity external-writes examples)
- `.claude/agents/milestone-web-perf-critic.md` (axes rewritten for MV3)

### Main session

- `AGENTS.md` (created — H7 stub)
- `.claude/CLAUDE.md` (table row descriptions for refactored infra/lfs critics)
- `.claude/agents/README.md` (rewrote table + dropped resolved inconsistency notes)
- `.claude/agent-memory/README.md` (I1 + body-driven memory clarification)
- `.claude/commands/milestone-pipeline.md` (C1 Phase 2 matrix; C2; H1; M7; L1; legacy-name removal)
- `.claude/hooks/milestone-pipeline-stop.sh` (M3 comment)
- `.claude/skills/milestone-pipeline/MIGRATION.md` (completion table extended; inconsistency #4 marked resolved)
- `.claude/skills/milestone-pipeline/SKILL.md` (H3 frontmatter rename)
- `.claude/skills/milestone-pipeline/references/agent-prompts.md` (H6 + L3 + L4)
- `.claude/skills/milestone-pipeline/references/phase-rectify.md` (H5 + C2 alignment)
- `.claude/skills/milestone-pipeline/references/phase-research.md` (M1 reconciliation)
- `.claude/skills/milestone-pipeline/references/schemas/critique.schema.json` (H8 enum)
- `.claude/skills/milestone-pipeline/references/schemas/state.schema.json` (H2 critique_rect_order)
- `.claude/skills/milestone-pipeline/scripts/dispatch-critics.sh` (H8 canonical names + proclivity-correct gates)

## Verification

- `python3 -m json.tool` parses both schemas + `settings.json` cleanly.
- `bash -n` validates `dispatch-critics.sh` + `milestone-pipeline-stop.sh`.
- `<untrusted-content-policy>` block SHA preserved byte-identical across all 7 agents (`3f631398efcc08cefb65e7e8545b0330497a9b50fa565038205a27878c36d496`).
- No source code changes; `npm run build` state unchanged.

## Remaining gate

The conversion is complete locally. The opus critic's own deferral applies:
**a single full end-to-end pipeline run on a real proclivity milestone**
(init → research → implement → critique → rectify → complete) is the final
acceptance test. After that runs cleanly, `SKILL.md` can be deleted per
the `MIGRATION.md` policy.
