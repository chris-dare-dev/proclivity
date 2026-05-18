# Phase 1 — REFINE

**Goal:** turn a fuzzy brief into a sharp, evidence-backed problem statement that the rest of the pipeline can decompose without guessing.

**Section:** populates the `<!-- ROADMAP:section:refine -->` block in `plans/<slug>-roadmap.md`.

## Step-by-step

### 1. How-Might-We reframe

Take the brief (verbatim user text or 2–4-sentence conversation summary) and restate it as **one** crisp HMW problem statement:

> "How might we **{do something concrete}** so that **{specific user/system/team}** can **{achieve specific outcome}**?"

Rules:
- The middle clause must name a real beneficiary (user persona, agent, downstream system) — not a vague "the user".
- The outcome clause must be observable — something a metric, a test, or a user can confirm.
- If the brief permits two or more credible HMW reframings, **STOP and surface both with one-paragraph tradeoffs.** This is the Phase 1 gate condition.

### 2. Sharpening questions (3–5)

Answer all of these from in-context evidence (the conversation, the codebase, the briefs in `plans/`, the `CLAUDE.md` files). If the in-context answer is "I don't know", flag it as a `[MUST]` assumption to validate (see step 3) — do NOT ask the user yet.

1. **Who is this for, specifically?** A dashboard user, a notification target, a future engineer. Name them.
2. **What does success look like?** The single observable thing that changes when this lands.
3. **What are the real constraints?** MV3 service worker limits, `chrome.storage.local` 10 MB cap, bundle size (~200 kB newtab chunk), no server-side components. Cite specific lines from CLAUDE.md when relevant.
4. **What's been tried before?** Grep `plans/` for prior roadmaps or milestones at the same shape of problem. List them.
5. **Why now?** What changed that makes this the right moment? (dependency unblocking, prior milestone unlocking, user friction threshold reached.)

### 3. Assumption tiering

Every claim about the world that is not yet evidence-backed gets one of three tags:

| Tag | Meaning | Action |
|---|---|---|
| `[MUST]` | Validating-this-is-wrong invalidates the whole roadmap. | Spike in Phase 3 BEFORE any value epic depends on it. ≤3-day spike. |
| `[SHOULD]` | Validating-this-is-wrong forces a redesign of one epic but not the whole. | Design a fallback at decomposition time. Don't spike unless cheap. |
| `[MIGHT]` | Validating-this-is-wrong is a minor tweak. | Defer. Note in the "open questions" section. |

Tag every assumption explicitly. An untagged assumption is the same as a `[MUST]` you forgot to validate — i.e. the most dangerous kind.

### 4. Objective + Key Results + Won't list

**Objective** (one sentence, outcome-shaped, single-engineer-appropriate):
> "By {date}, {observable outcome that didn't exist before}."

Skip OKR ritual scoring (Wodtke/Reforge consensus: anti-pattern below ~5 people). The objective is *one quarterly outcome statement* per Larson 2021.

**Key Results** (2–4, leading-indicator shaped):
- Each one is a metric, a test outcome, or a user-observable change.
- No KR is "ship X" — that's an output, not a result.
- If you can't write a KR without phrasing it as "ship feature Y", the outcome isn't real yet — go back to step 1.

**Won't list** (≥3 items, explicit non-goals):
- The 3 most tempting things this roadmap is NOT doing, named verbatim.
- This is the load-bearing scope-discipline artifact. Empty Won't list = scope creep waiting to happen.
- Must exclude: Chrome Web Store publishing, server-side components, cross-device sync.

## Output template (Edit into `<!-- ROADMAP:section:refine -->` block)

```markdown
<!-- ROADMAP:section:refine -->
## 1. Brief

{verbatim brief or 2–4-sentence conversation summary}

## 2. How-Might-We

How might we **{action}** so that **{beneficiary}** can **{observable outcome}**?

## 3. Sharpening answers

- **Who:** {persona / agent / integration}
- **Success looks like:** {single observable change}
- **Constraints:** {bulleted list with CLAUDE.md citations where relevant}
- **Prior art:** {bulleted list with file:line citations to plans/ or prior milestones}
- **Why now:** {triggering change}

## 4. Assumptions

- `[MUST]` {assumption} — *spike in Phase 3*
- `[SHOULD]` {assumption} — *fallback: {brief description}*
- `[MIGHT]` {assumption} — *defer*
- ...

## 5. Objective and Key Results

**Objective:** By {date}, {outcome}.

**Key Results:**
1. {leading-indicator metric or test outcome}
2. {leading-indicator metric or test outcome}
3. {leading-indicator metric or test outcome}

**Won't:**
- {explicit non-goal #1}
- {explicit non-goal #2}
- {explicit non-goal #3}
```

## Auto-advance vs gate (decision table)

| Condition | Action |
|---|---|
| One credible HMW + every sharpening Q has evidence + every assumption is tier-tagged + Won't list ≥3 | **Auto-advance** to Phase 2 |
| ≥2 credible HMW reframings — different beneficiaries OR different outcomes | **GATE.** Surface both with tradeoffs. Wait for `[a]` or `[b]`. |
| Sharpening Q has no in-context answer AND impacts decomposition | **GATE.** Ask the user the single most-load-bearing question. |
| Won't list <3 items | **NOT a gate** — push the model to add more. Empty Won't = lazy scoping. |

## Hard rules

- **No code in Phase 1.** Output is a problem statement, not a design. Code-shaped answers in this phase pre-commit decomposition before Phase 2 has run.
- **No paraphrasing of the user's brief.** Quote it verbatim in section 1 — paraphrasing biases every downstream decision.
- **Every constraint citation has a file path.** "chrome.storage.local cap" alone is hand-wavy. "chrome.storage.local cap ~10 MB (CLAUDE.md §Stack reminder)" is auditable.
- **Every prior-art citation has a file path.** Grep first, ask never.
- **Tagged assumptions only.** Untagged assumption = forgotten `[MUST]`.
- **Proclivity-specific constraints always surface.** If the brief implies a Chrome Web Store publish, server endpoint, or cross-device sync, put it in the Won't list and explain why.
