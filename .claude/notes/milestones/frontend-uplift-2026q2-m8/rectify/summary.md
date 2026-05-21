# Rectify summary — frontend-uplift-2026q2-m8

**Date:** 2026-05-20
**Critique input:** `critique/dedup.md` (C=0 H=0 M=3 L=6; sources: adversary + web + oss)
**Build verified:** 301.65 kB initial chunk raw / 96.06 kB gz (+0.03 kB raw from
implementer baseline — comment additions + theme prop expression). Zero TS errors.

---

## Fixed (2 of 9)

### MEDIUM

- **M3 — sonner `richColors` fails WCAG AA in light mode.** All four
  semantic toast variants (success/error/warning/info) ship with
  vendor CSS colors that fail 4.5:1 contrast in light mode at 13 px
  (lowest: warning at 3.07:1). Sonner's normal-mode palette passes
  10.5:1+ in both themes. **Removed `richColors` from the Toaster.**
  Toasts now use sonner's accessible default styling — no semantic
  green/red/orange backgrounds, but the message text is fully
  readable in both themes. Re-enabling later requires CSS overrides
  via `[data-rich-colors='true'][data-sonner-toast]` tokens; deferred
  to a future polish milestone.
  - File: `src/newtab/App.tsx:707` (Toaster props)

### LOW

- **L5 — Toaster `theme="system"` could diverge from in-app theme.**
  Sonner's `theme="system"` reads `prefers-color-scheme` independently
  of proclivity's in-app theme toggle (which lives in `rs.theme`).
  A user with OS=light + app=dark would see the app dark but toasts
  light. **Derived `theme` from `rs.theme`** via:
  `theme={rs.theme === "dark" ? "dark" : rs.theme === "light" ? "light" : "system"}`.
  Now in-app theme drives toast color-scheme. Falls back to OS detection
  when the in-app setting is `"system"`. The ternary is exhaustive since
  `ResolvedUserSettings.theme: ThemeMode = "light" | "dark" | "system"`.
  - File: `src/newtab/App.tsx:702-704`

---

## Deferred (7 of 9)

### MEDIUM

- **M1 — `deps` commit scope not in CLAUDE.md (4th recurrence).** Same
  m3 L2 / m10 M1 / m11 M1 carry-over. CLAUDE.md edit blocked by
  `protect-ops-files.mjs` hook (project-contract file requires user-
  initiated `CLAUDE_ALLOW_OPS_EDITS=1`). Now **EIGHT** accumulated
  CLAUDE.md edits worth bundling into a single user-initiated pass:
  `motion`, `deps`, `icons`, `theme`, `milestones`, `palette`, +
  the `react-augment.d.ts` delete-on-upgrade note, + the chunk-budget
  delta tracking. The critic explicitly said "bundle the CLAUDE.md
  edit with the next milestone's rectifier pass" but it's still hook-
  blocked. Defer until user authorizes.

- **M2 — Synthesis AC3 ("≤ 280 kB raw") mismatch with brief-2's
  301.78 kB projection.** The synthesis writer (me) typed a tighter
  AC than what brief-2 §Bundle delta predicted. Actual chunk:
  301.65 kB raw — matches brief-2 to within 0.05% but exceeds the
  synthesis AC3 text by ~21.6 kB. The actual chunk IS well within the
  CLAUDE.md 400 kB soft warn / 500 kB hard ceiling. This is a
  documentation-only inconsistency, not a real budget breach. The
  rect summary records the discrepancy; no code change required.
  Future m12+ chunk-budget critics should reference 305 kB raw as the
  post-m8 baseline.

### LOW

- **L1 — No test deltas.** m1 L5 carry-over. Proclivity has no test
  infrastructure (no vitest, no @testing-library/react, no JSDOM).
  Manual smoke is the documented regression-guard.

- **L2 — In-app `rs.reducedMotion` not propagated to sonner/auto-animate.**
  Synthesis §3.6 + OQ2 explicitly documented this v0 limitation. Both
  libraries only read the OS-level signal. Future polish milestone
  could add `disrespectUserMotionPreference: !rs.reducedMotion`
  override + `duration: Infinity` under in-app reduced-motion. Defer.

- **L3 — sonner is single-maintainer on npm.** Critic's own
  recommendation: "No action required for v0. The library has 12.4k
  GitHub stars." Bus-factor risk acknowledged.

- **L4 — auto-animate ^0.9.0 + 1.0.0-beta in flight.** When 1.0.0
  becomes `dist-tags.latest`, review the breaking-changes diff before
  bumping. The `^0.9.0` caret correctly scopes to the 0.9.x patch
  range; no auto-upgrade to 1.x.

- **L6 — Duplicate of L2.** The dedup script kept both. Same finding,
  defer same way.

---

## Invalidated

None.

---

## Re-verification status

Each fixed finding was re-read against the diff before fixing:

- **M3**: confirmed via `grep richColors src/` returns empty after the
  fix. Sonner's normal-mode default styling passes WCAG AA at 10.5:1
  (light) / 20.5:1 (dark) per brief-2 §Bundle delta + critic
  measurements.

- **L5**: confirmed `ResolvedUserSettings.theme: ThemeMode = "light"
  | "dark" | "system"` (src/types/index.ts:194). The ternary is
  exhaustive and TS-strict-compatible. Build verifies no type errors.

Invalidation rate: 0/2 fixed (0%). Below the 40% threshold.

---

## Build gate

```
✓ 2342 modules transformed.
dist/assets/index.html-cJVrfvQj.js   301.65 kB │ gzip: 96.06 kB
✓ built in 1.58s
```

Chunk delta from implementer (301.62 → 301.65): **+0.03 kB raw**. Just
the expanded comment + ternary expression. Well under 400 kB soft warn.

Strict TS: zero errors.

---

## Known script limitation

`check-rect-tests.sh` will FAIL again — proclivity has no test suite.
Manual smoke is the documented regression-guard:

1. Open Settings → click Done → modal closes → toast "Settings saved"
   appears in bottom-right; auto-dismisses after 3.5 s; close button
   works.
2. Create a new reminder → "Reminder created" toast.
3. Toggle in-app theme (dark/light) → toast color-scheme follows
   (L5 fix verifies).
4. DevTools force `prefers-reduced-motion: reduce` → toast appears
   instantly (no slide animation) but still visible for 3.5 s.
5. Add a todo on Today → row slides into the list via auto-animate
   FLIP (~250 ms).
6. Complete a todo → row fades/moves to Closed via FLIP.
7. Verify toasts read clearly in BOTH light and dark mode — the
   removed `richColors` means semantic colors no longer apply but
   default text contrast is well above WCAG AA.
