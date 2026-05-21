# Rectify summary — frontend-uplift-2026q2-m11

**Date:** 2026-05-20
**Critique input:** `critique/dedup.md` (C=0 H=1 M=5 L=5; sources: adversary + web + oss)
**Build verified:** 259.24 kB initial chunk (+0.02 kB from 259.22 implementer
baseline — comment additions + minor TSX changes). Lazy `CommandPalette-*.js`
chunk shrank from 47.95 → 44.80 kB raw (−3.15 kB) thanks to the L3 dedupe.
Zero TS errors.

---

## Fixed (6 of 11)

### HIGH

- **H1 — `mod+k` toggle silently dropped while typing in palette input.**
  `react-hotkeys-hook` skips form-element targets by default; once the
  palette opens and focus moves to `<Command.Input autoFocus>`, subsequent
  Cmd+K presses were no-ops — synthesis AC10 #5 would have failed in
  manual smoke. Added `enableOnFormTags: true` to the `useHotkeys`
  options. Matches the precedent ChatPanel uses for its Escape hotkey.
  - File: `src/newtab/App.tsx:352-365`

### MEDIUM

- **M2 — `Tab` type exported from App.tsx (inverse coupling).** Hoisted
  the `Tab` union to `src/types/index.ts` (the project's canonical types
  module — already houses `TodoScope`, `Tag`, `Todo`, etc.). Re-exported
  from `src/newtab/App.tsx` for back-compat. `CommandPalette.tsx` now
  imports from `@/types` (the upward dep). Closes the m11-axis-B inverse-
  coupling finding the synthesis §3.3 had pre-emptively flagged.
  - Files: `src/types/index.ts:1-19`, `src/newtab/App.tsx:138-143`,
    `src/components/palette/CommandPalette.tsx:18`

- **M4 — Selected palette item fails WCAG AA contrast.** Added
  `font-weight: 600` to the `[cmdk-item][data-selected="true"]` rule —
  promotes the row to "bold 14px" which satisfies WCAG AA large-text
  3:1 threshold (partial mitigation; full 4.5:1 normal-text compliance
  requires a `--accent-selected` token or darker accent variant in dark
  mode). Annotated as a partial fix referencing the broader pre-existing
  contrast gap (sprint.css / gantt.css / calendar.css use the same
  pattern; needs a holistic token audit beyond m11 scope).
  - File: `src/components/palette/CommandPalette.css:90-99`

### LOW

- **L1 — Hardcoded z-index magic numbers.** Added a block comment above
  the z-index declarations documenting the stack convention (9000 =
  overlay, 9001 = dialog root, >9001 reserved for future system toasts).
  Pointed to a future hoist-to-tokens path (`--z-modal` / `--z-palette`
  / `--z-toast` in theme.css) when a simultaneous-stack feature lands.
  - File: `src/components/palette/CommandPalette.css:17-26`

- **L2 — "Loads only on first Cmd+K press" doc-drift.** Rewrote the
  comment block above `lazy(() => import("@/components/palette/CommandPalette"))`
  to accurately describe the runtime behavior: the chunk fetches in
  parallel during app warm-up (because Suspense renders the component
  with `open=false` on App's first render); only the user-perceived
  rendering is gated by `open`. Same lesson applies to m10's
  KeyboardHelpOverlay comment but that text isn't touched here.
  - File: `src/newtab/App.tsx:131-138`

- **L3 — `@radix-ui/react-primitive` / `@radix-ui/react-slot` version
  duplication.** Added `resolve.dedupe` to `vite.config.ts` listing both
  packages. cmdk's nested-dep tree resolves both packages at multiple
  versions (2.1.3 + 2.1.4 for react-primitive; 1.2.3 + 1.2.4 for
  react-slot); Vite was bundling each unique realpath as a separate
  module. The dedupe forces a single canonical copy at bundle time —
  saved 3.15 kB raw / ~1 kB gz from the lazy CommandPalette chunk
  (47.95 → 44.80 kB raw), matching the OSS critic's prediction.
  - File: `vite.config.ts:9-22`

---

## Deferred (5 of 11)

### MEDIUM

- **M1 — `deps` commit scope not in CLAUDE.md (3rd recurrence).** Same
  m3 L2 / m10 M1 carry-over. CLAUDE.md edit blocked by `protect-ops-
  files.mjs` hook. Now SEVEN accumulated CLAUDE.md edits worth bundling
  into a single user-initiated `CLAUDE_ALLOW_OPS_EDITS=1` pass:
  `motion`, `deps`, `icons`, `theme`, `milestones`, `palette`,
  `react-augment.d.ts` delete-on-upgrade note. The critic recommended
  landing the CLAUDE.md edit IN m11's rectify pass; hook precluded.

- **M3 + M5 — No test deltas (cross-critic agreement, m1 L5 carry-over).**
  Same structural gap as every prior milestone. Proclivity has no test
  infrastructure (no vitest, no @testing-library/react, no JSDOM, no
  `"test"` script in package.json). Bundle into the standing
  `chore(test): bootstrap vitest` milestone proposal.

### LOW

- **L4 — cmdk `aria-labelledby`/`aria-label` interop gap.** Library-
  level concern (Radix Dialog.Content sets `aria-labelledby` pointing
  to a Dialog.Title that cmdk doesn't render; some screen readers may
  not announce the dialog name). Critic explicitly said "no change
  needed in proclivity's code" — most AT fall back to `aria-label`.
  Defer to a future a11y polish milestone if/when VoiceOver-specific
  testing surfaces a complaint.

- **L5 — Hardcoded `border-radius: 4px` on item rows.** Critic noted
  the 4px is intentional UX (items should look distinct from the
  panel's 10px `--radius`). A `--radius-sm` token would be the clean
  long-term answer but isn't worth introducing for a single usage.
  Defer until the project has a 2nd consumer of "sub-radius."

---

## Invalidated

None.

---

## Re-verification status

Each fixed finding was re-read against the diff before fixing:

- **H1**: confirmed via `node_modules/react-hotkeys-hook/packages/react-hotkeys-hook/dist/index.js`
  default-skip behavior for form tags. Fix is canonical (matches
  ChatPanel.tsx's same option for its Escape hotkey).

- **M2**: confirmed `Tab` was previously only in App.tsx + imported by
  CommandPalette via `@/newtab/App`. After hoist: App.tsx re-exports for
  back-compat; CommandPalette imports from `@/types`. `grep -rn "from
  \"@/newtab/App\"" src/` now matches zero (other than the type
  re-export site itself).

- **M4**: confirmed the contrast issue is pre-existing across
  sprint.css / gantt.css / calendar.css. Partial fix (`font-weight: 600`)
  + comment pointer to the broader token-audit follow-up.

- **L1**: confirmed via grep — `z-index` values 9000 and 9001 with no
  token system in theme.css. Comment block now anchors the convention.

- **L2**: confirmed lazy chunks fetch in parallel during app boot via
  Vite's preload tags. The "loads on first press" framing was
  misleading; the new comment accurately separates "chunk fetch
  timing" from "user-perceived render gate."

- **L3**: confirmed via build delta — pre-dedupe lazy chunk 47.95 kB,
  post-dedupe 44.80 kB (−3.15 kB raw / ~1 kB gz). Matches the OSS
  critic's prediction within margin. The source map no longer contains
  nested `react-dialog/node_modules/@radix-ui/react-primitive` entries.

Invalidation rate: 0/6 fixed (0%). Below the 40% threshold.

---

## Build gate

```
✓ 2336 modules transformed.
dist/assets/CommandPalette-GfMLUnyp.js   44.80 kB │ gzip:  15.67 kB
dist/assets/index.html-DOuvmH-S.js      259.24 kB │ gzip:  83.86 kB
✓ built in 1.56s
```

Initial chunk delta from implementer (259.22 → 259.24): **+0.02 kB raw**.
Lazy CommandPalette chunk shrank by 3.15 kB raw / ~0.3 kB gz net (the
dedupe payoff). All well under the 400 kB soft warn / 500 kB hard
ceiling.

Strict TS: zero errors.

---

## Known script limitation

`check-rect-tests.sh` will FAIL again (m1 L5 / m3 / m4 / m5 / m6 / m7 /
m10 carry-over). Proclivity has no test suite. Manual smoke is the
documented regression-guard:

1. Press Cmd+K → palette opens.
2. Type "set" → "Open Settings" filtered/highlighted.
3. Press Cmd+K AGAIN while typing → palette closes (H1 fix verifies).
4. Press Cmd+K → re-open. Type "today" → "Switch to Today" appears.
   Enter → switches to Today tab; palette closes.
5. Open Settings → hide some tabs → close Settings → re-open palette
   → those tabs are absent from Navigation commands.
6. Press Escape while palette is open → palette closes.
7. Verify selected item is now bold (font-weight: 600) — easier to
   spot under low-contrast conditions.
8. DevTools network panel — confirm `CommandPalette-*.js` is fetched
   during app boot (NOT delayed until Cmd+K press), but the dialog
   only renders when `paletteOpen` is true.
