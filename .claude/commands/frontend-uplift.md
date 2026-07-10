# /frontend-uplift

Run the canonical Proclivity frontend-modernization pipeline:
**Discover (evidence wave → direction wave, parallel agents incl. the ART-DIRECTION frame) → Synthesize → Challenge → Prioritize**

Usage:
```
/frontend-uplift                                            # ask for uplift id
/frontend-uplift <id>
/frontend-uplift <id> --brief "verbatim user scope"
/frontend-uplift <id> --views "today,sprint,gantt,reminders,settings"  # override the default 8-view set
/frontend-uplift <id> --mode lean|standard|deep|experiential  # default standard; art-direction fires in ALL of them
/frontend-uplift <id> --surface tool|mixed|experiential|auto  # default tool (Proclivity is an S-2 new-tab)
/frontend-uplift <id> --workflow                            # OPTIONAL Gen-2 background orchestrator (explicit opt-in only)
/frontend-uplift <id> --resume                              # resume from current state
```

`<id>` is a free-form slug.  Convention: date-tagged scope, e.g. `2026q2-visual-refresh` or `sprint-modernize-v1`.  If no id is given, STOP and ask: "What uplift id should I use?"

The pipeline answers: **"Where can Proclivity's new-tab UI become more attractive, sleek, and modern — with a real ART-DIRECTION THESIS (not cookie-cutter polish), measured against 2026 SOTA platforms, modern libraries, and the motion vocabulary — without violating the local-only / MV3-CSP / strict-TS / ≤~400 KB initial-chunk constraints or `prefers-reduced-motion` accessibility?"**  It does NOT produce code; it produces a ranked candidate report ready to feed `/milestone-pipeline` (single-candidate) or `/roadmap` (multi-candidate program).

**Standing default — art-direction thesis BEFORE ranking (the anti-cookie-cutter mandate).** Every run establishes a **design frame before candidates are ranked**: the `frontend-uplift-art-direction-scout` (dispatched in EVERY mode, lean included) reads the taste canon `.claude/references/frontend-design-language.md` AND this repo's house-thesis overlay (`.claude/references/frontend-uplift/proclivity-design-system.md` **§9**), then produces a visual thesis + 3 divergent directions + the active BAN-1..15 list + a surface map. Synthesis (Phase 2) OPENS with that frame; the challenger's axis 11 (Phase 3) BLOCKS frameless/template output; the prioritizer (Phase 4) ranks in PORTFOLIO LANES. **Polish without direction is the failure this pipeline exists to prevent.**  (To BUILD or RESTYLE a surface in-session — thesis → implement → self-score — use the `/frontend-design` skill instead; `/frontend-uplift` produces a discovery report and ships nothing.)

**Standing default — the motion-jobs test (no quota).** Every motion candidate must name the job it serves — **orientation / causality / feedback / continuity** (flat `frontend-uplift-motion-vocabulary.md` §0). No named job → no motion; there is no motion quota to fill. Native CSS / incumbent facility first; a library only when a named job needs one, lazy-loaded under the chunk budget. Entry fades, ambient glow, and stagger-for-its-own-sake do NOT pass the test.

**Surface awareness.** Proclivity's entire UI is the new-tab dashboard — an **S-2 tool** surface (see the §9 surface map). There is no landing/hero/onboarding, so experiential motion (parallax, scroll-scrub, WebGL galleries) is **BLOCKED by default** and the `frontend-uplift-experiential-scout` is **not dispatched by default**. The one bounded exception is the R3F `MeshBackground` (an S-1m decorative island behind the working UI). Default `--surface tool`.

---

## Step 0 — Initialize state + canon freshness

```bash
# parse: <ID> [--brief "..."] [--views "csv"] [--mode lean|standard|deep|experiential]
#        [--surface tool|mixed|experiential|auto] [--workflow] [--resume]
# --surface defaults to "tool" for this repo; --mode defaults to "standard".
# --surface is threaded into scout dispatch as {SURFACE}; it is NOT persisted
#   (checkpoint.py rejects fields absent from the init schema). On --resume, default to "tool".

.claude/scripts/frontend-uplift/init-uplift.sh <ID> [--brief "<verbatim user brief>"] [--views "today,sprint,..."]
mkdir -p .claude/agent-memory/frontend-uplift-art-direction-scout \
         .claude/agent-memory/frontend-uplift-visual-scout \
         .claude/agent-memory/frontend-uplift-library-scout \
         .claude/agent-memory/frontend-uplift-inspiration-scout \
         .claude/agent-memory/frontend-uplift-experiential-scout \
         .claude/agent-memory/frontend-uplift-current-state-critic \
         .claude/agent-memory/frontend-uplift-challenger
```

- If the state file already exists, the script prints `state already exists (phase=X) — resuming`.
- If resuming: run `status.sh` first, then skip to the appropriate phase below.
- The `mkdir -p` ensures per-agent memory dirs exist; safe to re-run.

**Canon freshness (advisory — surface loudly, NEVER blocks):**
```bash
python3 .claude/scripts/frontend-uplift-canon-lint.py check --root .
```
Print the result. A stale/incomplete canon means the frame is built on drifted doctrine — say so — but continue regardless.

```bash
.claude/scripts/frontend-uplift/status.sh <ID>
```

Read `.claude/references/frontend-uplift/state-schema.md` only if you need to inspect or write a field the scripts don't cover.

> **`--workflow` (OPTIONAL Gen-2 path).** When the user passes `--workflow`, Step 0 (init + canon-lint) and Step 1a (preflight) STILL run in the MAIN session (the Workflow JS cannot exec scripts or drive the preview), then the orchestrator invokes the Workflow tool with `scriptPath: ".claude/scripts/frontend-uplift-workflow.mjs"` and `args: { id, brief, mode, surface, views, url }`, which runs DISCOVER→SYNTHESIZE→CHALLENGE→PRIORITIZE off the main session (SYNTHESIZE/PRIORITIZE offloaded to `pipeline-synthesizer` / `pipeline-prioritizer`). **The Workflow tool requires the user's explicit opt-in per run — `--workflow` must NEVER be taken automatically.** Default remains the Gen-1 in-session path (Steps 1–4 below).

---

## Step 1 — Discover (two waves, parallel WITHIN each wave)

Read `.claude/references/frontend-uplift/phase-discover.md` once at phase start.

### 1a — Preflight: ensure the dev server is up

The visual scout drives the live newtab at `http://localhost:5173/src/newtab/index.html`.  Before dispatching, run:

```bash
.claude/scripts/frontend-uplift/ensure-preview-up.sh
```

If exit status != 0, surface the recovery hint (`npm run dev`) and HALT before dispatching any agent.  Re-invoke `/frontend-uplift <ID>` after the dev server is up — `init-uplift.sh` is idempotent and `status.sh` will show the phase ready to advance.

### 1b — Set mode + dispatch (two waves)

Record the mode (accepts any of the four; the field already exists in state):
```bash
.claude/scripts/frontend-uplift/checkpoint.py <ID> --set discover_mode='"standard"'   # or "lean" | "deep" | "experiential"
```

Dispatch agents **by their `subagent_type` name** (each agent's file body IS its canonical prompt; substitute `{ID}`, `{UPLIFT_BRIEF}`, `{BRIEF_PATH}`, `{SCREENSHOT_DIR}`, `{VIEWS}`, `{SURFACE}`, and the wave-1 evidence paths). `isolation: worktree` on every agent.

> **First-run registration caveat / fallback:** if a just-synced agent (`frontend-uplift-art-direction-scout`, `frontend-uplift-experiential-scout`) fails `subagent_type` dispatch this session, fall back to `subagent_type: general-purpose` with that agent's `.claude/agents/<name>.md` body pasted inline as the prompt. The `.claude/references/frontend-uplift/agent-prompts.md` copies are **superseded** by the agent definitions and pending retirement — do NOT dispatch from them.

**Wave 1 — evidence (one turn, parallel).** Ground the frame in what IS before any direction is proposed:

| Agent (`subagent_type`) | Brief path |
|---|---|
| `frontend-uplift-visual-scout` | `.claude/notes/frontend-uplifts/<ID>/discover/visual-scout-brief.md` |
| `frontend-uplift-current-state-critic` | `.claude/notes/frontend-uplifts/<ID>/discover/current-state-critic-brief.md` |

**Wave 2 — direction + outward (one turn, parallel), fed the wave-1 briefs + `screenshots/*.png`:**

| Agent (`subagent_type`) | Fires in mode | Brief path |
|---|---|---|
| `frontend-uplift-art-direction-scout` | **EVERY mode (incl. lean)** | `.claude/notes/frontend-uplifts/<ID>/discover/art-direction-scout-brief.md` |
| `frontend-uplift-library-scout` | standard, deep, experiential | `.claude/notes/frontend-uplifts/<ID>/discover/library-scout-brief.md` |
| `frontend-uplift-inspiration-scout` | standard, deep, experiential | `.claude/notes/frontend-uplifts/<ID>/discover/inspiration-scout-brief.md` |
| `frontend-uplift-experiential-scout` | ONLY when `--surface` ≠ `tool` | `.claude/notes/frontend-uplifts/<ID>/discover/experiential-scout-brief.md` |

Pass the art-direction-scout (and experiential-scout) `{SURFACE}`, and point it at the wave-1 evidence: `{VISUAL_MANIFEST}` = the `screenshots/` dir (Read renders the PNGs), `{CURRENT_STATE_BRIEF}` = the current-state-critic brief path. If wave 1 produced no screenshots (degraded run), the art-direction-scout scores the current state from source (`✓ code` / `~ inferred` tiers) and says so.

**Mode → wave-2 scout set:**
- **`lean`** — art-direction-scout ONLY (drops library + inspiration + experiential). The frame is never dropped.
- **`standard`** (default) — art-direction + library + inspiration.
- **`deep`** — same as standard, but the current-state-critic runs at a higher reasoning tier (it is `model: sonnet`; for `deep` note in its dispatch that it should reason at maximum depth).
- **`experiential`** — art-direction + library + experiential (drops inspiration). Only meaningful when `--surface` ≠ `tool`; on the default `tool` surface, prefer `standard`.

**Surface gate (absolute):** on `--surface tool` (the Proclivity default) the experiential-scout is NOT dispatched — there is no S-1/S-1m surface for it to serve beyond the bounded MeshBackground island, and its spectacle candidates would be axis-11 BLOCKERs. Only dispatch it for `mixed`/`experiential` runs that genuinely scope an experiential surface.

Record each dispatch and advance state:
```bash
for agent in <the agents you dispatched>; do
  .claude/scripts/frontend-uplift/checkpoint.py <ID> --append agents_dispatched="\"$agent\""
done
.claude/scripts/frontend-uplift/checkpoint.py <ID> discover-running
```

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

If the art-direction-scout failed to return a frame, say so LOUDLY — the synthesis will build a PROVISIONAL frame from `frontend-design-language.md` §8 + the §9 overlay, and the challenger treats a frameless catalog as a run-level BLOCKER.

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

**OPEN the synthesis with the ADOPTED FRAME** (the art-direction-scout's thesis + 3 directions + BAN list + surface map) — every candidate is then placed as `[DIRECTION-DEFINING]` / frame-compatible / `[polish]`.  Use the fixed candidate-entry shape and taxonomy from `phase-synthesize.md`.  Deduplicate across briefs.  Surface FOUNDATIONAL candidates first (the ones others depend on).  For every motion candidate, **name its job** (orientation / causality / feedback / continuity) and cross-link the flat-canon `[MOT-N]` / `[EXP-N]` primitive (`.claude/references/frontend-uplift-motion-vocabulary.md`, `.claude/references/frontend-uplift-experiential-motion.md`); a candidate with no named job is not a motion candidate.

```bash
.claude/scripts/frontend-uplift/checkpoint.py <ID> --set synthesis_path='".claude/notes/frontend-uplifts/<ID>/artifacts/synthesis.md"'
.claude/scripts/frontend-uplift/checkpoint.py <ID> --set candidate_count=<N>
.claude/scripts/frontend-uplift/checkpoint.py <ID> synthesize-complete
```

---

## Step 3 — Challenge (single sub-agent, 11-axis)

Read `.claude/references/frontend-uplift/phase-challenge.md` once at phase start.

```bash
.claude/scripts/frontend-uplift/checkpoint.py <ID> challenge-running
```

Dispatch the `frontend-uplift-challenger` agent (`subagent_type: frontend-uplift-challenger`, `isolation: worktree`).  Its body is the canonical **11-axis** prompt (axis 11 = distinctiveness / anti-template vs `frontend-design-language.md` BAN-1..15 + §10 rubric + the §9 house thesis; a frameless synthesis is a run-level BLOCKER).  Substitute `{ID}`, `{SYNTHESIS_PATH}`, `{CHALLENGE_PATH}`.

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

## Step 4 — Prioritize (main session, PORTFOLIO LANES)

Read `.claude/references/frontend-uplift/phase-prioritize.md` once at phase start.

```bash
.claude/scripts/frontend-uplift/checkpoint.py <ID> prioritize-running
```

Run in the **main session** (NOT a sub-agent) — the user reviews this report directly.

Read synthesis + challenge end-to-end.  **Assign every surviving candidate to exactly ONE portfolio lane**, then compute RICE-light **only WITHIN a lane** (cross-lane ranking mathematically buries structural design under XS polish):

1. **`a11y-safety-debt`** — MANDATORY lane, listed **FIRST**, never ranked away (reduced-motion gaps, contrast/keyboard/focus regressions, token-reservation fixes).
2. **`signature-direction`** — the direction-defining moves from the frame (what changes the language).
3. **`foundations`** — candidates others depend on (e.g., adopt a lazy-loaded motion library).
4. **`workflow`** — task-flow / interaction upgrades (command palette, drag-to-reorder).
5. **`polish`** — cosmetic paper-cuts.

Within each lane, score **RICE-light**: R 1/3/10 × Visual-Impact 0.5/1/3 × Triangulation-Confidence 0.3–1.0 / Effort-by-tshirt 0.25–8.  Apply challenger penalties (drop on un-redesigned BLOCKER; halve on redesigned BLOCKER; -25% on MAJOR; no adjustment on MINOR / NONE).  Write:
```
.claude/notes/frontend-uplifts/<ID>/artifacts/final-report.md
```

with these sections in order:

1. Executive summary (frame recap in one line; top candidate PER LANE; theme; caveat)
2. Quick-glance ranking table (grouped BY LANE — `a11y-safety-debt` first)
3. **The adopted frame** (thesis + directions + BAN list + surface map — recapped from synthesis)
4. Per-lane detail (a11y-safety-debt FIRST; then signature-direction / foundations / workflow / polish) — synthesis entry + challenger objections + within-lane RICE breakdown + DAG note
5. Recommended next steps (a11y-safety-debt first; then 1–2 signature/foundation candidates `/milestone-pipeline`-ready; parking lot)
6. Visual evidence index (screenshots × candidates)
7. Honest limitations
8. Cross-reference index

If the top-5 across lanes is all `[polish]` (no `signature-direction` survivor), SAY SO explicitly — the run polished an undirected layout.

**Always OFFER but NEVER auto-invoke `/milestone-pipeline` or `/roadmap`.**  Include the offer footer when candidates clear the documented thresholds; the user types the next command if they want to proceed.

Record:
```bash
.claude/scripts/frontend-uplift/checkpoint.py <ID> --set final_report_path='".claude/notes/frontend-uplifts/<ID>/artifacts/final-report.md"'
.claude/scripts/frontend-uplift/checkpoint.py <ID> --set ranked_candidates='[{"id":"UPL-1","title":"...","lane":"signature-direction","rice":13.0,"rank":1},...]'
.claude/scripts/frontend-uplift/checkpoint.py <ID> complete
```

Print a 5-line final summary: uplift id, total candidates, top candidate per lane, BLOCKER count, recommended next step.

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

## Boundaries (non-negotiable)

- **NEVER ships code.**  `final-report.md` is the deliverable; code-shipping is `/milestone-pipeline`'s job AFTER the user invokes it.
- **NEVER auto-invokes `/milestone-pipeline`, `/roadmap`, or `/spike`.**  The handoff is an OFFER the main session makes; the user invokes when ready.
- **Requires a live dev server** — the Step 1a preflight runs first and HALTS the run on failure.
- **`--workflow` requires explicit user opt-in** per run; never auto-selected.

---

## Common rationalizations (anti-pattern guard)

| Tempting belief | Reality |
|---|---|
| "Skip the art-direction-scout in lean mode — it's just taste." | Taste IS the deliverable gap.  The frame fires in EVERY mode; dropping it re-creates the cookie-cutter output this pipeline exists to prevent. |
| "Better cards, nicer shadows, some motion — that's the uplift." | Polish on an undirected layout is still the generic look (design-language §1).  The frame comes first (thesis + direction + BAN list), THEN candidates.  A top-5 that's all `[polish]` must say so (Phase 4). |
| "Skip the preview-up check — the agents can figure it out." | NO.  The visual scout can't run without the dev server.  Preflight is load-bearing. |
| "Fire all scouts in one blind wave." | Two waves: evidence (visual + current-state) THEN direction/outward fed that evidence — parallel WITHIN each wave.  Don't collapse to one blind wave; don't serialize to one-at-a-time either. |
| "Synthesize from TL;DRs only." | Triangulation lives in matching specific claims across briefs.  Read every brief end-to-end + look at screenshots. |
| "Skip the challenger — the synthesis is good enough." | Synthesis biases toward "more polish".  Axis 11 blocks frameless/template output; without the adversary, Phase 4 ranks aspirational candidates blind to bundle / strict-TS / a11y / distinctiveness cost. |
| "Propose parallax / scroll-scrub on the Today / Sprint / Gantt sections." | Those are S-2 tool surfaces (§9 map); parallax/scroll-scrub is flat motion §8 **AP-1 on S-2** → challenger BLOCKER.  Operators want stillness on planning surfaces. |
| "Add motion because the UI feels static." | No named job = no motion.  "Static" is a gap only when orientation/causality/feedback/continuity go unserved (flat motion §0).  Entry fades and ambient glow are not jobs. |
| "Dispatch the experiential-scout — award sites are cool." | Not on `--surface tool`.  Proclivity has no landing/hero/onboarding; the experiential-scout's candidates would be axis-11 BLOCKERs.  The MeshBackground is a bounded S-1m island, not a license to flip the surface. |
| "Propose a heavy animation lib without lazy-loading it." | The initial newtab chunk must stay ≤~400 KB (500 KB hard); heavy libs need `React.lazy` per `CLAUDE.md`.  MV3 CSP forbids CDN/inline-script escape hatches — the lib bundles. |
| "Rank across all lanes by RICE." | Cross-lane RICE buries structural design under XS polish.  RICE is computed WITHIN a lane; `a11y-safety-debt` is listed first and never ranked away. |
| "Auto-invoke /milestone-pipeline on the top candidate." | NEVER.  Offer-and-wait. |
| "Inflate severity to surface more findings." | The challenger's NONE is a credible result.  Aim 30–60% NONE; padding objections erodes signal. |
| "Flag GSAP as a paid-license risk." | Obsolete — GSAP is 100% FREE since 2025 (flat motion §10).  Do not flag it on the license axis. |

---

## Don'ts

- **Don't run Phase 4 as a sub-agent.**  It needs the user's review surface.
- **Don't let the synthesizer write the challenge.**  Distinct roles.
- **Don't accept a frameless synthesis.**  It OPENS with the adopted frame; a frameless catalog is an axis-11 run-level BLOCKER.
- **Don't drop the art-direction-scout in any mode.**  It fires in lean too.
- **Don't dispatch the experiential-scout on `--surface tool`.**  Default is `tool`.
- **Don't auto-invoke `/milestone-pipeline` or `/roadmap`.**  Offer-and-wait.
- **Don't skip the preflight `ensure-preview-up.sh` check.**  The whole Phase 1 hinges on a reachable dev server.
- **Don't take `--workflow` automatically.**  It requires explicit user opt-in per run.
- **Don't manufacture candidates.**  Every catalog entry traces to ≥1 discover brief.
- **Don't bypass `scripts/init-uplift.sh`.**  State directory naming is load-bearing.
- **Don't `git push` at any phase.**  Uplift artifacts are local files under `.claude/notes/frontend-uplifts/`.

---

## Sub-agent memory

All `frontend-uplift-*` agents (art-direction, visual, library, inspiration, experiential, current-state-critic, challenger) have `memory: project`.  Their memory accumulates under `.claude/agent-memory/<agent-name>/` across uplift runs.  Do NOT clear or overwrite these directories — they carry institutional memory (which inspiration platforms have the richest design-blog signal, which directions/traits translated well, recurring synthesis blind spots, etc.).

---

## References

**Shared canon (synced — NEVER edit in-repo; the pipeline reads these for doctrine):**
- `.claude/references/frontend-design-language.md` — THE taste canon: §1 anti-reference, §3 surface classes, §4 REF-1..9 library, §5 BAN-1..15, §6 premium-instrument spec, §8 direction seeds, §10 cookie-cutter rubric, §14 evidence tiers + band→outcome map. §9 is a product-neutral CONTRACT — Proclivity's actual thesis lives in the overlay below.
- `.claude/references/frontend-uplift-motion-vocabulary.md` — flat `[MOT-N]` tool-motion canon: §0 surface model + motion-jobs test, §8 AP-N anti-patterns (surface-conditional), §9 token discipline, §10 library-compat matrix.
- `.claude/references/frontend-uplift-experiential-motion.md` — flat `[EXP-N]` experiential-motion canon (used only on `--surface` ≠ `tool` runs).
- `.claude/references/frontend-uplift-source-registry.md` — flat exemplar + toolkit registry.

**Repo-owned (edit here):**
- `.claude/references/frontend-uplift/proclivity-design-system.md` — the design inventory + **§9 house thesis** (thesis, invariants, named anti-references, surface map). The art-direction-scout MUST read §9.
- `.claude/references/frontend-uplift/phase-{discover,synthesize,challenge,prioritize}.md` — the 4 phase protocols (surfaced inline at each phase entry above).
- `.claude/references/frontend-uplift/state-schema.md` — `state.json` field reference (repo-local infra — NOT superseded).
- `.claude/commands/milestone-pipeline.md` — single-candidate handoff target.
- `.claude/commands/roadmap.md` — multi-candidate program handoff target.
- `CLAUDE.md` — stack, branching, build gates, "what agents must not do".

> **Token namespaces (do NOT mix):** the flat canon owns `[MOT-N]` and `[EXP-N]`. Proclivity-only primitives live in `.claude/references/frontend-uplift/motion-extensions.md` under `[PMOT-N]`, with `[PMOT-NO-N]` anti-patterns. The old subdir `motion-vocabulary.md` re-used `[MOT-N]` for different meanings (local `MOT-31` = magnetic-cursor vs canon `MOT-31` = floating-orbs) and has been retired into `motion-extensions.md`.
>
> **Superseded, pending human retirement (do NOT dispatch/cite):** `source-registry.md` is superseded by the flat canon above; `agent-prompts.md` is superseded by the agent definitions (this command dispatches by `subagent_type` name). They still exist so a human can retire them deliberately; the Proclivity-specific curation they held (the 8-view set, the planning-surface competitor list) lives in `phase-discover.md`, the scout agent bodies, and the §9 overlay.
