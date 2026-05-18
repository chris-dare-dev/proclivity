# Phase 3 — CHALLENGE (sub-agent)

**Purpose:** dispatch a single sub-agent (the Challenger) to argue AGAINST each candidate in the synthesis catalog so Phase 4 prioritization receives honest feasibility signal.  This is the analog of the milestone-pipeline's Phase 3 adversary critique — except it critiques PROPOSED capabilities, not shipped code.

## Inputs

- `.claude/notes/capability-scouts/{ID}/artifacts/synthesis.md`
- (Optional) the 5 survey briefs for ground-checking — challenger reads these when it suspects a synthesis claim drifted from its source.

## Output

`.claude/notes/capability-scouts/{ID}/artifacts/challenge.md`

## Dispatch

Single `Agent` call with `subagent_type: general-purpose`, `model: sonnet` (no Opus override — the challenger workload fits comfortably in Sonnet's context).  Use `isolation: worktree` for repo-read isolation.

Use the canonical Challenger prompt from `references/agent-prompts.md` verbatim.  Substitute:
- `{ID}` → scout id
- `{SYNTHESIS_PATH}` → `.claude/notes/capability-scouts/{ID}/artifacts/synthesis.md`
- `{CHALLENGE_PATH}` → `.claude/notes/capability-scouts/{ID}/artifacts/challenge.md`

## Severity rubric (Challenger-specific)

The challenger uses a 4-tier rubric distinct from the standard CRITICAL/HIGH/MEDIUM/LOW critique format:

| Challenger tier | Maps to standard critique severity | Meaning |
|---|---|---|
| **BLOCKER** | CRITICAL | Candidate must be dropped or fundamentally redesigned (violates local-only constraint, requires hosted endpoint / cross-device sync / telemetry, license-incompatible OSS, blows the 200 KB initial-chunk budget without a credible lazy-load story).  Rare — calibrate carefully. |
| **MAJOR** | HIGH | Candidate is shippable but with a significant cost the synthesis didn't surface (TypeScript strict-mode regression, chrome.storage.local cap risk, MV3 service-worker eviction risk, effort under-estimated by ≥2x). |
| **MINOR** | MEDIUM | Candidate is shippable with light scope adjustment (a11y gap, missing reduced-motion fallback on a new animation, edge-case in recurrence logic). |
| **NONE** | n/a | Candidate survives the gauntlet cleanly. |

The orchestrator maps these to the standard format when populating `state.challenge_finding_counts` for the final report.

## The 10-axis CHALLENGER checklist

Every candidate gets evaluated against:

1. **Local-only respect** — does it require a hosted endpoint, cross-device sync, telemetry, or Chrome Web Store mutation?  Per `CLAUDE.md` these are categorical non-starters.
2. **TypeScript strict-mode compatibility** — does it compile under `strict: true`, `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`?
3. **Bundle-size cost** — does it keep the initial newtab chunk ≤200 KB?  Heavy features must lazy-import via `React.lazy + Suspense`.
4. **chrome.storage.local cap** — does it inflate the persisted shape toward the 10 MB hard cap?  Does it need a migration?
5. **MV3 service-worker lifecycle** — does it require the worker to stay alive across the 30-second idle eviction?  Does it use `chrome.alarms` correctly?
6. **Schema evolution / migration** — does it change the persisted schema?  Does the change have a forward-migration path?
7. **Build gate compatibility** — does `npm run build` (`tsc -b && vite build`) still pass cleanly?
8. **Effort honesty** — is the candidate's effort estimate plausible?  Compare to Proclivity's historical milestone sizes (typical: ≤300 LOC, ≤5 files per milestone).
9. **Value density** — does the candidate's value justify its scope?  A 6-week candidate with marginal value is a worse use of capacity than a 3-day candidate with comparable value.
10. **Sequencing dependencies** — does this candidate depend on another candidate?  Should the catalog flag the DAG?

## After receiving the challenge

Parse the challenge to populate:

```bash
.claude/scripts/capability-scout/checkpoint.py <ID> --set challenge_path='".claude/notes/capability-scouts/<ID>/artifacts/challenge.md"'
.claude/scripts/capability-scout/checkpoint.py <ID> --set challenge_finding_counts='{"critical": N_BLOCKER, "high": N_MAJOR, "medium": N_MINOR, "low": N_CLEAN}'
.claude/scripts/capability-scout/checkpoint.py <ID> challenge-complete
```

## Anti-patterns

| Tempting belief | Reality |
|---|---|
| ">50% of candidates have MAJOR or BLOCKER objections — the synthesis was bad." | Possible.  Usually means the challenger prompt is too aggressive OR the synthesis under-considered the local-only / bundle-size / strict-mode axes.  Re-read the challenge with that lens before re-running. |
| "Every candidate gets at least a MINOR objection — that's calibration." | No.  Padding objections is noise.  A clean candidate gets NONE.  If the challenger emits 0 NONEs the calibration is broken. |
| "BLOCKER findings should kill candidates outright." | Not always.  A BLOCKER + a credible redesign sketch leaves Phase 4 deciding whether the redesigned candidate is worth pursuing. |
| "The challenger should propose its own candidates." | No.  Phase 1's job.  The challenger evaluates the synthesis; it does not extend it. |
