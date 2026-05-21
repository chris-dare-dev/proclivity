# Explore Research Brief — frontend-uplift-2026q2-m10

## 1. TL;DR

There is exactly **one** `document.addEventListener("keydown", ...)` call in the codebase: `ChatPanel.tsx:53` (Escape-to-close). All other keyboard handling uses JSX `onKeyDown=`. The majority of `onKeyDown=` handlers are **form-input-scoped** (Enter to submit, Escape to cancel edit) and must be **kept as-is**. Three handlers are **widget-navigation** (DraggableCard arrow-key resize, SettingsSidebar arrow-key roving tabindex, TagPickerArea list navigation) — these are also keep-as-is, not global shortcuts. One handler in **Modal.tsx:88-98** (Escape + focus-trap) is the only meaningful candidate for `useHotkeys("escape", ...)` migration but has a nested-modal complication. `src/components/help/` does not exist yet; `src/lib/` contains only `cssVars.ts`, `dateUtils.ts`, and `googlePhotos/` — `shortcuts.ts` is a net-new file. `react-hotkeys-hook` is not yet installed.

---

## 2. File Inventory

### Ad-hoc `addEventListener` keydown listeners (s17 migration scope)

| File | Line | Context | Migrate? |
|---|---|---|---|
| `src/components/chat/ChatPanel.tsx` | 48–55 | `document.addEventListener("keydown", ...)` — Escape closes the chat panel | **YES — primary target** |

This is the **only** `document.addEventListener("keydown", ...)` in all of `src/`. The brief's premise of "scattered calls" is accurate for the spirit (multiple escape-close patterns), but the raw `addEventListener` form appears only once.

### JSX `onKeyDown=` — KEEP as-is (form-input-scoped or widget-internal)

| File | Lines | Context | Decision |
|---|---|---|---|
| `src/sections/TodoList.tsx` | 193 | Enter to submit new todo input | KEEP |
| `src/sections/gantt/TaskRow.tsx` | 153–159 | Enter blur / Escape cancel on title input | KEEP |
| `src/sections/gantt/ChartView.tsx` | 447 | Enter to add new gantt task input | KEEP |
| `src/sections/gantt/ChartView.tsx` | 596 | `onBarKeyDown` — gantt bar drag cancel/nudge (Escape, Shift+Arrow) | KEEP — widget-internal |
| `src/sections/calendar/SprintBars.tsx` | 145–148 | Enter/Space activate sprint bar button | KEEP — accessible button pattern |
| `src/sections/sprint/SprintManager.tsx` | 86 | Enter to submit new sprint input | KEEP |
| `src/sections/sprint/SprintManager.tsx` | 168, 180 | Enter to save sprint edit inputs | KEEP |
| `src/sections/sprint/SprintManager.tsx` | 332–340 | Enter blur / Escape cancel on sprint goal input | KEEP |
| `src/sections/reminders/RemindersManager.tsx` | 104, 253 | Enter to save reminder inputs | KEEP |
| `src/components/QuickPrompt.tsx` | 74–81 | Enter to submit / Escape to dismiss — **scoped to input** | KEEP (input-scoped, not global) |
| `src/components/TodoEditModal.tsx` | 107 | Enter to save on modal input | KEEP |
| `src/components/TagPickerArea.tsx` | 207 | Popover list navigation (ArrowUp/Down, Enter) | KEEP — widget-internal |
| `src/components/settings/SettingsSidebar.tsx` | 115 | Arrow-key roving tabindex in settings sidebar | KEEP — widget-internal ARIA pattern |
| `src/components/settings/panes/TagsPane.tsx` | 111, 185 | Enter blur rename / Enter+Escape create flow | KEEP |
| `src/components/chat/ChatInput.tsx` | 44 | Enter to send / Shift+Enter newline — **textarea** | KEEP — form-scoped |
| `src/components/card/DraggableCard.tsx` | 410 | Escape to cancel drag + Shift+Arrow resize | KEEP — widget-internal |
| `src/components/Modal.tsx` | 128 | `onKeyDown={handleKeyDown}` on `m.div` backdrop — Escape + Tab focus-trap | **DECISION POINT — see §3.2** |
| `src/components/Modal.tsx` | 196 | `onKeyDown` in `TextInputModal` — Enter to submit | KEEP |

### Non-keyboard `addEventListener` calls (do NOT migrate)

| File | Line | Event | Note |
|---|---|---|---|
| `src/sections/calendar/DayCell.tsx` | 75 | `change` on `MediaQueryList` | Media query listener |
| `src/storage/storage.ts` | 164 | `storage` on `window` | Storage sync |
| `src/components/MeshBackground.tsx` | 229 | `visibilitychange` on `document` | Visibility API |
| `src/components/TagPickerArea.tsx` | 127 | `mousedown` on `document` | Click-outside detection |
| `src/components/settings/NanoSection.tsx` | 108 | `downloadprogress` on model session | Custom event |
| `src/hooks/useThemeSync.ts` | 83, 99 | `change` on `MediaQueryList` | Theme MQ |
| `src/hooks/useChatSession.ts` | 98 | `contextoverflow` on session | AI session event |
| `src/newtab/App.tsx` | 441 | `NAV_CLOSED_EVENT` on `window` | Custom navigation event |
| `src/lib/googlePhotos/store.ts` | 94 | `storage` on `window` | Storage sync |

### New files to create (s18)

| Path | Type | Notes |
|---|---|---|
| `src/lib/shortcuts.ts` | New — shortcut registry | Source-of-truth const array. `src/lib/` contains `cssVars.ts` and `dateUtils.ts` — this is the right convention. |
| `src/components/help/KeyboardHelpOverlay.tsx` | New — lazy-loaded component | `src/components/help/` does not exist; flat alternative is `src/components/KeyboardHelpOverlay.tsx`. Both work; `help/` is cleaner given future shortcut-related additions. |
| `src/components/help/KeyboardHelpOverlay.css` | New — styles | |

### Modified files (both stories)

| File | Change |
|---|---|
| `src/components/chat/ChatPanel.tsx` | Replace `document.addEventListener("keydown", ...)` at lines 48–55 with `useHotkeys("escape", onClose, { enableOnFormTags: true })` |
| `src/newtab/App.tsx` | Add `useHotkeys("meta+slash, ctrl+slash", ...)` toggle for help overlay; add `const KeyboardHelpOverlay = lazy(...)` import; add `<Suspense fallback={null}><KeyboardHelpOverlay /></Suspense>` |
| `package.json` | Add `react-hotkeys-hook` dependency |

---

## 3. Implementation Notes / Gotchas

### 3.1 Singular `document.addEventListener` target

The `document.addEventListener("keydown", ...)` at ChatPanel.tsx:48–55 is the only raw imperative keyboard listener in the codebase. Migration: replace the `useEffect` block with `useHotkeys("escape", onClose, { enableOnFormTags: true })`. The `onClose` callback is already stabilized via prop; no additional memoization is needed. The manual `removeEventListener` cleanup is eliminated — react-hotkeys-hook auto-unbinds on unmount.

### 3.2 Modal.tsx Escape handler — migration decision

`Modal.tsx:88-98` has `handleKeyDown` on the backdrop `m.div` (JSX `onKeyDown`, not `addEventListener`). It calls `e.stopPropagation()` before `onClose()`. The brief asks whether to migrate this to `useHotkeys("escape", onClose)` inside Modal.

**Recommendation: keep the existing JSX `onKeyDown` pattern.**

Rationale: The current `e.stopPropagation()` prevents Escape from closing a parent modal when a nested modal (e.g. `ConfirmDialog` rendered inside `SettingsModal`) is open. If both parent and nested Modal migrate to `useHotkeys("escape")`, both would fire simultaneously on the first keydown — react-hotkeys-hook does not have built-in modal-stack awareness. The JSX `onKeyDown` + `stopPropagation` pattern is the correct mechanism for modal layering.

The help overlay is the one case where `useHotkeys("escape")` in the overlay itself would be fine (no nested modals), but Modal.tsx already handles Escape via JSX — so the overlay can just delegate to `Modal`'s existing pattern.

### 3.3 `src/lib/shortcuts.ts` location is correct

`src/lib/` is the right home. It currently contains utility modules (`cssVars.ts`, `dateUtils.ts`) and the `googlePhotos/` namespace. A `shortcuts.ts` registry fits that pattern. **Do not put it in `src/storage/` or `src/types/`** — it's neither persisted state nor a TypeScript type definition.

### 3.4 `src/components/help/` directory — create it

`src/components/help/` does not exist. The brief's proposal to create it is sound. The flat alternative (`src/components/KeyboardHelpOverlay.tsx`) is also fine for a single file, but `help/` scales better if a second help-surface file (e.g. `KeyboardHelpOverlay.css`) is added. Given the CSS file will accompany the component, `help/` is preferred.

### 3.5 Cmd+/ cross-platform: `meta+slash` vs `mod+slash`

react-hotkeys-hook v5 uses `meta` to mean the Meta/Cmd key on Mac and the Windows key on Windows. The cross-platform idiom for Cmd (Mac) + Ctrl (Win/Linux) is `"meta+slash, ctrl+slash"` — two entries in the keys string, comma-separated. The `mod+slash` shorthand (used in some hotkey libraries) is **not** documented in react-hotkeys-hook v5; use the explicit form.

No existing handler responds to `"/"` or `Cmd+/` anywhere in `src/` (grep returned empty). Zero conflict risk.

### 3.6 `react-hotkeys-hook` is not yet installed

`package.json` has no entry for `react-hotkeys-hook`. The dependency tree is: `@crxjs/vite-plugin`, `lucide-react`, `motion`, `react`, `react-dom`, `three`, `@react-three/fiber`. The new lib is a net-new addition.

### 3.7 App.tsx lazy-load pattern for KeyboardHelpOverlay

The existing App.tsx lazy pattern is:
```ts
const SettingsModal = lazy(() =>
  import("@/components/settings/SettingsModal").then((m) => ({ default: m.SettingsModal }))
);
```
Mirror exactly, but if `KeyboardHelpOverlay` is the default export, the `.then(m => ({ default: m.default }))` unwrapping can be omitted. Place the `lazy()` call near the other lazy UI imports (lines 75–122 of App.tsx). Mount as `<Suspense fallback={null}><KeyboardHelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} /></Suspense>` near the bottom of the return tree (after the `<ChatPanel>` Suspense block).

### 3.8 ChatPanel.tsx trapFocus `onKeyDown` at line 63 — KEEP

`ChatPanel.tsx:63` has `onKeyDown={trapFocus}` on the panel `div`. This is the JSX-level focus-trap, separate from the imperative Escape listener at lines 48–55. After migrating lines 48–55 to `useHotkeys`, the `trapFocus` JSX handler remains intact. Do not remove it.

### 3.9 `enableOnFormTags` is needed for ChatPanel

The Escape handler in ChatPanel fires while focus is inside the chat `<textarea>` (ChatInput). `useHotkeys("escape", onClose, { enableOnFormTags: true })` is required or the hook will silently ignore the keypress when a form element is focused. Same consideration for any future escape handler wired to a context where an input may be focused.

### 3.10 Bundle impact

Current package.json shows no `react-hotkeys-hook`. Post-install initial chunk will grow by ~3 kB gz. The brief states post-m7 baseline is 251.52 kB gz; target after m10 is ~255 kB — well inside the 400 kB soft ceiling and 500 kB hard ceiling from CLAUDE.md. `react-hotkeys-hook` claims zero peer dependencies beyond React itself (which is already in the tree). The `KeyboardHelpOverlay` component is lazy-loaded, so only `shortcuts.ts` (~0.5 kB) enters the initial chunk.

---

## 4. Open Questions for the Implementer

1. **Modal.tsx Escape migration**: The brief implies Modal's Escape handling could migrate to `useHotkeys`. The codebase analysis above recommends keeping the existing JSX `onKeyDown + stopPropagation` pattern for modal-stacking correctness. Confirm this is acceptable, or if react-hotkeys-hook's `options.enabled` + a modal-stack ref can be used to gate firing.

2. **`shortcuts.ts` structure**: What shape should the registry entries take? Minimum viable: `{ keys: string; description: string; category: "Navigation" | "Editing" | "App" }[]`. The Escape+modal pattern is convention-based (every modal closes on Escape), not explicitly registered — should the registry include it as a pseudo-entry or only list explicitly registered `useHotkeys` bindings?

3. **`KeyboardHelpOverlay` trigger key behavior**: Should `meta+slash` toggle (open if closed, close if open) or open-only (with Escape as the close path)? The brief says `open => !open` toggle. If the overlay is open and the user presses Cmd+/ again, does `useHotkeys` fire or does the Modal's own Escape/backdrop-click handling take precedence? Confirm intended UX.

4. **`useHotkeys` for ChatPanel inside `ChatPanel.tsx` vs in App.tsx**: The Escape handler at ChatPanel.tsx:53 is mounted when the chat panel is open (the component renders only when `chatOpen` is true in App.tsx:92 Suspense gate). Migrating it to `useHotkeys` inside `ChatPanel.tsx` is correct; no reason to lift it to App.tsx.

5. **Caret pin for `react-hotkeys-hook`**: The brief says `npm install react-hotkeys-hook@latest`. The OSS scout will verify the exact version — confirm whether the implementer should pin a caret (`^5.x.x`) or an exact version given MV3 extension paranoia about supply-chain updates.

---

## 5. External Writes Required

- `npm install react-hotkeys-hook` — installs the new dependency and updates `package.json` + `package-lock.json`
- `git push origin main` — publishes committed changes to GitHub after build verification
