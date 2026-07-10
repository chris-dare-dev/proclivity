# Phase 3 — CHALLENGE (sub-agent)

**Purpose:** dispatch a single sub-agent (the Challenger) to argue AGAINST each modernization candidate so Phase 4 prioritization receives honest signal about feasibility, accessibility risk, bundle cost, and Proclivity-design-system fit.  Mirrors `/capability-scout` Phase 3 but specialized for frontend concerns.

## Inputs

- `.claude/notes/frontend-uplifts/{ID}/artifacts/synthesis.md`
- (Optional) the 4 discover briefs under `.claude/notes/frontend-uplifts/{ID}/discover/` for ground-checking the synthesis against its sources.

## Output

`.claude/notes/frontend-uplifts/{ID}/artifacts/challenge.md`

## Dispatch

Single `Agent` call with `subagent_type: frontend-uplift-challenger`, `isolation: worktree`.  The agent's `.claude/agents/frontend-uplift-challenger.md` body IS the canonical **11-axis** prompt (the `agent-prompts.md` subdir copy is superseded — do not dispatch from it; fallback is `general-purpose` with the agent body inline).

Substitute:
- `{ID}` → uplift slug
- `{SYNTHESIS_PATH}` → `.claude/notes/frontend-uplifts/{ID}/artifacts/synthesis.md`
- `{CHALLENGE_PATH}` → `.claude/notes/frontend-uplifts/{ID}/artifacts/challenge.md`

The challenger Reads `.claude/references/frontend-design-language.md` (BAN-1..15, §10 rubric, §14 tiers) + the §9 overlay directly for axis 11.

## Severity rubric (Challenger-specific)

The challenger uses the 4-tier rubric mapped to the standard format for state-field consistency:

| Challenger tier | Maps to standard severity | Meaning |
|---|---|---|
| **BLOCKER** | CRITICAL | Must be dropped or fundamentally redesigned.  Examples: flat motion §8 anti-pattern (AP-1/2/3/5 on an S-2 surface — parallax on Today/Sprint/Gantt, magnetic-cursor on operational buttons; or AP-4/6/7 on any surface), React-19-only library on a React 18 stack, license-incompatible OSS, MV3-CSP-incompatible remote-code/inline-script requirement, requires hosted endpoint / cross-device sync (local-only violation), ≥50 KB initial-chunk increment with NO lazy-load story, **axis-11 projected §10 score 6+ or a frameless synthesis (run-level)**. |
| **MAJOR** | HIGH | Shippable but with significant cost the synthesis didn't surface.  Examples: 30–50 KB bundle increment with weak justification; a11y regression with no remediation plan; reduced-motion fallback missing across a key path; chrome.storage.local schema migration without forward-path. |
| **MINOR** | MEDIUM | Light scope adjustment.  Examples: token name drift, missing `aria-hidden` on a decorative icon, reduced-motion fallback missing on a single class. |
| **NONE** | LOW (clean) | Candidate survives.  Aim for 30–60% of candidates rating NONE — that's calibrated. |

## The 11-axis FRONTEND-CHALLENGER checklist

Every candidate gets evaluated against (full axis text lives in the agent body — this is the summary):

1. **Status-token discipline** — `--danger` / `--warn` / `--ok` are reserved for explicit state communication; flag decorative use (BAN-11)
2. **Reduced-motion discipline** — `@media (prefers-reduced-motion: reduce)` baseline in `index.css` must keep suppressing new motion; a missing fallback is flat motion §8 AP-4 (BLOCKER on EVERY surface)
3. **Accessibility regression risk** — WCAG 2.2 AA contrast (BOTH themes), keyboard nav, screen-reader semantics, ARIA roles, the 44 px `--row-height`
4. **Bundle-size cost** — ≤~400 KB initial newtab chunk (500 KB hard) per `CLAUDE.md`; heavy deps must `React.lazy + Suspense`; MV3 CSP forbids CDN/inline-script escapes
5. **React 18 compatibility** — React-19-only features / libraries are out of scope
6. **Strict-TS compatibility** — `strict: true`, `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`
7. **Theming impact** — both themes preserve contrast; the user-overridable `--accent` token must not be hardcoded
8. **Effort honesty** — t-shirt size matches Proclivity historical milestone sizes (typical: ≤300 LOC, ≤5 files per milestone)
9. **Surface-aware motion anti-pattern** — FIRST read the candidate's surface tag (every Proclivity working view is **S-2**; the MeshBackground is a bounded S-1m island — §9 map).  Then: (a) does it NAME its motion job (orientation / causality / feedback / continuity — no job = flag)?  (b) On S-2, is it a flat motion §8 `AP-1/2/3/5` (parallax/scroll-scrub, auto-video, stagger>8, >500ms interaction)?  Those are BLOCKERs on S-2 — e.g. parallax on Today/Sprint/Gantt, magnetic-cursor on Complete/Delete/Snooze, confetti on every todo.  `AP-4/6/7` are BLOCKERs on EVERY surface.
10. **Sequencing dependencies** — DAG between candidates (e.g., stagger-reveal depends on a motion-library adoption)
11. **Distinctiveness / anti-template** — score the candidate's PROJECTED end state against `frontend-design-language.md` §5 BAN-1..15 + the §10 rubric (13 tells) + the §9 house thesis; answer the §11 four questions.  §14 band→outcome: **0–2** → NONE on this axis; **3–5** → MAJOR; **6+** → BLOCKER.  A BAN token introduced/preserved-as-identity without a thesis-argued reason is ≥MAJOR; cloning another surface's/prior-run's shell is BAN-15.  **Run-level:** a frameless synthesis (no adopted frame) is a run-level BLOCKER — polish without direction is what the pipeline exists to prevent.  Carry a §14 evidence tier (`✓ live` / `✓ code` / `~ inferred`) on scored tells.

## After receiving the challenge

Parse the challenge to populate:

```bash
.claude/scripts/frontend-uplift/checkpoint.py <ID> --set challenge_path='".claude/notes/frontend-uplifts/<ID>/artifacts/challenge.md"'
.claude/scripts/frontend-uplift/checkpoint.py <ID> --set challenge_finding_counts='{"critical":N_BLOCKER,"high":N_MAJOR,"medium":N_MINOR,"low":N_CLEAN}'
.claude/scripts/frontend-uplift/checkpoint.py <ID> challenge-complete
```

## Anti-patterns

| Tempting belief | Reality |
|---|---|
| ">50% of candidates have MAJOR or BLOCKER objections — the synthesis was bad." | Possible.  More often, the challenger prompt is too aggressive or the synthesis under-considered the reduced-motion / bundle-size / React-18 axes.  Re-read with that lens before re-running. |
| "Every candidate must have AT LEAST a MINOR objection." | NO.  A clean NONE is a credible verdict.  Calibrated runs see 30–60% NONE. |
| "BLOCKER findings should kill candidates outright." | Not always.  A BLOCKER + a credible redesign sketch leaves Phase 4 deciding whether the redesigned candidate is worth pursuing. |
| "The challenger should propose its own candidates." | NO.  Phase 1's job.  Challenger evaluates the synthesis; it does not extend it. |
