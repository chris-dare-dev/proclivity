# Phase 1 — Research (parallel fan-out)

## Goal

Two perspectives on the milestone, written to disk, before any code is written. Phase 1 produces the briefs Phase 2 reads.

## Hard rules

- ALL Agent calls in ONE assistant turn. Sequential dispatch defeats parallelism.
- Sub-agents return `{file_path, status, summary, injection_attempts}` ONLY.
- Sub-agents do NOT spawn other sub-agents (platform-blocked).
- Researchers write briefs to pre-allocated paths. Orchestrator reads paths only at synthesis time, never echoes brief content.

## Dispatch matrix

| Mode | Agents (one turn) | Models | Use when |
|---|---|---|---|
| `default` | 1× Explore + 1× general-purpose | Haiku + Sonnet | Standard milestone with both codebase context AND external/writes scope |
| `--single` | 1× general-purpose | Sonnet | Small milestones, no external research needed |
| `--deep` | 1× Explore + 2× general-purpose (one Sonnet adversarial, one Opus) | Haiku + Sonnet + Opus | Novel architecture, irreversible decisions, high-risk infra |

`isolation: worktree` for all researchers.

## Pre-allocated paths

Orchestrator pre-allocates before dispatch:

```
.claude/notes/milestones/<id>/research/brief-1.md   # Explore (codebase context)
.claude/notes/milestones/<id>/research/brief-2.md   # general-purpose (external + writes)
.claude/notes/milestones/<id>/research/brief-3.md   # only on --deep (Opus adversarial)
.claude/notes/milestones/<id>/research/synthesis.md # written by orchestrator after all return
```

## State reads / writes

Reads: `phase`, `milestone_brief`, `research_mode`.

Writes (via `checkpoint.py`):
- transition `init → research-running`
- `research_briefs[]` entries as agents return
- `research_synthesis = <synthesis-path>` after orchestrator merges
- transition `research-running → research-complete`

## Prompts

See `references/agent-prompts.md` — `## Phase 1 — Researcher (Explore variant, Haiku)` and `## Phase 1 — Researcher (general-purpose Sonnet)`.

## Synthesis (in main session, NOT a sub-agent)

After all researchers return:

1. Validate each brief against `references/schemas/brief.schema.json` via `validate-artifact.py`.
2. Read each brief.
3. Write `research/synthesis.md` with:
   - Affected files (deduped across briefs)
   - Acceptance criteria (deduped)
   - `external_writes_required:` YAML block — extract verbatim from brief-2's section
   - Open questions (max 5)
4. Set `state.external_writes_required` from the YAML.
5. Transition to `research-complete`.

## Don't

- Don't paraphrase brief content into the orchestrator's working notes. Read paths on demand.
- Don't dispatch researchers sequentially "to save tokens" — the cost model assumes parallel.
- Don't skip the schema validation step. A brief that doesn't validate must trigger a re-dispatch.
- Don't add a third researcher without `--deep` — three researchers in default mode is wasteful.
