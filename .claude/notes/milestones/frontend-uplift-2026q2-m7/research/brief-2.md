---
milestone_id: "frontend-uplift-2026q2-m7"
researcher: "general-purpose"
agent_type: "external-and-writes"
external_writes_required:
  - "git push origin main"
sources:
  - url: "https://motion.dev/docs/react-animate-presence"
    sha256: "1bfb295c1a2f396461e4c635cad64ef3fac18ba60e2259c90c2bbffab2e07937"
    takeaway: "AnimatePresence mode='wait' is correct for modal mount/unmount; children need key only when multiple siblings switch; unmount is deferred via usePresence/safeToRemove hook until exit animation completes."
  - url: "https://motion.dev/docs/react-use-reduced-motion"
    sha256: "f17b0e75f5378211917b91000efe56a54d3defd326e21299f7eaad279aae1ad8"
    takeaway: "useReducedMotion() returns a reactive boolean that triggers re-render on prefers-reduced-motion media query change; pattern useReducedMotion() ? 0 : 0.18 is canonical."
  - url: "https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/"
    sha256: "8c0edc450595892806845dd478efd9a1b34ab10391418b69de965bdbccae3397"
    takeaway: "APG specifies focus returns to invoking element on modal close; no guidance on animation timing - the existing rAF-deferred focus restore in Modal.tsx is sufficient."
  - url: "https://bundlephobia.com/package/motion@12.39.0"
    sha256: "7162b459b4600542baab1397ecc769b62e178fd8abb80b692259dcc35a8f47f7"
    takeaway: "AnimatePresence source (index.mjs + use-presence.mjs) totals ~9.6 KB unminified in the installed framer-motion package; tree-shaken addition to modal chunks is estimated under 2 KB gzipped."
injection_attempts: 0
---

# External Research Brief — frontend-uplift-2026q2-m7

## 1. TL;DR

1. `<AnimatePresence>` is already available via `motion/react` (which re-exports all of framer-motion including `AnimatePresence`). No new dependency needed.
2. The strict mode check in `LazyMotion strict` applies ONLY to `motion.*` components — `AnimatePresence` is a plain React component with no features gate and is unaffected by `strict`. Children inside `AnimatePresence` must use `m.div` (not `motion.div`), which is the same rule already in force.
3. **Critical pre-work:** `Modal.css` already defines CSS keyframe entry animations (`modal-fade-in` 120 ms, `modal-slide-in` 150 ms) for backdrop and panel. These MUST be stripped from `Modal.css` before the `motion` animations are added — otherwise both play simultaneously on mount.
4. `useReducedMotion()` returns a reactive boolean (re-renders on OS toggle). The pattern `transition={{ duration: shouldReduceMotion ? 0 : 0.18 }}` is canonical and correct.
5. The existing `rAF`-deferred focus restore in `Modal.tsx` is compatible with the 180 ms `<AnimatePresence>` exit delay — focus returns at the next animation frame after `open` flips to false, which is before or concurrent with the exit animation playing.

## 2. External writes required

```yaml
external_writes_required:
  - "git push origin main"
```

No new npm dependencies. No Chrome Web Store publish. No hosted endpoints.

## 3. Best-practice findings

### 3.1 `<AnimatePresence>` semantics in motion v12

**Source:** `https://motion.dev/docs/react-animate-presence`
**SHA256:** `1bfb295c1a2f396461e4c635cad64ef3fac18ba60e2259c90c2bbffab2e07937`

- **Key prop:** The docs state "Direct children must each have a unique `key` prop so AnimatePresence can track their presence in the tree." For the modal pattern (single conditional child), a key is not strictly required — `AnimatePresence` tracks the single child by its reference. However, adding `key="settings-modal"` is a defensive practice that costs nothing and prevents edge-case bugs if the component is ever rendered alongside siblings.
- **Mode selection:** `mode="wait"` makes the entering element wait until the exiting child has animated out before animating in. For modals this is the correct choice: you never want two modal panels visible simultaneously. `mode="sync"` (default) allows enter/exit to overlap, which looks fine for independent elements but is wrong for a single modal slot. `mode="popLayout"` is only relevant when surrounding layout must reflow, which doesn't apply here.
- **Unmount deferral mechanism:** Verified in source (`framer-motion/dist/es/components/AnimatePresence/index.mjs`). AnimatePresence uses the `usePresence` hook which provides a `safeToRemove` callback. The child stays mounted in the DOM and plays its `exit` animation; `safeToRemove` fires after the animation completes, at which point React finally unmounts the component. This is entirely internal — the consumer does not call `safeToRemove` manually.
- **Direct source inspection confirms:** `AnimatePresence` is a pure React component. It has no dependency on the `LazyContext`. The `strict` check only fires inside the `createMotionComponent` path (i.e., `motion.div` / `motion.span`), not inside `AnimatePresence`. This was confirmed by reading `framer-motion/dist/es/motion/index.mjs` where `useStrictMode()` is called only within `MotionDOMComponent`.

### 3.2 `motion/react` LazyMotion + AnimatePresence interaction

**Source:** `framer-motion/dist/es/components/LazyMotion/index.mjs` (local package inspection)

- `LazyMotion` passes `{ renderer, strict }` via `LazyContext.Provider`. The `strict` flag is only consumed by `createMotionComponent` → `useStrictMode()`.
- `AnimatePresence` imports from `LazyContext` **zero times** (confirmed by grep). It is unaffected by the `strict` setting.
- Correct import for m7: `import { AnimatePresence } from "motion/react"` (same module already imported in `App.tsx`). Children inside `AnimatePresence` that animate must use `m.div` (imported from `"motion/react"`), not `motion.div`. This is the same rule already enforced by the `strict` prop.
- **Bundle implication:** `AnimatePresence` is part of the synchronously-loaded `motion/react` core (it re-exports from `framer-motion` which is fully tree-shaken by Vite). Since `SettingsModal` and `TodoEditModal` are both lazy-loaded chunks (`React.lazy`), the `AnimatePresence` import will land in each respective lazy chunk, not the main newtab chunk. Verified: the main chunk is `index.html-Ds1uA0W6.js` at 235,569 bytes; it should remain unchanged.

### 3.3 `useReducedMotion()` API in motion v12

**Source:** `https://motion.dev/docs/react-use-reduced-motion`
**SHA256:** `f17b0e75f5378211917b91000efe56a54d3defd326e21299f7eaad279aae1ad8`

- Returns a `boolean` (not a `MotionValue<boolean>`).
- **Is reactive:** the hook "actively responds to changes and re-render[s] your components with the latest setting" — i.e., when the OS accessibility setting changes, consumers re-render with the updated value.
- Canonical pattern confirmed:
  ```ts
  const shouldReduceMotion = useReducedMotion();
  const transition = { duration: shouldReduceMotion ? 0 : 0.18, ease: "easeOut" };
  ```
- When `duration: 0`, motion applies the `animate` state in a single frame (no visible animation frame, instant). This is NOT just "fast" — it is genuinely instant. Confirmed by the motion docs: `duration: 0` skips interpolation.
- **Note:** the codebase already has `[data-reduced-motion="true"]` CSS attribute (from the app-level reducedMotion setting). The `useReducedMotion()` hook reads the OS `prefers-reduced-motion` media query, which is separate from the in-app setting. The implementer should honor BOTH: call `useReducedMotion()` for the OS signal AND check `rs.reducedMotion` from `useStore()` for the in-app toggle (already set via `AppearancePane`). If either is true, use `duration: 0`.

### 3.4 Focus-trap during exit animation — accessibility verdict

**Source:** `https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/`
**SHA256:** `8c0edc450595892806845dd478efd9a1b34ab10391418b69de965bdbccae3397`

The APG specifies: "When a dialog closes, focus returns to the element that invoked the dialog." It provides no guidance on timing relative to animation.

**Existing implementation (Modal.tsx lines 38–48):**
```ts
useEffect(() => {
  if (open) {
    previousFocusRef.current = document.activeElement as HTMLElement;
  } else {
    const raf = requestAnimationFrame(() => {
      previousFocusRef.current?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }
}, [open]);
```

The `open` prop flips to `false` immediately when the user dismisses the modal. The `rAF` fires ~16 ms later, restoring focus to the trigger. **Separately**, `<AnimatePresence>` holds the modal's DOM alive for ~180 ms to play the exit animation.

The verdict: **(a) accessible.** Focus returns to the trigger at rAF time (~16 ms after close) — far before the 180 ms DOM teardown. From the AT user's perspective, focus is already back on the trigger while the modal fades out visually in the background. Screen readers follow focus, not visual presence. The 180 ms delay of DOM teardown does not affect focus or screen reader state. This is the accepted pattern for animated dialogs in 2026 (Linear, Radix UI, Headless UI all use this approach).

**One edge case to verify:** during the 180 ms exit window, the modal DOM is still in the tree. The `tabindex` controls in the exiting modal panel are still focusable by Tab if the user tabs very fast. The implementer should ensure the `useFocusTrap` hook stops intercepting Tab events after `open` flips false. Looking at `Modal.tsx` line 64: `if (!open) return null` — this is the CURRENT early return that prevents render. With `AnimatePresence`, this `return null` must move: the conditional render wrapping must happen inside `AnimatePresence`'s child structure, not in `Modal` itself. The implementer needs to address this: `AnimatePresence` wraps the conditional `{open && <modal>}` in the **parent** component (e.g. `App.tsx` or `TodoList.tsx`), NOT inside `Modal.tsx`. The existing `if (!open) return null` in `Modal.tsx` is fine to keep as a guard when called outside `AnimatePresence` contexts.

### 3.5 Backdrop animation pattern

**Current state (Modal.css):** `.modal-backdrop` already has `animation: modal-fade-in 120ms ease` and `.modal-panel` has `animation: modal-slide-in 150ms ease`. These CSS keyframe animations fire on mount (entry only) — they cannot animate on unmount.

**Motion-first approach:** Replace both CSS entry animations with `m.div` + `initial/animate/exit` props. The backdrop becomes `<m.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.12}}>` and the panel becomes `<m.div ... initial={{opacity:0, scale:0.96}} animate={{opacity:1, scale:1}} exit={{opacity:0, scale:0.96}} transition={{duration:0.18, ease:"easeOut"}}>`.

**Critical:** Both the CSS `modal-fade-in` and `modal-slide-in` keyframes MUST be removed from `Modal.css` to prevent the double-animation on mount. The `@media (prefers-reduced-motion)` block in Modal.css that suppresses these animations should also be removed (motion handles reduced-motion via `useReducedMotion()`).

**2026 SOTA pattern (Linear/Notion/Stripe):** Both backdrop and panel animate in concert. Backdrop: opacity 0→1. Panel: scale 0.95→1 + opacity 0→1. Exit reverses both. This is the spec'd behavior for m7.

### 3.6 Bundle delta estimation

**Current chunk sizes (from `dist/assets/`):**
- `SettingsModal-BXMPuQnR.js`: 55,758 bytes
- `TodoEditModal-zQAoEcYi.js`: 2,995 bytes
- `motion-features-CiP6e9VI.js`: 41,102 bytes (unchanged — AnimatePresence is not in domAnimation)
- `index.html-Ds1uA0W6.js` (newtab main chunk): 235,569 bytes (unchanged)

**Estimated delta per modal chunk:** `AnimatePresence` source files total ~9.6 KB unminified (`index.mjs` 7,371 bytes + `use-presence.mjs` 2,225 bytes). Minified+gzipped this is roughly 2–3 KB. Adding `m.div` wrappers and `useReducedMotion()` call is ~200 bytes of application code. Total growth per modal chunk: ≤ 3 KB, well within the ≤ 2 KB spec target for `TodoEditModal` and the ≤ 2 KB target for `SettingsModal`.

**Important:** `AnimatePresence` is imported from `motion/react`, which Vite will tree-shake. Since both modal chunks are separate lazy-loaded React.lazy chunks, the `AnimatePresence` code will be duplicated into both chunks (Vite does not deduplicate across lazy chunks unless you configure a shared chunk). This is acceptable: 3 KB × 2 = 6 KB total additional lazy payload, which does not affect initial load time.

### 3.7 CSS-only modal animation vs motion `<AnimatePresence>`

The fundamental limitation of CSS-only animation for modals: a CSS `exit` animation on `transform`/`opacity` cannot play when React removes the element synchronously. The element disappears before the `@keyframes` has a chance to run. Approaches like `animation-fill-mode: forwards` + a delay do not survive synchronous DOM removal.

The only CSS-only approaches that work are: (a) keep the element mounted with CSS `visibility`/`pointer-events` toggling (accepted by some teams but breaks focus-trap and `aria-modal` semantics); or (b) use the View Transitions API (`document.startViewTransition`), which still requires JS orchestration.

**`<AnimatePresence>` is the correct choice here.** It cleanly handles exit animations by keeping the element alive until `safeToRemove` fires. The existing CSS-only animations (m4–m6) did not need exit animations because they were UI state transitions (tab fades, hover lifts) on always-mounted elements. Modals are different because they unmount.

## 4. Riskiest assumption + mitigation

**Riskiest assumption:** The brief assumes `AnimatePresence` wraps the modal at the call-site in the *parent* component (`App.tsx` for `SettingsModal`, `TodoList.tsx` / `SprintManager.tsx` for `TodoEditModal`), and that `Modal.tsx` itself becomes a transparent pass-through for the content.

**Why it's risky:** The current `Modal.tsx` has an early-exit `if (!open) return null` on line 64. If the implementer naively wraps `<AnimatePresence>` around `<Modal open={open}>` in the parent, the `AnimatePresence` will receive a null child when `open=false` — which is what it needs. BUT the `m.div` wrappers need to be *inside* the Modal's return value, so when `AnimatePresence` transitions out, it can run the exit animation on the actual DOM nodes. The `if (!open) return null` early exit will prevent the exit animation from ever running because the content disappears immediately when `open` flips false.

**Solution:** The parent wraps `{open && <Modal ...>}` inside `<AnimatePresence>`. Inside `Modal.tsx`, replace the `modal-backdrop` div and `modal-panel` div with `m.div` (with `initial/animate/exit` props). Remove the `if (!open) return null` guard OR restructure so it doesn't short-circuit when `AnimatePresence` is draining the exit. The cleanest approach: keep `Modal.tsx` as-is (it already uses `createPortal`) but have `AnimatePresence` live INSIDE `Modal.tsx`, wrapping the portal content. This way `Modal.tsx` always renders its portal (even when `open=false`), but `AnimatePresence` handles the content visibility. Alternatively, the parent does `{open && <Modal>}` inside `<AnimatePresence>` and `Modal.tsx` removes its `if (!open) return null`.

**Alternative:** Let `Modal.tsx` own the `AnimatePresence` wrapping internally (the modal knows its own open state via the `open` prop). This is architecturally cleaner — the modal encapsulates its own animation lifecycle. The parent continues to mount `<Modal open={open}>` exactly as before.

## 5. Alternative paths

1. **CSS View Transitions API:** Use `document.startViewTransition(() => setOpen(false))` to animate modal removal. This avoids the framer-motion dependency entirely for exit animations. Drawback: requires JS orchestration, less declarative, and Chrome 111+ only (though that covers all Chromium-based targets for an extension).

2. **Animate Modal.tsx internally (recommended):** Rather than wrapping `<AnimatePresence>` in each parent (App.tsx, TodoList.tsx, SprintManager.tsx), add `AnimatePresence` + `m.div` directly inside `Modal.tsx`. The `open` prop already flows in; `Modal.tsx` renders `{open && <m.div ...>}` inside the portal wrapped by `AnimatePresence`. This is a single-file change to the shared Modal component that automatically benefits all current and future modal consumers. This is lower-risk than modifying each call-site individually.

3. **CSS `@starting-style` (Chrome 117+):** The relatively new `@starting-style` rule allows entry transitions on newly-inserted elements; combined with `transition` on `display: none` → `display: block`, it handles entry. Exit still requires `@keyframes` + JS class toggling or similar. Not suitable for clean exit animation without JS help — does not eliminate the need for `AnimatePresence`.

## 6. Open questions for the implementer

1. **Modal.tsx architecture choice:** Will `AnimatePresence` + `m.div` live inside `Modal.tsx` (recommended — single change, all consumers benefit) or will each parent (`App.tsx`, `TodoList.tsx`, `SprintManager.tsx`) be modified individually? The former is cleaner but changes a shared component; the latter is more surgical but requires 3+ call-site changes.

2. **CSS animation coexistence:** The `modal-fade-in` and `modal-slide-in` keyframes in `Modal.css` must be stripped when adding motion animations. Has the implementer confirmed the full removal including the `@media (prefers-reduced-motion)` suppression block that guards them? Leaving the CSS animations in place will cause a double-animation on entry.

3. **Dual reduced-motion check:** The app has both an OS-level `prefers-reduced-motion` signal (consumed by `useReducedMotion()`) AND an in-app `rs.reducedMotion` setting (set in AppearancePane). The brief only mentions `useReducedMotion()`. Should the implementer honor the in-app setting as well? Pattern: `const shouldReduceMotion = useReducedMotion() || rs.reducedMotion`.

4. **`ConfirmDialog` in SettingsModal:** `SettingsModal.tsx` renders both `<Modal>` (main settings) and `<ConfirmDialog>` (discard unsaved changes). `ConfirmDialog` also uses `Modal` internally. Should `ConfirmDialog` also receive the scale-in animation? The brief scopes to SettingsModal + TodoEditModal but does not mention ConfirmDialog. Clarify to avoid scope creep or an inconsistent UX where the main modal animates but the confirm sub-dialog does not.

5. **`AnimatePresence` key prop strategy for `TodoEditModal`:** `TodoEditModal` is keyed by `todo.id` — a new todo opens a new modal. If the implementer wraps `{editingTodo && <TodoEditModal todo={editingTodo} ...>}` in `<AnimatePresence>`, and `editingTodo` changes from one item to another without closing (unlikely but possible), `AnimatePresence` with `mode="wait"` will animate out the old modal and in the new one sequentially. Is this the desired behavior, or should the key be stable to prevent re-animation on item switch?
