# `.claude/agent-memory/` — per-agent persistent memory

Each milestone-pipeline and roadmap-pipeline sub-agent has a subdirectory
here. Every agent declares `memory: project` in its frontmatter AND has a
body-side memory section that instructs it to Read its own `lessons.md` at
startup and Append one entry on completion. These files persist across
sessions and machines because they are committed to git.

The `memory: project` frontmatter field IS the canonical Claude Code
mechanism — Options-signal-engine uses it on all 13 of its milestone /
roadmap / spike agents, and proclivity adopted the same convention on
2026-05-17. The body-driven memory protocol is the complementary instruction
that makes the agent actually USE the memory (frontmatter alone doesn't
auto-inject content into the dispatch prompt).

## Append-only invariant

Memory files are **additive append-only logs**. Never delete or rewrite
previous entries. If an entry is wrong, append a new entry that supersedes
the old one (reference the old timestamp in the new entry). Rewriting
corrupts the lineage and breaks any future audit-trail correlation with
`.claude/notes/milestones/<id>/audit.jsonl` or `.claude/notes/roadmaps/<slug>/`.

This invariant is documented in `.claude/CLAUDE.md` § "Agent memory".

## Directory structure

```
.claude/agent-memory/
├── README.md                          # this file
├── milestone-researcher/
│   └── lessons.md                     # append-only log
├── milestone-implementer/
│   └── lessons.md
├── milestone-adversary-critic/
│   └── lessons.md
├── milestone-web-perf-critic/
│   └── lessons.md
├── milestone-infra-critic/
│   └── lessons.md
├── milestone-lfs-critic/
│   └── lessons.md
├── milestone-oss-scout/
│   └── lessons.md
├── roadmap-refiner/
│   └── .gitkeep                       # lessons.md created on first dispatch
├── roadmap-decomposer/
│   └── .gitkeep
├── roadmap-sequencer/
│   └── .gitkeep
└── roadmap-materializer/
    └── .gitkeep
```

Milestone-* dirs ship with a seeded `lessons.md` (header + preamble). Roadmap-*
dirs ship with `.gitkeep` only; the agent creates `lessons.md` via `mkdir -p`
+ `cat >>` heredoc on its first successful run. Both states are valid — the
body-driven append path handles missing files.

## Why memory is committed to git

- Durable across session restarts, machine replacements, and worktree teardowns.
- Visible in PR diffs — entries are auditable.
- The pipelines' audit trails (`.claude/notes/milestones/<id>/audit.jsonl`
  for milestones, `.claude/notes/roadmaps/<slug>/state.json` for roadmaps)
  carry timestamps that can be cross-referenced with these entries.

Memory files MAY be consumed by future tooling, but no current script
(including `compute-metrics.py`) reads them automatically — the lineage is
preserved against that possibility.

## No secrets, no PII

Memory files are public within this repository. Never write:
- API tokens or OAuth credentials
- OAuth client IDs (the proclivity codebase has one — `455929700165-*`)
- Absolute paths to locations outside this repo (use repo-relative paths)
- Any value that would be a secret if the repo became public

## Entry format

The entry format differs between the two pipelines because they evolved
independently. Both share the append-only invariant and the 8-line size cap;
the bullet structure differs.

### Milestone pipeline entries (milestone-* agents)

```markdown
## <ISO-8601 UTC timestamp> · milestone:<id> · status:<status>
- **Bottleneck observed:** <one sentence, or "none">
- **What worked:** <one sentence>
- **What didn't:** <one sentence, or "n/a">
- **Reusable lesson:** <one actionable sentence the next run should apply>
```

### Roadmap pipeline entries (roadmap-* agents)

```markdown
## <slug> (<YYYY-MM-DD>)
- <2–5 bullet lessons, each self-contained>
```

Roadmap entries use slug + date for the heading because the unit of work is
a roadmap (slug-scoped, not run-scoped); milestone entries use ISO timestamp
because the unit is a single pipeline invocation (timestamp-distinct even
when re-running the same milestone).

Either format MAY include a `[CONFIRMED]` prefix prepended to a prior
entry's bullets to mark that a current run re-validated the lesson — see
each agent's body for the exact `[CONFIRMED]` protocol.

Entries SHOULD be ≤ 8 lines total. Condense before writing if an entry would
exceed 8 lines.
