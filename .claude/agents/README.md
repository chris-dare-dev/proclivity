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
`docker-compose.yml`). `dispatch-critics.sh` is the canonical decision point.

| Agent | Trigger condition | Output path | Model | Memory (body-driven) |
|---|---|---|---|---|
| `milestone-researcher` | Phase 1, always (general-purpose Sonnet slot) | `.claude/notes/milestones/<id>/research/brief-2.md` | sonnet | yes (manual append) |
| `milestone-implementer` | Phase 2, delegated path (300–800 LOC or >5 files) | `.claude/notes/milestones/<id>/implement/synthesis.md` | sonnet | yes (manual append) |
| `milestone-adversary-critic` | Phase 3, always | `.claude/notes/milestones/<id>/critique/adversary.md` | opus | yes (manual append) |
| `milestone-web-perf-critic` | Phase 3, when diff touches `src/`, `public/`, `manifest.config.ts`, `vite.config.ts`, `tsconfig.json`, `package(-lock)?.json`, or `index.html` | `.claude/notes/milestones/<id>/critique/web.md` | sonnet | yes (manual append) |
| `milestone-infra-critic` | Phase 3, when diff touches `.github/workflows/**` | `.claude/notes/milestones/<id>/critique/infra.md` | sonnet | yes (manual append) |
| `milestone-lfs-critic` | Phase 3, when diff touches `.gitattributes` or adds any binary asset (png/jpg/heic/mp4/etc.) | `.claude/notes/milestones/<id>/critique/lfs.md` | sonnet | yes (manual append) |
| `milestone-oss-scout` | Phase 3, only when `--oss-scout` flag passed OR brief mentions adding a new npm dependency | `.claude/notes/milestones/<id>/critique/oss.md` | sonnet | yes (manual append) |

## How to invoke (orchestrator syntax)

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

## Existing non-milestone agents

| Agent | Purpose |
|---|---|
| `ui-ux-critic` | Browser + source review of the proclivity newtab; design critique and OSS recommendations for UI implementation agent |

## Persistent memory (body-driven, not frontmatter)

**Important:** these agents do NOT use a `memory: project` frontmatter field —
that field is not (currently) a documented Claude Code feature. Instead, every
agent's body has a `## Memory protocol` section that explicitly instructs the
agent to:

1. **On startup:** `Read .claude/agent-memory/<agent-name>/lessons.md` if it exists,
   apply prior lessons, and bias coverage accordingly.
2. **On completion (success or failure):** append exactly ONE entry to the same file
   (`mkdir -p` the directory first), formatted per the body's spec.

The directory `.claude/agent-memory/<agent-name>/lessons.md` persists across sessions
and is append-only. Each agent's body specifies the exact entry format and a size
cap (≤8 lines per entry). No secrets, no PII, no absolute paths outside the repo.

If/when Claude Code ships a real `memory: project` frontmatter feature, the manual
pattern can be deprecated in favor of it.

## Reference files

All agents point at the skill's reference files by absolute path since agents run in
a fresh context and cannot see relative ancestors:

- Prompts: `/Users/chris.dare/Personal/SourceCode/proclivity/.claude/skills/milestone-pipeline/references/agent-prompts.md`
- Critique format: `/Users/chris.dare/Personal/SourceCode/proclivity/.claude/skills/milestone-pipeline/references/critique-format.md`
- Schemas: `/Users/chris.dare/Personal/SourceCode/proclivity/.claude/skills/milestone-pipeline/references/schemas/`
- Scripts: `/Users/chris.dare/Personal/SourceCode/proclivity/.claude/skills/milestone-pipeline/scripts/`

TODO: if the skill files move (e.g. to `.claude/references/` or a shared plugin), update
all absolute paths in every agent file.
