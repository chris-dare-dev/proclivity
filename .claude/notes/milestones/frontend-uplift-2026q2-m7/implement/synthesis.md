# Implement synthesis — frontend-uplift-2026q2-m7

**Date:** 2026-05-20
**Path:** inline (main session)
**Base SHA:** 8536277
**Commit landed:** `08c5fb2 feat(motion): modal scale-in via AnimatePresence (m7-s13)`

**Build status:** PASS (251.47 kB initial chunk, +15.9 kB from m6 baseline
235.57 kB; well under 400 kB soft warn).

---

## 1. What shipped

Five files changed (+130/-54 LOC):

### `src/components/Modal.tsx`
- Added imports: `AnimatePresence`, `m`, `useReducedMotion` from `motion/react`;
  `useStore` from `@/storage/useStore`; `resolvedSettings` from `@/storage/constants`.
- Added `shouldReduceMotion` derivation combining OS signal (`useReducedMotion()`)
  with in-app `rs.reducedMotion` — either-or collapses transition duration to 0.
- Removed `if (!open) return null` — AnimatePresence handles presence now.
- Restructured the `createPortal` return: wraps `{open && (<m.div backdrop>...
  <m.div panel>...</m.div></m.div>)}` in `<AnimatePresence>` with `key="modal"`.
- Backdrop: `initial={{ opacity: 0 }}`, `animate={{ opacity: 1 }}`,
  `exit={{ opacity: 0 }}`, `transition={{ duration: 0 or 0.18 }}`.
- Panel: `initial={{ opacity: 0, scale: 0.96 }}`,
  `animate={{ opacity: 1, scale: 1 }}`, `exit={{ opacity: 0, scale: 0.96 }}`,
  `transition={{ duration: 0 or 0.18, ease: "easeOut" }}`.
- All event handlers (onMouseDown, onKeyDown), aria attrs, and panelRef
  preserved on the converted `m.div` elements.

### `src/components/Modal.css`
- Deleted `@keyframes modal-fade-in` and `@keyframes modal-slide-in`.
- Removed `animation: modal-fade-in 120ms ease;` from `.modal-backdrop`.
- Removed `animation: modal-slide-in 150ms ease;` from `.modal-panel`.
- Deleted `@media (prefers-reduced-motion: reduce)` + `[data-reduced-motion="true"]`
  CSS blocks that suppressed the now-removed keyframes (redundant with motion's
  `useReducedMotion()`).
- Replaced with explanatory comments documenting the move to motion.

### `src/sections/TodoList.tsx`
- Added `useEffect` and `useRef` to the React import.
- Added `lastEditingTodoRef: useRef<Todo | null>(null)` + a `useEffect` that
  captures the last-seen `editingTodo` whenever it's truthy.
- Derived `displayEditingTodo = editingTodo ?? lastEditingTodoRef.current` —
  the render gate now uses this so the Suspense stays mounted during the
  ~180 ms exit animation window.

### `src/sections/sprint/SprintManager.tsx`
- Added `useRef` to the React import.
- Same ref+effect+derivation pattern as TodoList.tsx.
- Updated the render gate from `{editingTodo && ...}` to
  `{displayEditingTodo && ...}` and passes `todo={displayEditingTodo}`.

### `.claude/agent-memory/milestone-researcher/lessons.md`
- Researcher lessons updated by the brief-1/brief-2 agents during Phase 1.

---

## 2. Architecture decisions made during implementation

All decisions followed synthesis §3.1 through §3.12 prescriptively:

- AnimatePresence inside Modal.tsx (NOT at call-sites) — single-file change
  covers all 4 Modal variants (§3.1).
- `m.div` (NOT `motion.div`) per LazyMotion strict (§3.2).
- AnimatePresence is unaffected by strict mode — confirmed via brief-2 source
  inspection (§3.3).
- `mode` omitted (default sync) for single-child modal presence (§3.4).
- CSS keyframes deleted first before motion wiring (§3.5).
- Dual reduced-motion check: `useReducedMotion()` OR `rs.reducedMotion` (§3.6).
- `lastEditingTodoRef` pattern for TodoList + SprintManager (§3.7).
- Focus restoration via rAF is compatible with the 180 ms exit window (§3.8).
- `key="modal"` on the AnimatePresence child (§3.9).
- Backdrop + panel animate as separate `m.div`s (§3.10).
- Initial-chunk impact verified via build (§3.11 — see Deviations §3 below).
- All 4 Modal variants get the animation (§3.12).

One minor import-path correction during implementation: synthesis listed
`resolvedSettings` as importable from `@/storage/settings`, but it actually
lives in `@/storage/constants` (confirmed via `grep -rn "export function
resolvedSettings" src/`). Fixed inline; no functional change.

---

## 3. Deviations from synthesis

**Initial chunk grew more than predicted.** Synthesis §1 and brief-2 §3.6 both
predicted the chunk would stay at ~235.57 kB because `AnimatePresence` would
tree-shake into the lazy modal chunks. The actual measurement: initial chunk
grew from 235.57 → 251.47 kB (+15.9 kB).

**Why:** Modal.tsx is consumed eagerly by `Gantt.tsx`, `ChartView.tsx`,
`SprintManager.tsx`, `RemindersManager.tsx`, and `ClosedTodosView.tsx` —
all of which import the (non-animated) `TextInputModal` or `ConfirmDialog`
variants for their own use. When `motion/react` imports were added at
Modal.tsx scope, the consumed code lands in whatever chunk Modal.tsx ends
up in — which is the initial chunk via these eager consumers, not the
lazy chunks. The motion-features deferred chunk shrank from 41.10 → 37.18 kB
as a side-effect (some code migrated forward).

**Acceptable per CLAUDE.md:** 251.47 kB is well under the 400 kB soft warn
and 500 kB hard ceiling. The synthesis §7 risk note anticipated this and
named a fallback (keep CSS keyframes + animate exit only); that fallback
is unnecessary at this bundle weight. Documenting the discrepancy here so
the next round of optimization (if needed) can target an "animated Modal
vs static Modal" split — extracting `Modal.tsx`'s animated path into a
separate file consumed only by lazy modal callers.

---

## 4. Build verification

```
✓ 2278 modules transformed.
dist/assets/motion-features-BxpLtkrC.js   37.18 kB │ gzip:  13.97 kB
dist/assets/SettingsModal-CchvHn7j.js     55.76 kB │ gzip:  17.20 kB
dist/assets/index.html-BGEH8LCZ.js       251.47 kB │ gzip:  81.13 kB
✓ built in 1.54s
```

Strict TS: zero errors. Working tree clean except the m7 notes dir.

---

## 5. Test deltas

None (m1 L5 carry-over).

---

## 6. Files changed

```
 src/components/Modal.tsx                            | +57/-23 (rewrite of portal return)
 src/components/Modal.css                            | +18/-26 (delete keyframes + suppression)
 src/sections/TodoList.tsx                           | +20/-9
 src/sections/sprint/SprintManager.tsx               | +16/-3
 .claude/agent-memory/milestone-researcher/lessons.md | +12 (Phase 1 lessons)
```

Total: 5 files, +123/-61 (commit reports +130/-54 net after Modal.css rewrites
balance out).

---

## 7. Subject-length compliance

Commit subject: `feat(motion): modal scale-in via AnimatePresence (m7-s13)`

- After `feat(motion): ` prefix (14 chars): `modal scale-in via AnimatePresence
  (m7-s13)` = **42 chars**. Under the 50-char CLAUDE.md cap.

(Note: `motion` scope still not in CLAUDE.md scopes list — same deferred
finding from m5 M1 / m4 M1. Bundled with the pending CLAUDE.md edit.)
