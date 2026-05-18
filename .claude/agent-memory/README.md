# `.claude/agent-memory/` — per-agent persistent memory

Each milestone-pipeline sub-agent has a subdirectory here. The agent's body
(see its `## Memory protocol` section) instructs it to Read its own
`lessons.md` at startup and Append one entry on completion. These files
persist across sessions and machines because they are committed to git.

Note: `memory: project` is **not** a documented Claude Code frontmatter
field in the version used by this repo. Memory is driven by body
instructions in each agent file — not by auto-injection from the harness.

## Append-only invariant

Memory files are **additive append-only logs**. Never delete or rewrite
previous entries. If an entry is wrong, append a new entry that supersedes
the old one (reference the old timestamp in the new entry). Rewriting
corrupts the lineage and breaks any future audit-trail correlation with
`.claude/notes/milestones/<id>/audit.jsonl`.

This invariant is documented in `.claude/CLAUDE.md` § "Agent memory".

## Directory structure

```
.claude/agent-memory/
├── README.md                        # this file
├── milestone-researcher/
│   └── lessons.md                   # append-only log; see agent definition for format
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
└── milestone-oss-scout/
    └── lessons.md
```

Each `lessons.md` file starts empty (with only a heading and preamble). Over time,
milestone runs append structured entries. The entry format is defined in each agent's
own `## Memory protocol` section.

## Why memory is committed to git

- Durable across session restarts, machine replacements, and worktree teardowns.
- Visible in PR diffs — entries are auditable.
- The milestone pipeline's audit trail at `.claude/notes/milestones/<id>/audit.jsonl`
  records timestamps that can be cross-referenced with these entries manually.

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

Each entry follows the template defined in the corresponding agent's `## Memory protocol`
section. All entries share this basic shape:

```markdown
## <ISO-8601 UTC timestamp> · milestone:<id> · status:<status>
- **Bottleneck observed:** <one sentence, or "none">
- **What worked:** <one sentence>
- **What didn't:** <one sentence, or "n/a">
- **Reusable lesson:** <one actionable sentence the next run should apply>
```

Entries SHOULD be ≤ 8 lines. Condense before writing if an entry would exceed 8 lines.
