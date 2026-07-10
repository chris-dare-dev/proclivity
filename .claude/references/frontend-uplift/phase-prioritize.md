# Phase 4 — PRIORITIZE (main session)

**Purpose:** the main session reads synthesis + challenge and writes the ranked final report at `artifacts/final-report.md` ready to feed `/milestone-pipeline` (per-candidate) or `/roadmap` (multi-candidate program).  Runs in the main session so the user can review and iterate.

## Inputs

- `.claude/notes/frontend-uplifts/{ID}/artifacts/synthesis.md`
- `.claude/notes/frontend-uplifts/{ID}/artifacts/challenge.md`

## Output

`.claude/notes/frontend-uplifts/{ID}/artifacts/final-report.md`

## Portfolio lanes FIRST, then RICE-light WITHIN each lane

**Assign every surviving candidate to exactly ONE lane, then compute RICE only WITHIN a lane.**  Cross-lane RICE ranking mathematically buries structural design under XS polish (a 0.25-day polish item out-scores an 8-day direction move every time) — so RICE never ranks across lanes.

| Lane | Contains | Rule |
|---|---|---|
| **`a11y-safety-debt`** | reduced-motion gaps, contrast/keyboard/focus regressions, token-reservation (`--danger`/`--warn`/`--ok`) fixes | **MANDATORY lane, listed FIRST, never ranked away** — these ship regardless of RICE |
| **`signature-direction`** | the `[DIRECTION-DEFINING]` moves from the frame (what changes the language) | ranked by within-lane RICE |
| **`foundations`** | candidates others depend on (e.g., adopt a lazy-loaded motion library) | ranked by within-lane RICE; note the DAG |
| **`workflow`** | task-flow / interaction upgrades (command palette, drag-to-reorder) | ranked by within-lane RICE |
| **`polish`** | cosmetic paper-cuts | ranked by within-lane RICE |

Within each lane, score **RICE-light**:

| Variable | Scale | Source |
|---|---|---|
| **Reach** (R) | 1 / 3 / 10 | 1 = single section / surface; 3 = handful of sections; 10 = platform-wide (every section + modal benefits). |
| **Visual-Impact** (I) | 0.5 / 1 / 3 | 0.5 = polish; 1 = noticeably nicer; 3 = transformative (user first-load reaction changes). |
| **Confidence** (C) | 0.3 / 0.5 / 0.8 / 1.0 | Triangulation: 1 brief source → 0.3; 2 → 0.5; 3 → 0.8; 4+ → 1.0. |
| **Effort** (E) | 0.25 / 1 / 3 / 8 | T-shirt → person-days: XS=0.25, S=1, M=3, L=8. |

**RICE = R × I × C / E**

Challenger penalty (applied to the within-lane RICE):
- BLOCKER with no redesign → drop the candidate entirely (don't rank; note it in the parking lot with the BLOCKER rationale).
- BLOCKER with a credible redesign sketch → halve the RICE.
- MAJOR → -25% RICE.
- MINOR or NONE → no adjustment.

**Note:** the old flat "+30% foundational bonus" is retired — the `foundations` and `signature-direction` lanes now carry that structural work above `polish` by construction, so it no longer needs a numeric thumb on the scale.

## Final report sections

1. **Executive summary** (4–6 sentences) — the frame in one line; the top candidate PER LANE; main thematic recommendation; honest caveat about scout-run confidence ceiling.  If no `signature-direction` candidate survives (top of the list is all `polish`), SAY SO — the run polished an undirected layout.

2. **Quick-glance ranking table — grouped BY LANE** (`a11y-safety-debt` first, then signature-direction / foundations / workflow / polish; RICE is within-lane):

   | Lane | Rank | Cand id | Title | Category | Size | R | I | C | E | Penalty | Adj-RICE | Challenger |
   |---|---|---|---|---|---|---|---|---|---|---|---|---|
   | a11y-safety-debt | 1 | UPL-9 | Gate new list motion behind reduced-motion | Accessibility | XS | 10 | 1 | 1.0 | 0.25 | — | (mandatory) | NONE |
   | signature-direction | 1 | UPL-2 | Replace equal-card wall with a posture lede | Layout | M | 10 | 3 | 0.8 | 3 | — | 8.0 | NONE |
   | foundations | 1 | UPL-1 | Adopt a lazy-loaded motion library | Library/dependency | M | 10 | 3 | 1.0 | 3 | — | 10.0 | NONE |
   …

3. **The adopted frame** — recap the thesis + 3 directions + BAN list + surface map from synthesis, so the ranking is read against the direction.

4. **Per-lane detail** — `a11y-safety-debt` FIRST (never ranked away), then signature-direction / foundations / workflow / polish.  For each candidate: copy the synthesis entry verbatim; append the challenger findings inline; append the within-lane RICE breakdown + adjusted score + rank rationale + DAG dependency note.

5. **Recommended next steps** — 3–5 specific actions:
   - Which `a11y-safety-debt` items ship first (they are debt, not options)?
   - Which 1–2 `signature-direction` / `foundations` candidates are ready for `/milestone-pipeline`?
   - Which candidates to park for the next uplift run?

6. **Visual evidence index** — table of screenshot paths × candidate ids that use them.  Lets the user click through to see what's being proposed.

7. **Honest limitations** — bullet list:
   - Scouts had a 15-minute budget; some surfaces may be under-explored.
   - Triangulation across 4 briefs is strong but not infallible.
   - Bundle-size + RICE estimates are rough; ±50% accuracy is the realistic ceiling.
   - The challenger evaluated against the current React-18 + ≤~400 KB + strict-TS constraints; if conventions evolve, BLOCKERs may flip.

8. **Cross-reference index** — table of `UPL-id` → which discover briefs cited it + which screenshots support it.

## Optional handoff offers

The final report includes these footer offers when the top candidates clear sensible thresholds:

```text
## Handoff offers

### Single-candidate handoff (RICE ≥ 5 candidates)

To ship UPL-1 directly via the milestone pipeline:

    /milestone-pipeline frontend-uplift-foundation --brief "$(head -200 .claude/notes/frontend-uplifts/<ID>/artifacts/final-report.md)"

### Multi-candidate program handoff (≥ 3 candidates above RICE 3.0)

To convert this report into a roadmap with milestones:

    /roadmap frontend-uplift-<slug> --brief "$(head -300 .claude/notes/frontend-uplifts/<ID>/artifacts/final-report.md)"

The roadmap pipeline will refine → decompose → sequence → materialize from this report.

(Note: frontend-uplift NEVER auto-invokes /milestone-pipeline or /roadmap.  Always offer-and-wait.)
```

## After writing

```bash
.claude/scripts/frontend-uplift/checkpoint.py <ID> --set final_report_path='".claude/notes/frontend-uplifts/<ID>/artifacts/final-report.md"'
.claude/scripts/frontend-uplift/checkpoint.py <ID> --set ranked_candidates='[{"id":"UPL-1","title":"...","lane":"foundations","rice":10.0,"rank":1}, ...]'
.claude/scripts/frontend-uplift/checkpoint.py <ID> complete
```

Print a 5-line final summary: uplift id, total candidates, top candidate PER LANE (a11y-safety-debt first), BLOCKER count, recommended next step.

## Anti-patterns

| Tempting belief | Reality |
|---|---|
| "Auto-invoke /milestone-pipeline on the top candidate." | NEVER.  Offer-and-wait.  External-write gates are non-negotiable. |
| "Rank all candidates by RICE in one flat list." | NO.  Cross-lane RICE buries an 8-day direction move under a 0.25-day polish item.  Assign lanes FIRST; compute RICE only WITHIN a lane; list `a11y-safety-debt` first and never rank it away. |
| "Skip the foundations/signature lanes — RICE already accounts for it." | NO.  Lanes protect structural work from XS-polish burial, and the user needs to SEE the dependency DAG + the direction to plan sequencing. |
| "RICE Confidence is 1.0 for every candidate — they all came from 4 briefs." | Triangulation is the C-dial.  4 briefs = 1.0; 3 = 0.8; etc.  Reflect the actual triangulation, not aspiration. |
| "Effort estimates should be calendar-precise." | T-shirts (XS/S/M/L) only at this stage.  Calendar precision lives in `/roadmap` decomposition. |
| "Drop the parking-lot section — it's noise." | Keep it.  Discarded candidates document why Proclivity isn't pursuing X — invaluable when the question recurs. |
| "I'll rank a candidate even if the challenger BLOCKERed it with no redesign." | Don't.  Drop it entirely.  Half-considered BLOCKERs are noise; surface them in the parking lot with the BLOCKER rationale instead. |
