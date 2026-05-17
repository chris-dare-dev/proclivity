# Adversarial critique — milestone-pipeline skill → slash-command conversion

**Reviewer:** opus-adversary
**Date:** 2026-05-17
**Diff scope:** `.claude/commands/milestone-pipeline.md`, seven `.claude/agents/milestone-*.md`, `.claude/agent-memory/`, Stop hook, deprecated `SKILL.md`, `MIGRATION.md`, `.claude/CLAUDE.md`, and the unchanged `.claude/skills/milestone-pipeline/{references,scripts}/` tree.

## Summary
- CRITICAL count: 2
- HIGH count: 8
- MEDIUM count: 7
- LOW count: 4
- INFO count: 3

## Findings

### C1 — Agents + orchestrator describe a different codebase than proclivity [CRITICAL]
**File:** all 7 `.claude/agents/milestone-*.md`; `references/agent-prompts.md`; `.claude/commands/milestone-pipeline.md`
**Line(s):** adversary all 13 axes (L92-153); web-perf Step 2 (L94-144); infra Step 2 (L107-156); command Phase 2 matrix (L226-241)
**Claim:** Severity-rubric examples, all critic axes, and the Phase 2 check matrix describe `personal-website` (Next.js 15 + velite + Pulumi + bin/site + LFS-tracked media). Proclivity is Vite + React 18 + TS MV3 Chrome extension — no `web/`, `bin/`, `infra/`, `Pulumi.*.yaml`, `docker-compose.yml`, `velite`, `articles.ts`, `@/.velite`, KaTeX, `bun`, `bats`.
**Evidence:** `ls /Users/chris.dare/Personal/SourceCode/proclivity/` → only `src/ test/ public/ scripts/ dist/ plans/ manifest.config.* package.json vite.config.*`. Repo `CLAUDE.md` says "Vite + React 18 + TypeScript. MV3 Chrome extension via `@crxjs/vite-plugin`" and "`npm run build` must pass cleanly. This runs `tsc -b && vite build`". Command L228 says `cd "$REPO_ROOT/web" && bun run build:content && bun test`. `grep -ni "velite|bin/site|pulumi|articles.ts" CLAUDE.md` returns 0. Severity rubrics in 5 critics all cite `<Image priority>` (Next.js), `bin/site app release`, `records:stackOrg`, etc.
**Why it matters:** Phase 3 critique on a real proclivity milestone will anchor 90 % of findings to nonexistent files, triggering >40 % invalidation in re-verify, looping back to Phase 3 indefinitely. Phase 2's matrix runs gates that always fail (no `web/`, no `bun`). The pipeline cannot complete a real milestone in this state.
**Fix:** Rewrite the `<severity-rubric>` block + all axes around proclivity (Chrome MV3 manifest, SW lifecycle, `chrome.storage.local` 10 MB cap, `useStore()` hook invariants, `@react-three/fiber` lazy-load, strict-mode TS flags, ~200 KB initial-chunk budget). Replace command Phase 2 matrix with `npm run build` + clean working tree check. Either delete `milestone-infra-critic.md` and `milestone-lfs-critic.md` (no infra/LFS in proclivity) or refactor them around manifest / SW / Chrome storage.

### C2 — `external_writes_skipped` referenced but never defined, written, or in schema [CRITICAL]
**File:** `.claude/commands/milestone-pipeline.md`; `references/schemas/state.schema.json`; `scripts/init-state.sh`
**Line(s):** command L489; schema L126; init L151
**Claim:** Command tests `external_writes_required ⊆ external_writes_authorized ∪ external_writes_skipped` to gate transition to `complete`. The field is never written by `init-state.sh`, never appended by any orchestrator call, and not in the schema. Schema uses `external_writes_completed`.
**Evidence:** `grep -n external_writes_skipped` returns one hit — only at command L489. init-state.sh L151 initializes `"external_writes_completed": []`. state.schema.json L126 declares `external_writes_completed`.
**Why it matters:** Set test is unsatisfiable when any item is skipped — `external_writes_skipped` is always missing/empty. Pipeline cannot reach `complete` on any milestone where the user replies "skip <item>". phase-rectify.md L109 says "completed (or explicitly skipped)" but no skipped-list mechanism exists.
**Fix:** Rename L489 reference to `external_writes_completed` AND make Phase 4e append to `external_writes_completed` whenever the user replies "skip" or "authorize+done". Update phase-rectify.md L110 to match. Simpler than introducing a separate skipped list.

### H1 — `dedupe-findings.py` does NOT emit "dedup complete:" line orchestrator greps for [HIGH]
**File:** `.claude/commands/milestone-pipeline.md` L329-337; `scripts/dedupe-findings.py` L261
**Claim:** Command re-invokes the script and `grep "dedup complete:"`. Script's only stdout line is `print(json.dumps({"counts": …, "rect_order": …, "path": …}))`. No "dedup complete:" anywhere.
**Evidence:** `grep -n "dedup complete:" scripts/dedupe-findings.py` → 0 hits. dedupe-findings.py L260-261.
**Why it matters:** L329-337 is dead code. The first invocation at L317 already returned the JSON the orchestrator needs. Second invocation wastes I/O, re-writes dedup.md (idempotent but wasteful), and `$DEDUP_SUMMARY` is always empty.
**Fix:** Delete command L329-337. The `DEDUPE_OUT` JSON from L317 supplies counts, rect_order, path. Add comment: "do not re-invoke dedupe-findings.py; counts are in $FINDING_COUNTS".

### H2 — `critique_rect_order` written to state but state schema rejects unknown properties [HIGH]
**File:** `.claude/commands/milestone-pipeline.md` L323, L425; `state.schema.json` L7
**Claim:** Orchestrator does `--set "critique_rect_order=$RECT_ORDER"` and later `--get critique_rect_order`. Schema declares `"additionalProperties": false`. `critique_rect_order` not in `properties`.
**Evidence:** state.schema.json:7 `"additionalProperties": false`. `grep -n rect_order state.schema.json` → 0 hits. command L323.
**Why it matters:** `checkpoint.py --set` writes without validation. Next `validate-artifact.py state` will fail with "Additional properties not allowed ('critique_rect_order')". `state-schema.md` top-level fields table also missing.
**Fix:** Add `"critique_rect_order": {"type": ["array","null"], "items": {"type": "string", "pattern": "^[CHML][0-9]+$"}}` to schema. Update `state-schema.md` L29-56 table.

### H3 — Dual skill-catalog registration: `SKILL.md` and slash command both declare `name: milestone-pipeline` [HIGH]
**File:** `.claude/skills/milestone-pipeline/SKILL.md` L2; `.claude/commands/milestone-pipeline.md` L2
**Claim:** Both files declare `name: milestone-pipeline` in frontmatter. Skill catalog and slash-command namespaces both register the same name. Deprecation banner is in body content, not frontmatter — the catalog loader keys on frontmatter `name`.
**Evidence:** `grep -rn "name: milestone-pipeline" .claude/` returns 2 hits (plus 1 in a stale worktree). System-reminder catalog at session start lists `milestone-pipeline` twice (DEPRECATED variant + active slash command).
**Why it matters:** Skills and slash commands are different namespaces, so `/milestone-pipeline` correctly resolves to the command. But auto-trigger / `Skill(skill="milestone-pipeline")` calls may resolve to the deprecated SKILL.md, returning the OLD (broken) orchestrator body. Future-debugging trap.
**Fix:** Either remove the `name:` field from SKILL.md frontmatter entirely (file stays discoverable by path), or rename to `name: milestone-pipeline-deprecated`. Verify with `grep -rn "name: milestone-pipeline" .claude/` → exactly one match.

### H4 — `.claude/CLAUDE.md` claims `memory: project` frontmatter is present; on disk it is not [HIGH]
**File:** `.claude/CLAUDE.md` L99-103; all 7 agents
**Claim:** `.claude/CLAUDE.md` says "Each agent with `memory: project` in its frontmatter reads its own memory file at startup". `grep -n "memory:" .claude/agents/milestone-*.md` → 0 hits. MIGRATION.md L207-210 explains the field was removed post-Agent-A as a deliberate correction.
**Evidence:** No agent frontmatter contains `memory:`. agents/README.md L74 explicitly says "these agents do NOT use a `memory: project` frontmatter field." `.claude/CLAUDE.md` L99 still references it as if present.
**Why it matters:** `.claude/CLAUDE.md` loads every session; phantom-contract claim. A future maintainer relying on harness auto-injection of memory (the documented purpose of `memory:`) finds nothing happens — body must Read manually.
**Fix:** Rewrite `.claude/CLAUDE.md` L97-104 to: "Each `milestone-*` sub-agent has a `## Memory protocol` section in its **body** that instructs it to Read `.claude/agent-memory/<agent>/lessons.md` at startup and append one entry on completion. The `memory: project` frontmatter field is NOT used (it is not a documented Claude Code feature)." Align with command L63-89.

### H5 — `phase-rectify.md` documents the broken in-place trailer-amend pattern the command correctly rejects [HIGH]
**File:** `.claude/skills/milestone-pipeline/references/phase-rectify.md` L83
**Claim:** Reference says "Use `git interpret-trailers --in-place --trailer "Reviewed-by: …"` for each critic that ran." Command L416-421 explicitly warns: "the earlier approach of committing first and then mutating `.git/COMMIT_EDITMSG` via `git interpret-trailers --in-place` is broken — `COMMIT_EDITMSG` is a stale file post-commit, so the trailers never reach the actual commit object."
**Evidence:** phase-rectify.md L83 vs command L416-421.
**Why it matters:** Phase 4 says to read phase-rectify.md fully. A future maintainer fixing the command body to "match the reference" would reintroduce the broken pattern.
**Fix:** Rewrite phase-rectify.md L72-86 to match command's compose-before-commit pattern: build `$MSG` via `git interpret-trailers --trailer ...` (no `--in-place`), then `git commit -S -m "$MSG"`. Add explicit "Never use `--in-place .git/COMMIT_EDITMSG` after a commit."

### H6 — `agent-prompts.md` Phase 1 Explore prompt tells researchers to consult "any relevant SKILL.md files" [HIGH]
**File:** `references/agent-prompts.md` L65
**Claim:** Explore researcher prompt: "Read existing code, prior decision docs (.claude/references/*.md), CLAUDE.md, AGENTS.md, **and any relevant SKILL.md files**." With milestone-pipeline SKILL.md deprecated (and others migrating), researchers may cite the deprecated body as canonical.
**Evidence:** agent-prompts.md L65. The prompt is consumed by `milestone-researcher` per command L137-153.
**Why it matters:** Researchers cite stale skill bodies as authoritative; compounds H3.
**Fix:** Edit L65: "…CLAUDE.md, AGENTS.md, slash command bodies under `.claude/commands/*.md`, and any non-deprecated skill bodies. Skip SKILL.md files marked DEPRECATED."

### H7 — `AGENTS.md` referenced as canonical 8+ times but the file does not exist in proclivity [HIGH]
**File:** all 7 agents, command, `.claude/CLAUDE.md`
**Line(s):** researcher L52, implementer L59, command L482, etc.
**Claim:** Researcher: "Read `{REPO_ROOT}/CLAUDE.md` and `{REPO_ROOT}/AGENTS.md` before fetching anything external. These are the canonical sources for what external writes exist". `ls /Users/chris.dare/Personal/SourceCode/proclivity/AGENTS.md` → no such file.
**Evidence:** `ls AGENTS.md` from repo root → missing. `grep -ni "AGENTS.md" .claude/agents/*.md .claude/commands/*.md` → matches in every milestone agent + command body + `.claude/CLAUDE.md`.
**Why it matters:** Researchers will `Read AGENTS.md`, fail, and either error or hallucinate content. Repo `CLAUDE.md` IS canonical here. Pipeline inherited from a project that had AGENTS.md.
**Fix:** Either (a) create a minimal `AGENTS.md` at repo root pointing to `CLAUDE.md`, or (b) globally replace AGENTS.md → CLAUDE.md across 8+ files. (a) is the 10-line option.

### H8 — Critique schema enum lists legacy critic names but agents emit canonical names [HIGH]
**File:** `references/schemas/critique.schema.json` L11; all 5 critic agents
**Claim:** Schema: `"critic": {... "enum": ["adversary", "web-perf-reviewer", "infra-auditor", "lfs", "oss-scout"]}`. Agents tell critics to write `Source critic: milestone-adversary`/`milestone-web-perf-critic`/etc.
**Evidence:** schema L11 vs adversary L185, web-perf L173, infra L186, lfs L187, oss-scout L189.
**Why it matters:** `validate-artifact.py` currently does NOT apply the critique schema (only checks sections), so dormant. But schema is canonical — any future jsonschema call fails. dedupe-findings.py also writes canonical names into `dedup.md`.
**Fix:** Standardize on canonical names everywhere. Update schema enum to canonical names. Update `dispatch-critics.sh` to emit canonical names so the orchestrator drops the legacy→canonical mapping at command L267-273 and L431-441.

### M1 — `--deep` agent assignment inconsistent between command and `phase-research.md` [MEDIUM]
**File:** command L150-153; `phase-research.md` L20
**Claim:** Command: `--deep` = explore haiku + general sonnet + adversarial opus, all dispatched as `milestone-researcher`. Reference table: "1× Explore + 2× general-purpose (one Sonnet adversarial, one Opus)" — different role/model assignment.
**Evidence:** command L150-153; phase-research.md L20.
**Why it matters:** Future maintainer reading reference doc may introduce a separate `milestone-adversarial-researcher` agent or change role labels.
**Fix:** Update phase-research.md L20: "1× Explore haiku + 1× general sonnet + 1× adversarial opus (all three dispatched as `milestone-researcher` with `role` substituted into prompt)."

### M2 — Agent B's "dispatch-critics.sh missing .github/workflows/" flag is wrong [MEDIUM]
**File:** `scripts/dispatch-critics.sh` L47
**Claim:** Agent B's deliverable lists "`dispatch-critics.sh` does not gate on `.github/workflows/**`" as unresolved. Script L47 already includes `\.github/workflows/` in the infra regex.
**Evidence:** dispatch-critics.sh L47 — `grep -qE '^(infra/|bin/site$|docker-compose\.yml$|.*Pulumi\..*\.yaml$|web/Dockerfile$|\.github/workflows/|\.claude/scripts/(release-preflight|stack-outputs)\.sh$)'`.
**Why it matters:** False-positive flag in Agent B's TODO. Don't waste fix-effort.
**Fix:** Strike from Agent B's deliverable. No code change.

### M3 — `milestone-pipeline-stop.sh` uses `set -uo pipefail` (no `-e`) [MEDIUM]
**File:** `.claude/hooks/milestone-pipeline-stop.sh` L25
**Claim:** Hook is defensive; lack of `-e` is arguably correct (must not block session exit). But undocumented.
**Evidence:** L25 — `set -uo pipefail`. L27 fallback for `REPO_ROOT`.
**Why it matters:** Future maintainer adding side-effecting calls may expect `-e` halt.
**Fix:** Add comment above L25: "Intentional: no -e. Hook must not block session exit on non-critical errors."

### M4 — Command body Phase 2 check matrix gates files/tools that don't exist in proclivity [MEDIUM]
**File:** command L226-241
**Claim:** Matrix: `cd $REPO_ROOT/web && bun run build:content && bun test`; `cd $REPO_ROOT/bin/tests && bats site.bats`; `$REPO_ROOT/bin/site status`; `.claude/scripts/lfs-doctor.sh`. None of `web/`, `bin/`, `.claude/scripts/lfs-doctor.sh` exists. Canonical proclivity build is `npm run build`.
**Evidence:** `ls $REPO_ROOT/web $REPO_ROOT/bin .claude/scripts/lfs-doctor.sh 2>/dev/null` → all missing. Repo CLAUDE.md Build section uses `npm run build`.
**Why it matters:** Same root cause as C1. Implementer's contract on what to verify; gates always fail or are skipped silently.
**Fix:** Replace L226-241 with: `npm run build` (always); optionally `npm run typecheck`; `git status --porcelain` clean post-commit. Delete bun/bats/bin-site/lfs-doctor branches.

### M5 — `milestone-adversary` granted WebFetch + WebSearch but body never uses them [MEDIUM]
**File:** `.claude/agents/milestone-adversary.md` L13
**Claim:** Frontmatter: `tools: Read, Grep, Glob, Bash, Write, WebFetch, WebSearch`. The 13 axes are local-diff checks; no WebFetch/WebSearch call appears in the body.
**Evidence:** adversary L13.
**Why it matters:** Principle of least authority. Unnecessary tools widen prompt-injection surface and add cost.
**Fix:** Remove `WebFetch, WebSearch` from milestone-adversary frontmatter.

### M6 — Command unconditionally invokes nonexistent `lfs-doctor.sh`; lfs-critic agent handles its absence gracefully [MEDIUM]
**File:** command L237; `.claude/agents/milestone-lfs-critic.md` L68-93
**Claim:** Command: `$REPO_ROOT/.claude/scripts/lfs-doctor.sh` as a `.gitattributes` gate. Agent body L68: "Status as of 2026-05-17: `lfs-doctor.sh` does NOT currently exist anywhere in the repo." Asymmetric handling.
**Evidence:** `ls .claude/scripts/lfs-doctor.sh .claude/skills/milestone-pipeline/scripts/lfs-doctor.sh` → both missing.
**Why it matters:** Phase 2 fails if `.gitattributes` is touched. (Rare in proclivity but possible.)
**Fix:** Update command L237: `[ -x "$REPO_ROOT/.claude/scripts/lfs-doctor.sh" ] && "$REPO_ROOT/.claude/scripts/lfs-doctor.sh" || echo "lfs-doctor.sh not found — skip"`. Or remove the gate.

### M7 — `IS_RESUME` variable declared but never read [MEDIUM]
**File:** command L60
**Claim:** Arg parser sets `IS_RESUME` (0/1). `grep -n IS_RESUME .claude/commands/milestone-pipeline.md` → 1 hit (L60), zero uses.
**Evidence:** command L60.
**Why it matters:** Dead text in body that loads every invocation. `init-state.sh` handles resume detection itself.
**Fix:** Delete the `IS_RESUME` bullet from L60.

### L1 — `--deep` / `--single` mutex only signaled by pipe in argument-hint [LOW]
**File:** command L4, L36-37, L52
**Claim:** Argument-hint pipe `[--deep | --single]` is the only mutex indicator; body L36-37 lists them separately without explicit mutex wording.
**Why it matters:** Trivial doc clarity.
**Fix:** Add one-line "mutually exclusive" note near L36-37.

### L2 — `agents/README.md` "Inconsistency notes" section is stale [LOW]
**File:** `.claude/agents/README.md` L92-115
**Claim:** Three notes that are now resolved (LFS is sub-agent; adversary is Opus; `.github/workflows/` already in dispatch-critics.sh). Note 3 contradicts M2.
**Fix:** Delete or convert to "Resolved (kept for history)" with each note marked RESOLVED.

### L3 — `agent-prompts.md` Phase 3 LFS section still says "Not a sub-agent — invoked as a Bash call" [LOW]
**File:** `references/agent-prompts.md` L336
**Claim:** Contradicts current orchestrator (dispatches `milestone-lfs-critic` as sub-agent per command L294, L272).
**Fix:** Rewrite L334-342 to point at `milestone-lfs-critic` sub-agent.

### L4 — `agent-prompts.md` Phase 3 web/infra section headings still use legacy names [LOW]
**File:** `references/agent-prompts.md` L295, L313
**Claim:** Headings `web-perf-reviewer` (L295) and `infra-auditor` (L313). Web section L297 has a clarifying "dispatches this as `subagent_type='milestone-web-perf-critic'`" line; infra section has no such line.
**Fix:** Rename headings to canonical; add the same clarifying line to the infra section.

### I1 — `.claude/agent-memory/README.md` claims compute-metrics.py reads memory; it does not [INFO]
**File:** `.claude/agent-memory/README.md` L44
**Claim:** README L44: "`compute-metrics.py` reads these files when computing per-agent learning metrics." compute-metrics.py reads `state.json` + `audit.jsonl` only.
**Fix:** Align with `.claude/CLAUDE.md` correction: "These files MAY be consumed by future tooling; no current consumer reads them automatically."

### I2 — Severity rubric duplicated across 5 critic agents (~30 lines × 5) [INFO]
**File:** all 5 critic agents (~L58-87 in each)
**Claim:** Identical `<severity-rubric>` block in 5 files. agent-prompts.md L5 originally planned `{SEVERITY-RUBRIC}` substitution; orchestrator does not pass it — each agent inlines.
**Why it matters:** A rubric change requires 5 edits. Coupled with C1 (which rewrites all examples), this multiplies the touch count.
**Fix:** Single source in `references/severity-rubric.md`. Either centralize via dispatch-time substitution or accept duplication with a regression-test to catch drift.

### I3 — `init-state.sh` lock-take is non-atomic (TOCTOU between check and write) [INFO]
**File:** `scripts/init-state.sh` L81-95
**Claim:** Sequential `[[ -f "$LOCK" ]]` test + `echo … > "$LOCK"` write; no `flock`.
**Why it matters:** Theoretical only — proclivity is solo-use and state-schema.md explicitly says "Multi-milestone parallelism is intentionally NOT supported".
**Fix:** Optional `flock` wrap. Not required for current use.

## Cross-axis observations

### Best agentic AI practices
The slash-command + sub-agent + memory pattern is correctly structured: orchestration in `.claude/commands/`, workers in `.claude/agents/`, body-driven memory under `.claude/agent-memory/`. Phase 1 + Phase 3 dispatch are documented as one-message parallel fan-outs (command L137-155, L291-297). Phase 4 correctly refuses sub-agent delegation; implementer-cannot-critique is enforced via separate agent files + model tiers. Anti-pattern guard table at L501-518 is comprehensive. The fundamental flaw is content drift, not structure: agents anchor 90 % of examples to files that don't exist in proclivity (C1).

### Token-usage optimization
Command body is ~25 KB on every invocation; the lazy-load discipline for references is respected (verified). However, each critic agent inlines `<untrusted-content-policy>` + `<severity-rubric>` + `<scope-bounds>` + `<output-contract>` (~30 KB total duplication across 5 critics per Phase 3 dispatch). agent-prompts.md L5 plans substitution; orchestrator never substitutes. `IS_RESUME` (M7) is dead text. `dedupe-findings.py` is invoked twice (H1) — second is dead code.

### Accuracy
Multiple documented behaviors do not match disk state: H1 (grep "dedup complete:" — line absent), H4 (`memory: project` claimed, absent), C2 (`external_writes_skipped` referenced, undefined), H7 (AGENTS.md referenced, missing), M6 (lfs-doctor.sh invoked, absent), M2 (`.github/workflows/` flagged-as-missing, present), C1 (5 critics describe a different codebase).

### Bugs / errors
Critical-rated bugs: cross-codebase content drift (C1) and unresolvable state condition due to undefined `external_writes_skipped` (C2). Both block real-milestone completion. High-rated cluster: schema drift (H2, H8), dead/broken code paths (H1), stale references (H4, H5, H6, H7), namespace collision (H3). settings.json parses; Stop hook wired correctly; protect-ops-files.mjs sound; checkpoint.py state-machine correct; atomic-write idiom correct.

## Things that look correct
- `.claude/settings.json` valid JSON; Stop hook entry parallels PreToolUse block correctly.
- All 7 milestone agents include byte-identical `<untrusted-content-policy>` blocks (verified via shasum: `562193f964…` × 7).
- `checkpoint.py` correctly refuses backward + skipped transitions (L100-108).
- `init-state.sh` idempotent on resume (L98-102 short-circuits before brief-required check at L114).
- `dedupe-findings.py` writes via atomic temp+rename (L256-258).
- `cleanup-aborted-worktrees.sh` correctly saves patches before destroying worktrees (L37-50).
- Command Phase 4d compose-message-before-commit pattern (L416-451) correctly fixes the broken in-place pattern.
- Anti-pattern guard table at command L501-518 comprehensive and matches the orchestration body.
- `milestone-pipeline-stop.sh` lock-PID dead-check (L42) correctly avoids printing when another session still holds the lock.
- `dispatch-critics.sh` includes `.github/workflows/` in infra regex (L47); Agent B's flag was wrong.
- `validate-artifact.py` correctly applies jsonschema to state (L37-49) and structurally validates critique by section checks (L99-119).
- `Co-Authored-By:` trailer composed via `git interpret-trailers` in the same pipe as subject+body (no post-commit `.git/COMMIT_EDITMSG` race).
- Memory protocol per-agent format spec is consistent across all 7 agents (ISO-8601 timestamp + milestone:id + status, four bullet lines, ≤ 8 lines).
- Each Phase 3 critic correctly forbids editing source code (`<scope-bounds>` block).
- Phase 4 external-write boundary is enforced in both the command body (L461-498) and `.claude/CLAUDE.md` (L75-91).
