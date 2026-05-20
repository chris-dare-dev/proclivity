# Implement scope-exceeded — frontend-uplift-2026q2-m2

**Milestone:** Motion-library foundation (UPL-1)
**Reason:** Initial newtab chunk size **breached the CLAUDE.md hard ceiling of 220 KB** after `motion@12.39.0` + `<LazyMotion>` wrapper landed. Per research synthesis §6 hard gate, aborting and removing the dependency.
**State transition:** `implement-running → implement-aborted-scope`

---

## Bundle measurements

| Build | Initial chunk (`dist/assets/index.html-*.js`) | vs baseline | vs CLAUDE.md hard ceiling (220 KB) |
|---|---|---|---|
| s3 baseline (post-m1) | **203.65 kB** | — | ✓ under (warn-zone) |
| s5 attempt 1 — naive `<LazyMotion>` + dynamic `import("motion/react")` | **233.16 kB** | +29.5 kB | ✗ **+13.16 kB over hard ceiling** |
| s5 attempt 2 — `<LazyMotion>` + dynamic `import("./motion-features")` indirection (forces Rollup chunk split) | **232.09 kB** | +28.4 kB | ✗ **+12.09 kB over hard ceiling** |
| After revert | **203.65 kB** | restored | ✓ under |

The features-indirection pattern (attempt 2) successfully split `motion-features-*.js` into its own deferred 41 kB chunk — but the synchronous `LazyMotion` core itself is **~28 kB**, far heavier than the research briefs' "~4.6 kB synchronous" claim.

---

## Root cause

`motion@12.39.0`'s `LazyMotion` provider has grown substantially beyond the version-12-baseline figures cited by both Phase 1 researchers and the upstream `/frontend-uplift` library-scout brief. The "~4.6 kB initial + ~15 kB deferred" claim was sourced from older docs / earlier motion versions. The deferred features chunk math (`domAnimation` ≈ 41 kB raw / 15.5 kB gzipped) is roughly accurate, but the synchronous overhead is now ~6× the documented figure.

The synthesis §7 alternative (a) — moving `<LazyMotion>` inside a `<Suspense>` boundary — does NOT solve this because `LazyMotion` is a Context provider, not a lazy-loaded component. Its module-level code is pulled in by the static `import { LazyMotion }` regardless of where in the JSX tree it renders.

The synthesis §7 alternative (b) — skip `LazyMotion`, import only `m` — would also drag in the same import surface area; verifying that is itself a spike.

The synthesis §7 alternative (c) — **defer m2 and run a chunk-budget-cleanup milestone first** — is the path forward. The current 203.65 kB baseline only leaves ~16 kB of headroom under the 220 kB hard ceiling; any meaningful motion library adoption needs more headroom recovered first.

---

## What was reverted

- `package.json` — removed `"motion": "^12.39.0"` from `dependencies`
- `package-lock.json` — regenerated to match (motion + 22 transitive deps removed)
- `src/newtab/App.tsx` — restored to pre-m2 state (no `LazyMotion` import, no loader, no provider wrapper)
- `src/newtab/motion-features.ts` — deleted (was a new file)
- `dist/` — rebuilt; initial chunk confirmed at 203.65 kB

No commits were made on `main` during this milestone — the implementer's edits are fully reverted in the working tree before this scope-exceeded artifact lands.

---

## Recommended next steps (program-level)

1. **File a `chunk-budget-recovery` spike** (≤ 3 days) — diagnose where the 203.65 kB baseline could be slimmed. Candidates from the upstream synthesis + visual-scout brief:
   - QuickPrompt + Gemini tools chain (currently bundled — see `App.tsx:81-83` lazy import; verify whether the system-prompt builder is genuinely lazy)
   - Closed-pile selectors that `TodoList` imports unconditionally
   - The `logger` module preloaded as 8.33 kB — verify it's needed at first paint
   - Settings-modal CSS / JS — already lazy but verify chunk split is clean
2. **OR raise the chunk ceiling** to ~250 kB in `CLAUDE.md` if the project is willing to relax — explicit user decision, not the orchestrator's call.
3. **OR consider a different motion library** — `@formkit/auto-animate` (UPL-13 in the upstream catalog) at ~3.28 kB gzipped is a cheaper alternative for the m4 / m5 stagger-reveal use cases, though it doesn't unlock the `AnimatePresence` / `layoutId` capabilities motion does. Combined adoption (auto-animate now + motion later when headroom exists) is a hybrid path.
4. **Update the roadmap doc** — the s5 AC's "≤ 200 KB absolute" wording should be corrected to "delta ≤ 10 kB AND total ≤ 220 KB" per the codified `CLAUDE.md` + `milestone-web-perf-critic` axis 6. Track as a `docs(roadmap)` follow-up.
5. **Retry m2 only after** chunk headroom is recovered (option 1) OR a cheaper alternative library is selected (option 3) OR the ceiling is explicitly raised (option 2).

---

## State of the world after this abort

- Repo on `main` at `ec0b22d` (post-m1, post-bookkeeping). Working tree clean.
- m2 state file: `phase = implement-aborted-scope`. Research artifacts (brief-1, brief-2, synthesis) committed under `.claude/notes/milestones/frontend-uplift-2026q2-m2/`.
- m3 (icon-system) is **NOT blocked** by this — m3 has no dependency on motion. Recommend the user proceed to `/milestone-pipeline frontend-uplift-2026q2-m3` while the m2 retry is being planned.
- The upstream `/frontend-uplift 2026q2-visual-refresh` final report's catalog is unaffected; UPL-1 simply moves from "foundation now" to "foundation after chunk-budget-recovery".

---

## Pipeline state

This is a **legitimate scope-exceeded abort**, not an error. The milestone-pipeline's bundle-budget gate worked as designed: it caught a real chunk regression before any commit landed on `main`. The synthesis §6 hard gate is the single point of policy that turned a foggy ~204 kB → 232 kB delta into a clear "don't ship" decision.

No `rect` commit is written. No external writes are pending. Phase 3 (critique) and Phase 4 (rectify) are skipped — there is no implementation to critique.
