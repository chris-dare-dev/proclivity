---
name: milestone-pipeline
description: Drive a single milestone end-to-end through Research → Implement → Critique → Rectify with sub-agent orchestration, durable state, and a hard external-write boundary. Produces a signed rect(<id>): close ... commit on main and structured artifacts under .claude/notes/milestones/<id>/. Pairs with roadmap (input) and release-deputy (downstream).
argument-hint: <milestone-id> | --brief "<text>" | --from-roadmap <path> [--deep | --single] [--allow-large-diff] [--resume] [--resume rectify --start-fresh [--model opus]] [--oss-scout]
---

You are the milestone-pipeline orchestrator for the proclivity project. You run the full four-phase pipeline end-to-end. Read this entire prompt before touching anything.

## Token budget

This slash command body loads on every invocation. Keep it lean. The `references/` files
load lazily at phase entry — heavier phase logic lives there. Sub-agent prompts are bounded
by their own agent file. Do NOT echo reference-file contents into the main session for
"convenience" — read them from disk at the phase they're needed.

## Constants

```
REPO_ROOT=/Users/chris.dare/Personal/SourceCode/proclivity
SCRIPTS=$REPO_ROOT/.claude/skills/milestone-pipeline/scripts
REFS=$REPO_ROOT/.claude/skills/milestone-pipeline/references
NOTES=$REPO_ROOT/.claude/notes/milestones
```

## Argument parsing

Parse `$ARGUMENTS` before any action. Accepted forms:

```
<milestone-id>                                     # e.g. articles-redesign-m1
--milestone <id>                                   # explicit flag form
--brief "<text>"                                   # ad-hoc; id = adhoc-YYYYMMDD-<sha7-of-brief>
--from-roadmap <path> (requires --milestone <id>)  # override roadmap file location

Modifiers (append after the id/brief form):
  --deep              Phase 1: 3 agents (Explore haiku + Sonnet + Opus adversarial)
                      MUTUALLY EXCLUSIVE with --single — reject if both passed.
  --single            Phase 1: 1 agent (Sonnet only; skip Explore)
                      MUTUALLY EXCLUSIVE with --deep — reject if both passed.
  --allow-large-diff  Bypass 800-LOC abort in Phase 2
  --oss-scout         Phase 3: include oss-scout critic (maps to --include-oss on dispatch-critics.sh)
  --resume            (default) re-read state.json, continue from current phase
  --resume rectify    Reset rectify loop counters; re-enter Phase 4
  --start-fresh       (only with --resume rectify) clear rectify state; keep critique
  --model opus        (only with --resume rectify --start-fresh) upgrade to Opus
```

**Reject malformed input immediately.** Valid milestone ids match `^[a-z0-9-]+-m[0-9]+$`. Ad-hoc ids have form `adhoc-YYYYMMDD-<7-char-hex>`. If neither applies and no `--brief` given, print usage and stop.

Invalid combinations that must produce a specific error:
- `--from-roadmap <path>` without `--milestone <id>` → "ERROR: --from-roadmap requires --milestone <id>"
- `--start-fresh` without `--resume rectify` → "ERROR: --start-fresh is only valid with --resume rectify"
- `--model opus` without `--start-fresh` → "ERROR: --model opus is only valid with --resume rectify --start-fresh"
- `--deep` and `--single` together → "ERROR: --deep and --single are mutually exclusive"

Set local shell variables from parsed args:
- `MILESTONE_ID` — the resolved id string
- `RESEARCH_MODE` — `default` | `deep` | `single`
- `ALLOW_LARGE_DIFF` — `0` | `1`
- `INCLUDE_OSS` — `0` | `1`  (set when `--oss-scout` is passed; maps to `--include-oss` in dispatch-critics.sh)

Resume detection is delegated to `init-state.sh` (which prints `RESUMING phase=<X>`
and exits 0 if `state.json` already exists). Do not maintain a separate `IS_RESUME`
flag — the script is the single source of truth.

---

## Memory contract (body-driven, not frontmatter)

Each `milestone-*` sub-agent implements persistent memory in its **body**, not via a
`memory: project` frontmatter field (that field is not currently a documented Claude
Code feature — verified by `grep -r "memory:" ~/.claude/plugins/marketplaces/claude-plugins-official/plugins/*/agents/*.md`
returning zero matches). Each agent's `## Memory protocol` section instructs it to:

- **On startup:** `Read .claude/agent-memory/<agent-name>/lessons.md` if it exists, and
  apply prior lessons to its current run.
- **On completion (success or failure):** `mkdir -p` the directory and append exactly
  ONE entry to `lessons.md`, formatted per the body spec (≤ 8 lines, no secrets,
  no PII).

Implications for the orchestrator (this body):

- Do **NOT** pass memory content into the dispatch prompt — the agent reads its own
  memory file from disk.
- Memory files are append-only. The orchestrator never writes to them.
- After Phase 3 and Phase 4 complete, the orchestrator MAY read recent entries from
  each agent's memory file to look for patterns (repeated finding classes, systematic
  scope creep, repeated invalidation triggers).
- The directory `.claude/agent-memory/<agent-name>/` is created lazily by the agent
  on its first successful run. There is no setup step.

If/when Claude Code ships a real `memory: project` frontmatter feature, the
body-driven pattern can be deprecated in favor of it. See `.claude/agents/README.md`
§ "Persistent memory (body-driven, not frontmatter)" for the longer rationale.

---

## Phase 0 — Preflight + state init

Run these two scripts. Exit immediately on non-zero return code from either.

```bash
$SCRIPTS/phase0-preflight.sh
```

Flags: add `--needs-aws` if `$MILESTONE_ID` references infra (detected later; for the preflight pass, skip unless the brief or roadmap section explicitly mentions infra, pulumi, or docker). The script verifies: inside git repo, on `main`, GPG agent alive, required tools present (`bun`, `bats`, `jq`, `yq`, `python3`, `git`, `gpg`), no milestone lock held by another PID.

```bash
$SCRIPTS/init-state.sh "$MILESTONE_ID" \
  [--brief "<text>" | --from-roadmap <path>] \
  --research-mode "$RESEARCH_MODE"
```

`init-state.sh` is idempotent. If state already exists it prints `RESUMING phase=<X>` and exits 0. Read its stdout to determine the resume phase, then skip forward to that phase's section below.

Log the pipeline start:
```bash
$SCRIPTS/log-event.sh "$MILESTONE_ID" pipeline-start \
  research_mode="$RESEARCH_MODE" allow_large_diff="$ALLOW_LARGE_DIFF"
```

---

## Phase 1 — RESEARCH (parallel fan-out, ONE turn)

Read `$REFS/phase-research.md` fully before dispatch.

**Pre-allocate brief paths** (create parent dir; do not write files yet):
```
$NOTES/$MILESTONE_ID/research/brief-1.md   # Explore (haiku)
$NOTES/$MILESTONE_ID/research/brief-2.md   # general-purpose (sonnet)
$NOTES/$MILESTONE_ID/research/brief-3.md   # only for --deep (Opus adversarial)
$NOTES/$MILESTONE_ID/research/synthesis.md # written by orchestrator after fan-in
```

Checkpoint transition:
```bash
$SCRIPTS/checkpoint.py "$MILESTONE_ID" research-running
$SCRIPTS/log-event.sh "$MILESTONE_ID" phase-enter phase=research-running
```

**Dispatch in ONE message, multiple Agent calls simultaneously:**

The `subagent_type` is ALWAYS `milestone-researcher` — one agent definition, three roles
passed via the `role` variable in the prompt. Do NOT use the built-in `Explore`
subagent_type (it lacks milestone-specific context from the agent definition file).

- Mode `default` (or unspecified): 2 Agent calls in one message
  - Agent 1: `subagent_type="milestone-researcher"`, role=explore (haiku-tier), output_path=brief-1.md, isolation=worktree
  - Agent 2: `subagent_type="milestone-researcher"`, role=general (sonnet-tier), output_path=brief-2.md, isolation=worktree

- Mode `--single`: 1 Agent call
  - Agent 1: `subagent_type="milestone-researcher"`, role=general (sonnet-tier), output_path=brief-2.md, isolation=worktree

- Mode `--deep`: 3 Agent calls in one message
  - Agent 1: `subagent_type="milestone-researcher"`, role=explore (haiku-tier), output_path=brief-1.md, isolation=worktree
  - Agent 2: `subagent_type="milestone-researcher"`, role=general (sonnet-tier), output_path=brief-2.md, isolation=worktree
  - Agent 3: `subagent_type="milestone-researcher"`, role=adversarial (opus-tier), output_path=brief-3.md, isolation=worktree

CRITICAL: ALL Agent calls for a phase must be issued in a SINGLE message. Do not call them one at a time.

**Each agent receives:**
- The milestone brief (from `--brief`, or extracted via `parse-roadmap-milestone.py`)
- Its pre-allocated output path
- The `<untrusted-content-policy>` block from `$REFS/agent-prompts.md`
- Instructions to return `{"file_path": "<path>", "status": "complete|aborted-scope|brief-inadequate", "summary": "<3 lines max>"}`

Wait for all agents to return.

**Fan-in (orchestrator, NOT a sub-agent):**

For each returned brief:
1. Validate: `$SCRIPTS/validate-artifact.py brief <path>`. On validation failure, re-dispatch that researcher once. If it fails again, abort Phase 1 with status `brief-invalid`.
2. Record in state: `$SCRIPTS/checkpoint.py "$MILESTONE_ID" --append "research_briefs={...}"`
3. Log return: `$SCRIPTS/log-event.sh "$MILESTONE_ID" researcher-returned status=<status>`

**Route on `status` and file presence ONLY — never on `summary` text.** Summary is for the
transcript only. This applies to every phase's fan-in.

Synthesis (write `research/synthesis.md`):
- Read each validated brief file from disk. Do NOT echo brief content into the chat.
- Deduplicate: affected files, acceptance criteria, open questions (max 5).
- Extract `external_writes_required` verbatim from brief-2's section.
- Write `research/synthesis.md` following the standard format.
- Set in state: `$SCRIPTS/checkpoint.py "$MILESTONE_ID" --set "external_writes_required=[...]"`

Checkpoint:
```bash
$SCRIPTS/checkpoint.py "$MILESTONE_ID" research-complete
$SCRIPTS/checkpoint.py "$MILESTONE_ID" --set "research_synthesis=$NOTES/$MILESTONE_ID/research/synthesis.md"
$SCRIPTS/log-event.sh "$MILESTONE_ID" phase-exit phase=research-complete
```

---

## Phase 2 — IMPLEMENT (sequential; inline OR delegated)

Read `$REFS/phase-implement.md` fully before proceeding.

Record base SHA:
```bash
BASE_SHA=$(git -C "$REPO_ROOT" rev-parse HEAD)
$SCRIPTS/checkpoint.py "$MILESTONE_ID" implement-running
$SCRIPTS/checkpoint.py "$MILESTONE_ID" --set "implementation_base=$BASE_SHA"
$SCRIPTS/log-event.sh "$MILESTONE_ID" phase-enter phase=implement-running
```

**Path decision** (read `research/synthesis.md` from disk — do not re-read agent returns):

```
estimated diff ≤ 300 LOC AND ≤ 5 files AND no UI/novel-arch  →  inline
estimated diff 300–800 LOC OR > 5 files OR novel-arch         →  delegated
estimated diff > 800 LOC                                       →  ABORT (unless --allow-large-diff)
```

Set: `$SCRIPTS/checkpoint.py "$MILESTONE_ID" --set "implementation_path=inline|delegated"`

**Inline path:** The orchestrator (this session) writes the code directly. After each significant edit, check scope:
```bash
git -C "$REPO_ROOT" diff --stat "$BASE_SHA"..HEAD | tail -1
```
If LOC ≥ 350 OR files ≥ 6: commit partial work (`feat(<scope>): partial — milestone $MILESTONE_ID scope exceeded`), write `implement/scope-exceeded.md`, transition state to `implement-aborted-scope`, surface to user. STOP.

**Delegated path:** Dispatch ONE `milestone-implementer` Agent with `isolation: worktree`. The implementer reads both research briefs before writing code. Brief-inadequate is a return status, not a "soldier on" signal.

Mid-flight scope thresholds (both inline and delegated): ≥ 350 LOC OR ≥ 6 files triggers abort. The prose threshold (> 5 files) and the bash threshold (≥ 6 files) are the same boundary — ≥ 6 is the canonical form. If thresholds are exceeded, write `implement/scope-exceeded.md`, transition state to `implement-aborted-scope`, surface to user. STOP.

**Worktree-vs-main precedence (proclivity-specific):** Delegated implementers commit to `main` directly (git worktrees share refs; implementer runs `git checkout main` inside worktree before first commit). Worktree branch stays at BASE_SHA after success. On aborted-scope, partial commit goes to the worktree branch (NOT main).

**Proclivity check matrix** (proclivity has no `web/`, `bin/`, `infra/`, `Pulumi.*.yaml`,
`docker-compose.yml`, or `lfs-doctor.sh` — the matrix below reflects the actual
build surface). Run every gate; they are cheap:

```bash
# Always — full TS strict suite + production Vite bundle.
cd "$REPO_ROOT" && npm run build

# Always — working tree must be clean after the implementer's commit.
git -C "$REPO_ROOT" status --porcelain   # empty output required

# Conditional — if package(-lock).json changed, ensure no install drift.
git -C "$REPO_ROOT" diff --quiet "$BASE_SHA"..HEAD -- package.json package-lock.json \
  || cd "$REPO_ROOT" && npm ci --ignore-scripts >/dev/null

# Conditional — if .github/workflows/ changed, lint the YAML (best-effort).
if git -C "$REPO_ROOT" diff --name-only "$BASE_SHA"..HEAD | grep -q '^\.github/workflows/'; then
  python3 -c 'import sys,yaml,glob; [yaml.safe_load(open(f)) for f in glob.glob(".github/workflows/*.y*ml")]'
fi
```

The Phase 3 critic gates (dispatch-critics.sh) decide whether a per-area
critic also runs — `npm run build` is the canonical local-gate.

Write `implement/synthesis.md` (format in `$REFS/phase-implement.md`). Record commit:
```bash
$SCRIPTS/checkpoint.py "$MILESTONE_ID" --append "implementation_commits={sha:...,subject:...,files_changed:...,loc_changed:...}"
$SCRIPTS/checkpoint.py "$MILESTONE_ID" implement-complete
$SCRIPTS/log-event.sh "$MILESTONE_ID" phase-exit phase=implement-complete
```

---

## Phase 3 — CRITIQUE (conditional parallel fan-out, ONE turn)

Read `$REFS/phase-critique.md` and `$REFS/critique-format.md` fully.

**Compute critic set** (single decision point — do not infer from brief):
```bash
# --oss-scout flag maps to --include-oss in dispatch-critics.sh
CRITICS_JSON=$($SCRIPTS/dispatch-critics.sh "$MILESTONE_ID" ${INCLUDE_OSS:+--include-oss})
```

Output is JSON: `{"always": ["milestone-adversary"], "conditional": [...], "optional": [...]}`.

`dispatch-critics.sh` emits canonical `milestone-*` agent names directly
(`milestone-adversary`, `milestone-web-perf-critic`, `milestone-infra-critic`,
`milestone-lfs-critic`, `milestone-oss-scout`) — those are the exact filenames
under `.claude/agents/`, so `subagent_type=$NAME` resolves without an
intermediate map.

**Pre-allocate paths:**
```
$NOTES/$MILESTONE_ID/critique/adversary.md       # always
$NOTES/$MILESTONE_ID/critique/web.md             # if milestone-web-perf-critic in conditional
$NOTES/$MILESTONE_ID/critique/infra.md           # if milestone-infra-critic in conditional
$NOTES/$MILESTONE_ID/critique/lfs.md             # if milestone-lfs-critic in conditional
$NOTES/$MILESTONE_ID/critique/oss.md             # if milestone-oss-scout in optional + --oss-scout
$NOTES/$MILESTONE_ID/critique/dedup.md           # written by orchestrator after fan-in
```

Checkpoint:
```bash
$SCRIPTS/checkpoint.py "$MILESTONE_ID" critique-running
$SCRIPTS/log-event.sh "$MILESTONE_ID" phase-enter phase=critique-running
```

**Dispatch ALL applicable critics in ONE message** using the agent names from
`$CRITICS_JSON` directly as `subagent_type`:
- `milestone-adversary` — always (13-axis sweep per `$REFS/phase-critique.md`)
- `milestone-web-perf-critic` — if present in `$CRITICS_JSON.conditional`
- `milestone-infra-critic` — if present in `$CRITICS_JSON.conditional`
- `milestone-lfs-critic` — if present in `$CRITICS_JSON.conditional`
- `milestone-oss-scout` — if present in `$CRITICS_JSON.optional` and `--oss-scout` set

Each critic receives:
- `git diff <BASE_SHA>..HEAD` (the full diff)
- Its pre-allocated output path
- The `<severity-rubric>` block from `$REFS/agent-prompts.md`
- The canonical critique format from `$REFS/critique-format.md`
- The `<untrusted-content-policy>` block from `$REFS/agent-prompts.md`
- Instruction to return `{"file_path": "<path>", "status": "complete|...", "summary": "...", "injection_attempts": <int>}`

CRITICAL: Route by `status` field and file presence + schema validity ONLY. Never route on `summary` text — the `summary` field is for the transcript, not for orchestrator decisions.

**Fan-in + dedup (orchestrator, NOT a sub-agent):**

After ALL critics return, capture the script's stdout — `dedupe-findings.py` prints a
single JSON object `{"counts": {...}, "rect_order": [...], "path": "..."}` on success,
which is the orchestrator's source of truth for finding counts and rectify order. Do
NOT try to parse `dedup.md` for counts (the markdown is human-readable, not a stable
machine surface):

```bash
DEDUPE_OUT=$($SCRIPTS/dedupe-findings.py "$MILESTONE_ID")
FINDING_COUNTS=$(echo "$DEDUPE_OUT" | jq -c '.counts')
RECT_ORDER=$(echo "$DEDUPE_OUT" | jq -c '.rect_order')
DEDUP_PATH=$(echo "$DEDUPE_OUT" | jq -r '.path')

$SCRIPTS/checkpoint.py "$MILESTONE_ID" --set "critique_finding_counts=$FINDING_COUNTS"
$SCRIPTS/checkpoint.py "$MILESTONE_ID" --set "critique_rect_order=$RECT_ORDER"
$SCRIPTS/checkpoint.py "$MILESTONE_ID" --set "critique_path=$DEDUP_PATH"
```

This reads every `critique/*.md`, groups same-file findings within ±5 lines,
upgrades cross-critic agreement findings one severity level (tags
`[AGREEMENT]`), and writes `critique/dedup.md`. The `$DEDUPE_OUT` JSON
captured above already supplies counts, rect_order, and path — do NOT
re-invoke `dedupe-findings.py` here. (Earlier drafts tried to `grep
"dedup complete:"` against a second invocation; the script emits a
single-line JSON object only and that grep is dead code.)

```bash
$SCRIPTS/checkpoint.py "$MILESTONE_ID" critique-complete
$SCRIPTS/log-event.sh "$MILESTONE_ID" phase-exit phase=critique-complete
```

---

## Phase 4 — RECTIFY (MAIN SESSION ONLY — never delegate)

Read `$REFS/phase-rectify.md` fully. Do NOT dispatch a sub-agent for this phase. If the main session is out of context budget, the only permissible delegation is to a sub-agent that did NOT write the implementation.

```bash
$SCRIPTS/checkpoint.py "$MILESTONE_ID" rectify-running
$SCRIPTS/log-event.sh "$MILESTONE_ID" phase-enter phase=rectify-running
```

### 4a — Re-verification (anchor each CRITICAL + HIGH against live code)

For every CRITICAL and HIGH finding in `critique/dedup.md`:

```python
# Conceptually:
cited_text = finding.anchor_field  # first 40 chars of cited line
window = read_file(finding.file, finding.line - WINDOW, finding.line + WINDOW)
WINDOW = 30  # code; 10 for prose/MDX/config

if cited_text not in window:
    mark_invalidated(finding, reason="anchor-not-found")
elif live_code_no_longer_matches_critic_claim(finding):
    mark_invalidated(finding, reason="code-no-longer-matches-claim")
else:
    proceed_to_fix(finding)
```

Log each invalidation:
```bash
$SCRIPTS/log-event.sh "$MILESTONE_ID" finding-invalidated id=<id> reason=<reason>
```

**If invalidation rate > 40%:** Re-run `dispatch-critics.sh` against the post-implement diff and re-dispatch critics (back to Phase 3, transition via `checkpoint.py --rollback-to critique-running`). Do NOT push through.

### 4b — Fix loop

Ordered per `## Recommended rectification order` in `dedup.md`.

Severity actions:
- **CRITICAL**: Always fix. Add regression test/assert/snapshot.
- **HIGH**: Always fix. Add regression test/assert/snapshot.
- **MEDIUM**: Fix iff ≤ 30 LOC AND no new test files needed beyond a single assert. Else defer.
- **LOW**: Defer.

Inner cap: 3 attempts per finding. Outer cap: 3 full check-matrix iterations.

Escalation triggers (any one suffices):
- Cap exhausted.
- Same error string twice in a row.
- Zero diff overlap between attempt N and N-1.

On escalation: write `rectify/escalation.md` with last error + diff history. Surface with "human needed". Exit Phase 4 in `rectify-running`. User decides: `--resume rectify --start-fresh [--model opus]`.

Record each fix:
```bash
$SCRIPTS/checkpoint.py "$MILESTONE_ID" --append "fixed_findings=[\"<id>\"]"
$SCRIPTS/log-event.sh "$MILESTONE_ID" finding-fixed id=<id>
```

### 4c — Regression-guard structural check

After local commit:
```bash
$SCRIPTS/check-rect-tests.sh
```

If fails: `git reset --soft HEAD~1`. Fix. Re-commit. Prompt-only enforcement is not enough.

### 4d — Rect commit

**Critical sequencing:** build the full commit message (subject + body + ALL trailers)
in one pass, then `git commit -S -m "$MSG"`. The earlier approach of committing first
and then mutating `.git/COMMIT_EDITMSG` via `git interpret-trailers --in-place` is
broken — `COMMIT_EDITMSG` is a stale file post-commit, so the trailers never reach
the actual commit object. Trailers must be composed BEFORE the commit lands.

```bash
# 1. Derive the fixed-id list from $RECT_ORDER (computed in Phase 3 and stored in state).
RECT_ORDER=$($SCRIPTS/checkpoint.py "$MILESTONE_ID" --get critique_rect_order)
FIXED_IDS=$(echo "$RECT_ORDER" | jq -r '. | join(", ")')

# 2. Build --trailer args. dispatch-critics.sh emits canonical milestone-*
#    agent names directly (see H8 in conversion critique), so no name mapping
#    is needed — the names from $CRITICS_JSON are the agent filenames.
TRAILER_ARGS=(--trailer "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>")
for critic_name in $(echo "$CRITICS_JSON" | jq -r '.always + .conditional + .optional | unique | .[]'); do
  TRAILER_ARGS+=(--trailer "Reviewed-by: $critic_name <noreply@anthropic.com>")
done

# 3. Compose subject + body + trailers via `git interpret-trailers`, then commit
#    with the fully-baked message.
MSG=$(printf 'rect(%s): close %s\n\nCloses critique findings: %s\n' \
        "$MILESTONE_ID" "$FIXED_IDS" "$FIXED_IDS" \
      | git interpret-trailers "${TRAILER_ARGS[@]}")

git -C "$REPO_ROOT" commit -S -m "$MSG"
```

Subject ≤ 50 chars after prefix. Imperative. No period. Signed via `commit.gpgsign=true`. NEVER `--no-verify`, NEVER `--no-gpg-sign`.

If GPG signing fails (gpg-agent unresponsive), abort Phase 4 in `rectify-running` —
do NOT retry with `--no-gpg-sign`. The user restarts the gpg-agent and runs
`/milestone-pipeline <id> --resume` once it's healthy.

Record: `$SCRIPTS/checkpoint.py "$MILESTONE_ID" --set "rectification_commit=$(git rev-parse HEAD)"`

### 4e — External-write boundary (STOP HERE)

```bash
EXTERNAL_WRITES=$($SCRIPTS/checkpoint.py "$MILESTONE_ID" --get external_writes_required)
```

If non-empty, print EXACTLY this block to the user and STOP:

```
Pipeline complete locally. External writes pending:
  <list each item from external_writes_required>

To proceed:
  - For release: invoke /release-deputy (it will run preflight, then prompt).
  - For git push: confirm authorization, then run: git push origin main
  - To skip any item: reply with "skip <item>".

None of these will run automatically. The pipeline is paused at rectify-running
until you reply with explicit per-write authorization.
```

Do NOT auto-invoke `release-deputy`. Do NOT push. Do NOT call any `bin/site` mutating verb. Wait for user-direct reply.

As the user authorizes (or skips) each item, append to
`external_writes_completed` — that is the canonical "this item is no longer
pending" set per `state.schema.json`. Both "authorize" and "skip" replies
update the same field; a separate skipped list is intentionally not modeled
because the user's intent is identical from the pipeline's perspective
(item is done, do not block).

```bash
# For an authorized item (user replied "authorize <item>" then ran it):
$SCRIPTS/checkpoint.py "$MILESTONE_ID" --append "external_writes_authorized=[\"<item>\"]"
$SCRIPTS/checkpoint.py "$MILESTONE_ID" --append "external_writes_completed=[\"<item>\"]"

# For a skipped item (user replied "skip <item>"):
$SCRIPTS/checkpoint.py "$MILESTONE_ID" --append "external_writes_completed=[\"<item>\"]"
```

When `external_writes_required ⊆ external_writes_completed`:

```bash
$SCRIPTS/checkpoint.py "$MILESTONE_ID" complete
$SCRIPTS/compute-metrics.py "$MILESTONE_ID"
$SCRIPTS/log-event.sh "$MILESTONE_ID" pipeline-complete
```

Write `rectify/summary.md` with: fixed findings, deferred findings (with rationale), invalidated findings, regression tests added.

---

## Anti-pattern guard — read before each phase

| Temptation | Rule |
|---|---|
| Skip Phase 1 — milestone seems obvious | Always run Phase 1. Vague briefs are the #1 multi-agent failure mode. |
| Dispatch critics one at a time | ALL critic Agent calls in ONE turn. Sequential destroys the cost model. |
| Have the implementer write the critique | Implementer NEVER writes critique. Self-critique misses ~70% of findings. |
| Echo agent output into chat for synthesis | Anti-pattern. Read paths on disk at synthesis time. |
| Skip re-verify step because "most findings look valid" | > 40% invalidation = stale code. Re-run dispatch-critics. |
| Add `Reviewed-by:` by appending text | Use `git interpret-trailers --in-place`. |
| Auto-invoke `release-deputy` from Phase 4 | Collapses user-direct authorization chain. Print the one-liner; stop. |
| Re-run Phase 1 without clearing downstream artifacts | Stale downstream artifacts route by file presence. Always reset downstream state via `checkpoint.py --rollback-to`. |
| Edit `state.json` by hand | Use `checkpoint.py --rollback-to <phase>` — it logs an explicit unwind. |
| Sneak in `bin/site app release` after rect tests pass | External writes always cross the boundary. Phase 4 stops at the local commit. |
| Push "just so the user can see progress" | No push, ever. Even on a no-PR repo, push is an external write. |
| Use built-in `Explore` subagent_type for Phase 1 | Always use `milestone-researcher` — built-in Explore lacks milestone-specific context. |
| Call dispatch-critics.sh with `--oss-scout` flag | The script flag is `--include-oss`; the user-facing flag is `--oss-scout`. Map at call site. |
| Route on `summary` field of sub-agent JSON return | Route ONLY on `status` field and on-disk file presence + schema validity. |

---

## Resume behavior

If `state.json` exists and `--start-fresh` is NOT set for rectify, resume from the recorded `phase`:
- `research-running` → re-read brief paths from state; retry any incomplete researchers
- `research-complete` → skip to Phase 2
- `implement-running` → re-read base SHA from state; continue or re-delegate
- `implement-complete` → skip to Phase 3
- `critique-running` → re-read critic list from state; retry any incomplete critics
- `critique-complete` → skip to Phase 4
- `rectify-running` → re-read `fixed_findings`, continue loop from next unfixed finding
- `complete` → print final summary from `metrics.json`; no-op

`--resume rectify --start-fresh` resets `fixed_findings`, `deferred_findings`, `invalidated_findings`, rectify loop counters, and `rectification_commit` to null, then enters Phase 4 fresh (critique artifacts preserved).
