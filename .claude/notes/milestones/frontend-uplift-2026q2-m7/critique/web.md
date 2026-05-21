# Critique — frontend-uplift-2026q2-m7 — milestone-web-perf-critic

**Critic:** milestone-web-perf-critic
**Commit range:** `8536277..08c5fb2`
**Generated:** 2026-05-20T00:00:00Z
**Diff stats:** 5 files changed, +130/-54 LOC

## Verdict

SHIP-WITH-FIXES

The implementation is fundamentally correct: `<AnimatePresence>` is properly scoped inside `Modal.tsx`, `m.div` is used throughout (LazyMotion strict-mode compliant), the dual reduced-motion guard is wired correctly, and the `lastEditingTodoRef` pattern correctly keeps the Suspense boundary mounted during the 180 ms exit window. The build passes with zero TypeScript errors at 251.47 kB (81.13 kB gzip), well under the 400 kB soft warn. Two MEDIUM findings need attention: `Modal.tsx` now adds a redundant `useStore()` subscription to every mounted Modal instance (including the 6+ always-mounted instances in the initial chunk), and the backdrop transition duration deviates from the spec (0.18 s instead of the 0.12 s specified in both the synthesis and brief-2). One LOW finding covers the `AnimatePresence` mode omission where the research brief and implementation synthesist disagreed and the riskier default (sync) was chosen without documenting the trade-off in code.

## Executive summary

- [PASS] Build clean: 251.47 kB unminified / 81.13 kB gzip. +15.9 kB raw / +5.78 kB gzip from m6 baseline. Well under 400 kB soft warn.
- [PASS] +15.9 kB initial chunk growth explained: Modal.tsx eagerly consumed by Gantt.tsx (initial chunk); adding `AnimatePresence`, `m`, `useReducedMotion` imports to Modal.tsx pulled those symbols into the initial chunk. motion-features deferred chunk shrank 3.9 kB (code migrated forward). Net new cost: ~12 kB raw / ~5.8 kB gzip. Acceptable per CLAUDE.md revised ceiling.
- [PASS] No new npm dependency; `motion@12.39.0` reused throughout.
- [PASS] No `chrome.storage.local` direct access; `useStore()` correctly mediates all storage reads. No `update()` calls in Modal.tsx — read-only subscription, no render loop.
- [PASS] CSP compliance confirmed: `m.div` applies inline styles (transform, opacity) — permitted under MV3 default CSP. No `dangerouslySetInnerHTML`, no `eval`, no runtime `<script>` injection.
- [MEDIUM] M1 — `Modal.tsx` calls `useStore()` unconditionally, adding a `chrome.storage.onChanged` listener for every mounted Modal instance. With 6+ always-mounted Modal variants (Gantt × 2, ChartView, Reminders, Sprint × 2+), every storage write (todo tick, title edit) triggers 6+ unnecessary Modal re-renders via setState.
- [MEDIUM] M2 — Backdrop `transition` duration is 0.18 s; synthesis §3.10 and brief-2 §3.5 specified 0.12 s for the backdrop and 0.18 s for the panel. Both now exit at the same duration — the backdrop lingers 60 ms longer than designed.
- [LOW] L1 — `<AnimatePresence>` uses default `mode="sync"`. Brief-2 §3.1 explicitly recommends `mode="wait"` for single-slot modal presence. Synthesis §3.4 overrode this without leaving a code comment. The trade-off (sync = immediate re-entry on rapid reopen; wait = 180 ms reopen latency) is undocumented at the call-site.

## Findings

### CRITICAL

(None.)

### HIGH

(None.)

### MEDIUM

#### [MEDIUM] M1 — `useStore()` in Modal.tsx multiplies storage subscribers

- **File:** `src/components/Modal.tsx`
- **Line:** 47
- **Anchor:** `  const { state } = useStore();`
- **What:** `Modal.tsx` calls `useStore()` unconditionally; every mounted Modal instance (TextInputModal, ConfirmDialog, the base Modal) creates an independent `chrome.storage.onChanged` listener via `useStore()`'s `storage.subscribe(setState)` effect. At initial render, at least 6 Modal instances are always mounted (open=false) in the initial-chunk tree — Gantt.tsx renders `TextInputModal` + `ConfirmDialog`, ChartView.tsx renders `TextInputModal`, RemindersManager.tsx renders `Modal` directly, SprintManager.tsx renders at least 2 `ConfirmDialog` instances. Each of these triggers a `setState` and a re-render on every `chrome.storage.onChanged` event (i.e., every todo tick, every todo add, every settings change).
- **Why it matters:** The parent components for every one of these Modal instances already call `useStore()` themselves. The Modal-level subscriptions are fully redundant — they read only `rs.reducedMotion`, a boolean that rarely changes. On a busy tab (frequent todo interactions), this pattern fires 6+ unnecessary Modal re-renders per storage write. With more Modal instances (ClosedTodosView adds 2 more when that lazy chunk loads), the count grows.
- **Proposed fix:** Pass `shouldReduceMotion` as a prop from the caller OR introduce a `ReducedMotionContext` that holds the computed boolean and is provided once near the root (e.g. in `App.tsx` alongside `LazyMotion`). Modal reads the context value without subscribing to the full storage state. Pseudo-code: `const ctx = useContext(ReducedMotionContext); const transitionDuration = ctx.shouldReduceMotion ? 0 : 0.18;` — the context value only updates when `rs.reducedMotion` or the OS pref changes, not on every storage write.
- **Regression-guard:** Not applicable for MEDIUM. A future integration test could assert that `chrome.storage.onChanged` fires a bounded number of React `setState` calls when a single todo is completed (should be proportional to open instances, not to all mounted Modal instances).
- **Source critic:** milestone-web-perf-critic
- **Source axis:** Web Axis 4 — useStore()/storage.ts boundary (subscriber multiplication)

#### [MEDIUM] M2 — Backdrop transition duration deviates from spec (0.18 s vs 0.12 s)

- **File:** `src/components/Modal.tsx`
- **Line:** 96
- **Anchor:** `          transition={{ duration: transitionDuration }}`
- **What:** The backdrop `m.div` uses `transitionDuration` (0.18 s) for both entry and exit, but the research synthesis §3.10 and brief-2 §3.5 specified the backdrop at 0.12 s and the panel at 0.18 s, producing a layered timing (backdrop fades faster, panel completes the scale-in).
- **Why it matters:** The intended design has the backdrop fade in 33% faster than the panel scale-in, which reads as "environment appears then dialog materializes" — a staging effect. Using 0.18 s for both makes them feel simultaneous and removes the perceptual layering. On exit, the backdrop lingers 60 ms after the panel scale-out would visually complete, which can feel like an extra flash before the background is fully visible.
- **Proposed fix:** Use a separate constant: `const backdropDuration = shouldReduceMotion ? 0 : 0.12;` and pass `transition={{ duration: backdropDuration }}` to the backdrop `m.div`. The panel retains `transition={{ duration: transitionDuration, ease: "easeOut" }}` (0.18 s).
- **Source critic:** milestone-web-perf-critic
- **Source axis:** Web Axis 6 — Accessibility / visual quality

### LOW

#### [LOW] L1 — `<AnimatePresence>` uses default `mode="sync"`; trade-off undocumented

- **File:** `src/components/Modal.tsx`
- **Line:** 88
- **Anchor:** `    <AnimatePresence>`
- **What:** `AnimatePresence` uses default `mode="sync"` (no `mode` prop set). Brief-2 §3.1 explicitly stated `mode="wait"` is the "correct choice" for modals to prevent simultaneous enter/exit overlap; synthesis §3.4 overrode this decision without leaving a code comment explaining the trade-off.
- **Why it matters:** With `mode="sync"`, if the user closes and reopens the modal within the 180 ms exit window, motion cancels the exit and immediately starts the entry animation — this is actually correct behavior for this pattern (no ghosted modals). However, in `AnimatePresence` with a single conditional child and the same `key="modal"`, motion v12 behavior with sync mode cancels the exit correctly. The visual impact is a brief scale-flicker if the modal is dismissed and immediately reopened. The missing documentation creates ambiguity for future maintainers who might see the discrepancy with brief-2 §3.1 and wonder if it was an oversight.
- **Proposed fix:** Add an inline comment: `{/* mode omitted (default "sync"): single-child presence, no overlapping open/close possible in normal use. mode="wait" would add 180ms latency to rapid reopen. See synthesis §3.4. */}`. No code change needed.
- **Source critic:** milestone-web-perf-critic
- **Source axis:** Web Axis 3 — maintainability / documentation

## What was done well

- **Synthesis followed prescriptively.** All 12 architecture decisions from the research synthesis (§3.1–§3.12) were implemented as specified. The single documented deviation (chunk size) was anticipated in synthesis §7 and handled correctly via the CLAUDE.md revised ceiling.
- **CSS keyframe cleanup is complete.** Both `@keyframes modal-fade-in` and `@keyframes modal-slide-in` were removed alongside their `animation:` declarations and the now-redundant `@media (prefers-reduced-motion)` and `[data-reduced-motion="true"]` suppression blocks. The double-animation-on-mount risk is eliminated. Replacement comments document the migration clearly.
- **Dual reduced-motion guard is correct.** `useReducedMotion()` (OS signal) combined with `rs.reducedMotion` (in-app toggle) via `||` — either-or collapses to instant. The `useMemo` over `resolvedSettings(state.settings)` prevents unnecessary re-derivation. This matches the synthesis §3.6 specification exactly.
- **`m.div` (not `motion.div`) throughout.** LazyMotion `strict` mode compliance is maintained. All animated elements use the feature-function-gated `m.div` import, which correctly receives the LazyMotion context through the portal boundary.
- **`lastEditingTodoRef` pattern is correct and consistent.** Both `TodoList.tsx` and `SprintManager.tsx` received the same ref+effect+derivation pattern. The Suspense boundary stays mounted after first open, enabling exit animations while keeping first-open lazy-load deferral intact. The stale todo is never displayed (Modal renders nothing inside the portal when `open=false`).
- **Focus restoration is compatible with the 180 ms exit window.** The existing `rAF`-deferred focus restore fires ~16 ms after `open` flips false, returning focus to the trigger while the modal visually fades out. During the 0–16 ms window, the `useFocusTrap` hook correctly traps Tab within the still-focused modal panel. After the rAF fires, focus is on the trigger and the modal's `onKeyDown` is no longer in scope. This is the accepted 2026 pattern.
- **No storage writes in Modal.tsx.** The `useStore()` call is read-only (`state` destructured, `update` not destructured). No render loop risk — storage changes trigger Modal re-renders but Modal never writes back in response.
- **`aria-modal="true"` and `aria-labelledby` preserved on the animated `m.div` panel.** Semantic attributes survived the `div → m.div` conversion unchanged. Screen readers correctly identify the panel as a modal dialog regardless of animation state.
- **Chunk growth is honest and bounded.** The implementer accurately diagnosed why the 235.57 kB prediction was wrong (Modal.tsx eagerly consumed by initial-chunk components), documented the discrepancy explicitly in implement/synthesis.md §3, and correctly applied the CLAUDE.md revised ceiling. The motion-features deferred chunk shrinkage (41.10 → 37.18 kB) is correctly noted as a code-migration side effect, not savings.
- **Build is clean.** Zero TypeScript strict-mode errors, zero Vite warnings, 2277 modules transformed successfully. The strict TS flags (`strict: true`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`) remain in force.

## Recommended rectification order

M1, M2, L1

(M1 first because it has cumulative runtime impact. M2 is a one-line constant split. L1 is a comment-only change.)

## Phase 4 status (filled by orchestrator at rectify time)

- Fixed:
- Deferred:
- Invalidated:
- Regression tests added:
