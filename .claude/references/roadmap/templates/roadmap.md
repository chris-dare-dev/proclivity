# {{TITLE}} — Roadmap

> **Slug:** `{{SLUG}}` · **Created:** {{DATE}} · **Status:** scaffold (Phase 0)

<!-- ROADMAP:section:meta -->
## 0. Meta

- **Author:** {{AUTHOR}}
- **Brief source:** {{BRIEF_SOURCE}}  *(one of: `--brief` arg | conversation summary | unspecified)*
- **Execution skill:** `/milestone-pipeline`
- **Issue tracker:** GitHub Issues — `chris-dare-dev/proclivity` *(populated only if `--gh-issues` was passed)*

<!-- ROADMAP:section:refine -->
## 1. Brief

{{BRIEF}}

## 2. How-Might-We

How might we **{{HMW_ACTION}}** so that **{{HMW_BENEFICIARY}}** can **{{HMW_OUTCOME}}**?

## 3. Sharpening answers

- **Who:** {{WHO}}
- **Success looks like:** {{SUCCESS_OBSERVABLE}}
- **Constraints:** {{CONSTRAINTS}}
- **Prior art:** {{PRIOR_ART}}
- **Why now:** {{WHY_NOW}}

## 4. Assumptions

- `[MUST]` {{MUST_ASSUMPTION_EXAMPLE}} — *spike in Phase 3*
- `[SHOULD]` {{SHOULD_ASSUMPTION_EXAMPLE}} — *fallback: …*
- `[MIGHT]` {{MIGHT_ASSUMPTION_EXAMPLE}} — *defer*

## 5. Objective and Key Results

**Objective:** {{OBJECTIVE}}

**Key Results:**
1. {{KR1}}
2. {{KR2}}
3. {{KR3}}

**Won't:**
- {{WONT1}}
- {{WONT2}}
- {{WONT3}}

<!-- ROADMAP:section:decompose -->
## 6. Epics

### 6.1 Decomposition technique

{{DECOMP_TECHNIQUE}}  *(default: vertical slicing + enabler stories)*

### 6.2 Dependency graph

| Epic | Depends on |
|---|---|
| `{{SLUG}}-e1` | — |
| `{{SLUG}}-e2` | e1 |

### 6.3 Epics

#### `{{SLUG}}-e1` — {{EPIC1_TITLE}} `[VALUE]`

**Goal:** {{EPIC1_GOAL}}

**Slice:** {{EPIC1_SLICE}}

**INVEST:** {{EPIC1_INVEST}}

**Specialist hints:**
- {{EPIC1_HINT1}}
- {{EPIC1_HINT2}}

**T-shirt:** {{EPIC1_TSHIRT}}

**Predecessors:** —

**Acceptance signals:**
- {{EPIC1_ACCEPT1}}
- {{EPIC1_ACCEPT2}}

#### `{{SLUG}}-e2` — {{EPIC2_TITLE}} `[VALUE]`

**Goal:** {{EPIC2_GOAL}}

**Slice:** {{EPIC2_SLICE}}

**INVEST:** {{EPIC2_INVEST}}

**Specialist hints:**
- {{EPIC2_HINT1}}

**T-shirt:** {{EPIC2_TSHIRT}}

**Predecessors:** {{SLUG}}-e1

**Acceptance signals:**
- {{EPIC2_ACCEPT1}}

<!-- ROADMAP:section:sequence -->
## 7. Prioritization

### 7.1 MoSCoW

| Epic | Tag | Rationale |
|---|---|---|
| `{{SLUG}}-e1` | Must | {{E1_MOSCOW_REASON}} |
| `{{SLUG}}-e2` | Should | {{E2_MOSCOW_REASON}} |

**Must cap:** {{MUST_COUNT}}/{{TOTAL_COUNT}} = {{MUST_PCT}}% (cap: 60%) — *script-validated*

### 7.2 RICE rank (Musts only)

| Rank | Epic | R | I | C | E | RICE |
|---|---|---|---|---|---|---|
| 1 | `{{SLUG}}-e1` | {{R1}} | {{I1}} | {{C1}} | {{E1}} | {{RICE1}} |

*Confidence defaults to 50% where no evidence exists. Defaults: {{C50_LIST}}.*

<!-- ROADMAP:section:lanes -->
## 8. Now / Next / Later

### Now (fully spec'd)

#### `{{SLUG}}-e1` — {{EPIC1_TITLE}}

**Stories:**

**`{{SLUG}}-e1-s1` — {{S1_TITLE}}** ({{S1_SIZE}})

Given {{S1_GIVEN}}
When {{S1_WHEN}}
Then {{S1_THEN}}

Specialist: {{S1_SPECIALIST}}

**`{{SLUG}}-e1-s2` — {{S2_TITLE}}** ({{S2_SIZE}})

Given {{S2_GIVEN}}
When {{S2_WHEN}}
Then {{S2_THEN}}

Specialist: {{S2_SPECIALIST}}

### Next (shaped)

#### `{{SLUG}}-e2` — {{EPIC2_TITLE}}

{{EPIC2_BODY_REPEAT}}

### Later (outcomes only)

- `{{SLUG}}-e3` — {{EPIC3_GOAL}}
- `{{SLUG}}-e4` — {{EPIC4_GOAL}}

<!-- ROADMAP:section:spikes -->
## 9. Spike lane

- **Spike: {{SPIKE1_TOPIC}}** (≤3 days) — validates `[MUST]` from §4: "{{SPIKE1_ASSUMPTION}}". Blocks: `{{SLUG}}-eN`.

<!-- ROADMAP:section:tracking -->
## 10. Tracking

*Populated by `--gh-issues` flag in Phase 4.*

| Epic / Story | GH Issue | Status |
|---|---|---|

<!-- ROADMAP:section:handoff -->
## 11. Execution handoff

First Now-lane milestone: `{{FIRST_MILESTONE}}`.

Invoke: `/milestone-pipeline {{FIRST_MILESTONE}}`

The milestone-pipeline reads:
- The epic body in §8 (Now lane)
- The story list with Given/When/Then AC
- The specialist hints
- Any spike findings under §9

It writes to `.claude/notes/milestones/{{FIRST_MILESTONE}}/state.json` and produces:
- `.claude/notes/milestones/{{FIRST_MILESTONE}}/research/` (research briefs)
- Implementation commits on main
- `.claude/notes/milestones/{{FIRST_MILESTONE}}/critique/adversary.md`
- `.claude/notes/milestones/{{FIRST_MILESTONE}}/rectify/summary.md`

---

*This roadmap was produced by `/roadmap`. Update directly with edits; for major restructures, re-invoke `/roadmap {{SLUG}}` and the orchestrator will resume at the first unpopulated section.*
