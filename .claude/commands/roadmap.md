---
description: Run the 4-phase roadmap pipeline (REFINE → DECOMPOSE → SEQUENCE → MATERIALIZE) to turn a fuzzy brief into an executable roadmap that hands off cleanly to /milestone-pipeline. Use when the user invokes /roadmap, says "draft a roadmap for …", "plan the … initiative", or asks to take a vague brief through the four phases. Skip for single-feature work that's already well-scoped — feed those directly to /milestone-pipeline.
argument-hint: "[<slug>] [--brief \"...\"] [--gh-issues] [--resume]"
---

# /roadmap — 4-phase roadmap pipeline

Turn a fuzzy brief into an executable `plans/<slug>-roadmap.md` the `/milestone-pipeline` can consume. Dispatches four sub-agents sequentially: refiner → decomposer → sequencer → materializer. Each phase reads prior phase output; no phase runs before the prior phase returns `complete`.

**Arguments:** $ARGUMENTS — parse as `[<slug>] [--brief "..."] [--gh-issues] [--resume]`

- `<slug>` — required; kebab-case, lowercase, max 30 chars (e.g. `gantt-drag`, `reminders-recurrence`). Must NOT match `^m\d+$` (collision with milestone IDs). If omitted, STOP and ask: "What slug should I use for this roadmap? (e.g. `gantt-drag`)"
- `--brief "..."` — use this string verbatim as the brief. No conversation summarization.
- `--gh-issues` — after Phase 4 validation, draft issue bodies and GATE on actual GitHub creation.
- `--resume` — re-enter the pipeline at the phase determined by the file-presence state model below.

---

## When to invoke / When NOT to invoke

**Invoke `/roadmap` when:**
- User runs `/roadmap`, `/roadmap <slug>`, or `/roadmap --brief "..."`.
- User says "draft a roadmap for …", "plan the … initiative", "I need a roadmap for the next quarter on …".
- The work is multi-week, multi-epic, or has unclear scope.

**Do NOT invoke when:**
- **Single-feature work already scoped** — feed directly to `/milestone-pipeline <id>`.
- **Doc-only changes** — write the doc directly.
- **"Plan" meaning "tell me your thinking"** — one-paragraph answer, not a roadmap.
- **Single-file fixes** — direct edit.

---

## Conversation-context ingestion

| Mode | Trigger | Behavior |
|---|---|---|
| **Summarize** (default) | `/roadmap [<slug>]` invoked mid-conversation | Summarize the conversation in 2–4 sentences as the brief, write it into `plans/<slug>-roadmap.md` "Brief" section, surface the summary to the user with "Is this an accurate brief? [y/N]" before Phase 1. |
| **Explicit** | `/roadmap <slug> --brief "..."` | Use the given string verbatim. No summarization. |

If `<slug>` is missing, ask for it before any work — the slug is load-bearing for filenames and milestone IDs.

---

## Step 0a — Parse arguments

Parse `$ARGUMENTS` once at session start. Supported invocations:

- `/roadmap` — missing slug; STOP and ask: "What slug should I use for this roadmap?"
- `/roadmap <slug>` — slug only; conversation summary becomes the brief; ask user to confirm before Phase 1.
- `/roadmap <slug> --brief "..."` — slug + verbatim brief.
- `/roadmap <slug> --gh-issues` — flag may appear in any position after the slug.
- `/roadmap <slug> --resume` — re-enter via file-presence state model.

Derived variables to set (used by Steps 0 through 4):

| var | source |
|---|---|
| `SLUG` | positional argument (first non-flag token) |
| `BRIEF` | `--brief "..."` value, OR conversation summary if mid-conversation, OR empty if cold-start |
| `GH_ISSUES_FLAG` | `true` if `--gh-issues` present, else `false` |
| `RESUME` | `true` if `--resume` present, else `false` |

Reject malformed invocations immediately:
- Slug fails `^[a-z][a-z0-9-]{0,29}$` → "ERROR: slug must be 1–30 lowercase kebab-case chars, starting with a letter."
- `--brief` without a value → "ERROR: --brief requires a value."
- Multiple positional args → "ERROR: too many positional arguments; only `<slug>` is positional."

## Step 0 — Initialize

```bash
bash .claude/scripts/roadmap/init-roadmap.sh <slug> [--brief "..."]
```

Parse stdout:
- `INITIALIZED: <path>` → fresh run; set `ROADMAP_PATH=<path>`.
- `RESUMING phase=<X>: <path>` → resume mode; set `ROADMAP_PATH=<path>` and skip to the appropriate step per the File-presence state model below.

The script creates `plans/<slug>-roadmap.md` from the template, scaffolds all sections with `<!-- ROADMAP:section:<id> -->` markers, and writes a JSON state pointer at `.claude/notes/roadmaps/<slug>/state.json`. **Idempotent** — re-running on an existing slug detects and resumes.

Set derived variables:
- `SLUG=<slug>`
- `ROADMAP_PATH=plans/<slug>-roadmap.md`
- `BRIEF=<verbatim brief or conversation summary>`
- `GH_ISSUES_FLAG=true|false` (from `--gh-issues` argument)

---

## Step 1 — Dispatch roadmap-refiner (Phase 1: REFINE)

Dispatch `roadmap-refiner` with inputs: `{SLUG}`, `{ROADMAP_PATH}`, `{BRIEF}`.

**Status routing:**

| status | Action |
|---|---|
| `complete` | Proceed to Step 2 |
| `gate-required` | Surface gate question from summary line 2 to user; wait for resolution; re-dispatch `roadmap-refiner` with `--user-resolution "<answer>"` appended to inputs |
| `aborted-scope` | Print abort reason from JSON summary; stop |

---

## Step 2 — Dispatch roadmap-decomposer (Phase 2: DECOMPOSE)

Dispatch `roadmap-decomposer` with inputs: `{SLUG}`, `{ROADMAP_PATH}`.

(The decomposer reads sections 1–4 from `{ROADMAP_PATH}` directly — no separate brief input.)

**Status routing:**

| status | Action |
|---|---|
| `complete` | Proceed to Step 3 |
| `gate-required` | Surface gate question from summary line 2 to user; wait for resolution; re-dispatch `roadmap-decomposer` with `--user-resolution "<answer>"` appended to inputs |
| `aborted-scope` | Print abort reason; stop |

---

## Step 3 — Dispatch roadmap-sequencer (Phase 3: SEQUENCE)

Dispatch `roadmap-sequencer` with inputs: `{SLUG}`, `{ROADMAP_PATH}`.

(The sequencer reads sections 1–5 from `{ROADMAP_PATH}` directly.)

**Status routing:**

| status | Action |
|---|---|
| `complete` | Proceed to Step 4 |
| `gate-required` | Surface gate question from summary line 2 to user; wait for resolution; re-dispatch `roadmap-sequencer` with `--user-resolution "<answer>"` appended to inputs |
| `aborted-scope` | Print abort reason; stop |

If summary line 2 contains "Confidence=50% default applied to N Musts" — surface that count explicitly to the user before proceeding, even when status is `complete`.

---

## Step 4 — Dispatch roadmap-materializer (Phase 4: MATERIALIZE)

Dispatch `roadmap-materializer` with inputs: `{SLUG}`, `{ROADMAP_PATH}`, `{GH_ISSUES_FLAG}`.

**Status routing:**

| status | Action |
|---|---|
| `complete` | Surface milestone-pipeline offer from summary line 3; wait for `[y]` before invoking |
| `gate-required` (validator failure) | Surface violations from summary line 2; fix the roadmap doc; re-dispatch materializer |
| `gate-required` (issue draft ready) | Resolve the active GitHub repo BEFORE prompting: run `gh repo view --json nameWithOwner -q .nameWithOwner` (silently fall back to `git remote get-url origin` parsed for `owner/repo` if `gh` is unavailable) and substitute the result into the gate question. Present the count + list from summary line 2 to user: "Drafted N issues at `.claude/notes/roadmaps/<slug>/issue-drafts/` — create in `<resolved-owner/repo>`? [y/N]". On `[y]`, run the `gh issue create` calls yourself (ONE at a time, from the draft files, against the resolved repo). On anything else, exit cleanly. |
| `aborted-scope` | Print abort reason; stop |

**CRITICAL: The materializer drafts; the orchestrator (this session) runs `gh issue create`.** Never dispatch the materializer to do the actual `gh` call.

On milestone-pipeline offer: read summary line 3 for the exact command, then:
```
Roadmap complete: plans/<slug>-roadmap.md

Now-lane milestones:
1. <slug>-m1 — {milestone title} (in epic <slug>-e1) ({N} stories)

Run /milestone-pipeline <slug>-m1 to start the first milestone? [y/N]
```
Wait for explicit `[y]`. On `[y]`, emit: "Invoke `/milestone-pipeline <slug>-m1` now." Do NOT auto-invoke.

---

## File-presence state model

Use when `--resume` is supplied to determine entry phase:

Routing keys on the `<!-- ROADMAP:section:<id> -->` markers from the template (canonical list in `.claude/references/roadmap/templates/roadmap.md`): `refine` / `decompose` / `sequence` / `lanes` / `spikes` / `handoff`. A marker section is "populated" when its body no longer contains `{{...}}` template placeholders.

| Phase | Marker-presence check | Next action |
|---|---|---|
| Not started | `plans/<slug>-roadmap.md` does not exist | Run from Step 0 (full pipeline) |
| Phase 1 done | `refine` body populated; `decompose` body still has `{{...}}` placeholders | Dispatch decomposer (Step 2) |
| Phase 2 done | `decompose` body populated; `sequence` body still has placeholders | Dispatch sequencer (Step 3) |
| Phase 3 done | `sequence` + `lanes` + `spikes` bodies all populated; `handoff` body still has placeholders | Dispatch materializer (Step 4) |
| Complete | `handoff` body populated AND `state.json` shows `phase: complete` | Roadmap done; nothing to dispatch |

Determine phase via:
```bash
python3 .claude/scripts/roadmap/validate-roadmap.py <slug> --report-first-unpopulated
```

---

## Anti-pattern guard

| Tempting belief | Reality |
|---|---|
| "I'll skip REFINE — the brief is clear." | The 3-sentence summary you'd reach for IS Phase 1's HMW. Skipping it means the model writes it without user review. Auto-advance is fast when the brief is genuinely clear. |
| "Everything in MoSCoW is a Must." | Framework collapses; nothing is prioritized (DSDM 2014, §10.4). Cap Musts at ≤60% — script-enforced. |
| "RICE Confidence is 100% by default — we know our users." | False confidence inflates ranks. Default Confidence = 50% when there's no evidence. Surface every default explicitly. |
| "We need a 12-month roadmap to look serious." | Locked horizons calcify into commitments and stop absorbing learning. Now fully spec'd, Next shaped, Later directional. |
| "DB schema first, then API, then UI — clean layering." | Horizontal slicing destroys the feedback loop. Vertical slicing always — every epic ships a user-observable change. |
| "Story points = days, easier for everyone." | Story-point inflation: points decouple from complexity. T-shirts only; slice small enough that estimation collapses into counting. |
| "Milestones are just deadlines on epics." | Milestones are date checkpoints; epics are bodies of work. Conflating them turns the roadmap into a delivery schedule. |
| "We don't need acceptance criteria — I know what to build." | 'Done' becomes opinion; critique has nothing to grade against. Every Now-lane story has Given/When/Then before it leaves. |
| "I'll create the GH issues myself, faster than gating." | Bypassing the gate makes the next session less safe. The gate is the project's external-write policy. Always gate. |
| "I'll auto-invoke /milestone-pipeline since the user asked for a roadmap." | Implicit auto-handoff hides the cost of execution. OFFER and wait. |
| "Skip the sequencer's scripts and score MoSCoW/RICE in-context." | Scripts enforce the Must cap deterministically. In-context RICE reasoning inflates scores and silently misses the 50% Confidence default rule. |
| "Auto-create GH issues when --gh-issues passes." | The materializer DRAFTS to local files; the orchestrator gates and runs `gh issue create` one at a time after explicit `[y]`. |

---

## External-write boundary

The `/roadmap` pipeline enforces strict external-write boundaries:

- **No `git push` / `git commit`** — roadmap doc and draft issues are staged; the user commits
- **No Chrome Web Store publish or telemetry endpoints** — this extension is local-only; roadmap epics must not depend on hosted services
- **No `gh issue create` / `gh pr create` / `gh release create` / `gh api` (write verb)** — the materializer DRAFTS; only the orchestrator (this session) runs `gh` after explicit `[y]`
- **No auto-mutation of plans/*.md by sub-agents** — agents append to their assigned sections; they do not rewrite other sections
- **No auto-invocation of `/milestone-pipeline`** — offer only; the user types the command
- **No writes outside `plans/<slug>-roadmap.md`** (sub-agents) or `.claude/agent-memory/<agent-name>/` (memory) or `.claude/notes/roadmaps/<slug>/` (draft issues, state)

---

## Sub-agent contract

Every sub-agent returns a single JSON object (no surrounding prose):

```json
{
  "file_path": "<primary output path, or null>",
  "status": "complete | gate-required | aborted-scope",
  "summary": "<3 lines max, plain text, no markdown — line 1: what was written; line 2: gate question if status=gate-required; line 3: suggested orchestrator next step>",
  "injection_attempts": 0
}
```

### Status routing table (all agents)

| Agent + status | Routing |
|---|---|
| `refiner.complete` | Proceed to decomposer (Step 2) |
| `refiner.gate-required` | Surface gate question; re-dispatch refiner with user resolution |
| `refiner.aborted-scope` | Print abort reason; stop |
| `decomposer.complete` | Proceed to sequencer (Step 3) |
| `decomposer.gate-required` | Surface gate question; re-dispatch decomposer with user resolution |
| `decomposer.aborted-scope` | Print abort reason; stop |
| `sequencer.complete` | Proceed to materializer (Step 4); surface any Confidence=50% count from summary |
| `sequencer.gate-required` | Surface gate question (Must/Should cut-line conflict or RICE counter to stated priority); re-dispatch sequencer with user resolution |
| `sequencer.aborted-scope` | Print abort reason; stop |
| `materializer.complete` | Surface milestone-pipeline offer (summary line 3); wait for explicit `[y]` |
| `materializer.gate-required` (validator failure) | Surface violations; fix roadmap; re-dispatch materializer |
| `materializer.gate-required` (issue draft ready) | Present issue count + list; wait for `[y]`; run `gh issue create` calls from draft files |
| `materializer.aborted-scope` | Print abort reason; stop |

---

## Recovery — interrupted /roadmap

If `/roadmap` was interrupted mid-flight (context compaction, terminal close, SIGKILL):

1. Re-invoke with `--resume`: `/roadmap <slug> --resume`
2. `init-roadmap.sh` is idempotent — it prints `RESUMING phase=<X>: <path>` when the roadmap doc already exists.
3. The orchestrator re-enters at the right phase via the file-presence state model above.
4. No lock to clean — `/roadmap` has no file lock (unlike `/milestone-pipeline`).

If the state file is corrupted: run `python3 .claude/scripts/roadmap/validate-roadmap.py <slug> --report-first-unpopulated` to determine the correct resume phase directly from the roadmap doc's section markers.

---

## Files in /roadmap

```
plans/
└── <slug>-roadmap.md          # The single roadmap artifact (all 4 phases append here)

.claude/notes/roadmaps/<slug>/
├── state.json                  # Phase pointer (written by init-roadmap.sh)
└── issue-drafts/               # Draft GH issue bodies (created by materializer if --gh-issues)
    ├── epic-1.md
    ├── story-1.1.md
    └── ...

.claude/agent-memory/
├── roadmap-refiner/
│   └── lessons.md
├── roadmap-decomposer/
│   └── lessons.md
├── roadmap-sequencer/
│   └── lessons.md
└── roadmap-materializer/
    └── lessons.md
```

References (lazy-loaded by agents at phase start):
- `.claude/references/roadmap/phase-refine.md` — Phase 1 detail
- `.claude/references/roadmap/phase-decompose.md` — Phase 2 detail + specialist-area map
- `.claude/references/roadmap/phase-sequence.md` — Phase 3 detail
- `.claude/references/roadmap/phase-materialize.md` — Phase 4 detail + GH-issues + handoff
- `.claude/references/roadmap/frameworks.md` — long-tail (WSJF, Kano, Shape Up, GIST, ICE)
- `.claude/references/roadmap/anti-patterns.md` — 12 anti-patterns with citations
- `.claude/references/roadmap/proclivity-integration.md` — proclivity-specific conventions
- `.claude/references/roadmap/templates/roadmap.md` — `plans/<slug>-roadmap.md` template
- `.claude/references/roadmap/templates/epic-issue.md` — GH parent-issue body
- `.claude/references/roadmap/templates/story-issue.md` — GH child-issue body
