# Critique — frontend-uplift-2026q2-m8 — milestone-web-perf-critic

**Critic:** milestone-web-perf-critic
**Commit range:** 4c2ddb9..531f66f
**Generated:** 2026-05-21T03:15:00Z
**Diff stats:** 7 files changed, 49 insertions, 3 deletions (~32 LOC actual code changes; remainder is package-lock.json churn)

---

## Verdict

SHIP-WITH-FIXES

The implementation is structurally correct and meets every acceptance criterion from the
synthesis. Bundle budget is sound (301.62 kB raw / 96.07 kB gz, well under the 400/500 kB
ceiling). The storage boundary is respected (no direct `chrome.storage` calls). One MEDIUM
finding requires attention before shipping: all four `richColors` semantic toast variants
(success, info, warning, error) fail WCAG AA contrast in light mode at their vendor-shipped
values. This is a real but bounded failure — dark mode passes all four, and normal
(non-rich) toasts pass in both modes. The known v0 gap (in-app `rs.reducedMotion` not
propagated to sonner/auto-animate) is a pre-documented deferral, not a regression.

---

## Executive summary

- [MEDIUM] All four sonner `richColors` semantic variants fail WCAG AA (4.5:1) in **light mode**: success 4.29:1, info 4.35:1, warning 3.07:1, error 4.36:1 at 13px normal weight — vendor CSS, not proclivity code.
- [LOW] `theme="system"` reads `prefers-color-scheme` independently of proclivity's in-app theme state (`rs.theme`). Toast color mode can diverge from app color mode when the user's OS setting differs from their in-app preference.
- [LOW] In-app `rs.reducedMotion` toggle is not propagated to either sonner or `@formkit/auto-animate`; both libraries only read the OS-level `matchMedia` signal. Pre-documented deferral per synthesis §3.1/§3.6.
- [CLEAN] Initial chunk: 301.62 kB raw / 96.07 kB gz. Under the 400 kB soft warn. Delta matches projected (+41.3 kB raw / +13.9 kB gz vs ~12.5 kB gz expectation — slight gz overrun due to tree-shaking characteristics; within acceptable tolerance).
- [CLEAN] Storage boundary intact: no direct `chrome.storage` calls in any modified file.
- [CLEAN] CSP: sonner ships pure React JSX (no `eval`, `Function`, or `innerHTML`); auto-animate uses WAAPI (`element.animate()`) — both MV3-safe.
- [CLEAN] `<Toaster>` placement is correct: outside `<div className="app">`, inside `<LazyMotion>`, after the CommandPalette `<Suspense>` block — consistent with KeyboardHelpOverlay and CommandPalette placement.
- [CLEAN] auto-animate is NOT duplicated in the `ClosedTodosView` lazy chunk (confirmed by build artifact inspection).

---

## Findings

### CRITICAL

_(none)_

### HIGH

_(none)_

### MEDIUM

#### [MEDIUM] M1 — sonner richColors fails WCAG AA in light mode (all 4 variants)

- **File:** `src/newtab/App.tsx`
- **Line:** 701–707
- **Anchor:** `      <Toaster`
- **What:** All four `richColors` semantic toast variants ship with vendor CSS color values that fail WCAG AA (4.5:1 minimum for 13px/normal-weight text) in light mode: success hsl(140,100%,27%) on hsl(143,85%,96%) = **4.29:1**; info hsl(210,92%,45%) on hsl(208,100%,97%) = **4.35:1**; warning hsl(31,92%,45%) on hsl(49,100%,97%) = **3.07:1**; error hsl(360,100%,45%) on hsl(359,100%,97%) = **4.36:1**.
- **Why it matters:** Proclivity uses `theme="system"` which maps to `prefers-color-scheme`. Users in OS light mode see feedback toasts with below-threshold contrast, affecting readability for users with low vision. Dark mode passes all four (lowest 6.59:1 for info).
- **Proposed fix:** Two options: (1) override the failing tokens in proclivity's own CSS to darker text values — e.g. for success: `hsl(140, 100%, 22%)` achieves ~5.8:1, for warning: `hsl(31, 95%, 32%)` achieves ~4.6:1; (2) disable `richColors` and rely on sonner's normal (non-rich) toast mode, which passes comfortably in both modes (light: 10.53:1, dark: 20.55:1). Option 2 is simplest. If semantic colors are desired, add a small CSS override block in `App.css` or `index.css` scoped to `[data-rich-colors='true'][data-sonner-toast]` variables. This is 8–12 LOC of CSS.
- **Regression-guard:** None automated today; note for a future visual-regression test suite: capture `[data-rich-colors='true'][data-sonner-toast][data-type='warning']` background/foreground in light mode.
- **Source critic:** milestone-web-perf-critic
- **Source axis:** Web Axis 6 — Accessibility (WCAG AA)

### LOW

#### [LOW] L1 — Toaster theme="system" can diverge from in-app theme state

- **File:** `src/newtab/App.tsx`
- **Line:** 703
- **Anchor:** `        theme="system"`
- **What:** `theme="system"` makes sonner read `window.matchMedia("(prefers-color-scheme: dark)")` independently. Proclivity's in-app theme toggle sets `data-theme` / `data-reduced-motion` on `<html>` and is stored in `state.settings`. If the user sets the in-app theme to "dark" while the OS is in light mode, the app appears dark but toasts appear light.
- **Why it matters:** Cosmetic inconsistency in an edge case (OS light + in-app dark); not a functional or accessibility regression since normal toast contrast passes in both modes.
- **Proposed fix:** Derive the sonner `theme` prop from `rs.theme` (or the resolved equivalent): `theme={rs.theme === "dark" ? "dark" : rs.theme === "light" ? "light" : "system"}`. This is a 1-line change. Defer to a follow-up polish milestone per synthesis §3.3 open question 1.
- **Regression-guard:** n/a
- **Source critic:** milestone-web-perf-critic
- **Source axis:** Web Axis 1 — Initial chunk / theme consistency

#### [LOW] L2 — In-app rs.reducedMotion not propagated to sonner or auto-animate

- **File:** `src/newtab/App.tsx` (sonner), `src/sections/TodoList.tsx`, `src/sections/sprint/SprintManager.tsx` (auto-animate)
- **Line:** 701 / 60 / 567, 680
- **Anchor:** `      <Toaster`
- **What:** Neither sonner nor `@formkit/auto-animate` reads the `data-reduced-motion="true"` attribute that `useThemeSync` sets on `<html>` when `rs.reducedMotion` is enabled in-app. Both libraries only read the OS-level `window.matchMedia("(prefers-reduced-motion: reduce)")` signal.
- **Why it matters:** A user with OS-level motion enabled but in-app motion disabled still sees toast slide-in/out animations and auto-animate FLIP transitions. This is a known v0 gap documented in the synthesis (§3.1 and §3.6) — not an undetected regression.
- **Proposed fix (for a future milestone):** For sonner: pass `duration={rs.reducedMotion ? Infinity : 3500}` so toasts stay until manually dismissed. For auto-animate: pass `useAutoAnimate({ disrespectUserMotionPreference: rs.reducedMotion })` with the inverted semantics, or call the returned `setEnabled(false)` in a `useEffect` when `rs.reducedMotion` is true. See synthesis §3.1 for rationale. Defer per pre-existing synthesis decision.
- **Regression-guard:** n/a
- **Source critic:** milestone-web-perf-critic
- **Source axis:** Web Axis 6 — Accessibility (WCAG AA) / reduced-motion parity

---

## What was done well

- **Reduced-motion correctness on the hard path.** The roadmap brief contained a load-bearing error ("set `duration={0}` under reduced-motion") that would have made toasts unreadable. The synthesis correctly identified and rejected this interpretation, and the implementer followed through with a fixed `duration={3500}` and no `useReducedMotion()` wrapper. This is the highest-risk decision in the milestone and it was handled correctly.
- **Correct hook placement for `useAutoAnimate` across component boundaries.** The implementer correctly created separate hook calls inside `ArchivedSprintRow()` and `SprintManager()` respectively, respecting the rules-of-hooks constraint. A single shared ref across component scopes would have silently failed; this was called out in the synthesis and executed cleanly.
- **ClosedTodosView correctly deferred.** The rules-of-hooks violation (multiple `<ul>` via `.map()`) would have been a runtime error if attempted. The deferred-with-comment approach is the right call.
- **No chunk duplication.** Build artifact inspection confirms `@formkit/auto-animate` is present in the initial chunk (via TodoList + SprintManager) and absent from the `ClosedTodosView-DEX71AK3.js` lazy chunk — Vite correctly deduped the shared module.
- **Storage boundary clean.** None of the six modified source files touch `chrome.storage` directly. All state mutations continue to flow through `useStore()` → `update()` → `storage.ts`.
- **CSP-safe libraries.** Both libraries were pre-screened for `eval`/`Function`/`innerHTML` usage (brief-2 §3). The build confirms no CSP-incompatible patterns. MV3 compliance is intact.
- **Precise Toaster placement.** The `<Toaster>` is correctly placed outside `<div className="app">` and inside `<LazyMotion>`, consistent with the KeyboardHelpOverlay and CommandPalette placement convention — readable and predictable tree structure.
- **toast.success call ordering in SettingsModal.** The `toast.success("Settings saved")` fires AFTER `setDirty(false); onClose()`, meaning the modal exit animation is already in flight before the toast appears. This prevents the modal and toast from competing for attention (per synthesis §3.4 recommendation).
- **Commit message quality.** The commit body documents the reduced-motion design rationale and the synthesis §3.8 deferred decision inline — this survives `git blame` and protects future maintainers from re-litigating the rationale.
- **Bundle delta accuracy.** Projected 301,785 bytes raw; actual 301,615 bytes raw — a 170-byte deviation. The gz delta (+13.9 kB) is 1.3 kB over the 12.6 kB projection, consistent with the `hasSideEffects: true` characteristic of auto-animate (Vite includes the full library without partial tree-shaking). Within acceptable tolerance and well under budget.

---

## Recommended rectification order

M1 (WCAG AA light-mode richColors), L1 (theme divergence), L2 (in-app reduced-motion gap)

M1 is the only finding that merits Phase 4 action before shipping. L1 and L2 are pre-documented v0 deferrals and can remain open for a future polish milestone.

---

## Phase 4 status (filled by orchestrator at rectify time)

- Fixed: _
- Deferred: _
- Invalidated: _
- Regression tests added: _
