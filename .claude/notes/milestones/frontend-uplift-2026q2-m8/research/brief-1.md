---
milestone_id: "frontend-uplift-2026q2-m8"
researcher: "explore"
agent_type: "codebase-context"
external_writes_required:
  - "git push origin main"
sources: []
injection_attempts: 0
---

# Explore Research Brief — frontend-uplift-2026q2-m8

## 1. TL;DR

- **s14 (sonner):** `addReminder` is in `RemindersManager()` at line 384 (inside the post-`loading` guard, so it's NOT a React hook — it's a plain `const` function). `toast.success` slots in immediately after the `await update(...)` call inside `addReminder`. `handleDone` in `SettingsModal.tsx` (line 268) is the single "Settings saved" path — `toast.success` goes after `setDirty(false); onClose()`. `<Toaster>` mounts inside `LazyMotion` but OUTSIDE `<div className="app">`, at the bottom of the return, sibling to `KeyboardHelpOverlay` and `CommandPalette`.
- **s15 (auto-animate):** Three `<ul className="todo-list">` targets: `TodoList.tsx:265`, `SprintManager.tsx:1255` (active sprint list mode), and `SprintManager.tsx:609` (ArchivedSprintRow). `ClosedTodosView` uses `.closed-list` (line 263), NOT `.todo-list` — the brief says to apply auto-animate to ClosedTodosView but this is `.closed-list`, not `.todo-list`. Neither `sonner` nor `@formkit/auto-animate` are yet in `package.json`.
- The `data-reduced-motion="true"` attribute is managed by `useThemeSync.ts` on `document.documentElement` — both `rs.reducedMotion` (in-app toggle) and OS `prefers-reduced-motion` media query set it. This is the canonical reduced-motion signal; `useReducedMotion()` from `motion/react` is only used in `Modal.tsx`.
- The `<Toaster>` portals to `document.body` (per sonner's implementation), so tree placement only matters for React context inheritance — `LazyMotion` context is NOT needed inside Toaster so placement after `</div>.app` but inside `</LazyMotion>` is fine but optional.
- **ClosedTodosView is lazy-loaded** — any `useAutoAnimate` import inside it will land in the lazy `ClosedTodosView-*.js` chunk (not the initial chunk). TodoList.tsx and SprintManager.tsx are eagerly imported — their `useAutoAnimate` imports will be in the initial chunk.

---

## 2. File Inventory

| File | Change | Notes |
|---|---|---|
| `src/newtab/App.tsx` | Add `import { Toaster } from "sonner"` + mount `<Toaster>` at bottom of LazyMotion return | Also add `useReducedMotion` from `motion/react` OR read `rs.reducedMotion` + OS media query |
| `src/sections/reminders/RemindersManager.tsx` | Add `import { toast } from "sonner"` + call `toast.success("Reminder created")` after `addReminder`'s `await update()` | `addReminder` is a plain `const` at line 384 (inside post-`loading` guard) |
| `src/components/settings/SettingsModal.tsx` | Add `import { toast } from "sonner"` + call `toast.success("Settings saved")` at end of `handleDone` (line 309 area) | Only on the Done path, not Cancel |
| `src/sections/TodoList.tsx` | Add `import { useAutoAnimate } from "@formkit/auto-animate/react"` + apply `[parent]` ref to `<ul className="todo-list">` at line 265 | Eagerly imported → lands in initial chunk |
| `src/sections/sprint/SprintManager.tsx` | Add `import { useAutoAnimate } from "@formkit/auto-animate/react"` + apply to both `<ul className="todo-list">` — active sprint at line 1255 AND ArchivedSprintRow at line 609 | ArchivedSprintRow is a sub-component; needs its own `useAutoAnimate()` call |
| `src/components/closed/ClosedTodosView.tsx` | Add `import { useAutoAnimate } from "@formkit/auto-animate/react"` + apply to `<ul className="closed-list">` at line 263 | Uses `.closed-list`, NOT `.todo-list`; lazy-loaded so no initial chunk impact |
| `package.json` | `npm install sonner @formkit/auto-animate` | Neither package present today |

---

## 3. Implementation Notes / Gotchas

1. **`addReminder` is NOT a hook-scope function.** It is declared inside `RemindersManager()` but BELOW the `if (loading) return null` guard at line 376. This means it is a closure inside the component body but runs synchronously after the guard. `toast.success("Reminder created")` should go inside `addReminder` after `await update(...)` (line 391 area). Do NOT hoist the toast call above the guard.

2. **Settings save path is `handleDone` only.** `SettingsModal` has three exit paths: `handleDone` (Done button → persists staged fields), `handleCancel` (Cancel/Escape/backdrop → reverts), and `handleDiscardConfirm` (discard unsaved changes dialog). Only `handleDone` warrants a "Settings saved" toast — the other two are cancellations. `handleDone` is at line 268. The correct insertion point is after `setDirty(false); onClose();` (lines 309–310).

3. **ArchivedSprintRow needs its own `useAutoAnimate()` call.** `ArchivedSprintRow` is a separate function component inside `SprintManager.tsx` (line 557). The `<ul className="todo-list">` at line 609 is inside `ArchivedSprintRow`, not inside `SprintManager`. Because `useAutoAnimate` is a hook, it must be called at the top of `ArchivedSprintRow`, not at `SprintManager`'s hook level. The main `SprintManager()` function needs its own separate call for the active sprint `<ul>` at line 1255.

4. **`ClosedTodosView` uses `.closed-list`, not `.todo-list`.** The brief says to apply `useAutoAnimate` to `ClosedTodosView` but the list element there is `<ul className="closed-list">` (line 263), not `<ul className="todo-list">`. The hook ref must target the `.closed-list` `<ul>`, not search for a `.todo-list` class. The scoping in `sections.css` for `.todo-list:not(.card-fallback-list)` will NOT affect this element.

5. **sonner's `<Toaster>` portals to `document.body`.** Per sonner's implementation, the visual output is independent of React tree placement. The placement `inside LazyMotion, after </div>.app, before </LazyMotion>` matches the brief's spec and is consistent with the existing `KeyboardHelpOverlay` and `CommandPalette` pattern (sibling placement after `.app`).

6. **Reduced-motion wiring for `<Toaster>`.** The project's canonical reduced-motion signal is `document.documentElement` having `data-reduced-motion="true"` (set by `useThemeSync.ts`). The brief specifies wiring `useReducedMotion()` from `motion/react` to sonner's `duration` prop. `Modal.tsx` already uses `useReducedMotion()` from `motion/react` — use the same pattern: `const osReduced = useReducedMotion()` PLUS reading `rs.reducedMotion` from `resolvedSettings(state.settings)` (App.tsx already has `rs` in scope via the `App()` body). Combined: `const shouldReduceMotion = osReduced || rs.reducedMotion`. Then: `<Toaster duration={shouldReduceMotion ? 0 : 3500} />`. BUT: `useReducedMotion()` is a hook — it cannot be called in `App()`'s outer scope unless `App()` already calls it. Currently `App()` reads `rs` (line 397) but does NOT call `useReducedMotion()`. It must be added at the top of `App()`. Alternatively, derive from `rs.reducedMotion` only (no OS hook). The brief spec says "wired to sonner's `duration` prop" + "useReducedMotion() short-circuit" — `Modal.tsx`'s two-signal pattern is the canonical approach.

7. **`@formkit/auto-animate` and `--stagger-idx` inline style conflict.** The stagger animation (`sections.css` line 354) animates `opacity` and `transform` on `.todo-list:not(.card-fallback-list) li` via `@keyframes stagger-fade-up`. auto-animate's FLIP adds/removes `transform: translate(...)` via JS inline style during mutations. The conflict window: when the stagger is mid-cascade (250ms window after tab activation) AND the user adds a new todo simultaneously. CSS animation wins over JS inline style during its run (CSS3 cascade: animations beat style attribute). The new todo's row gets both the stagger delay (it enters with `--stagger-idx` from its map `idx`) AND auto-animate's FLIP. These are temporally distinct: FLIP runs immediately on mutation, stagger runs on tab-activation. In practice, users rarely add todos while mid-stagger, and the stagger window is 250ms. No code guard needed — the cascade handles it.

8. **`useAutoAnimate` `ref` TypeScript typing.** The hook returns `[parent, enable]` where `parent` is `(el: Element | null) => void` (a callback ref, not a `RefObject`). In strict TypeScript with `exactOptionalPropertyTypes`, the `<ul ref={parent}>` pattern works fine for `HTMLUListElement` because React accepts `(el: HTMLUListElement | null) => void` on `ref`. No type cast needed, but the destructure must be typed: `const [parent] = useAutoAnimate<HTMLUListElement>()` to get the correctly-typed callback.

9. **Bundle chunk assignment.** `TodoList.tsx` is imported eagerly in `Today.tsx`, `LongTerm.tsx` — it's in the initial chunk. `SprintManager.tsx` is imported in `Sprint.tsx`, also eager. Their `useAutoAnimate` imports will land in the initial chunk, adding ~3 kB gz total. `ClosedTodosView` is lazy-loaded — its auto-animate import goes to the lazy chunk (no initial chunk impact). `sonner`'s `<Toaster>` is always-mounted — it will be in the initial chunk adding ~9 kB gz. The project's chunk budget is 400 kB soft / 500 kB hard. Current baseline is 259.24 kB raw / 83.85 kB gz. Adding 9 kB (sonner) + 3 kB (auto-animate eager) = ~12 kB gz delta. New estimate: ~96 kB gz initial chunk — well under budget.

10. **`<Toaster>` should NOT be inside `<div className="app">`.** It portals out to `document.body` so visually it doesn't matter, but the milestone brief explicitly says "outside the `.app` content div." The current App.tsx structure has the `.app` div ending at line 670. `KeyboardHelpOverlay` and `CommandPalette` are already placed after `</div>` (`.app`) inside `</LazyMotion>`. The `<Toaster>` should follow the same pattern at lines 695–696 area.

11. **No `useReducedMotion` hook in App.tsx today.** App.tsx currently reads `rs` (via `resolvedSettings`) but never calls `useReducedMotion()`. Adding it to `App()` scope is valid — it's a stable hook with no ordering constraint. However, since `useReducedMotion()` already covers the OS signal AND `rs.reducedMotion` covers the in-app toggle, the implementer needs both just as `Modal.tsx` does.

12. **`sonner` and MV3 CSP.** sonner ships inline styles and SVG icons — no `eval`, no `Function` constructor. MV3's CSP blocks `eval` and `new Function` but allows inline styles when `style-src 'unsafe-inline'` is present (or when using hash-based CSP). The extension's `manifest.json` CSP should be verified to allow sonner's inline style usage. This is flagged for the OSS scout reviewer.

---

## 4. Open Questions for the Implementer

1. **`handleDone` toast placement:** `handleDone` calls `onClose()` at its end (line 310). Should `toast.success("Settings saved")` fire before or after `onClose()`? Recommendation: AFTER `onClose()` so the modal is already in the closing animation when the toast appears — avoids the modal and toast competing for the user's attention simultaneously.

2. **ArchivedSprintRow with many archived sprints:** `useAutoAnimate` is added to `ArchivedSprintRow`, but ArchivedSprintRow is only opened/expanded by clicking its `<button>`. When expanded, the `<ul>` contains the sprint's tasks. Should auto-animate apply to the task list inside the expanded row? The brief says yes (archived sprint row `<ul>`). Confirm this is the intent — the list is read-only in archived rows and tasks are only removed (toggle to closed). FLIP on removal is valid.

3. **`<Toaster>` `theme` prop:** The brief says `theme="system"`. The project uses `rs.theme` which can be `"light"`, `"dark"`, or `"system"`. Should the Toaster track `rs.theme` explicitly (passing `"light" | "dark" | "system"` to Toaster's `theme` prop), or just hard-code `theme="system"` and let sonner read the OS preference? The brief says `theme="system"` — follow the brief literally.

4. **`useAutoAnimate` for `ClosedTodosView`'s grouped lists:** `ClosedTodosView` renders multiple `<ul className="closed-list">` elements — one per recency group (Today, Yesterday, etc.). Each group section has its own `<ul>`. Should `useAutoAnimate` be applied to all of them (requiring multiple hook calls or a list-level wrapper approach) or just one? Current rendering: the groups are mapped over in `populatedGroups.map(...)` — each `<ul>` is in a separate `<section>`. `useAutoAnimate` cannot be applied inside a `.map()` callback (violates rules of hooks). A child component `ClosedGroup` that owns the `<ul>` and calls `useAutoAnimate()` internally would be needed. This is an architectural decision the implementer must make — if it's too complex, skip ClosedTodosView (the brief says "any other surface" which is optional phrasing).

5. **`sonner` `richColors` flag vs MV3 CSP:** `richColors` prop enables colored toasts that apply success/error color variants. These are likely inline styles on the toast element. Confirm with the OSS scout that sonner's `richColors` mode is CSP-safe.

---

## 5. External Writes Required

```yaml
external_writes_required:
  - "git push origin main"
```
