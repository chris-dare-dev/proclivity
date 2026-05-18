# Phase 4 — MATERIALIZE

**Goal:** finalize `plans/<slug>-roadmap.md`, optionally create GitHub issues (gated), and offer (never auto-invoke) the milestone-pipeline handoff.

**Sections:** populates the `<!-- ROADMAP:section:tracking -->` and `<!-- ROADMAP:section:handoff -->` blocks in `plans/<slug>-roadmap.md`.

## Step-by-step

### 1. Lint the roadmap doc

```bash
python3 .claude/scripts/roadmap/validate-roadmap.py <slug>
```

The validator checks:
- All 8 canonical sections present (`<!-- ROADMAP:section:* -->` markers).
- No template placeholders left (`{{TOKEN}}`).
- Every `[MUST]` assumption has either a spike OR an evidence citation.
- Every Now-lane story has Given/When/Then.
- Every epic has a `<slug>-eN` id.
- MoSCoW cap is satisfied.
- Dependency graph is a DAG.

Exit codes:
- `0` = clean — proceed.
- `1` = lint failure — orchestrator surfaces the violations and **STOPS**. Do not advance until clean.
- `2` = usage error.

### 2. GitHub issues (only if `--gh-issues` flag was passed at invocation)

The flag triggers epic + child stories integration depth: one parent issue per epic (Initiative), child issues per Now-lane story, label-based parent reference (`epic:<slug>-eN`).

**ALWAYS gate.** Before creating any issue:

1. Surface the issue creation plan in a single message:

   ```
   I'm about to create the following issues in chris-dare-dev/proclivity:

   Parent epics (2):
   - gantt-drag-e1: Drag-to-reschedule Gantt tasks (label: epic:gantt-drag-e1)
   - gantt-drag-e2: Inline date-picker on drag end (label: epic:gantt-drag-e2)

   Child stories under gantt-drag-e1 (3):
   - gantt-drag-e1-s1: Drag handle UI (label: story, epic:gantt-drag-e1)
   - gantt-drag-e1-s2: storage.local update on drop
   - gantt-drag-e1-s3: Visual feedback during drag

   Total: 5 issues. Proceed? [y/N]
   ```

2. Wait for explicit `y`. Anything else (including "yes please go ahead from before") is **NOT authorization**.

3. On `y`, materializer writes draft issue body files to `.claude/notes/roadmaps/<slug>/issue-drafts/`. Use [`templates/epic-issue.md`](templates/epic-issue.md) for parents, [`templates/story-issue.md`](templates/story-issue.md) for children. Substitute placeholders.

4. The orchestrator then runs `gh issue create` for each file, one at a time, after explicit `[y]` per issue.

5. Append the created issue numbers back into the roadmap doc under the `<!-- ROADMAP:section:tracking -->` block.

6. Do NOT push. Do NOT create branches. Do NOT comment on issues. Just create.

### 3. Milestone-pipeline handoff

OFFER, never auto-invoke. Single message at the end of Phase 4:

```
Roadmap complete: plans/<slug>-roadmap.md

Now-lane milestones:
1. <slug>-e1 — {epic title} ({N} stories)
2. <slug>-e2 — {epic title} ({N} stories) [optional, depending on capacity]

Run /milestone-pipeline <slug>-e1 to start the first milestone? [y/N]
```

Wait for explicit `y`. On `y`, the orchestrator emits a single instruction to the user — "Invoke `/milestone-pipeline <slug>-e1` now" — and exits. The /roadmap pipeline does NOT directly invoke /milestone-pipeline. Slash-command-to-slash-command auto-chaining is anti-pattern — the user is the orchestration layer.

### 4. Update state

```bash
bash .claude/scripts/roadmap/init-roadmap.sh <slug> --advance complete
```

Sets the state file's phase to `complete`. The roadmap doc is now the source of truth; further edits are direct file edits, not skill invocations.

## Output additions to roadmap.md

```markdown
<!-- ROADMAP:section:tracking -->
## 10. Tracking (populated by --gh-issues only)

| Epic / Story | GH Issue | Status |
|---|---|---|
| `<slug>-e1` | #123 | open |
| `<slug>-e1-s1` | #124 | open |
| ... | ... | ... |

<!-- ROADMAP:section:handoff -->
## 11. Execution handoff

First Now-lane milestone: `<slug>-e1`.

Invoke: `/milestone-pipeline <slug>-e1`

The milestone-pipeline reads:
- The epic body in §8 (Now lane)
- The story list with Given/When/Then AC
- The specialist hints
- Any spike findings under §9

It writes to `.claude/notes/milestones/<slug>-e1/state.json` and produces:
- `.claude/notes/milestones/<slug>-e1/research/` (research briefs)
- Implementation commits on main
- `.claude/notes/milestones/<slug>-e1/critique/adversary.md`
- `.claude/notes/milestones/<slug>-e1/rectify/summary.md`
```

## Auto-advance vs gate (decision table)

| Condition | Action |
|---|---|
| `validate-roadmap.py` exit 0 | **Auto-advance** to step 2 |
| `validate-roadmap.py` exit 1 | **STOP.** Surface violations. Do NOT proceed. |
| `--gh-issues` flag passed | **GATE before any issue creation.** No exceptions. |
| `--gh-issues` flag passed AND user typed `y` | Materializer writes drafts to `.claude/notes/roadmaps/<slug>/issue-drafts/`; orchestrator runs `gh issue create` one at a time |
| End of Phase 4 | **GATE on milestone-pipeline handoff.** OFFER, never auto-invoke. |
| User responds anything other than `y` to handoff | Exit cleanly. Roadmap doc is the artifact; user invokes pipeline when ready. |

## Hard rules

- **Validator must pass.** No partial roadmaps shipped.
- **Issue creation gates per-event.** Prior `y` does not authorize a future creation.
- **No `gh issue comment`, `gh pr *`, or `git push` from this skill.** Issue creation only.
- **No auto-invocation of `/milestone-pipeline`.** OFFER is a string the user reads and types into their next prompt. The skill does not call other skills.
- **`src/` is OFF-LIMITS** for this skill's writes. The milestone-pipeline owns code changes; the roadmap skill writes ONLY to `plans/` and `.claude/notes/roadmaps/<slug>/issue-drafts/`.
- **Draft issue files go to `.claude/notes/roadmaps/<slug>/issue-drafts/`**, NOT to `plans/<slug>-tickets/`. That legacy path is retired.
