# /frontend-uplift

Run the canonical 4-phase Proclivity frontend-modernization pipeline:
**Discover (4 parallel agents — incl. live-preview walk) → Synthesize → Challenge → Prioritize**

Usage:
```
/frontend-uplift                                            # ask for uplift id
/frontend-uplift <id>
/frontend-uplift <id> --brief "verbatim user scope"
/frontend-uplift <id> --views "today,sprint,gantt,reminders,settings"  # override the default 8-view set
/frontend-uplift <id> --lean                                # 2 agents only (visual-scout + current-state-critic)
/frontend-uplift <id> -- resume from current state
```

`<id>` is a free-form slug.  Convention: date-tagged scope, e.g. `2026q2-visual-refresh` or `sprint-modernize-v1`.  If no id is given, STOP and ask: "What uplift id should I use?"

The pipeline answers: **"Where can Proclivity's new-tab UI become more attractive, sleek, and modern — measured against 2026 SOTA platforms, modern libraries, and motion vocabulary — without violating the local-only / strict-TS / ≤~400 KB initial-chunk constraints or `prefers-reduced-motion` accessibility?"**  It does NOT produce code; it produces a ranked candidate report ready to feed `/milestone-pipeline` (single-candidate) or `/roadmap` (multi-candidate program).

---

## Step 0 — Initialize state

```bash
.claude/scripts/frontend-uplift/init-uplift.sh <ID> [--brief "<verbatim user brief>"] [--views "today,sprint,..."]
mkdir -p .claude/agent-memory/frontend-uplift-visual-scout \
         .claude/agent-memory/frontend-uplift-library-scout \
         .claude/agent-memory/frontend-uplift-inspiration-scout \
         .claude/agent-memory/frontend-uplift-current-state-critic \
         .claude/agent-memory/frontend-uplift-challenger
```

- If the state file already exists, the script prints `state already exists (phase=X) — resuming`.
- If resuming: run `status.sh` first, then skip to the appropriate phase below.
- The `mkdir -p` ensures per-agent memory dirs exist; safe to re-run.

```bash
.claude/scripts/frontend-uplift/status.sh <ID>
```

Read `.claude/references/frontend-uplift/state-schema.md` only if you need to inspect or write a field that isn't covered by the scripts.

---

## Step 1 — Discover (parallel, 4 agents in ONE turn)

Read `.claude/references/frontend-uplift/phase-discover.md` once at phase start.

### 1a — Preflight: ensure the dev server is up

The visual scout drives the live newtab at `http://localhost:5173/src/newtab/index.html`.  Before dispatching, run:

```bash
.claude/scripts/frontend-uplift/ensure-preview-up.sh
```

If exit status != 0, surface the recovery hint and HALT before dispatching any agent.  Re-invoke `/frontend-uplift <ID>` after the dev server is up — `init-uplift.sh` is idempotent and `status.sh` will show `phase: init` ready to advance.

### 1b — Set mode + dispatch

Set the discover mode (default standard):
```bash
.claude/scripts/frontend-uplift/checkpoint.py <ID> --set discover_mode='"standard"'
```

Then dispatch all 4 agents in **one assistant turn** containing 4 `Agent` tool blocks.  Each uses `subagent_type: general-purpose`, sonnet, `isolation: worktree`.  The canonical prompts live in `.claude/references/frontend-uplift/agent-prompts.md` — copy verbatim and substitute `{ID}`, `{UPLIFT_BRIEF}`, `{BRIEF_PATH}`, `{SCREENSHOT_DIR}`, `{VIEWS}`.

| Agent name (state field) | Brief path |
|---|---|
| `visual-scout` | `.claude/notes/frontend-uplifts/<ID>/discover/visual-scout-brief.md` |
| `library-scout` | `.claude/notes/frontend-uplifts/<ID>/discover/library-scout-brief.md` |
| `inspiration-scout` | `.claude/notes/frontend-uplifts/<ID>/discover/inspiration-scout-brief.md` |
| `current-state-critic` | `.claude/notes/frontend-uplifts/<ID>/discover/current-state-critic-brief.md` |

Record each dispatch and advance state:
```bash
for agent in visual-scout library-scout inspiration-scout current-state-critic; do
  .claude/scripts/frontend-uplift/checkpoint.py <ID> --append agents_dispatched="\"$agent\""
done
.claude/scripts/frontend-uplift/checkpoint.py <ID> discover-running
```

In **lean** mode, dispatch only `visual-scout` + `current-state-critic`.

### 1c — Return briefs

As each agent returns:
```bash
.claude/scripts/frontend-uplift/checkpoint.py <ID> --append agents_returned='"<agent-name>"'
.claude/scripts/frontend-uplift/checkpoint.py <ID> --append discover_briefs='"<brief-path>"'
```

When all dispatched agents have returned:
```bash
.claude/scripts/frontend-uplift/checkpoint.py <ID> discover-complete
```

---

## Step 2 — Synthesize (main session)

Read `.claude/references/frontend-uplift/phase-synthesize.md` once at phase start.

```bash
.claude/scripts/frontend-uplift/checkpoint.py <ID> synthesize-running
```

Read EVERY brief end-to-end AND look at the screenshots under `.claude/notes/frontend-uplifts/<ID>/screenshots/`.  Build the unified modernization-candidate catalog at:
```
.claude/notes/frontend-uplifts/<ID>/artifacts/synthesis.md
```

Use the fixed candidate-entry shape and 10-category taxonomy from `phase-synthesize.md`.  Deduplicate across briefs.  Surface FOUNDATIONAL candidates first (the ones other candidates depend on, e.g., "adopt Framer Motion" unlocks stagger / fade-up follow-ons).  Cross-link motion vocabulary `[MOT-N]` primitives.

```bash
.claude/scripts/frontend-uplift/checkpoint.py <ID> --set synthesis_path='".claude/notes/frontend-uplifts/<ID>/artifacts/synthesis.md"'
.claude/scripts/frontend-uplift/checkpoint.py <ID> --set candidate_count=<N>
.claude/scripts/frontend-uplift/checkpoint.py <ID> synthesize-complete
```

---

## Step 3 — Challenge (single sub-agent)

Read `.claude/references/frontend-uplift/phase-challenge.md` once at phase start.

```bash
.claude/scripts/frontend-uplift/checkpoint.py <ID> challenge-running
```

Single `Agent` call with `subagent_type: general-purpose`, sonnet, `isolation: worktree`.  Use the canonical Challenger prompt from `agent-prompts.md` verbatim.  Substitute `{ID}`, `{SYNTHESIS_PATH}`, `{CHALLENGE_PATH}`.

The challenger writes to:
```
.claude/notes/frontend-uplifts/<ID>/artifacts/challenge.md
```

Record:
```bash
.claude/scripts/frontend-uplift/checkpoint.py <ID> --set challenge_path='".claude/notes/frontend-uplifts/<ID>/artifacts/challenge.md"'
.claude/scripts/frontend-uplift/checkpoint.py <ID> --set challenge_finding_counts='{"critical":N_BLOCKER,"high":N_MAJOR,"medium":N_MINOR,"low":N_CLEAN}'
.claude/scripts/frontend-uplift/checkpoint.py <ID> challenge-complete
```

(BLOCKER → critical, MAJOR → high, MINOR → medium, NONE → low.)

---

## Step 4 — Prioritize (main session)

Read `.claude/references/frontend-uplift/phase-prioritize.md` once at phase start.

```bash
.claude/scripts/frontend-uplift/checkpoint.py <ID> prioritize-running
```

Run in the **main session** (NOT a sub-agent) — the user reviews this report directly.

Read synthesis + challenge end-to-end.  Score every candidate via **RICE-light** (R 1/3/10 × Visual-Impact 0.5/1/3 × Triangulation-Confidence 0.3-1.0 / Effort-by-tshirt 0.25-8).  Apply challenger penalties (drop on un-redesigned BLOCKER; halve on redesigned BLOCKER; -25% on MAJOR; no adjustment on MINOR / NONE) AND a **foundational-candidate bonus** (+30% on candidates synthesis flagged as foundational).  Write:
```
.claude/notes/frontend-uplifts/<ID>/artifacts/final-report.md
```

with these sections in order:

1. Executive summary (top-3 by adjusted RICE, theme, caveat)
2. Quick-glance ranking table
3. Foundational candidates (FIRST in detail; they unblock the rest)
4. Top-10 in detail (synthesis entry + challenger objections + RICE breakdown + DAG note)
5. Recommended next steps (foundational first; then 1–2 `/milestone-pipeline`-ready; parking lot)
6. Visual evidence index (screenshots × candidates)
7. Honest limitations
8. Cross-reference index

**Always OFFER but NEVER auto-invoke `/milestone-pipeline` or `/roadmap`.**  Include the offer footer when candidates clear the documented thresholds; the user types the next command if they want to proceed.

Record:
```bash
.claude/scripts/frontend-uplift/checkpoint.py <ID> --set final_report_path='".claude/notes/frontend-uplifts/<ID>/artifacts/final-report.md"'
.claude/scripts/frontend-uplift/checkpoint.py <ID> --set ranked_candidates='[{"id":"UPL-1","title":"Adopt Framer Motion","rice":13.0,"rank":1},...]'
.claude/scripts/frontend-uplift/checkpoint.py <ID> complete
```

Print a 5-line final summary: uplift id, total candidates, top-3 by adjusted RICE, BLOCKER count, recommended next step.

---

## State machine

```
init → discover-running → discover-complete
     → synthesize-running → synthesize-complete
     → challenge-running → challenge-complete
     → prioritize-running → complete
```

`status.sh` prints elapsed time per phase, which agents are pending, and the count of screenshots captured.

---

## Common rationalizations (anti-pattern guard)

| Tempting belief | Reality |
|---|---|
| "Skip the preview-up check — the agents can figure it out." | NO.  The visual scout can't run without the dev server.  Preflight is load-bearing. |
| "Skip the visual scout — the other 3 agents cover the gaps." | NO.  Without live screenshots, every claim about visual state is unverifiable.  The visual scout is the EVIDENCE-PRODUCING agent; the rest are interpreters. |
| "Fire agents one at a time to read each brief as it lands." | Sequential dispatch doubles wall-clock and kills diversity.  ONE turn, 4 tool blocks. |
| "Synthesize from TL;DRs only." | Triangulation lives in matching specific claims across briefs.  Read every brief end-to-end + look at screenshots. |
| "Skip the challenger — the synthesis is good enough." | Synthesis biases toward "more polish".  Without an adversary, Phase 4 ranks aspirational candidates blind to bundle / strict-TS / a11y cost. |
| "Auto-invoke /milestone-pipeline on the top candidate." | NEVER.  Offer-and-wait. |
| "Inflate severity to surface more findings." | The challenger's NONE is a credible result.  Aim 30–60% NONE; padding objections erodes signal. |
| "Propose parallax on the Today section." | motion-vocabulary §8 anti-pattern — operators want stillness on planning surfaces. |
| "Propose a heavy animation lib without lazy-loading it." | Proclivity's initial newtab chunk must stay ≤~400 KB; heavy libs need `React.lazy` per CLAUDE.md. |

---

## Don'ts

- **Don't run Phase 4 as a sub-agent.**  It needs the user's review surface.
- **Don't let the synthesizer write the challenge.**  Distinct roles.
- **Don't auto-invoke `/milestone-pipeline` or `/roadmap`.**  Offer-and-wait.
- **Don't skip the preflight `ensure-preview-up.sh` check.**  The whole Phase 1 hinges on a reachable dev server.
- **Don't manufacture candidates.**  Every catalog entry traces to ≥1 discover brief.
- **Don't bypass `scripts/init-uplift.sh`.**  State directory naming is load-bearing.
- **Don't `git push` at any phase.**  Uplift artifacts are local files under `.claude/notes/frontend-uplifts/`.

---

## Sub-agent memory

All `frontend-uplift-*` agents have `memory: project` in their frontmatter.  Their memory accumulates under `.claude/agent-memory/<agent-name>/` across uplift runs.  Do NOT clear or overwrite these directories — they carry institutional memory across runs (which inspiration platforms have the richest design-blog signal, which preview-tool corner cases need workarounds, recurring synthesis blind spots, etc.).

---

## References

Phase references (`phase-discover.md`, `phase-synthesize.md`, `phase-challenge.md`, `phase-prioritize.md`), the agent-prompts source (`agent-prompts.md`), and the curated knowledge files (`source-registry.md`, `motion-vocabulary.md`, `proclivity-design-system.md`) are all surfaced INLINE at their phase entries — no need to list them here.  Cross-cutting references the phase bodies don't already link:

- `.claude/references/frontend-uplift/state-schema.md` — `state.json` field reference
- `.claude/commands/milestone-pipeline.md` — single-candidate handoff target
- `.claude/commands/roadmap.md` — multi-candidate program handoff target
- `CLAUDE.md` — stack, branching, build gates, "what agents must not do"
