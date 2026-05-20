# Rectify summary — frontend-uplift-2026q2-m2

**Date:** 2026-05-20
**Critique:** `.claude/notes/milestones/frontend-uplift-2026q2-m2/critique/dedup.md`
**Counts:** 0 CRITICAL / 0 HIGH / **4 MEDIUM** / **5 LOW**
**Verdict:** SHIP-WITH-FIXES

---

## Re-verification

Skipped — re-verification protocol applies only to CRITICAL and HIGH findings (per `phase-rectify.md` §4a). All 9 findings are MEDIUM or LOW.

---

## Fixed findings

| ID | Source | Title | Fix |
|---|---|---|---|
| **M1 / M4** | adversary + web | `loadDomAnimation` const breaks import-block contiguity | Moved the `loadDomAnimation` arrow + its 16-line explanatory comment to AFTER the import block in `src/newtab/App.tsx`. All 11 static imports are now contiguous at lines 1–11; the loader const lives in the module-level-constants section at lines 13–32. M1 and M4 dedupe to the same finding — same file:line anchor, same fix. |
| **M2** | adversary | Roadmap doc still says "≤ 200 KB absolute" — drift after CLAUDE.md raise | Updated `plans/frontend-uplift-2026q2-roadmap.md` s5 AC to: "the initial chunk delta against the s3 baseline is ≤ 30 KB AND the absolute total does not exceed the CLAUDE.md hard ceiling of 500 KB (soft warn at 400 KB; raised from 200/220 in commit 55d81ac on 2026-05-20)". Also rewrote 4 other stale "≤ 200 KB" references in §6 and §8 of the roadmap to the new policy. |
| **M3** | oss | LazyMotion sync cost is 28 kB, not ~4.6 kB as motion docs state | Appended dated lesson to `.claude/agent-memory/milestone-oss-scout/lessons.md` capturing the 6× discrepancy + the lesson ("expect 5–10× docs estimate for any animation library's sync provider runtime in v10+ releases"). Future oss-scout runs reading the memory will calibrate against the real number. |

Build verified clean after M1+M4 refactor: `npm run build` passes, chunk holds at 232.09 kB (unchanged — the M1+M4 refactor is purely re-ordering; zero behavioral or bundle impact).

---

## Deferred findings (with rationale)

| ID | Severity | Title | Defer reason |
|---|---|---|---|
| L1 | LOW | No regression guard for the chunk-split invariant | Requires a new post-build script + `npm run build` wiring + (probably) a CI hook. ≥ 30 LOC across a new file + `package.json` script. Defer to a `tune(build)` follow-up milestone. The risk is real but localized — anyone "simplifying" the dynamic import will re-trigger the scope-exceeded gate at Phase 3, so the milestone-pipeline already has a structural safety net. |
| L2 | LOW | Repo-wide test-infrastructure gap | Project-level architectural gap, not specific to m2. Introducing vitest is itself a multi-milestone effort. Track for a future `/roadmap test-infra` initiative or capability-scout pass. |
| L3 | LOW | `tslib` quietly promoted from dev → prod via transitive motion deps | Informational. tslib is a Microsoft-maintained ~12 kB utility shim; supply-chain risk is negligible. No fix needed; acknowledged in the implement synthesis bundle math. |
| L4 | LOW | `@formkit/auto-animate` not a functional substitute for motion | Dispatch-level finding (raised in the oss-scout brief, answered: confirmed motion is the right choice). No code change. |
| L5 | LOW | Sync LazyMotion delta (+28.44 kB) exceeded projected ~5 kB by 5.7× | Same as M3 (memory append already done). The delta is well under the new 400/500 kB budget; no immediate action required. Track in m3+ planning by using the new 232.09 kB baseline as the denominator. |

---

## Invalidated findings

**None.** Re-verification was skipped (no C/H to re-verify); no invalidations were logged.

---

## Regression tests added

**None** — see L2 (no test framework). M1+M4 fix is a pure refactor verified by build success; M2 and M3 are doc/memory updates with no test surface.

The rect commit itself touches:
- `src/newtab/App.tsx` (production code; refactor for M1+M4 — zero behavior change, verified by build passing identically)
- `plans/frontend-uplift-2026q2-roadmap.md` (doc, M2)
- `.claude/agent-memory/milestone-oss-scout/lessons.md` (doc, M3)
- `.claude/notes/milestones/frontend-uplift-2026q2-m2/{rectify/summary.md,critique/*,research/*,implement/*,audit.jsonl}` (durable milestone evidence)

The `check-rect-tests.sh` script flagged `audit.jsonl` as production code in m1 — same false-positive expected here. Tracked under m1's L5 deferral; no action needed.

---

## Verdict

**SHIP** — all 4 MEDIUMs fixed, all 5 LOWs deferred with rationale. The implementation commit `2c38371` stands as the shipped change; the rect commit (this artifact + the M1+M4 refactor + M2 doc + M3 memory) closes the cycle.

---

## Sequencing note

m2 is now complete on `main`. m3 (icon-system migration) is the next Now-lane milestone per the roadmap §8. The new 232.09 kB baseline (vs the prior 203.65 kB) should be cited in m3's s8 chunk-budget verification.
