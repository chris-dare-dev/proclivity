---
milestone_id: "frontend-uplift-2026q2-m7"
researcher: "explore"
agent_type: "codebase-context"
external_writes_required:
  - "git push origin main"
sources: []
injection_attempts: 0
---

# Explore Research Brief — frontend-uplift-2026q2-m7

## 1. TL;DR

- `Modal.tsx` owns the entire modal scaffold (`modal-backdrop` + `modal-panel`) via `createPortal` to `document.body`. Both `SettingsModal` and `TodoEditModal` delegate entirely to `Modal` — neither component has its own root `<div>` to convert. The animation target is the `Modal.tsx` base component itself (or a thin wrapper around its portal output).
- `Modal.tsx:64` returns `null` when `open` is false, so the conditional-render gate is *inside* Modal, not at the caller. `AnimatePresence` must be placed either (a) inside `Modal.tsx` wrapping its `createPortal` output, or (b) at every call-site — but since Modal already owns the gate, placing `AnimatePresence` inside `Modal.tsx` is the correct single-site approach.
- `Modal.css` already has two conflicting CSS entry animations (`modal-fade-in` on `.modal-backdrop` and `modal-slide-in` on `.modal-panel`). These must be removed/disabled once motion-driven animation is added to avoid double-animating.
- `motion/react` at v12.39.0 is actually a thin re-export of `framer-motion`. `AnimatePresence`, `m`, and `useReducedMotion` are all confirmed present in the export surface.
- `LazyMotion strict` is in force at `App.tsx:446`. **Implementer must use `m.div`, not `motion.div`**, and must import `m` from `"motion/react"`. However — the modals render via `createPortal` to `document.body`, which is *outside* the `<LazyMotion>` subtree in the React tree. This is the critical gotcha: `m.*` components need to be a descendant of `<LazyMotion>` to receive the lazy feature pack. The portal DOM position is irrelevant; it's the React tree ancestry that matters.

---

## 2. File inventory

### `src/components/Modal.tsx` — the animation target (lines 1–90)

This is the shared base component used by both `SettingsModal` and `TodoEditModal`. It owns:

- **Backdrop**: `<div className="modal-backdrop">` — `line 67`, a `createPortal` call. The backdrop is NOT a separate sibling component; it is the portal root with backdrop styling.
- **Panel**: `<div className="modal-panel" ref={panelRef} role="dialog">` — `line 76`. This is the modal card that needs the scale-in animation.
- **Conditional-render gate**: `line 64` — `if (!open) return null;`. The entire modal (backdrop + panel) is unmounted when `open` is false. `AnimatePresence` must wrap the return value at this level to catch the unmount.
- **Focus-trap**: `useFocusTrap(panelRef)` at `line 35` + `useEffect` at `lines 38–49` that saves `document.activeElement` on open and restores it via `requestAnimationFrame` on close.
- **Focus restoration**: `line 44` — `requestAnimationFrame(() => previousFocusRef.current?.focus())` fires on the `else` branch (when `open` changes to false). This fires IMMEDIATELY when `open` flips to false, BEFORE `AnimatePresence` delays the DOM unmount. Because `rAF` is deferred one frame anyway, and `AnimatePresence` holds the DOM for 180 ms, focus restoration fires into a modal that is still visible but already logically "closed". This is an interaction to flag.
- **Escape handler**: `line 52–62`. The `onKeyDown` is on the backdrop div; it calls `onClose()` which changes the `open` prop. The `<AnimatePresence>` delay means Escape → `onClose()` → `open=false` → exit animation plays → then modal unmounts. During that 180 ms window, `onKeyDown` is still active (element still in DOM). A second Escape press during the exit animation would call `onClose()` again (idempotent — already false, no harm).
- **Portal target**: `document.body` — exits the React component tree rooted in `<LazyMotion>`.

### `src/components/settings/SettingsModal.tsx` — SettingsModal (lines 547–594)

- Renders `<Modal open={open} onClose={handleRequestClose} ...>` — delegates fully to Modal. No root `<div>` of its own to animate.
- Lazy-loaded at `src/newtab/App.tsx:77–79`.
- Conditional-render at `App.tsx:261–273`: `<Suspense fallback={null}><SettingsModal open={settingsOpen} ... /></Suspense>`. `SettingsModal` is ALWAYS mounted (not gated by `settingsOpen`) — it's always rendered in the Suspense tree. The `open` prop flows into `Modal.tsx`'s `if (!open) return null` gate.

### `src/components/TodoEditModal.tsx` — TodoEditModal (lines 97–197)

- Renders `<Modal open={open} onClose={onClose} ...>` — delegates fully to Modal. No root `<div>` of its own.
- Lazy-loaded in two places:
  - `src/sections/TodoList.tsx:28–29` — conditional mount: `{editingTodo && <Suspense><TodoEditModal open={editingId !== null} .../></Suspense>}` (`line 268–279`). Note: `editingTodo` gates the Suspense mount, but `open` is `editingId !== null` — so when `editingTodo` is truthy and `editingId` is not null, modal is open. When `setEditingId(null)` is called, `editingTodo` becomes null, so the entire Suspense unmounts before AnimatePresence can play the exit animation. This pattern will BREAK exit animations.
  - `src/sections/sprint/SprintManager.tsx:1281–1292` — same pattern: `{editingTodo && <Suspense><TodoEditModal .../></Suspense>}`.
- The `editingTodo && (...)` guard is the key incompatibility: it gates the Suspense at the same level as the `open` prop, so setting `editingId = null` destroys `editingTodo`, which destroys the Suspense wrapper BEFORE the exit animation can play.

### `src/components/Modal.css` — existing animations (lines 1–109)

- `line 10–11`: `.modal-backdrop` has `animation: modal-fade-in 120ms ease;` — CSS keyframe entry animation.
- `line 13–16`: `@keyframes modal-fade-in` — `opacity: 0 → 1`.
- `line 28–29`: `.modal-panel` has `animation: modal-slide-in 150ms ease;` — CSS keyframe entry animation.
- `line 31–34`: `@keyframes modal-slide-in` — `translateY(-8px) opacity:0 → translateY(0) opacity:1`.
- `line 100–105`: `@media (prefers-reduced-motion: reduce)` block suppresses both animations.
- `line 106–109`: `[data-reduced-motion="true"] .modal-backdrop, [data-reduced-motion="true"] .modal-panel { animation: none }` — per-site reduced-motion guard.
- **Conflict**: these CSS entry animations will fight the new motion-driven animations. The `modal-slide-in` (translateY) on `.modal-panel` directly conflicts with the new scale+opacity motion. Both must be removed from `Modal.css` once motion takes over. The `modal-fade-in` on `.modal-backdrop` also conflicts with the motion animation on the backdrop.
- No exit animations exist in CSS (CSS animations cannot target unmounting elements). The new `motion` exit animation is purely additive for the exit direction.

### `src/newtab/App.tsx` — LazyMotion provider (lines 446, 261–273)

- `line 446`: `<LazyMotion features={loadDomAnimation} strict>` wraps the entire App subtree.
- SettingsModal is rendered inside `<Header>` (a `memo` component), inside `<LazyMotion>`. The portal call `createPortal(..., document.body)` moves DOM nodes outside the `<LazyMotion>` DOM subtree, BUT React's context tree remains intact — the portal's React component tree is still a child of `<LazyMotion>`. Context flows through React tree, not DOM tree. So `m.*` components inside the portal WILL receive the LazyMotion context correctly.
- `line 30–31`: `loadDomAnimation` is a dynamic import of `./motion-features` which re-exports `domAnimation`. This is the deferred features pack; `m.*` components block rendering until it resolves.
- `AnimatePresence` is NOT in the current initial chunk (`index.html-Ds1uA0W6.js`, 235,518 bytes raw). Importing it from `"motion/react"` in `Modal.tsx` or in `App.tsx` will add it to one of the existing chunks.

### `src/newtab/motion-features.ts`

- Re-exports `domAnimation as default` from `"motion/react"`. This causes `motion-features-CiP6e9VI.js` (41,102 bytes raw) to be the deferred features chunk.

### `src/hooks/useFocusTrap.ts` — focus-trap implementation (lines 1–52)

- Pure keyboard trap; returns `onKeyDown` handler. Runs on every keydown — no mount/unmount side effect. Compatible with AnimatePresence delay.

---

## 3. Implementation notes / gotchas

### Gotcha 1: `AnimatePresence` placement is inside `Modal.tsx`, not at callers

Because `Modal.tsx:64` contains the `if (!open) return null` gate, and because both consumers delegate fully to `Modal`, the correct approach is to move the gate inside `AnimatePresence` within `Modal.tsx` itself:

```tsx
// Modal.tsx — after import { m, AnimatePresence, useReducedMotion } from "motion/react"
export function Modal(...) {
  const reducedMotion = useReducedMotion();
  const duration = reducedMotion ? 0 : 0.18;
  return createPortal(
    <AnimatePresence>
      {open && (
        <m.div
          key="modal-backdrop"
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration }}
          onMouseDown={...}
          onKeyDown={handleKeyDown}
        >
          <m.div
            className="modal-panel ..."
            ref={panelRef}
            role="dialog"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration, ease: "easeOut" }}
          >
            ...
          </m.div>
        </m.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
```

This single change covers ALL modal variants (SettingsModal, TodoEditModal, TextInputModal, ConfirmDialog) simultaneously — no need to touch callers. The `key="modal-backdrop"` prop is required for `AnimatePresence` to track entry/exit.

### Gotcha 2: `m.div` (NOT `motion.div`) — LazyMotion strict mode

`App.tsx:446` uses `<LazyMotion ... strict>`. In strict mode, using `motion.div` will throw a runtime error (or at minimum, bypass the lazy feature pack). Implementer must use `m.div` imported as `import { m, AnimatePresence, useReducedMotion } from "motion/react"`.

React context propagates through portals, so the `m.div` inside `createPortal` WILL receive the LazyMotion context despite the DOM node being outside `<LazyMotion>`'s DOM subtree. This is confirmed React behavior: portals participate in context inheritance.

### Gotcha 3: `TodoEditModal` callers use `editingTodo &&` guard — breaks exit animation

Both `TodoList.tsx:268` and `SprintManager.tsx:1281` gate the `<Suspense><TodoEditModal /></Suspense>` block with `{editingTodo && ...}`. When `setEditingId(null)` is called, `editingTodo` becomes `null` and the entire Suspense block unmounts immediately — the `open` prop never flows `false` to Modal while `AnimatePresence` still holds the DOM.

The fix: keep the Suspense block always-mounted (or held mounted for the exit window), and rely solely on `open={editingId !== null}` for the animation gate. The simplest approach: remove the `editingTodo &&` outer guard and pass `todo={editingTodo ?? dummyTodo}` to satisfy the non-null type, with the `open` prop doing the animation gating. Alternatively, use a `useRef` to keep the last-seen `editingTodo` alive during the close animation window.

This is a REQUIRED fix for exit animations on TodoEditModal.

### Gotcha 4: CSS keyframe conflicts in `Modal.css`

Both `@keyframes modal-fade-in` (on backdrop) and `@keyframes modal-slide-in` (on panel) run CSS entry animations. These will double-animate with the new motion-driven animations. Remove or neutralize these `animation:` declarations from `.modal-backdrop` and `.modal-panel` in `Modal.css`. The `@keyframes` blocks can be deleted. The `@media (prefers-reduced-motion)` and `[data-reduced-motion]` suppression blocks can also be removed since motion's `useReducedMotion()` handles this now.

### Gotcha 5: Focus restoration timing with AnimatePresence delay

`Modal.tsx:38–49`: on `open → false`, a `requestAnimationFrame` fires to restore focus to `previousFocusRef.current`. With `AnimatePresence` holding the DOM for 180 ms (the exit animation duration), focus-restoration fires ~1 frame after `open` goes false — so the previous trigger element gets focus while the modal is still visually present (but logically closed). This is functionally acceptable: the trigger button receives focus and the closing modal fades out. Screen-readers will see `aria-modal: true` on a dialog that's still in DOM but the dialog's `open` prop is now `false`, meaning keyboard focus has left it. This is marginally suboptimal for screen-readers but acceptable at 180 ms — the dialog disappears before the user has time to interact with it again.

Mitigation if needed: move the focus-restoration `rAF` to fire after the exit animation completes (use `onAnimationComplete` callback on the exit). This is an optional enhancement, not a blocker.

### Gotcha 6: `AnimatePresence mode` — `mode="wait"` is not appropriate here

`mode="wait"` waits for the exiting element to finish before animating in the entering element. For a single modal (open or closed), `mode="wait"` adds unnecessary delay when re-opening quickly. Default mode (no `mode` prop, or `mode="sync"`) is correct for single-item presence animation.

### Gotcha 7: `AnimatePresence` will enter the initial newtab chunk

`AnimatePresence` imported at `Modal.tsx` scope (or from anywhere that's not lazy-loaded) will land in a shared chunk or the initial newtab chunk. Current initial chunk: 235,518 bytes raw. AnimatePresence source tree is ~24 KB unminified (~7–8 KB minified, ~3–4 KB gzipped). This will cause the initial chunk to grow. The `AnimatePresence` component CANNOT be lazy-imported inside a lazy modal — the parent needs to hold `AnimatePresence` in its tree to catch exit animations (exit animation happens after the child starts unmounting). Since `Modal.tsx` is shared by both lazy and eager consumers (TextInputModal, ConfirmDialog may be invoked from eager code), `AnimatePresence` will end up in the shared vendor chunk or the initial chunk.

The brief's constraint says "initial newtab chunk ≤ 240 kB" — at 235.5 KB raw currently, adding ~7–8 KB minified AnimatePresence will push it to ~243 KB, possibly violating the constraint. The implementer should run `npm run build` and verify actual numbers. If over budget, `AnimatePresence` can be imported inside a wrapper that's lazy-loaded — but that breaks exit animations for any eagerly-rendered modal. The real mitigation is that `AnimatePresence` may already be part of `motion/react`'s base bundle (which is always loaded eagerly for `LazyMotion`), not an additional cost. This needs to be verified by the implementer post-build.

---

## 4. Open questions for the implementer

1. **`AnimatePresence` initial-chunk impact**: After adding `import { m, AnimatePresence, useReducedMotion } from "motion/react"` to `Modal.tsx`, does `npm run build` show the initial `index.html-*.js` chunk growing, or does Vite/Rollup see `AnimatePresence` as already part of the eagerly-loaded `motion/react` core? Run `npm run build` and compare chunk sizes before and after. The 240 kB initial-chunk ceiling may be at risk.

2. **`TodoEditModal` caller fix — preferred pattern**: The `editingTodo &&` guard must be resolved to allow exit animations. The recommended approach: in `TodoList.tsx` and `SprintManager.tsx`, change the guard to use a `lastEditingTodoRef` (always-updated ref) as the `todo` prop, removing the `editingTodo &&` outer conditional. However, this requires `TodoEditModal` to handle a `todo` that might be null when `open=false`. An alternative: always keep the Suspense block mounted but gate on `editingTodo !== null` only for the `open` prop. The implementer should choose one pattern and apply it consistently.

3. **`TextInputModal` and `ConfirmDialog` scope**: The brief specifies only SettingsModal and TodoEditModal. `TextInputModal` and `ConfirmDialog` both use `Modal.tsx` as their base. If `AnimatePresence` is added to `Modal.tsx`, ALL modals get the animation. Is this desired? The brief says to convert the `modal root <div>` — but since both target modals delegate to `Modal.tsx`, the implementation naturally covers all four Modal variants. Confirm scope: apply animation to `Modal.tsx` base (covering all four), or add a prop to opt-in only for SettingsModal and TodoEditModal.

4. **`ConfirmDialog` nested inside `SettingsModal`**: `SettingsModal.tsx:581–591` renders `<ConfirmDialog open={showDiscardDialog} .../>`. If both `SettingsModal` and `ConfirmDialog` use `AnimatePresence` via the shared `Modal.tsx` base, the discard dialog will also animate. This is probably desirable but needs explicit verification that nested modals (both portaled to `document.body`) don't produce z-index or focus-trap conflicts during concurrent animations.

5. **`[data-reduced-motion]` vs `useReducedMotion()` overlap**: `Modal.css:106–109` already has `[data-reduced-motion="true"] .modal-backdrop, .modal-panel { animation: none }`. Once the CSS entry animations are removed (Gotcha 4), this selector becomes a no-op. Confirm this block can be deleted. The per-site reduced-motion is now fully handled by `useReducedMotion()` inside the motion components.

---

## 5. External writes required

```yaml
external_writes_required:
  - "git push origin main"
```

No new npm dependencies. All required APIs (`m`, `AnimatePresence`, `useReducedMotion`) are present in `motion@12.39.0` (already installed). No CWS publish. No server-side changes.
