# Rectify summary — frontend-uplift-2026q2-m7

**Date:** 2026-05-20
**Critique input:** `critique/dedup.md` (C=0 H=1 M=4 L=3)
**Build verified:** 251.52 kB initial chunk (+0.05 kB from implementer
251.47; the increase is the comment block + dual-duration variable
names). Zero TS errors, 1.48s.

---

## Fixed (4 of 8)

### HIGH

- **H1 — Tab during exit re-traps focus in closing modal.** Added an
  `inert` attribute to the panel `panelRef` element when `open` flips
  false, via direct DOM `setAttribute("inert", "")` inside the existing
  focus-restoration `useEffect`. The `inert` attribute removes the
  panel + all descendants from focus order AND the a11y tree atomically
  — Tab during the ~164 ms exit window now routes to the next normal
  focusable element instead of being yanked back into the closing
  modal by the still-wired `useFocusTrap`. The attribute is removed
  on the next open via `removeAttribute("inert")` so re-opens of the
  same modal instance (AnimatePresence-held key="modal") work cleanly.
  - File: `src/components/Modal.tsx:55-79`
  - Pattern matches the m4-s11 lesson shape (use `inert`, not just
    `pointer-events: none`, to block Tab escape during animated exits).

### MEDIUM

- **M3 — Redundant `useMemo` around `resolvedSettings(...)` [AGREEMENT]**.
  Inlined: `const rs = resolvedSettings(state.settings);`. Dropped the
  `useMemo` import (no other call site in Modal.tsx uses it). Module
  is correct; the function is a tiny pure default-applier and the
  `useMemo` machinery cost exceeded the savings.
  - File: `src/components/Modal.tsx:4, 51`

- **M4 — Backdrop transition duration deviated from spec (0.18 s vs
  0.12 s).** Split the single `transitionDuration` into
  `backdropDuration` (0.12 s) and `panelDuration` (0.18 s) — the
  two-tier timing originally prescribed in synthesis §3.10 / brief-2
  §3.5. Backdrop now fades 33% faster than the panel scales in,
  producing the "environment appears, then dialog materializes"
  staging effect. Both collapse to 0 under reduced-motion.
  - File: `src/components/Modal.tsx:60-65, 105, 121`

### LOW

- **L3 — `<AnimatePresence>` `mode` trade-off undocumented.** Added an
  inline comment block above the `<AnimatePresence>` element
  documenting why `mode` is omitted (default `sync` is correct for
  single-child modal presence — `mode="wait"` would add 180 ms
  latency on rapid reopen). References synthesis §3.4 and brief-2
  §3.1 so future maintainers can trace the decision.
  - File: `src/components/Modal.tsx:93-98`

---

## Deferred (4 of 8)

### MEDIUM

- **M1 — `motion` scope not in CLAUDE.md (third recurrence).** Same
  root cause as m5 M1 / m4 M1. CLAUDE.md edit blocked by
  `protect-ops-files.mjs` hook. Now FIVE accumulated edits worth
  bundling into a single user-initiated `CLAUDE_ALLOW_OPS_EDITS=1`
  run: `motion` + `deps` + `icons` + `theme` + `milestones` scopes.
  The commit is already pushed; CLAUDE.md says never amend pushed.
  Critic explicitly noted "the rectifier should NOT block on this."

- **M2 — Production-code delta with zero test deltas.** Same root
  cause as m1 L5 + m3/m4/m5/m6 carry-overs. Proclivity has no
  test infrastructure (no Vitest, no RTL). Critic explicitly
  demoted from CRITICAL → MEDIUM because "the testing harness
  genuinely does not exist yet, structurally enforcing it on a
  single milestone would be unfair." Bundle into the standing
  testing-infrastructure milestone proposal.

### LOW

- **L1 — Diff at 5 files / +130 LOC at the inline boundary.**
  Process note for m8+ (per critic). No fix for m7 — diff is
  within both ≤5 files and ≤300 LOC gates.

- **L2 — Lessons.md timestamp anachronism.** The researcher
  memory file uses append-only semantics and `.claude/CLAUDE.md`
  is explicit: "These are additive append-only logs, never to be
  rewritten or truncated." Editing the lessons.md file to "fix"
  past entries would violate the invariant. Defer; the timestamp
  drift is documented and future researcher runs should self-
  correct via the milestone-researcher's own checks.

---

## Invalidated

None.

---

## Re-verification status

Each fixed finding was re-read against the diff before fixing:

- **H1**: confirmed the `useFocusTrap` is invoked via the panel's
  `onKeyDown={handleKeyDown}` which calls `trapFocus(e)` on lines 80-92.
  During exit, the m.div still has this handler wired from its last
  render. Adding `inert` to `panelRef.current` synchronously when
  `open` flips false short-circuits ALL keyboard interaction with
  descendants (Tab, Escape, click). Verified by reading the
  `useFocusTrap` source briefly: it intercepts Tab events at the
  panel boundary; `inert` makes descendants non-focusable so the
  trap never fires.

- **M3**: confirmed `resolvedSettings` at `src/storage/constants.ts:167`
  is a small pure function. No expensive computation; useMemo
  unjustified. Inlining drops 2 lines (useMemo import + the
  useMemo wrapper).

- **M4**: confirmed synthesis §3.10 prescribed "Backdrop: opacity
  0→1, 120 ms ease-out. Panel: opacity 0→1 + scale 0.96→1, 180 ms
  ease-out." Implementer used 180 ms for both. Fix restores the
  two-tier timing exactly per spec.

- **L3**: confirmed the `mode` omission was deliberate (synthesis
  §3.4). Adding an inline comment makes the trade-off discoverable
  without breaking any code.

Invalidation rate: 0/4 fixed (0%). Below the 40% threshold.

---

## Build gate

```
✓ 2278 modules transformed.
dist/assets/index.html-fiQ9Im6R.js   251.52 kB │ gzip: 81.16 kB
✓ built in 1.48s
```

Chunk delta from implementer (251.47 → 251.52): **+0.05 kB**. The
rect added the dual-duration variables, the inert toggle in the
effect, comment blocks, and removed the useMemo + import. Net: a few
bytes of code + comments. Well under the 400 kB soft warn.

Strict TS: zero errors.

---

## Known script limitation

`check-rect-tests.sh` will FAIL again (m1 L5 / m3 / m4 / m5 / m6
carry-over). Proclivity has no test suite. Manual visual smoke is
the documented regression-guard:

1. Open SettingsModal → backdrop fades in faster than panel scales in
   (~120 ms backdrop, ~180 ms panel — staging effect visible).
2. Close SettingsModal → reverse staging on exit.
3. Press Tab IMMEDIATELY after Escape/click-close → focus routes
   to the next focusable (not back into the closing modal).
4. DevTools forced reduced-motion → instant open/close, no animation.
5. SettingsModal → "Discard unsaved changes" ConfirmDialog → both
   animate independently with their own staging.
6. TodoEditModal (pencil-edit a todo) → same animation, same
   Tab-during-exit safety.
7. Rapid open/close (5 clicks in 500 ms) → no ghost modals
   accumulate; AnimatePresence cancels exit and re-enters cleanly.
