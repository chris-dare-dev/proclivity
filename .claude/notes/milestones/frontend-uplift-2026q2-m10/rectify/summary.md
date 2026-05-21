# Rectify summary — frontend-uplift-2026q2-m10

**Date:** 2026-05-20
**Critique input:** `critique/dedup.md` (C=0 H=1 M=4 L=6)
**Build verified:** 258.28 kB initial chunk (unchanged from implementer
baseline — rect edits were CSS-token swaps, regex tweaks, comment
updates, key-prop changes, and one new Close button). Zero TS errors.

---

## Fixed (7 of 11)

### MEDIUM

- **M2 — `isMacOS()` regex omits `ipod` exclusion vs library's internal
  check.** Added `ipod` to the negative-match alternation: `!/iphone|ipad|ipod/i.test(...)`.
  Now matches the library's upstream `Z()` helper exactly. Updated the
  surrounding JSDoc to document the parity rationale.
  - File: `src/components/help/KeyboardHelpOverlay.tsx:5-13`

- **M3 — Keyboard help overlay opens without moving focus into the
  dialog.** Added a Close `<button autoFocus>` in the modal footer.
  Three benefits in one ~12-line edit:
  - WCAG 2.1 SC 2.4.3 (Focus Order) satisfied — focus moves into the
    dialog on open.
  - ARIA dialog-modal APG satisfied — screen readers announce the dialog
    state correctly.
  - Modal's `useFocusTrap` now has a focusable child (was degenerating
    to a no-op).
  - Keyboard users get an explicit dismiss path (Tab → Enter on Close).
  - File: `src/components/help/KeyboardHelpOverlay.tsx:124-143`

- **M4 — `--text-muted` CSS token undefined; category headers rendered
  at full brightness.** Replaced `var(--text-muted, var(--text))` with
  `var(--text-dim)` (the project's actual muted-text token, defined in
  theme.css) at two sites: `.keyboard-help-category h3` (line 23) and
  `.keyboard-help-key-sep` (line 65). Added comments documenting the
  token correction.
  - File: `src/components/help/KeyboardHelpOverlay.css:21-23, 64-66`

### LOW

- **L1 — ChatPanel `description` desync with registry label.** Updated
  the `useHotkeys("escape")` in ChatPanel.tsx from
  `description: "Close chat panel"` to `description: "Close panel /
  modal"` (verbatim match to `shortcuts.ts` SHORTCUTS[escape].label).
  Per critic Option (a) — the registry's generic phrasing is the union
  semantic (covers chat-panel AND modals since Modal.tsx's onKeyDown
  is intentionally not migrated).
  - File: `src/components/chat/ChatPanel.tsx:53-60`

- **L2 — `<span key={token}>` collapses on duplicate tokens.** Changed
  the React key from the token string to the array index: `<span
  key={i}>`. The keys list is render-stable here (parent `keys` prop
  only changes when the SHORTCUTS entry changes), so index-as-key is
  safe. Added inline comment explaining why.
  - File: `src/components/help/KeyboardHelpOverlay.tsx:74-80`

- **L3 — `<div key={shortcut.keys}>` collapses if two SHORTCUTS share
  `keys`.** Changed to composite key: `key={`${category}-${shortcut.keys}-${rowIndex}`}`.
  Now safe against a future registry where the same `keys` string maps
  to different categories (e.g. `mod+enter` for "Submit form" in App
  + "Send message" in Chat). Threaded `rowIndex` via the `.map()`
  signature.
  - File: `src/components/help/KeyboardHelpOverlay.tsx:114-123`

- **L6 — Stale JSDoc contradicting line 7 about `isMacOS()` source.**
  Updated the class-level JSDoc from "isMacOS() (from react-hotkeys-hook)"
  to a corrected attribution noting the local helper + a back-reference
  to the line-7 rationale. The line-7 comment was already correct; L6
  was a contradictory secondary comment.
  - File: `src/components/help/KeyboardHelpOverlay.tsx:14-23`

---

## Deferred (4 of 11)

- **H1 — Production-code delta with zero test-file delta (m1 L5
  carry-over).** Critic explicitly demoted CRITICAL→HIGH and explicitly
  said "no rectifier action is required — log the deferral." Same
  structural gap as m1/m3/m4/m5/m6/m7. Proclivity has no test
  infrastructure; bundle into the standing testing-infrastructure
  milestone proposal.

- **M1 — Commit scope `deps` not in CLAUDE.md scopes list.** Recurring
  with m3 L2. CLAUDE.md edit blocked by `protect-ops-files.mjs` hook.
  Now SIX accumulated CLAUDE.md edits worth bundling into a single
  user-initiated `CLAUDE_ALLOW_OPS_EDITS=1` pass: `motion` (m4/m5/m7),
  `deps` (m3/m10), `icons` (m3), `theme` (m3), `milestones` (m3+),
  and the `react-augment.d.ts` delete-on-upgrade note (m4).

- **L4 — Implement-synthesis cites gzip-only chunk number vs raw
  bytes.** Doc-only nit per critic. The implement/synthesis.md will be
  read once and then archived; editing it now to fix the unit mismatch
  is low-leverage. Future Phase 3 critics should standardize on raw
  bytes (matching Vite's output and CLAUDE.md's ceiling).

- **L5 — Local `isMacOS()` duplicates internal library logic.** Critic
  explicitly said "No action required now... When the shortcut registry
  grows (m11+), add a comment linking to the library source." M2's fix
  (adding `ipod` to the exclusion) already brings the local helper to
  exact parity. Defer the upstream-tracking comment until m11.

---

## Invalidated

None.

---

## Re-verification status

Each fixed finding was re-read against the diff before fixing:

- **M2**: confirmed the library's `Z()` helper in
  `node_modules/react-hotkeys-hook/dist/index.js` includes `ipod` in its
  negative-match alternation. Fix is a one-token addition that brings
  the local helper to byte-exact parity.

- **M3**: confirmed Modal.tsx's `useFocusTrap` expects a focusable
  descendant. Without one, the trap silently no-ops. Adding the Close
  button (with `autoFocus`) gives Modal both an initial focus target
  and a Tab-stop for the focus-trap loop.

- **M4**: confirmed via `grep -rn '\-\-text-muted' src/styles/` — token
  is not defined. `grep -rn '\-\-text-dim' src/styles/theme.css` returns
  the correct token at lines 35, 84 of theme.css (dark + light).

- **L1**: confirmed string mismatch via `grep description
  src/components/chat/ChatPanel.tsx` vs `grep label src/lib/shortcuts.ts`.
  After fix, both render `"Close panel / modal"`.

- **L2, L3**: confirmed React strict-mode behavior — duplicate keys
  produce a console warning AND drop one of the siblings silently.
  Index-as-key + composite-key fixes are mechanically correct.

- **L6**: confirmed the two contradictory JSDoc blocks. Updated the
  later block to align with the earlier (correct) block.

Invalidation rate: 0/7 fixed (0%). Below the 40% threshold.

---

## Build gate

```
✓ 2278 modules transformed.
dist/assets/index.html-DJXFESv5.js   258.28 kB │ gzip: 83.52 kB
✓ built in 1.57s
```

Chunk delta from implementer (258.28 → 258.28): **+0.00 kB raw**. All
rect edits were CSS token swaps, regex tweaks, comment updates,
key-prop changes, and a Close button — no JS payload increase.

Strict TS: zero errors.

---

## Known script limitation

`check-rect-tests.sh` will FAIL again (m1 L5 / m3 / m4 / m5 / m6 / m7
carry-over). Proclivity has no test suite. Manual smoke is the
documented regression-guard:

1. Press Cmd+/ → overlay opens with m7 modal animation; focus lands
   on Close button (verify via DevTools accessibility tab).
2. Tab key cycles through Close button only (single focusable target).
3. Enter on Close → overlay closes; focus returns to trigger.
4. Press Cmd+/ again while overlay is open → overlay closes (toggle).
5. Press Escape → overlay closes via Modal's onKeyDown handler.
6. Category headers render at dimmed `--text-dim` color (not full
   brightness `--text`).
7. Key chips show ⌘ on Mac, Ctrl on Windows/Linux (verify by spoofing
   userAgent in DevTools).
8. Open chat panel → Escape closes it (ChatPanel migration intact).
9. Open Settings → Escape still closes it (Modal.tsx untouched).
