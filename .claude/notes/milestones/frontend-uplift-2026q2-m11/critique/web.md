# Critique — frontend-uplift-2026q2-m11 — milestone-web-perf-critic

**Critic:** milestone-web-perf-critic
**Commit range:** b8ea1f2..HEAD
**Generated:** 2026-05-21T02:45:07Z
**Diff stats:** 8 files changed, +906/-3 (307 meaningful LOC excluding auto-gen package-lock.json)

---

## Verdict

SHIP-WITH-FIXES

The implementation is architecturally sound and meets all CRITICAL and HIGH
acceptance criteria. The cmdk lazy-split holds clean (confirmed by build output
and `grep -l cmdk dist/assets/*.js`), the initial chunk grew by only 0.94 kB to
259.22 kB (well under the 400 kB soft-warn ceiling), the focus-trap/Escape/
focus-return semantics are correct via Radix Dialog, and the OPEN_SETTINGS_EVENT
bridge follows the established NAV_CLOSED_EVENT topology. Two MEDIUM findings
remain: a pre-existing design-token contrast failure that m11 replicates in the
selected palette item, and a project-wide zero-test footprint. Neither blocks
shipping; both warrant follow-up.

---

## Executive summary

- [CLEAN] Initial chunk 259.22 kB raw / 83.84 kB gz — well within 400 kB soft warn / 500 kB hard ceiling.
- [CLEAN] Lazy-chunk discipline verified: `grep -l cmdk dist/assets/*.js` returns `CommandPalette-DsNpE4RH.js` only; no cmdk symbols leak into `index.html-jpLXcdD7.js`.
- [CLEAN] CommandPalette lazy chunk: 47.95 kB raw / 15.96 kB gz — +1.06 kB gz over the 14.9 kB prediction (within normal variance; budget is ≤500 kB total, not per-chunk).
- [CLEAN] OPEN_SETTINGS_EVENT bridge is correct: constant lives in `logger-BpFZM-HC.js` (shared chunk), imported by both the initial chunk (App.tsx) and the lazy CommandPalette chunk. React 18 automatic batching ensures dispatch+closePalette are committed together.
- [CLEAN] Radix Dialog provides role="dialog", focus-trap (FocusScope `trapped`), Escape dismiss, focus-return (onUnmountAutoFocus), and aria-label pass-through. autoFocus on Command.Input fires on every open because Radix Presence unmounts/remounts content when open changes.
- [CLEAN] No direct chrome.storage access in palette files. No Node-only imports. No manifest/vite config changes. No service-worker changes. CSP-clean (no eval, Function, innerHTML, dangerouslySetInnerHTML, script.src).
- [MEDIUM] Selected palette item contrast fails WCAG AA: dark mode 2.61:1, light mode 3.24:1 (both below 4.5:1 requirement). Pre-existing design token issue (same --accent/--accent-on pair already used in sprint.css, calendar.css, gantt.css) — m11 replicates it in CommandPalette.css.
- [MEDIUM] Project has no test infrastructure (no vitest.config, no .test.* files). This is a pre-existing project-level gap, not introduced by m11, but m11 adds non-trivial UI behavior (focus management, event bridging, hotkey toggle) with zero test coverage.

---

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

#### [MEDIUM] M1 — Selected palette item fails WCAG AA contrast in both themes

- **File:** `src/components/palette/CommandPalette.css`
- **Line:** 89–92
- **Anchor:** `[cmdk-item][data-selected="true"] {`
- **What:** The selected/highlighted command item uses `background: var(--accent)` with `color: var(--accent-on)`, producing 2.61:1 contrast in dark mode (#7c9cff on white) and 3.24:1 in light mode (#4859d0 on oklch(0.18 0.012 252)). Both fail WCAG AA normal text (4.5:1 required for 14px non-bold text).
- **Why it matters:** Users navigating the palette by keyboard rely on the selected-item highlight being visually distinct; low-contrast selection states are the primary interaction mode for keyboard users and screen-magnification users.
- **Proposed fix:** Add `font-weight: 600` to the selected state to promote it to "bold 14px" (which meets the WCAG AA large-text threshold of 3:1; dark mode 2.61:1 still falls short). For full WCAG AA compliance, darken the dark-mode accent to pass 4.5:1 against white, e.g. use `var(--accent-2)` (oklch(0.55 0.15 179)) as the selected background, or add a `--accent-selected` token. Note: this is a pre-existing design-token contrast gap that appears identically in `sprint.css:27–29`, `calendar.css:138`, and `gantt.css:235` — a holistic token audit is preferable to a palette-only fix.
- **Regression-guard:** Optional — no test infrastructure exists; manual check with browser DevTools accessibility panel (Ctrl+Shift+I → Elements → Accessibility).
- **Source critic:** milestone-web-perf-critic
- **Source axis:** Web Axis 6 — Accessibility (WCAG AA)

---

#### [MEDIUM] M2 — Zero test coverage for new focus/event-bridge behavior

- **File:** `src/components/palette/CommandPalette.tsx`, `src/lib/palette-commands.ts`, `src/newtab/App.tsx`
- **Line:** (whole diff — 307 LOC of new UI behavior)
- **Anchor:** `export default function CommandPalette({`
- **What:** The milestone adds three novel behaviors — (a) Cmd+K hotkey toggle, (b) OPEN_SETTINGS_EVENT custom-event bridge (Header listener), (c) visibleTabs prop driving Navigation commands — with no corresponding unit, integration, or smoke tests.
- **Why it matters:** The event-bridge pattern (window.dispatchEvent in a lazy chunk, addEventListener in an always-mounted Header) has no test-visible invariant. If a future refactor moves `setSettingsOpen` out of `Header()` scope, the bridge silently becomes a no-op (dispatches an event no one listens to) with no test failure.
- **Proposed fix:** Add vitest + @testing-library/react infrastructure (the project currently has none). Priority tests: (1) `PALETTE_COMMANDS.find(c => c.id === 'settings').action(deps)` dispatches `proclivity:open-settings`; (2) Header's useEffect registers and cleans up the listener; (3) `visibleTabs` with an empty array renders no Navigation group. These are unit-testable in ~30 LOC without a browser.
- **Regression-guard:** The tests themselves would be the regression guard once infrastructure exists.
- **Source critic:** milestone-web-perf-critic
- **Source axis:** Web Axis 2 / general (zero test deltas on production code)

---

### LOW

#### [LOW] L1 — cmdk aria-labelledby/aria-label interop gap (library-level, not actionable)

- **File:** `src/components/palette/CommandPalette.tsx`
- **Line:** 48
- **Anchor:** `label="Command palette"`
- **What:** Radix Dialog.Content internally sets `aria-labelledby` pointing to a generated ID (from Dialog.Title), which is never rendered by cmdk's `Command.Dialog`. Since `aria-labelledby` takes precedence over `aria-label` per ARIA spec, and the referenced element doesn't exist in the DOM, some screen readers (notably VoiceOver on macOS) may not announce "Command palette" as the dialog name.
- **Why it matters:** The dialog may be announced without a name by some AT, reducing discoverability for screen-reader users.
- **Proposed fix:** This is a known cmdk/Radix interop gap — cmdk's `label` prop API is designed to work around it, and most AT (NVDA, JAWS) fall back to `aria-label` when `aria-labelledby` references a missing element. No change needed in proclivity's code. If VoiceOver support is a priority, add a visually-hidden `<Command.Dialog>` wrapping element with `id={dialogTitleId}` and reference it; but this is out of scope for v0.
- **Source critic:** milestone-web-perf-critic
- **Source axis:** Web Axis 6 — Accessibility (WCAG AA)

---

#### [LOW] L2 — Hardcoded `border-radius: 4px` on item rows diverges from `--radius` token

- **File:** `src/components/palette/CommandPalette.css`
- **Line:** 83
- **Anchor:** `  border-radius: 4px;`
- **What:** Command item rows use a hardcoded `4px` border-radius instead of `var(--radius)` (which is `10px` in both themes).
- **Why it matters:** If the `--radius` token is ever changed (e.g. for a "sharp corners" user setting), item rows in the palette will not follow. Not a bug today.
- **Proposed fix:** Replace `border-radius: 4px` with a sub-radius expression: `calc(var(--radius) * 0.4)` or a new `--radius-sm` token. Note: the 4px choice for item rows is intentional UX (items should look different from the panel border-radius), so a named token is preferable over `var(--radius)` directly.
- **Source critic:** milestone-web-perf-critic
- **Source axis:** Low — style/naming

---

## What was done well

- **Lazy-chunk discipline was flawless.** The `cmdk` import is confined strictly to `CommandPalette.tsx`. The initial chunk contains only a `lazy(() => import(...))` reference string — no cmdk symbols, no Radix Dialog, no palette-commands. The m7 "motion eager-hoist surprise" failure mode was fully avoided.
- **OPEN_SETTINGS_EVENT bridge follows the established pattern exactly.** The constant is placed adjacent to `NAV_CLOSED_EVENT` in `constants.ts` with a doc-comment explaining the topology and when NOT to add more events (synthesis §7 risk note is directly reflected in the jsdoc). The listener cleanup is correct (`return () => window.removeEventListener(...)`).
- **React 18 automatic batching is handled correctly.** The dispatch-before-close ordering (CustomEvent fires synchronously, then `closePalette()`) batches both state updates in a single commit because they occur within the same synchronous call stack inside a React synthetic event handler. No `flushSync` is needed.
- **`exactOptionalPropertyTypes: true` compliance.** The `keywords` prop spread pattern (`{...(cmd.keywords !== undefined ? { keywords: [...cmd.keywords] } : {})}`) correctly handles the strict optional property requirement without casting or unsafe `undefined` assignment.
- **Theme tokens are used consistently and correctly.** `--text-dim` is used (not the undefined `--text-muted` token, which was the m10 bug). `--panel`, `--border`, `--accent`, `--accent-on`, `--radius` are all verified present in both dark and light themes. The only hex literals are `rgba(0,0,0,N)` for backdrop, matching the m3 rect convention documented in the CSS comment.
- **Focus management is correct.** `autoFocus` on `<Command.Input>` fires on every palette open because Radix Dialog's Presence component unmounts/remounts content when `open` changes (no animation = immediate unmount). Radix Dialog handles focus return on close via `onUnmountAutoFocus`. No manual `useRef.current.focus()` calls needed.
- **`visibleTabs` prop correctly gates tab-switch commands.** The prop is derived from the `visibleTabs` memo in `App()` (which filters by `rs.sectionVisibility`), so hidden tabs are absent from the Navigation group without any additional logic in `CommandPalette.tsx`.
- **`mod+k` hotkey wired with `preventDefault: true`.** Consistent with the `mod+slash` precedent from m10. The description string `"Open command palette"` matches `shortcuts.ts` exactly (m10 L1 lesson was applied).
- **`<Command.Dialog>` used directly instead of wrapping `<Modal>`.** This avoids the dual-focus-trap and dual-portal anti-pattern that would result from nesting Radix Dialog inside another Radix Dialog. The architecture decision is correct and well-documented in the component JSDoc.
- **No manifest, vite config, or service-worker changes.** The feature is entirely client-side UI. No new permissions were added. The permission least-authority invariant is undisturbed.

---

## Recommended rectification order

M1, M2, L1, L2

(M1 is worth fixing before wide QA — the dark-mode contrast failure is visible at a glance. M2 is a project investment, not a hotfix. L1 and L2 are deferred unless AT testing is in scope for this milestone.)

---

## Phase 4 status (filled by orchestrator at rectify time)

- Fixed: _
- Deferred: _
- Invalidated: _
- Regression tests added: _
