### `frontend-uplift-2026q2-m7` — UPL-4 modal scale-in (motion library)

Modal `<AnimatePresence>` scale-in / scale-out via the `motion` library shipped in m2. No new dependency — reuses the LazyMotion + domAnimation foundation. Reduced-motion respected via `useReducedMotion()`. Three modals exist today: SettingsModal, TodoEditModal, and the QuickPrompt confirmation flow — start with SettingsModal (highest-frequency open) and TodoEditModal; QuickPrompt is a banner not a modal and is out of scope.

**Stories:**

**`frontend-uplift-2026q2-e3-s13` — UPL-4: motion `<AnimatePresence>` scale-in/out on SettingsModal + TodoEditModal** (S)

Given SettingsModal (`src/components/settings/SettingsModal.tsx`) and TodoEditModal (`src/components/TodoEditModal.tsx`) currently mount instantly via conditional rendering with no entry/exit animation, and `motion/react` is already in the bundle (m2 foundation, behind `LazyMotion`)
When the developer wraps each modal's root `<div>` in `<AnimatePresence mode="wait">` (mounted in the parent component that conditionally renders the modal), converts the root `<div>` to `motion.div` with `initial={{ opacity: 0, scale: 0.96 }}`, `animate={{ opacity: 1, scale: 1 }}`, `exit={{ opacity: 0, scale: 0.96 }}`, and `transition={{ duration: 0.18, ease: "easeOut" }}`; calls `useReducedMotion()` inside each modal and passes through `transition: { duration: 0 }` when it returns true; verifies the modal backdrop (typically a separate fixed-position overlay) ALSO fades via paired motion props
Then opening SettingsModal or TodoEditModal produces a visible scale-in over 180 ms (opacity 0→1 + scale 0.96→1); closing reverses it (the unmount is delayed by `<AnimatePresence>` until the exit animation completes); under reduced-motion the animation collapses to instant via the `useReducedMotion()` short-circuit; focus management is preserved (focus moves to the modal on open, returns to the trigger on close — verify the m1-era focus-trap implementation still works); `npm run build` passes with zero TS errors and the initial newtab chunk grows by ≤ 1 KB (motion is already lazy-loaded; the modal components themselves are already lazy-loaded via React.lazy)

Specialist: A11y reviewer — focus-trap verification (Tab cycles through modal controls; Shift+Tab reverses; Escape closes); confirm `useReducedMotion()` collapses the animation to a single render frame (not a "fast animation"); confirm the backdrop click-to-close still works during the exit animation window

Specialist: Bundle-budget reviewer — confirm `motion-features.js` chunk size unchanged (no new motion API surface added that would inflate the deferred chunk); confirm the modal lazy chunks (SettingsModal.js, TodoEditModal.js) grow by ≤ 2 KB each for the motion.div wrapper code

---
