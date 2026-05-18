# Phase 2 — DECOMPOSE

**Goal:** turn the refined Objective into 2–6 vertically-sliced epics that each ship a user-observable change in ≤6 weeks.

**Section:** populates the `<!-- ROADMAP:section:decompose -->` block in `plans/<slug>-roadmap.md`.

## Step-by-step

### 1. Pick the technique

Default is **vertical slicing + enabler stories** (Holub; Patton). Use the long-tail techniques in [`frameworks.md`](frameworks.md) only when the problem shape demands it:

| Problem shape | Technique | Reason |
|---|---|---|
| User-journey-shaped (multi-step user-visible flow) | **User Story Mapping** (Patton 2014) | Preserves end-to-end coherence |
| Bounded-context unclear (where does X end and Y begin?) | **Event Storming** (Brandolini 2021) | Surfaces domain seams |
| Causal link from output to outcome is fuzzy | **Impact Mapping** (Adzic 2012) | Kills features that "seem useful" |
| Anything else | **Vertical Slicing** | Default; cheapest decomposition habit |

If you reach for anything other than vertical slicing, write one sentence in the Decomposition Notes explaining why.

### 2. Slice vertically

Each epic must:
- Cut through every relevant layer (storage → service worker → UI when applicable).
- Deliver something observable on completion (a working newtab section, a working alarm, a committed storage shape).
- Be sized to **≤6 weeks** at one-engineer pace. Anything bigger gets split.

**Anti-pattern: horizontal slicing.** Storage-first / component-second / integration-last. The milestone-pipeline's Critique phase has nothing to grade until the last layer ships, which destroys the feedback loop.

### 3. Tag enabler-vs-value

Every epic carries one tag:

- **`[VALUE]`** — observable user/system change. Default; every roadmap should be ≥60% value epics.
- **`[ENABLER]`** — pure infrastructure (storage schema, service worker refactor, bundle split) that unblocks downstream value epics. Allowed but limited.

A roadmap with >40% `[ENABLER]` epics has lost the outcome thread — push back and re-slice.

### 4. INVEST check (per epic)

Run every epic through INVEST (Wake 2003). An epic failing two letters needs to be re-cut.

| Letter | Question | Failure signal |
|---|---|---|
| **I**ndependent | Can this epic land without epic N+1, N+2 being half-done? | "Epic 2 needs Epic 1's storage schema to compile" — split or merge. |
| **N**egotiable | Can scope shift mid-flight without breaking the milestone-pipeline state? | If "all-or-nothing", the epic is too big — apply SPIDR. |
| **V**aluable | Does it deliver an observable change? | If only `[ENABLER]` chains downstream, justify the enabler. |
| **E**stimable | Can a senior engineer T-shirt-size it (S/M/L)? | "I have no idea" → spike first (Phase 3 spike lane). |
| **S**mall | ≤6 weeks at one-engineer pace? | XL epic → split via SPIDR or User Story Mapping. |
| **T**estable | Will the milestone-pipeline's critique phase have something to grade? | If the epic produces no diff, it's not an epic. |

### 5. Specialist-area hints

For every epic, name 1–2 specialist areas the milestone-pipeline implementer should consult. **Hint-only — no callable specialist agents exist in this project.**

| Region keywords (epic touches…) | Specialist hint to embed in epic body |
|---|---|
| `src/storage/`, `chrome.storage`, persistence layer | Reference `src/storage/storage.ts` wrapper + `useStore()` hook. Check 10 MB cap. |
| `src/background/service-worker.ts`, `chrome.alarms`, `chrome.notifications` | MV3 SW can be killed at any time. Use `chrome.alarms` + `chrome.storage` for persistence. |
| `src/sections/`, new-tab UI, React components, `*.tsx` | Reference `src/sections/` patterns. Check `motion-safe`, `:focus-visible`, `aria-` a11y. |
| bundle size, lazy imports, `vite.config.ts`, `@crxjs/vite-plugin` | Initial newtab chunk must stay under ~200 kB. Heavy features must be lazy-imported via `React.lazy` + `Suspense`. |
| `@react-three/fiber`, `three.js`, background canvas | Must be lazy-loaded. Reference `src/background/` mesh patterns. |
| `manifest.config.ts`, MV3 permissions, `host_permissions` | MV3 constraint: declare minimum permissions. No broad host_permissions. |

### 6. Dependency graph

Every epic lists its predecessors. The graph must be a DAG (no cycles). If a cycle is forming, two epics are too coupled — merge or split.

## Output template (Edit into `<!-- ROADMAP:section:decompose -->` block)

```markdown
<!-- ROADMAP:section:decompose -->
## 6. Epics

### 6.1 Decomposition technique

{Vertical slicing | User Story Mapping | Event Storming | Impact Mapping}

{One-sentence rationale ONLY if not vertical slicing.}

### 6.2 Dependency graph

| Epic | Depends on |
|---|---|
| `<slug>-e1` | — |
| `<slug>-e2` | e1 |
| ... | ... |

### 6.3 Epics

#### `<slug>-e1` — {Short title} `[VALUE]` (or `[ENABLER]`)

**Goal:** {one sentence — observable change on completion}

**Slice:** {storage layer touched? service worker? UI sections?}

**INVEST:** {6/6, or list any failing letters with one-sentence justification}

**Specialist hints:**
- {hint from the table — e.g., "Check chrome.storage.local 10 MB cap."}
- {hint #2}

**T-shirt:** S (≤1 week) / M (≤3 weeks) / L (≤6 weeks)

**Predecessors:** —  *(or epic ids)*

**Acceptance signals:** {2–3 bullets — what makes this epic done?}

#### `<slug>-e2` — {next epic}
... (repeat for 2–6 epics)
```

## Auto-advance vs gate (decision table)

| Condition | Action |
|---|---|
| Every epic INVEST-clean, dependency graph is DAG, ≥60% `[VALUE]`, all sized ≤L | **Auto-advance** to Phase 3 |
| Cut between epics has ≥2 credible alternatives (e.g., split-by-storage vs split-by-feature; vertical vs hybrid slicing) | **GATE.** Surface both with one-paragraph tradeoffs. Wait for `[a]` or `[b]`. |
| `[ENABLER]` epics > 40% of total | **NOT a gate** — push back; re-slice to expose value sooner. |
| One epic is XL (>6 weeks) | **NOT a gate** — apply SPIDR (in [`frameworks.md`](frameworks.md)) and re-cut. |

## Hard rules

- **No story-level decomposition in Phase 2.** That's Phase 3 (Now lane only). Epics here, stories there.
- **Every epic has a `<slug>-eN` id.** Sub-epic letters (`e2a`, `e2b`) only when an epic is split mid-flight, NOT pre-emptively.
- **No epic has dependencies on its own descendants.** Cycle = merge two epics or split a third.
- **`[ENABLER]` epics need an explicit downstream value epic.** A pure-enabler chain is a reorganization disguised as a roadmap.
- **Specialist hint section is text, not invocation.** No "run `/skill`" in the epic body — that's the milestone-pipeline's job.
- **No epics that propose Chrome Web Store publishing, server endpoints, or cross-device sync** — these violate Proclivity's constitution (`CLAUDE.md § What agents must not do`).
