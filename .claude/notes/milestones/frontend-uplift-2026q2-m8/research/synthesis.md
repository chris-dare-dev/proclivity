# Research synthesis — frontend-uplift-2026q2-m8

**Milestone:** UPL-25 sonner toasts + UPL-13 @formkit/auto-animate
**Date:** 2026-05-20
**Author:** orchestrator (main session, Phase 1 fan-in)
**Sources:** brief-1.md (explore — exact call-sites + 12 gotchas), brief-2.md (general — sonner@2.0.7 + auto-animate@0.9.0 verified, native reduced-motion handling)

---

## 1. TL;DR for the implementer

Two new deps (`sonner@^2.0.7` + `@formkit/auto-animate@^0.9.0`). Both MIT, zero transitive deps each, ~9.3 + ~3.2 kB gz respectively. Brief-2 §4 caught a load-bearing correction to the roadmap brief.

**Critical correction (brief-2 §4):** the roadmap brief said "wrap Toaster in a `useReducedMotion()` short-circuit that sets `duration={0}` under reduced-motion." This is **wrong** — sonner's `duration` prop is the auto-dismiss timer, not the animation duration. Setting `duration={0}` would make toasts disappear before they can be read. Sonner ships a native `@media (prefers-reduced-motion)` CSS block that collapses all animations to instant. **Mount the Toaster with a fixed `duration={3500}` and no useReducedMotion() wrapper.** Animation is auto-disabled by sonner's CSS; the user still reads the message for 3.5 s.

**Two stories:**
- **s14 (sonner):** Mount `<Toaster position="bottom-right" theme="system" richColors closeButton duration={3500} />` once in App.tsx after the `.app` div (sibling to KeyboardHelpOverlay and CommandPalette). Wire `toast.success("Reminder created")` inside `RemindersManager.addReminder` after `await update()`. Wire `toast.success("Settings saved")` inside `SettingsModal.handleDone` after `setDirty(false); onClose();`.

- **s15 (@formkit/auto-animate):** Apply `useAutoAnimate<HTMLUListElement>()` to:
  - `TodoList.tsx` `<ul className="todo-list">` (line 265) — eager → initial chunk
  - `SprintManager.tsx` active sprint `<ul>` (line 1255) — eager → initial chunk
  - `SprintManager.tsx`'s `ArchivedSprintRow` `<ul>` (line 609) — same chunk, but the hook MUST be called inside `ArchivedSprintRow()` since hooks can't cross component boundaries
  - **SKIP** ClosedTodosView (brief-1 Q4): uses `.closed-list` not `.todo-list`, renders multiple `<ul>` via `.map()` which violates rules-of-hooks. Defer to a v1 follow-up that extracts a `ClosedGroup` child component.

**Path decision:** `delegated` — 6-7 unique paths touched (package.json, package-lock.json, App.tsx, RemindersManager, SettingsModal, TodoList, SprintManager). Exceeds the ≤5-file inline threshold.

**Expected bundle delta:** initial chunk grows by ~12 kB gz total (~9.3 kB sonner + ~3.2 kB auto-animate). Brief-2 §Bundle delta projects 94.2 kB gz total post-m8 (vs 81.9 kB baseline) — well under the 400 kB raw / 270 kB synthesis target.

---

## 2. Affected files (7 unique paths)

| File | Status | Change |
|---|---|---|
| `package.json` | MODIFY | Add `sonner@^2.0.7` and `@formkit/auto-animate@^0.9.0` |
| `package-lock.json` | MODIFY | Lockfile updates (both libs have zero transitive deps) |
| `src/newtab/App.tsx` | MODIFY | Add `import { Toaster } from "sonner"`; mount `<Toaster>` after `</div>.app` inside `</LazyMotion>` (sibling to KeyboardHelpOverlay/CommandPalette) |
| `src/sections/reminders/RemindersManager.tsx` | MODIFY | Add `import { toast } from "sonner"`; call `toast.success("Reminder created")` inside `addReminder` (line 384 area) after `await update(...)` |
| `src/components/settings/SettingsModal.tsx` | MODIFY | Add `import { toast } from "sonner"`; call `toast.success("Settings saved")` inside `handleDone` (line 268) after `setDirty(false); onClose();` |
| `src/sections/TodoList.tsx` | MODIFY | Add `import { useAutoAnimate } from "@formkit/auto-animate/react"`; `const [parent] = useAutoAnimate<HTMLUListElement>();` and `<ul ref={parent} className="todo-list">` at line 265 |
| `src/sections/sprint/SprintManager.tsx` | MODIFY | TWO separate `useAutoAnimate()` calls — one in `SprintManager()` for the active sprint `<ul>` at line 1255, one in `ArchivedSprintRow()` for line 609 (hooks can't cross component boundaries) |

**Not touched (deferred per OQ4):** `src/components/closed/ClosedTodosView.tsx` — uses `.closed-list` (not `.todo-list`), renders multiple `<ul>` via `.map()` which violates rules-of-hooks. Adding auto-animate requires extracting a `ClosedGroup` child component. Out-of-scope for v0; deferred to a future polish milestone.

Total: 7 paths, ~30-60 LOC actual code changes (most additions are 1-3 lines per file).

---

## 3. Architecture decisions made during synthesis

### 3.1 No `useReducedMotion()` wrapper on Toaster (brief-2 §4 correction)

The roadmap brief's instruction to "set `duration={0}` under reduced-motion" would make toasts disappear instantly — defeating the feedback purpose. Sonner handles reduced-motion natively via a CSS `@media (prefers-reduced-motion)` block that nulls all `transition` and `animation` properties. The JS `duration` prop is the **dismiss timer**, not the animation duration. Use a fixed `duration={3500}` — sonner's CSS handles the rest.

Optional enhancement: if respecting the in-app `rs.reducedMotion` toggle is desired beyond OS-level, pass `duration={shouldReduceMotion ? Infinity : 3500}` so the toast stays visible until the user manually dismisses via `closeButton`. **Decision for v0:** fixed `duration={3500}`. The in-app toggle ALREADY sets `data-reduced-motion="true"` on `<html>` which would cascade to any element with reduced-motion-gated CSS — but sonner uses its own `@media` selector, not the `[data-reduced-motion]` selector. The OS signal is sufficient for v0; the in-app toggle is a deferrable polish.

### 3.2 `<Toaster>` mounted as a sibling of KeyboardHelpOverlay + CommandPalette

Inside the `<LazyMotion>` provider, AFTER the `</div>.app` close tag. Same placement as the m10 and m11 overlay portals. The `<Toaster>` portals to `document.body` internally so tree placement only affects React context propagation — sonner doesn't need LazyMotion context, but the consistent placement keeps the App return structure readable.

### 3.3 `<Toaster>` props (brief-2 §3 confirmed)

```tsx
<Toaster
  position="bottom-right"
  theme="system"
  richColors
  closeButton
  duration={3500}
/>
```

- `position="bottom-right"` — per roadmap brief.
- `theme="system"` — uses `prefers-color-scheme`. Proclivity has its own theme state but sonner's `"system"` mode is the simplest correct path (the toast colors are independent of the app's theme tokens; it matches the OS chrome).
- `richColors` — enables semantic color variants (success = green, error = red).
- `closeButton` — explicit dismiss affordance (paired with reduced-motion's no-animation behavior so AT users can still manually clear).
- `duration={3500}` — 500 ms shorter than sonner's default 4000 ms; matches roadmap spec.

### 3.4 sonner `toast.success` wire-up — TWO call sites only

Per the roadmap brief: "start with `Reminders.tsx`'s `addReminder` and `SettingsModal.tsx`'s save path — those are the highest-frequency action completions today."

**RemindersManager.addReminder** (brief-1 §1): `addReminder` is a plain `const` function inside `RemindersManager()` after the `if (loading) return null` guard at line 376. Toast call goes immediately after `await update(...)` at ~line 391. Order: `await update(...) → toast.success("Reminder created");` so the toast only fires on successful persistence.

**SettingsModal.handleDone** (brief-1 §2): the ONLY save path is `handleDone` at line 268. Three exit paths exist (Done, Cancel, Discard) — only Done warrants a "Settings saved" toast. Insert AFTER `setDirty(false); onClose();` at lines 309-310 so the modal is already in its exit animation when the toast appears (per brief-1 Q1 recommendation — avoids the modal and toast competing for attention).

**Do NOT** add toasts to other action callbacks in v0. The brief explicitly scopes to these two; adding more should be a follow-up after dogfood feedback.

### 3.5 `@formkit/auto-animate` wire-up — three `<ul>` targets

Three call-sites, each requiring its own `useAutoAnimate` hook call (hooks can't cross component boundaries):

```tsx
// TodoList.tsx line ~265
const [parent] = useAutoAnimate<HTMLUListElement>();
<ul ref={parent} className="todo-list">

// SprintManager.tsx line ~1255 (active sprint, inside SprintManager() function)
const [activeSprintListRef] = useAutoAnimate<HTMLUListElement>();
<ul ref={activeSprintListRef} className="todo-list">

// SprintManager.tsx line ~609 (inside ArchivedSprintRow() sub-component)
const [archivedListRef] = useAutoAnimate<HTMLUListElement>();
<ul ref={archivedListRef} className="todo-list">
```

The hook return is `[RefCallback<T>, (enabled: boolean) => void]`. We only need the `parent` ref callback; the enable setter is unused for v0.

### 3.6 Reduced-motion handled natively (brief-2 §3 confirmed)

`@formkit/auto-animate` reads `window.matchMedia("(prefers-reduced-motion: reduce)")` at enable-time and skips WAAPI calls if matched (with default `disrespectUserMotionPreference: false`). No JS guard needed.

For the in-app `rs.reducedMotion` toggle: the library only reads the OS signal. If a user has OS-level off but in-app on, auto-animate will still fire. This is a known gap that mirrors sonner — accept for v0; an explicit `useAutoAnimate(options)` with conditional `disrespectUserMotionPreference: !rs.reducedMotion` could be added in a follow-up.

### 3.7 `useAutoAnimate` vs m5-s9 stagger vs m6 hover-lift (brief-1 §3.7-3.8, brief-2 §3)

- **vs m5 stagger:** auto-animate fires on the NEWLY ADDED element via WAAPI; m5 stagger fires on EXISTING `<li>` elements via CSS @keyframes (triggered by tab activation). Different elements at mutation time = no conflict in practice.

- **vs m6 hover-lift:** auto-animate fires on add/remove/reorder (mutation events); hover-lift fires on `:hover` (pointer event). Window where both target the same element + same transform property is real but benign — the WAAPI animation completes in 250 ms, then the CSS hover transition reasserts. Cosmetic flicker acceptable for v0.

### 3.8 SKIP ClosedTodosView for v0 (brief-1 Q4)

ClosedTodosView renders multiple `<ul className="closed-list">` via `populatedGroups.map(...)`. `useAutoAnimate` can't be called inside `.map()` (rules-of-hooks violation). Would require extracting a `ClosedGroup` child component that calls `useAutoAnimate()` internally — ~30-50 LOC of refactoring for a lazy-loaded section that the user rarely visits.

**Decision:** defer to a v1 follow-up (e.g. `frontend-uplift-2026q2-m12` if the roadmap re-opens). The roadmap brief said "and any other surface where rows are added/removed (`ClosedTodosView.tsx`)" — soft phrasing. The HIGH-frequency mutation surfaces (Today, Sprint, LongTerm via TodoList; active sprint via SprintManager) are all covered.

### 3.9 sonner CSP + a11y safety (brief-2 §3 confirmed)

- **CSP**: zero `eval` / `Function` / `innerHTML` in sonner source. ESM, no runtime code generation. MV3 safe.
- **a11y**: `aria-live="polite"` hardcoded on the toast list; `aria-atomic="false"` allows individual toast announcements without re-reading the entire region. Default behavior is WCAG-compliant.

### 3.10 Build chunk impact

sonner is always-mounted (Toaster at App root) → initial chunk. auto-animate is imported by TodoList + SprintManager (both eager) → initial chunk. Brief-2 projects 94.2 kB gz initial after m8 (vs 81.9 kB baseline) — ~12 kB gz delta. Raw chunk projection: ~270 kB (vs 259 kB baseline). Well under 400 kB soft warn.

---

## 4. external_writes_required

```yaml
external_writes_required:
  - "npm install sonner"
  - "npm install @formkit/auto-animate"
  - "git push origin main"
```

The two `npm install` calls are local-only writes (modify `package.json` + `package-lock.json` + `node_modules/`). Recorded for audit but do not block Phase 4.

---

## 5. Implementation strategy (delegated path)

The implementer should follow this sequence:

1. **`npm install sonner@^2.0.7 @formkit/auto-animate@^0.9.0`** — single invocation installs both. Verify package-lock entries (both zero transitive deps; +~12 kB gz total).

2. **App.tsx Toaster mount** — add `import { Toaster } from "sonner"`. Mount `<Toaster position="bottom-right" theme="system" richColors closeButton duration={3500} />` right before `</LazyMotion>` at the bottom of the return (sibling placement to KeyboardHelpOverlay and CommandPalette per brief-1 §1).

3. **RemindersManager toast wire-up** — add `import { toast } from "sonner"`. Inside `addReminder` (line 384 area), after `await update(...)`, add `toast.success("Reminder created");`.

4. **SettingsModal toast wire-up** — add `import { toast } from "sonner"`. Inside `handleDone` (line 268 area), AFTER `setDirty(false); onClose();` add `toast.success("Settings saved");`.

5. **TodoList.tsx auto-animate** — add `import { useAutoAnimate } from "@formkit/auto-animate/react"`. Add `const [parent] = useAutoAnimate<HTMLUListElement>();` inside the function body. Apply `<ul ref={parent} className="todo-list">` at line 265.

6. **SprintManager.tsx auto-animate (two call-sites)** — same import. TWO separate `useAutoAnimate()` calls:
   - One inside `SprintManager()` main scope for the active sprint `<ul>` at line 1255.
   - One inside `ArchivedSprintRow()` sub-component for the archived `<ul>` at line 609. **CRITICAL:** these MUST be separate hook calls in separate component scopes; do NOT try to share one ref across components.

7. **Skip ClosedTodosView** per §3.8 decision. Add a comment in the brief's deferred-list noting why.

8. **`npm run build`** — verify:
   - Initial chunk ≤ 280 kB raw / ≤ 100 kB gz (target ~270 raw / ~94 gz per brief-2 projection).
   - Strict TS zero errors.
   - sonner CSS imports work cleanly (sonner ships its own `styles.css`).

9. **Single commit** — `feat(deps): sonner toasts + auto-animate (m8)` (sample subject, 36 chars after `feat(deps): ` prefix; under 50-char cap).

---

## 6. Implementation acceptance criteria

1. `package.json` includes `sonner@^2.0.7` AND `@formkit/auto-animate@^0.9.0`.
2. `npm run build` passes clean (strict TS zero errors).
3. **Initial chunk ≤ 280 kB raw** (target ~270 raw per brief-2 §Bundle delta).
4. App.tsx mounts `<Toaster position="bottom-right" theme="system" richColors closeButton duration={3500} />` — NO `useReducedMotion()` wrapper. NO `duration={0}` under reduced-motion.
5. RemindersManager.addReminder calls `toast.success("Reminder created")` AFTER the `await update(...)` line.
6. SettingsModal.handleDone calls `toast.success("Settings saved")` AFTER `setDirty(false); onClose();`.
7. TodoList.tsx's `<ul className="todo-list">` at line 265 has `ref={parent}` where `parent` is from `useAutoAnimate<HTMLUListElement>()`.
8. SprintManager.tsx has TWO `useAutoAnimate()` calls — one in `SprintManager()` (active sprint `<ul>`) and one in `ArchivedSprintRow()` (archived `<ul>`). Each `<ul>` has its own `ref={parent}`.
9. ClosedTodosView is NOT touched (deferred per §3.8).
10. **Manual smoke** in dev:
    - Create a new reminder → bottom-right toast appears, auto-dismisses after 3.5 s, has a close button.
    - Open Settings → Done → modal closes → toast "Settings saved" appears.
    - Add a todo on Today → row slides into place smoothly (auto-animate FLIP).
    - Complete a todo → row fades/moves to closed (FLIP again).
    - DevTools forced reduced-motion → toasts still appear/dismiss but with no animation; auto-animate doesn't fire (rows snap into place).
    - Add a todo while m5 stagger is mid-cascade (within ~250 ms of tab activation) — new row gets FLIP, existing rows continue stagger; no visual jank.

---

## 7. Riskiest assumption + alternative

**Risk (brief-2 §4 — load-bearing):** the roadmap brief's "duration={0} under reduced-motion" wording is wrong. If the implementer follows it literally, toasts will be unreadable for reduced-motion users — a critical a11y regression. This synthesis explicitly forbids that interpretation (§3.1 + AC4).

**Mitigation:** the implementer prompt MUST include the literal text "Do NOT pass `duration={0}` — sonner handles reduced-motion via CSS natively." The synthesis §3.1 explains the rationale; the implementer should treat it as a hard constraint.

**Alternative if sonner's CSP integration fails:** swap to `react-hot-toast` (5 kB gz, MIT) which has slightly fewer features but the same a11y baseline. Out-of-scope unless OSS scout flags a CSP issue with sonner that brief-2's source inspection missed.

---

## 8. Open questions for the implementer (≤5)

1. **`Toaster` theme prop** — brief says `theme="system"` (sonner reads `prefers-color-scheme`). Could alternatively derive from `rs.theme` to match proclivity's theme tokens exactly. Synthesis §3.3 recommends `"system"` for v0; the alternative is a future-polish item.

2. **In-app `rs.reducedMotion` toggle** — neither sonner nor auto-animate read the `data-reduced-motion="true"` HTML attribute that `useThemeSync` sets. A user with OS off + in-app on would still see toast animations and auto-animate FLIP. This is a known v0 limitation; accept and document.

3. **`ArchivedSprintRow` rendering frequency** — when a user expands an archived sprint, the auto-animate hook runs on its `<ul>`. The list inside is rarely mutated (archived rows are usually read-only). Net animation surface is low. No concern.

4. **`hasSideEffects` on `@formkit/auto-animate`** — bundlephobia flags it true because the library mutates element styles. Vite cannot fully tree-shake. Net cost is the full 3.2 kB gz — acceptable.

5. **Settings toast vs other action callbacks** — the brief explicitly limits v0 to addReminder + handleDone. Future milestones can wire more toasts (todo created, todo deleted, tag created, sprint started, etc.). Keep v0 tight.

---

## 9. Scope assessment

- **Path:** delegated (7 unique paths > 5-file inline threshold)
- **Estimated LOC:** ~60-100 (most additions are 1-3 lines per file; bulk is package-lock.json updates)
- **Worktree:** YES (delegated-path convention)
- **`--allow-large-diff`:** NO
- **Novel architecture:** NO — additive toast + FLIP integration, established lazy/eager chunking
- **OSS scout:** YES — `--include-oss` enabled (two new deps)
