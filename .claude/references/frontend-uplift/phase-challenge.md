# Phase 3 — CHALLENGE (sub-agent)

**Purpose:** dispatch a single sub-agent (the Challenger) to argue AGAINST each modernization candidate so Phase 4 prioritization receives honest signal about feasibility, accessibility risk, bundle cost, and Proclivity-design-system fit.  Mirrors `/capability-scout` Phase 3 but specialized for frontend concerns.

## Inputs

- `.claude/notes/frontend-uplifts/{ID}/artifacts/synthesis.md`
- (Optional) the 4 discover briefs under `.claude/notes/frontend-uplifts/{ID}/discover/` for ground-checking the synthesis against its sources.

## Output

`.claude/notes/frontend-uplifts/{ID}/artifacts/challenge.md`

## Dispatch

Single `Agent` call with `subagent_type: general-purpose`, sonnet, `isolation: worktree`.  Use the canonical Challenger prompt from `references/frontend-uplift/agent-prompts.md` verbatim.

Substitute:
- `{ID}` → uplift slug
- `{SYNTHESIS_PATH}` → `.claude/notes/frontend-uplifts/{ID}/artifacts/synthesis.md`
- `{CHALLENGE_PATH}` → `.claude/notes/frontend-uplifts/{ID}/artifacts/challenge.md`

## Severity rubric (Challenger-specific)

The challenger uses the 4-tier rubric mapped to the standard format for state-field consistency:

| Challenger tier | Maps to standard severity | Meaning |
|---|---|---|
| **BLOCKER** | CRITICAL | Must be dropped or fundamentally redesigned.  Examples: motion-vocabulary §8 anti-pattern (parallax on planning sections, magnetic-cursor on operational buttons), React 19-only library on a React 18 stack, license-incompatible OSS, requires hosted endpoint / cross-device sync (local-only violation), ≥50 KB initial-chunk increment with NO lazy-load story. |
| **MAJOR** | HIGH | Shippable but with significant cost the synthesis didn't surface.  Examples: 30–50 KB bundle increment with weak justification; a11y regression with no remediation plan; reduced-motion fallback missing across a key path; chrome.storage.local schema migration without forward-path. |
| **MINOR** | MEDIUM | Light scope adjustment.  Examples: token name drift, missing `aria-hidden` on a decorative icon, reduced-motion fallback missing on a single class. |
| **NONE** | LOW (clean) | Candidate survives.  Aim for 30–60% of candidates rating NONE — that's calibrated. |

## The 10-axis FRONTEND-CHALLENGER checklist

Every candidate gets evaluated against:

1. **Status-token discipline** — `--danger` / `--warn` / `--ok` are reserved for explicit state communication; flag any candidate that uses them for decorative purposes
2. **Reduced-motion discipline** — `@media (prefers-reduced-motion: reduce)` baseline in `index.css` must continue to suppress new motion; every new animation must honor it
3. **Accessibility regression risk** — WCAG AA contrast (in BOTH light + dark themes), keyboard nav, screen-reader semantics, ARIA roles
4. **Bundle-size cost** — Proclivity targets ≤200 KB initial newtab chunk per `CLAUDE.md`; heavy deps must `React.lazy + Suspense`
5. **React 18 compatibility** — React 19-only features / libraries are out of scope
6. **Strict-TS compatibility** — `strict: true`, `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`
7. **Theming impact** — both light + dark themes must preserve contrast; the user-overridable `--accent` token must not be hardcoded
8. **Effort honesty** — t-shirt size matches Proclivity historical milestone sizes (typical: ≤300 LOC, ≤5 files per milestone)
9. **Motion-vocabulary anti-pattern** — explicitly check candidate against motion-vocabulary §8 (parallax on planning sections, magnetic-cursor on operational buttons, confetti on every todo, animations without reduced-motion fallback)
10. **Sequencing dependencies** — DAG between candidates (e.g., stagger-reveal depends on Framer Motion adoption)

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
