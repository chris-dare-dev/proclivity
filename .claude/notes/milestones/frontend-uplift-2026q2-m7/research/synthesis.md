# Research synthesis — frontend-uplift-2026q2-m7

**Milestone:** UPL-4 — modal scale-in via `motion`'s `<AnimatePresence>`
**Date:** 2026-05-20
**Author:** orchestrator (main session, Phase 1 fan-in)
**Sources:** brief-1.md (explore — Modal.tsx + CSS conflict + editingTodo guard analysis), brief-2.md (general — motion v12 API verification, strict-mode interaction with AnimatePresence, focus-trap APG verdict)

---

## 1. TL;DR for the implementer

Both researchers converge on the same architecture: **put `<AnimatePresence>` + `m.div` INSIDE `Modal.tsx`** (the shared base component), not at each call-site. Single-file change covers all 4 Modal variants (Modal, TextInputModal, ConfirmDialog directly + SettingsModal + TodoEditModal via delegation). Existing CSS keyframes in `Modal.css` MUST be deleted first to prevent double-animation on mount.

Five files touched:

1. **`src/components/Modal.tsx`** — wrap the portal's children in `<AnimatePresence>`; convert `.modal-backdrop` and `.modal-panel` to `m.div` with `initial`/`animate`/`exit` props; remove `if (!open) return null` (AnimatePresence handles presence now). Use `m.div` (NOT `motion.div`) per LazyMotion strict mode from m2. Use `useReducedMotion()` combined with the in-app `rs.reducedMotion` setting.

2. **`src/components/Modal.css`** — delete `@keyframes modal-fade-in` and `@keyframes modal-slide-in` + their references on `.modal-backdrop` / `.modal-panel`. Delete the `@media (prefers-reduced-motion: reduce)` and `[data-reduced-motion="true"]` blocks that suppressed those animations (now redundant — motion handles reduced-motion via `useReducedMotion()`).

3. **`src/components/TodoEditModal.tsx`** — no change to signature; the existing `todo: Todo` prop works because the parent ref-trick (see #4/5) keeps a non-null todo passing through during the exit window.

4. **`src/sections/TodoList.tsx`** — fix the `{editingTodo && <Suspense><TodoEditModal /></Suspense>}` pattern: when `editingId` flips null, `editingTodo` becomes `undefined` and the Suspense unmounts BEFORE AnimatePresence can play the exit animation. Use a `useRef<Todo | null>` to capture the last-seen editingTodo; pass it as the `todo` prop while `open={editingId !== null}` flows independently. The Suspense stays mounted for the exit window (and for the rest of the session, but that's fine — the lazy chunk is 3 KB and only loads on first open anyway).

5. **`src/sections/sprint/SprintManager.tsx`** — same fix as TodoList.tsx.

**Path decision:** `inline` — 5 files, ~80-120 LOC estimated. At the edge of the ≤5 files threshold but within the ≤300 LOC bound. Watch the file count.

**Expected chunk delta:** Initial chunk should stay at 235.57 kB (per brief-2 §3.6 — `AnimatePresence` lands in the per-modal lazy chunks via tree-shaking, not the initial chunk). SettingsModal lazy chunk grows ~3 KB; TodoEditModal lazy chunk grows ~3 KB.

---

## 2. Affected files (5)

| File | Change | Est. LOC |
|---|---|---|
| `src/components/Modal.tsx` | Add motion imports; wrap portal in `<AnimatePresence>`; convert two `<div>`s to `m.div` with anim props; remove early-return | ~40 |
| `src/components/Modal.css` | Delete 2 `@keyframes` blocks + their references + their reduced-motion guards | ~30 deletions |
| `src/components/TodoEditModal.tsx` | No signature change; verify `useMemo` reset still works when `todo` is stale during exit | ~0-5 |
| `src/sections/TodoList.tsx` | Add `lastEditingTodoRef`; change render gate to use `displayTodo = editingTodo ?? lastEditingTodoRef.current` | ~8 |
| `src/sections/sprint/SprintManager.tsx` | Same as TodoList.tsx for both consumer sites | ~8 |

Total: ~85 LOC (+ ~30 deletions). 5 files at the inline boundary.

---

## 3. Architecture decisions made during synthesis

### 3.1 `<AnimatePresence>` lives INSIDE `Modal.tsx`, not at call-sites

Both briefs converge here (brief-1 Gotcha 1, brief-2 Alternative 2 / Riskiest §4). Rationale:
- Modal.tsx is the shared portal owner — it makes architectural sense for it to own its own enter/exit lifecycle.
- Single-file change covers all 4 Modal variants (Modal, TextInputModal, ConfirmDialog, plus SettingsModal and TodoEditModal that delegate).
- Call-sites stay unchanged (they pass `open={...}` and the same children as today).

### 3.2 Use `m.div`, NOT `motion.div` (LazyMotion strict mode)

App.tsx wraps the tree in `<LazyMotion features={loadDomAnimation} strict>` (m2). React context flows through portals, so `m.div` inside `createPortal(..., document.body)` correctly receives the LazyMotion context despite being outside the LazyMotion DOM subtree. Brief-1 §Gotcha 2 + brief-2 §3.2 both confirm.

### 3.3 `<AnimatePresence>` is unaffected by LazyMotion strict mode

Brief-2 §3.2 verified by source inspection: `useStrictMode()` is only called inside `createMotionComponent` (the `motion.div` / `m.div` path), not inside `AnimatePresence`. AnimatePresence is a plain React component with no `LazyContext` dependency. Import works as `import { AnimatePresence } from "motion/react"`.

### 3.4 `mode` is omitted (default `mode="sync"`)

Brief-1 §Gotcha 6 + brief-2 §3.1: `mode="wait"` waits for the exiting child to finish before animating the entering one. For modals (single-child conditional render), no overlapping enter/exit is possible — default `sync` mode is correct. Brief-1 specifically recommends omitting `mode` entirely.

### 3.5 Existing CSS keyframes MUST be deleted from `Modal.css` first

Brief-1 §Gotcha 4 + brief-2 §3.5 + critical pre-work in both TL;DRs: `Modal.css` currently animates `.modal-backdrop` via `@keyframes modal-fade-in 120ms ease` and `.modal-panel` via `@keyframes modal-slide-in 150ms ease`. These will fight the new motion-driven animations on mount (entry). Delete both `@keyframes` blocks, the `animation:` property declarations, and the redundant `@media (prefers-reduced-motion: reduce)` + `[data-reduced-motion="true"]` blocks that suppressed them.

### 3.6 Dual reduced-motion check: OS + in-app

Brief-2 §6.3: the app has both signals — OS-level via `useReducedMotion()` (motion's hook), and in-app via `rs.reducedMotion` (from `useStore()` + `resolvedSettings()`). The implementer should honor BOTH:
```tsx
const osReduced = useReducedMotion();
const { state } = useStore();
const rs = useMemo(() => resolvedSettings(state.settings), [state.settings]);
const shouldReduceMotion = osReduced || rs.reducedMotion;
const transition = { duration: shouldReduceMotion ? 0 : 0.18, ease: "easeOut" };
```

### 3.7 The `editingTodo &&` outer guard breaks exit animations — fix via `useRef`

Brief-1 §Gotcha 3 + brief-2 §4: `TodoList.tsx:268` and `SprintManager.tsx:1281` use `{editingTodo && <Suspense><TodoEditModal />}` outer guards. When `setEditingId(null)` is called, `editingTodo` derives to `undefined`, the Suspense unmounts immediately, and `<TodoEditModal>` + its internal `<Modal>` + the `<AnimatePresence>` are all destroyed before the exit animation can play.

**Fix (synthesis recommendation):** `useRef<Todo | null>` to hold the last-seen editingTodo. When `editingTodo` is truthy, update the ref. When rendering, gate on `displayTodo = editingTodo ?? lastEditingTodoRef.current`. The Suspense stays mounted from first open onward (preserves lazy chunk load on first open), and `open={editingId !== null}` flows the animation lifecycle into Modal's internal AnimatePresence.

```tsx
const lastEditingTodoRef = useRef<Todo | null>(null);
useEffect(() => {
  if (editingTodo) lastEditingTodoRef.current = editingTodo;
}, [editingTodo]);
const displayTodo = editingTodo ?? lastEditingTodoRef.current;

{displayTodo && (
  <Suspense fallback={null}>
    <TodoEditModal
      open={editingId !== null}
      todo={displayTodo}
      ...
    />
  </Suspense>
)}
```

After first open, Suspense stays mounted forever (in the session). TodoEditModal renders with `open=false` when not editing — AnimatePresence inside Modal sees no animated children → nothing in DOM → cheap. The stale `todo` is harmless when `open=false` because the children aren't displayed.

### 3.8 Focus restoration timing is compatible with the 180 ms exit delay

Brief-1 §Gotcha 5 + brief-2 §3.4: `Modal.tsx:38-49` restores focus via `requestAnimationFrame` when `open` flips false. The rAF fires ~16 ms after the close, restoring focus to the trigger element. AnimatePresence holds the DOM for ~180 ms during exit. Net: focus is on the trigger while the modal visually fades out — exactly what screen readers expect (focus follows the trigger, not visual presence). This is the accepted 2026 pattern (Linear, Radix UI, Headless UI).

### 3.9 `mode` and `key` on `<AnimatePresence>`

Brief-2 §3.1 + brief-1 §Gotcha 1: provide a stable `key` prop on the animated child (`key="modal"` is sufficient — the modal is the single tracked child). `mode` omitted (default `sync`).

### 3.10 Backdrop and panel both animate (separate `m.div`s)

Brief-2 §3.5 (2026 SOTA: Linear/Notion/Stripe pattern):
- Backdrop: opacity 0→1, 120 ms ease-out.
- Panel: opacity 0→1 + scale 0.96→1, 180 ms ease-out.
- Exit: reverse both.

### 3.11 Initial-chunk concern (brief-1 §Gotcha 7 open question)

Brief-1 was uncertain whether AnimatePresence would land in the initial chunk. Brief-2 §3.6 verified by inspecting the build: AnimatePresence is tree-shaken into the per-modal lazy chunks (SettingsModal, TodoEditModal each grow ~3 KB). The initial newtab chunk stays at 235.57 kB. Implementer should verify post-build that initial chunk hasn't grown.

### 3.12 Scope: all 4 Modal variants get the animation

Brief-1 §OQ3 + brief-2 §OQ4: putting AnimatePresence inside Modal.tsx automatically covers TextInputModal and ConfirmDialog (both delegate to Modal). This is desired — uniform modal motion across the app reads better than partial coverage. ConfirmDialog inside SettingsModal (nested) is also covered; both portals to `document.body`, no z-index conflict per Modal.css's z-index layering.

---

## 4. external_writes_required

```yaml
external_writes_required:
  - "git push origin main"
```

---

## 5. Implementation strategy (inline path)

1. **Modal.css cleanup FIRST** — delete `@keyframes modal-fade-in`, `@keyframes modal-slide-in`, the `animation:` declarations on `.modal-backdrop` and `.modal-panel`, and the redundant reduced-motion suppression blocks. Build to confirm clean removal.

2. **Modal.tsx motion wiring** — add imports (`m`, `AnimatePresence`, `useReducedMotion` from `motion/react`; `useStore` + `resolvedSettings` from `@/storage/useStore` + `@/types`); compute `shouldReduceMotion` from both signals; restructure the portal return to wrap the conditional `{open && <m.div backdrop>...<m.div panel>...</m.div></m.div>}` in `<AnimatePresence>`; remove the `if (!open) return null` early exit. Build.

3. **TodoList.tsx + SprintManager.tsx editingTodo ref fix** — add `lastEditingTodoRef: useRef<Todo | null>(null)`, `useEffect` to update on `editingTodo` change, derive `displayTodo`, change the render gate to `{displayTodo && <Suspense>...</Suspense>}`. Two near-identical edits across two files.

4. **Verify TodoEditModal** — its existing `useMemo([open, todo.id])` reset logic should still work because `todo.id` only changes when the user opens a new item (not during the close exit window). The stale `todo` during exit is never displayed (modal content is in the `exit` animation). No code change expected.

5. **`npm run build` final verify** — initial chunk stays ≤ 240 kB (target 235.57); SettingsModal lazy chunk +~3 KB; TodoEditModal lazy chunk +~3 KB; motion-features chunk unchanged.

6. Single commit (`feat(motion): modal scale-in via AnimatePresence (m7-s13)` or similar — verify subject ≤ 50 chars after the prefix).

Commit subject calculation: `feat(motion): modal scale-in via AnimatePresence (m7-s13)` = 47 chars after `feat(motion): `. Under cap. ✓

---

## 6. Implementation acceptance criteria

1. **Modal.tsx** uses `<AnimatePresence>` wrapping `m.div` backdrop + `m.div` panel. `m.div` (NOT `motion.div`).
2. **Backdrop animation:** `initial={{ opacity: 0 }}`, `animate={{ opacity: 1 }}`, `exit={{ opacity: 0 }}`, transition duration matches the panel (0.18 s on enter and exit; 0 under reduced-motion).
3. **Panel animation:** `initial={{ opacity: 0, scale: 0.96 }}`, `animate={{ opacity: 1, scale: 1 }}`, `exit={{ opacity: 0, scale: 0.96 }}`, `transition={{ duration: 0.18, ease: "easeOut" }}` (0 under reduced-motion).
4. **`useReducedMotion()` AND in-app `rs.reducedMotion`** both consulted; either-or collapses to instant.
5. **`Modal.css`**: `@keyframes modal-fade-in` and `@keyframes modal-slide-in` deleted; `animation:` declarations on `.modal-backdrop` and `.modal-panel` removed; reduced-motion CSS suppression blocks for those animations removed.
6. **`TodoList.tsx` and `SprintManager.tsx`**: render gate uses `lastEditingTodoRef`-derived `displayTodo`, so the Suspense stays mounted during the exit animation window.
7. **No new npm dependency** — reuses motion@12.39.0 already installed.
8. **`npm run build`** passes, strict TS zero errors. Initial chunk ≤ 240 kB. Per-modal lazy chunks +~3 KB each (SettingsModal, TodoEditModal).
9. **Manual smoke** in dev:
   - Opening Settings shows fade-in + scale-up (~180 ms).
   - Closing Settings shows fade-out + scale-down (~180 ms).
   - Same for TodoEditModal (pencil-edit a todo, close).
   - Under DevTools forced reduced-motion (or in-app reduced-motion toggle), modals snap open/close (no animation).
   - Focus is on the trigger button after close (within ~16 ms of `open=false`).
   - Backdrop click closes the modal with exit animation playing.
   - Escape closes with exit animation playing.
   - Nested ConfirmDialog (discard-unsaved-changes in SettingsModal) also animates.
   - Rapid open/close (5 clicks in 500 ms) doesn't accumulate ghosted modals.

---

## 7. Riskiest assumption + alternative

**Risk:** Brief-1 §Gotcha 7 — uncertainty about whether AnimatePresence lands in the initial chunk. Brief-2 §3.6 verified it tree-shakes into lazy chunks, but Vite/Rollup chunking can be surprising. If `npm run build` shows initial chunk > 240 kB after this change, fall back to:

**Mitigation:** keep the existing CSS keyframes in Modal.css and animate ONLY the exit direction via AnimatePresence. The enter animation runs from CSS (zero JS cost); the exit uses motion's `exit` prop. Less clean but bundle-safe.

**Alternative (heavier — not recommended for v0):** View Transitions API (`document.startViewTransition`) for modal mount/unmount. Native, zero new bundle, but requires `flushSync` + feature-detection wrapper. Park as future v1 if AnimatePresence proves problematic.

---

## 8. Open questions for the implementer (≤5)

1. **TodoEditModal `useMemo` reset behavior with ref-trick** — the existing reset useMemo uses `[open, todo.id]`. During the exit animation, `open=false` and `todo.id` is stale (last seen). The useMemo's `if (open)` short-circuit means no state reset happens — correct. Verify by reading the TodoEditModal logic and confirming no other useEffect runs during exit.

2. **`Modal.css` deletion scope** — confirm by `grep -n "modal-fade-in\|modal-slide-in" src/` returns only Modal.css occurrences before deleting (no stray references in other CSS files). Synthesis assumes confined to Modal.css only.

3. **AnimatePresence + nested ConfirmDialog z-index** — when SettingsModal is open AND ConfirmDialog opens on top, both render `<m.div backdrop>` portaled to `document.body`. Modal.css's z-index for `.modal-backdrop` (1000+ today) handles stacking. Verify no animation-driven z-index conflict.

4. **`Tab` key during exit window** — the closing modal still exists in DOM for ~180 ms. The `useFocusTrap` hook is still wired. If a user tabs during the exit window, focus stays trapped in the closing modal. Defensive: add `inert` to the panel when `open=false` (same pattern as m4-s11), OR rely on the rAF focus restoration. Brief-2 §3.4 says rAF restoration is sufficient at 2026 SOTA. Implementer's call — recommend trusting rAF.

5. **Visual quality at 60fps** — `scale 0.96 → 1` over 180 ms is a 4% scale change. Verify it's visible enough to feel like a deliberate "appear" gesture rather than a no-op. The 2026 SOTA (Linear, Stripe, Notion) uses 95-97% scale start; 0.96 is in the sweet spot.

---

## 9. Scope assessment

- **Path:** inline (5 files at the boundary, ~85 LOC)
- **Estimated LOC:** 80-120 (incl. deletions in Modal.css)
- **Worktree:** NO
- **`--allow-large-diff`:** NO
- **Novel architecture:** NO — single-component motion wrap, established React patterns
