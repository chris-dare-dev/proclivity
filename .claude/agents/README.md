# `.claude/agents/` — Sub-agent index

Sub-agents run in isolated fresh context windows, invoked by the main session via
`Agent(subagent_type='<name>', prompt=...)`. They cannot spawn other sub-agents.

## Milestone pipeline agents

These seven agents implement the parallel fan-out steps of the milestone pipeline.
The orchestrator lives at `.claude/commands/milestone-pipeline.md` (slash command).
Phase 4 (rectify) intentionally does NOT have a sub-agent — see "Anti-pattern: no
rectifier agent" below.

Trigger conditions reflect proclivity's actual surface (Vite + React 18 + MV3
Chrome extension; no `web/`, `bin/`, `infra/`, `Pulumi.*.yaml`, or
`docker-compose.yml`). The orchestrator computes the critic set at Phase 3:
`milestone-adversary-critic` always fires; overlay critics
(`milestone-*-critic.md` files not in `.claude/.registry-manifest.json`) fire
when the diff matches the trigger declared in their frontmatter description.

| Agent | Trigger condition | Output path | Model | Memory |
|---|---|---|---|---|
| `milestone-researcher` | Phase 1, always (general-purpose Sonnet slot) | `.claude/notes/milestones/<id>/research/brief-2.md` | sonnet | `memory: project` |
| `milestone-implementer` | Phase 2, delegated path (300–800 LOC or >5 files) | `.claude/notes/milestones/<id>/implement/synthesis.md` | sonnet | `memory: project` |
| `milestone-adversary-critic` | Phase 3, always | `.claude/notes/milestones/<id>/critique/adversary.md` | opus | `memory: project` |
| `milestone-web-perf-critic` | Phase 3, when diff touches `src/`, `public/`, `manifest.config.ts`, `vite.config.ts`, `tsconfig.json`, `package(-lock)?.json`, or `index.html` | `.claude/notes/milestones/<id>/critique/web.md` | sonnet | `memory: project` |
| `milestone-infra-critic` | Phase 3, when diff touches `.github/workflows/**` | `.claude/notes/milestones/<id>/critique/infra.md` | sonnet | `memory: project` |
| `milestone-lfs-critic` | Phase 3, when diff touches `.gitattributes` or adds any binary asset (png/jpg/heic/mp4/etc.) | `.claude/notes/milestones/<id>/critique/lfs.md` | sonnet | `memory: project` |
| `milestone-oss-scout` | Phase 3, only when `--oss-scout` flag passed OR brief mentions adding a new npm dependency | `.claude/notes/milestones/<id>/critique/oss.md` | sonnet | `memory: project` |

## How to invoke milestone pipeline (orchestrator syntax)

The orchestrator dispatches all Phase 1 and Phase 3 agents in a **single turn** (parallel):

```python
# Phase 1 — parallel (one turn)
Agent(subagent_type='milestone-researcher', prompt=f"""
You are the external-research + external-writes researcher for milestone {id}.
<milestone-brief>{brief}</milestone-brief>
Write your brief to {brief_path}.
Return per <output-contract>.
""")

# Phase 3 — parallel (one turn, all critics at once)
Agent(subagent_type='milestone-adversary-critic', prompt=f"Review milestone {id}, commits {commit_range}. Write to {critique_path}.")
Agent(subagent_type='milestone-web-perf-critic', prompt=f"Review milestone {id}, commits {commit_range}. Write to {critique_path}.")
# etc.
```

Phase 2 (delegated):
```python
Agent(subagent_type='milestone-implementer', prompt=f"Implement milestone {id} on branch {branch} from {base_sha}.")
```

**Key constraint:** ALL Phase 1 Agent calls in ONE turn. ALL Phase 3 Agent calls in ONE
turn. Sequential dispatch destroys the parallelism cost model.

## Anti-pattern: no rectifier agent

Phase 4 (rectify) runs in the **main session ONLY**. There is intentionally no
`milestone-rectifier` sub-agent.

Reason: sub-agents cannot spawn sub-agents. The rectifier may need to delegate to
specialist fixers for complex repairs. More importantly, the actor-critic architecture
requires that the rectifier is NOT the implementer — but a sub-agent rectifier
dispatched from the main session would still share no context with the implementer,
which is fine, EXCEPT that if the rectifier needs to escalate (loop cap exhausted,
same-error-twice), it must surface to the user. That escalation only works cleanly in
the main session.

Do not add a `milestone-rectifier.md` without re-reading the "Anti-pattern guard
table" in `.claude/commands/milestone-pipeline.md` and `phase-rectify.md`'s "Hard rules" section first.

## Roadmap pipeline agents

These four agents implement the sequential phases of the `/roadmap` slash command.
The orchestrator lives at `.claude/commands/roadmap.md`. All four write to
`plans/<slug>/roadmap.yaml` (roadmap/1) in successive passes; each advances the
`phase:` field via `python3 .claude/scripts/roadmap-init.py <slug> --advance <phase>`
only after `roadmap-validate.py` passes.

Unlike milestone-pipeline (which fans out in parallel within Phase 1 + Phase 3),
the roadmap pipeline is strictly **sequential** — each phase consumes the prior
phase's output from the roadmap doc. Planning is well-served by single-pass
synthesis (addyosmani's `idea-refine` and `planning-and-task-breakdown` follow
the same pattern).

| Agent | Phase | Output (all in `plans/<slug>/roadmap.yaml`) | Model | Memory |
|---|---|---|---|---|
| `roadmap-refiner` | Phase 1 — Refine | `title`, `brief`, `goal:` block (objectives, key results, assumptions, wont) | sonnet | `memory: project` |
| `roadmap-decomposer` | Phase 2 — Decompose | 2–6 vertically-sliced epic items | sonnet | `memory: project` |
| `roadmap-sequencer` | Phase 3 — Sequence | milestones/tasks/spikes, lanes, MoSCoW + RICE scores, acceptance | sonnet | `memory: project` |
| `roadmap-materializer` | Phase 4 — Materialize | final validation, links, `status: active`, optional `--github` bodies | sonnet | `memory: project` |

## How to invoke roadmap pipeline (orchestrator syntax)

Sequential — ONE agent dispatched at a time. The orchestrator routes on the JSON
return contract's `status` field (see each agent body):

```python
# Phase 1 — sequential (one turn)
Agent(subagent_type='roadmap-refiner', prompt=f"""
Inputs: {{SLUG}}={slug}, {{ROADMAP_PATH}}={path}, {{BRIEF}}={brief}.
Read .claude/references/roadmap-phase-refine.md before writing.
Return per <output-contract>.
""")
# The agent itself validates (roadmap-validate.py) and advances the phase
# (roadmap-init.py <slug> --advance refined) before returning. Then dispatch
# roadmap-decomposer with {SLUG} + {ROADMAP_PATH}. Repeat through
# sequencer + materializer.
```

On `status=gate-required`: surface the agent's gate question (from summary line 2)
to the user, then re-dispatch the SAME agent with `--user-resolution "<answer>"`
appended to inputs. The roadmap-materializer is special — it also gates on
`gh issue create` authorization; the ORCHESTRATOR runs `gh`, never the agent.

## Scripts used by roadmap agents

Registry-synced flat files at `.claude/scripts/`:
- `roadmap-init.py` — init scaffold, resume detection, `--advance`, `--status`
- `roadmap-validate.py` — structural + semantic validation (`--json` mode)
- `roadmap-score-moscow.py` — MoSCoW Must-cap validator
- `roadmap-score-rice.py` — RICE scoring
- `roadmap-schema.json` — the roadmap/1 JSON Schema contract

## Existing non-milestone, non-roadmap agents

| Agent | Purpose |
|---|---|
| `ui-ux-critic` | Browser + source review of the proclivity newtab; design critique and OSS recommendations for UI implementation agent |

## Persistent memory (frontmatter + body)

Every milestone-* and roadmap-* agent uses **both**:

1. **`memory: project` in frontmatter** — the canonical Claude Code mechanism
   (Options-signal-engine confirms this is the working convention; proclivity
   adopted it 2026-05-17).
2. **A body-side memory section** — the actual prompt instructing the agent
   to Read `.claude/agent-memory/<agent-name>/lessons.md` at startup and
   Append one entry on completion via Bash heredoc.

The frontmatter alone does NOT auto-inject memory content into the dispatch
prompt — the body-side protocol is what makes the agent actually USE the
memory. Both are load-bearing; do not strip either.

Entry formats differ between pipelines (milestone-* uses ISO timestamp + 4-bullet
schema; roadmap-* uses slug + date + 2–5 bullets). See
`.claude/agent-memory/README.md` § "Entry format" for the canonical templates.

## Reference files

All agents resolve reference files from the repo root (`{REPO_ROOT}` is passed
in every dispatch; CWD is not guaranteed in a fresh sub-agent context). All
references and scripts are registry-synced flat files:

**Milestone pipeline** (`{REPO_ROOT}/.claude/`):
- Critique format: `references/milestone-pipeline-critique-format.md`
- Phase refs: `references/milestone-pipeline-phase-{research,implement,critique,rectify}.md`
- State schema: `references/milestone-pipeline-state-schema.md`
- Scripts: `scripts/milestone-pipeline-*.{py,sh}`

**Roadmap pipeline** (`{REPO_ROOT}/.claude/`):
- Phase refs + frameworks + anti-patterns: `references/roadmap-*.md`
- Golden fixture: `references/roadmap-example.yaml`
- Scripts + schema: `scripts/roadmap-*.py`, `scripts/roadmap-schema.json`
- Project conventions: `references/roadmap-proclivity-integration.md`
