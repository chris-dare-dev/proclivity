# Rectify summary — frontend-uplift-2026q2-m4

**Date:** 2026-05-20
**Critique input:** `critique/dedup.md` (C=0 H=2 M=4 L=5)
**Build verified:** 235.57 kB initial chunk (+0.10 kB from implementer's
235.47; the increase is the inert-type comment + role-selector chars),
zero TS errors, 1.36s.

---

## Fixed (4 of 11)

### HIGH

- **H1 — `.section-empty` div fade-in-animated by incoming-panel selector.**
  Narrowed both the incoming-panel rule and both reduced-motion guards
  from `.content > div:not(...)` to `.content > div[role="tabpanel"]:not(...)`.
  All 7 tabpanel `<div>`s carry `role="tabpanel"`; `.section-empty` does
  not, so it no longer triggers the fade-in keyframe on every settings-
  toggle re-render. Same class of "class-keyed selector fan-out" the m5
  rect M3 fix addressed for `.card-fallback-list`.
  - File: `src/newtab/App.css:174, 183, 192`

- **H2 — Commit subject exceeds CLAUDE.md ≤50-char cap.** Original
  s11 subject was `feat(motion): section-fade cross-dissolve on tab
  switches (m4-s11)` (52 chars after the prefix). The commit was
  **unpushed** (CLAUDE.md only forbids `--amend` on pushed commits),
  so amended to `feat(motion): section-fade cross-dissolve (m4-s11)`
  (36 chars). New SHA: e9960d4. State updated to reference the new SHA.
  - Treatment differs from m5 M2 (which was deferred because that
    commit had already been pushed).

### LOW

- **L2 — `inert` augmentation included unused `""` member.** Dropped
  the empty-string member from the `inert?: boolean | undefined` union
  to match React 19's native declaration shape and discourage the
  `inert=""` antipattern at call sites.
  - File: `src/types/react-augment.d.ts:24`

- **L4 — Stale `leavingTab` reference when sectionVisibility unmounts
  the active tab.** The visibility-gate `useEffect` that re-routes to
  `firstVisible` when the active tab is hidden now syncs
  `prevTabRef.current` to the incoming tab BEFORE `setTab`, cancels any
  in-flight `leavingTimeoutRef`, and clears `leavingTab` to `null`. The
  cross-dissolve `useLayoutEffect` then reads `prev === tab` and skips
  `setLeavingTab(prev)` for this synthesized tab change. Correct because
  the outgoing panel's `<div>` is unmounted by the conditional render
  gate — there's no DOM node to fade out.
  - File: `src/newtab/App.tsx:414-433`

---

## Deferred (7 of 11)

### MEDIUM

- **M1 — `motion` scope not in CLAUDE.md.** Recurring with m5 M1.
  Blocked by `protect-ops-files.mjs` hook on CLAUDE.md edits. Per the
  critic's own recommendation, `motion` is a stable cross-cutting
  concern across UPL-1, UPL-2 (this), UPL-3, UPL-4, UPL-9, UPL-11,
  UPL-12, UPL-17, UPL-19 — worth adding to the scope list in a single
  user-initiated edit (alongside `deps`, `icons`, `theme` from m3 L2,
  and `milestones`). Defer to a bundled CLAUDE.md update.

- **M2 — No test deltas for production-code change (recurring m1-L5).**
  Same root cause: proclivity has no test infrastructure. The four
  scenarios the critic recommended (initial mount, rapid-clicks,
  timeout-clear-via-functional-updater, `inert` attribute correctness)
  are valid coverage targets. Tracked alongside M4 below as a single
  testing-infrastructure follow-on milestone candidate.

- **M3 — Height-jump (CLS) at t=0 when leaving panel exits normal
  flow.** Documented v0 trade-off per synthesis §3.6. The existing
  `.content { min-height: 400px }` is the v0 mitigation; the grid-
  stacking alternative (`display: grid; grid-area: 1/1`) is the
  cleaner future path but is out of scope for a CSS-only cross-
  dissolve v0. Adding a CSS comment to track the trade-off would be
  belt-and-suspenders; defer the comment to avoid scope creep here.

- **M4 — Zero test delta across a behavioral animation milestone.**
  Same root cause as M2. Bundle both M2 + M4 + m5 M2 + m1 L5 into a
  single testing-infrastructure milestone proposal when the user is
  ready.

### LOW

- **L1 — Reduced-motion per-site `transition: none` shadowed by global
  `!important`.** Convention-following per `sections.css` precedent.
  Critic explicitly flagged as "Flag-only; do not fix." Defer.

- **L3 — Two adjacent `useLayoutEffect([tab])` blocks could be
  combined.** Critic recommended "No change — convention beats brevity
  here." Two independent features (stagger vs cross-dissolve) read
  more clearly as separate effects. Defer.

- **L5 — `react-augment.d.ts` delete-on-upgrade note is file-only,
  not tracked.** Adding a one-line note to CLAUDE.md §Stack reminder
  is blocked by `protect-ops-files.mjs` hook. Bundle with M1 for the
  user-initiated CLAUDE.md update.

---

## Invalidated

None.

---

## Re-verification status

Each fixed finding was re-read against the diff before fixing:

- **H1**: confirmed at `src/newtab/App.css:174` and matched against
  App.tsx:596 (`<div className="section-empty">`) which has no
  `role="tabpanel"`. Selector narrowing is correct.
- **H2**: measured original subject via `printf '%s' "section-fade
  cross-dissolve on tab switches (m4-s11)" | wc -c` = 52.
  Amended to 36 chars (well under 50). Commit unpushed verified via
  `git log origin/main..HEAD` before amend.
- **L2**: React 19's `@types/react` declares `inert?: boolean |
  undefined`. The empty-string member was a historical accommodation
  for raw-HTML serialization that doesn't apply at the JSX layer.
- **L4**: traced the React render order: `useEffect` (visibility gate)
  schedules a state update → next render → `useLayoutEffect`
  (cross-dissolve) fires. The `prevTabRef.current = firstVisible.id`
  assignment in the visibility-gate effect ensures the next
  useLayoutEffect run reads `prev === tab` and skips
  `setLeavingTab(prev)`.

Invalidation rate: 0/4 fixed (0%). Below the 40% threshold.

---

## Build gate

```
✓ 2278 modules transformed.
dist/assets/index.html-vd5eFUTT.js   235.57 kB │ gzip: 75.35 kB
✓ built in 1.36s
```

Chunk delta from implementer (235.47 → 235.57): +0.10 kB — the role-
selector additions in CSS and the inert-type comment. No functional
bundle impact.

Strict TS: zero errors.

---

## Known script limitation

`check-rect-tests.sh` will FAIL again (m1 L5 / m3 / m5 carry-over):
proclivity has no test suite for CSS regressions to live in. Manual
visual smoke in dev is the documented regression-guard:

1. Tab switch produces a visible cross-dissolve (~220 ms).
2. No flash-of-content on the incoming side.
3. Under DevTools forced reduced-motion, switches are instant.
4. Rapid clicks (5 in 500 ms) don't leave panels in stale state.
5. Tab key during the 220 ms window cannot focus the leaving panel's
   descendants (verify `inert` is in the DOM via DevTools elements).
6. Today/Sprint/LongTerm still get the m5 stagger (not double-fading).
7. Hiding the active tab in Settings re-routes cleanly without
   leaving a phantom `leavingTab` (L4 fix verification).
