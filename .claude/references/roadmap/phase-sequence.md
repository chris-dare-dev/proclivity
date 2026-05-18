# Phase 3 — SEQUENCE

**Goal:** decide which epics ship Now (fully spec'd to story level), which are Next (shaped, not story-spec'd), which are Later (outcomes only), and which `[MUST]` assumptions need spikes before any of the above.

**Sections:** populates the `<!-- ROADMAP:section:sequence -->`, `<!-- ROADMAP:section:lanes -->`, and `<!-- ROADMAP:section:spikes -->` blocks in `plans/<slug>-roadmap.md`.

## Step-by-step

### 1. MoSCoW the epics

Tag every epic from Phase 2 as Must / Should / Could / Won't:

| Tag | Meaning |
|---|---|
| **Must** | Without this, the Objective is not met. |
| **Should** | Important; design a fallback if it slips. |
| **Could** | Nice-to-have; Won't is the default if anything contracts. |
| **Won't** | Out of scope this roadmap (matches Phase 1 Won't list). |

Run the cap check by piping your draft assignments into stdin:

```bash
printf "e1 | must   | 2.0\ne2 | should | 1.5\n" | \
  python3 .claude/scripts/roadmap/score-moscow.py
```

Hard rule (DSDM Consortium 2014, §10.4): **Musts ≤ 60% of total epic count.** Script exits 1 on violation. If you violate, you have not prioritized — you have flat-listed with the Must label.

### 2. RICE-rank the Musts

For every Must epic, compute RICE:

```
RICE = (Reach × Impact × Confidence) / Effort
```

- **Reach:** number of users / sessions / newtab-opens affected per cycle. Integer.
- **Impact:** 0.25 (minimal), 0.5 (low), 1 (medium), 2 (high), 3 (massive). Discrete steps only.
- **Confidence:** percentage. **Default 50% when there's no evidence.** 80% with anecdotal evidence. 100% only with data. Surface every default-50% explicitly to the user.
- **Effort:** person-weeks. Integer or half-week.

Run:

```bash
printf "e1 | 100 | 2 | 80 | 1.0\ne2 | 50 | 1 | 50 | 2.0\n" | \
  python3 .claude/scripts/roadmap/score-rice.py
```

Output is a ranked table. The orchestrator must surface every Confidence=50% default to the user before accepting the rank.

### 3. Now / Next / Later assignment

| Lane | Detail level | Time horizon |
|---|---|---|
| **Now** | Fully spec'd: stories with Given/When/Then AC, T-shirt sizes, specialist hints from Phase 2 | Current cycle (this quarter / next 6 weeks) |
| **Next** | Shaped: epic body, INVEST check, dependency, no story decomposition | Cycle+1 |
| **Later** | Outcomes only: title + one-sentence goal | Beyond cycle+1 |

This is the **rolling-wave detail decay**. Resist the temptation to fully spec Later — it locks horizons (anti-pattern #3).

Lane assignment rules:
- Now: top RICE-ranked Musts that fit in capacity. Default capacity for solo: ~1 epic per 2 weeks.
- Next: remaining Musts + top RICE-ranked Shoulds.
- Later: everything else (Shoulds + Coulds).
- Won't: not on the roadmap; only in Phase 1's Won't list.

### 4. Decompose Now-lane epics into stories

Each Now-lane epic gets stories. Rules:

- **Each story ≤ 3 days.** Bigger → apply SPIDR (see [`frameworks.md`](frameworks.md)).
- **Each story has Given/When/Then acceptance criteria** (Dan North 2006). The validator's `check_s004_story_acceptance` reads the `lanes` section body; if you skip this marker the Now-lane stories silently never get validated and the materializer produces ZERO issue drafts.
- **Each story has a `<slug>-eN-sM` id.** Sub-story letters (`s1a`, `s1b`) when a story is split.
- **Each story names exactly 1 specialist hint** (from Phase 2's epic-level list).

Story format:
```
**`<slug>-eN-sM` — {short imperative}** (XS/S/M)

Given {precondition}
When {action}
Then {observable outcome}

Specialist: {one hint}
```

XS/S/M sizing:
- **XS** ≤ 0.5 days
- **S** ≤ 1 day
- **M** ≤ 3 days
- **L** stories don't exist — re-slice via SPIDR.

### 5. Spike lane

Every `[MUST]` assumption from Phase 1 that is NOT already validated by existing code/docs needs a **spike**:

- ≤3 days
- Time-boxed (the time box is the deliverable; if the spike runs over, the assumption is harder than thought — escalate, don't extend)
- Output: a written finding (typically `plans/<slug>-spike-<topic>.md`) that either validates or invalidates the assumption
- Spike output dictates whether the dependent epic stays in Now/Next or gets re-tiered

A roadmap with `[MUST]` assumptions and no spike lane is a roadmap betting blind. Push back.

### 6. Sanity checks before Phase 4

- [ ] Must cap holds (≤60%)
- [ ] Now lane has stories with G/W/T for every epic
- [ ] Every Now story is ≤3 days (XS/S/M only)
- [ ] Every `[MUST]` assumption from Phase 1 has a spike OR is validated by cited evidence
- [ ] Dependency graph respected: no Now epic depends on a Next/Later epic

## Output template (Edit into the three sequence-related blocks)

```markdown
<!-- ROADMAP:section:sequence -->
## 7. Prioritization

### 7.1 MoSCoW

| Epic | Tag | Rationale (one line) |
|---|---|---|
| `<slug>-e1` | Must | {why} |
| ... | ... | ... |

**Must cap:** {N}/{total} = {%} (cap: 60%) — *script-validated*

### 7.2 RICE rank (Musts only)

| Rank | Epic | R | I | C | E | RICE |
|---|---|---|---|---|---|---|
| 1 | `<slug>-eN` | ... | ... | ... | ... | ... |
| ... | ... | ... | ... | ... | ... | ... |

*Confidence defaults to 50% where no evidence exists. Defaults: {list eN with C=50%}.*

<!-- ROADMAP:section:lanes -->
## 8. Now / Next / Later

### Now (fully spec'd)

#### `<slug>-e1` — {title}

**Stories:**

**`<slug>-e1-s1` — {short imperative}** (S)

Given {precondition}
When {action}
Then {observable outcome}

Specialist: {one hint}

**`<slug>-e1-s2` — ...** (M)
...

### Next (shaped)

#### `<slug>-e2` — {title}
{epic body from Phase 2; no story decomposition}

### Later (outcomes only)

- `<slug>-e3` — {one-sentence goal}
- `<slug>-e4` — {one-sentence goal}

<!-- ROADMAP:section:spikes -->
## 9. Spike lane

- **Spike: {topic}** (≤3 days) — validates `[MUST]` from §4: "{assumption text}". Blocks: `<slug>-eN`.
- ...
```

## Auto-advance vs gate (decision table)

| Condition | Action |
|---|---|
| Must cap holds, Now-lane fully story-spec'd with G/W/T, every `[MUST]` has spike or evidence, DAG respected | **Auto-advance** to Phase 4 |
| Must/Should cut-line has ≥2 credible interpretations (e.g., shrinking Now below 60% would push out an explicitly-named-critical epic) | **GATE.** Surface both with capacity-cost tradeoffs. Wait for `[a]` or `[b]`. |
| Confidence=50% default applied to >50% of Must epics | **NOT a gate** but **MUST surface** the count to the user before accepting the rank ("3 of 5 Musts have default Confidence=50% — proceed without evidence?"). |
| RICE rank counter to user-stated priority | **GATE.** Show the conflict; the user picks which signal wins. |
| One Now-lane story is XL or has no G/W/T | **NOT a gate** — push the model to re-slice or write the AC. Do not auto-advance with broken stories. |

## Hard rules

- **Must cap is non-negotiable.** Script-enforced. The flag `--allow-must-overflow` exists in `score-moscow.py` for emergencies but every use prints a warning.
- **RICE Confidence default = 50% when no evidence.** Never silently use 80% or 100% without a one-line evidence citation.
- **Now lane stories all have G/W/T.** No exceptions; the milestone-pipeline's critique phase grades against G/W/T.
- **Later lane has no story decomposition.** Story-spec'ing Later locks horizons.
- **Every `[MUST]` either spike or evidence.** Both is fine; neither is malpractice.
