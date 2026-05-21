---
milestone_id: "frontend-uplift-2026q2-m11"
researcher: "explore"
agent_type: "codebase-context"
external_writes_required:
  - "git push origin main"
sources: []
injection_attempts: 0
---

# Codebase-Context Brief — frontend-uplift-2026q2-m11

## 1. TL;DR

App.tsx is at `src/newtab/App.tsx` (not `src/App.tsx`). The `mod+slash` / `helpOpen` precedent
in App() (lines 325–329) is the exact insertion point for `mod+k` / `paletteOpen`. `setHelpOpen`
IS in App() scope — confirmed. `setSettingsOpen` and `settingsOpen` are ONLY in the `Header()`
memo at lines 183–185 — NOT accessible from App() scope. The lowest-diff bridge is a
`OPEN_SETTINGS_EVENT = "proclivity:open-settings"` custom event in `constants.ts`, mirroring the
`NAV_CLOSED_EVENT` pattern exactly. `src/components/palette/` does NOT exist — m11 creates it.
The initial chunk is 258,283 bytes minified / ~83.5 kB gz; with cmdk lazy-loaded the initial
chunk grows by only the `lazy(() => import(...))` boilerplate (~50 bytes).

---

## 2. File Inventory

| File | Status | Nature of change |
|---|---|---|
| `src/newtab/App.tsx` | MODIFY | Add `paletteOpen` state + `useHotkeys("mod+k", ...)` + `<CommandPalette>` lazy import + Suspense mount |
| `src/lib/shortcuts.ts` | MODIFY | Add `mod+k` entry (and optionally per-nav entries) to `SHORTCUTS` array |
| `src/storage/constants.ts` | MODIFY | Add `OPEN_SETTINGS_EVENT = "proclivity:open-settings"` constant |
| `src/newtab/Header()` (inside App.tsx) | MODIFY | Add `useEffect` listening for `OPEN_SETTINGS_EVENT` → `setSettingsOpen(true)` (4-line addition) |
| `src/components/palette/` | CREATE (dir) | New directory — mirrors `src/components/help/` convention |
| `src/components/palette/CommandPalette.tsx` | CREATE | Main palette component using `cmdk`; lazy-loaded |
| `src/components/palette/CommandPalette.css` | CREATE | Palette styles — mirrors `KeyboardHelpOverlay.css` convention |
| `src/lib/palette-commands.ts` | CREATE | v0 command registry with `PaletteCommand` interface |
| `package.json` + `package-lock.json` | MODIFY | `npm install cmdk@latest` adds cmdk@1.1.1 + 26 transitive deps |

---

## 3. Implementation Notes / Gotchas

### 3.1 App.tsx file location
The file is at `src/newtab/App.tsx`, not `src/App.tsx`. The alias `@/` resolves to `src/`
(not `src/newtab/`). Lazy imports must use `@/components/palette/CommandPalette` for consistency
with all other lazy imports in the file.

### 3.2 m10 `mod+slash` is the canonical insertion point
The `mod+k` useHotkeys call must go immediately after the existing `mod+slash` block:

```typescript
// App.tsx lines 325–329 (existing):
useHotkeys(
  "mod+slash",
  () => setHelpOpen((open) => !open),
  { preventDefault: true, description: "Show keyboard shortcuts" },
);

// m11: insert directly below
const [paletteOpen, setPaletteOpen] = useState(false);
useHotkeys(
  "mod+k",
  () => setPaletteOpen((open) => !open),
  { preventDefault: true, description: "Open command palette" },
);
```

The `preventDefault: true` option is mandatory — Cmd+K's default Chrome behavior is to focus
the address bar (in the browser context); in the extension new-tab context it may do nothing,
but using preventDefault is consistent with the m10 `mod+slash` precedent and future-proofs
against browser changes.

### 3.3 `setSettingsOpen` is in Header() scope — not App() scope (CONFIRMED)
`settingsOpen` and `setSettingsOpen` are declared at lines 183–185 of App.tsx:
```typescript
const [settingsOpen, setSettingsOpen] = useState(
  () => pendingInitialPane !== undefined,
);
```
This is INSIDE `const Header = memo(function Header() { ... })` (line 173). It is NOT in
`export default function App()` (line 320). The `CommandPalette` component will be mounted
in `App()` return. There is no prop-drilling path from CommandPalette → Header.

**Recommended solution — custom event (4 lines to Header):**
1. Add to `constants.ts`: `export const OPEN_SETTINGS_EVENT = "proclivity:open-settings";`
2. Add to `Header()`:
   ```typescript
   useEffect(() => {
     const handler = () => setSettingsOpen(true);
     window.addEventListener(OPEN_SETTINGS_EVENT, handler);
     return () => window.removeEventListener(OPEN_SETTINGS_EVENT, handler);
   }, []);
   ```
3. In `CommandPalette.tsx`, the "Open Settings" command action:
   ```typescript
   window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT));
   ```

This is the exact same topology as `NAV_CLOSED_EVENT` (dispatched by ClosedScopeCounter,
caught by App.tsx). Here the dispatch is from CommandPalette and the catch is in Header().

**Alternative: lift state to App():** Move `settingsOpen/setSettingsOpen/pendingInitialPane/
setPendingInitialPane` out of `Header()` into `App()`, pass as props to Header. This is a
larger refactor — changes Header's memo signature and the `<SettingsModal>` mount point. Only
recommended if the broader architectural direction wants all modal state in App().

### 3.4 `setHelpOpen` is in App() scope — confirmed (easy)
`helpOpen` and `setHelpOpen` are declared at line 324:
```typescript
const [helpOpen, setHelpOpen] = useState(false);
```
This is inside `export default function App()`. `CommandPalette` receives `onOpenHelp` as a
prop: `() => setHelpOpen(true)`. No event bridge needed.

### 3.5 `setTab` is in App() scope — confirmed (easy)
`tab` and `setTab` are declared at line 321:
```typescript
const [tab, setTab] = useState<Tab>("today");
```
`CommandPalette` receives `onSwitchTab: (tab: Tab) => void` as a prop. The `Tab` type union
is declared at lines 131–139 — it must be imported by CommandPalette or extracted to a shared
types file. Simplest approach: import `Tab` from `@/types` if it's already exported there, or
import it from `src/newtab/App.tsx` (named export of the type). Check `src/types/index.ts`
for whether `Tab` is already there — if not, the implementer should either export it or
redeclare it in `palette-commands.ts` as `type TabId = "today" | "sprint" | ...`.

### 3.6 `TABS` array and visibility
The `TABS` array (lines 140–151) lists 7 tabs including "closed". The `visibleTabs` memo
(lines 417–423) filters by `rs.sectionVisibility`. The CommandPalette should use `visibleTabs`
(passed as a prop) rather than the raw `TABS` array — otherwise it will present section-switch
commands for tabs the user has hidden. Pass `visibleTabs` as a prop to `CommandPalette`.

### 3.7 "Create todo" — no App-level hook
`editingId` and `setEditingId` live as local state inside `TodoList` (line 54). `SprintManager`
has its own copy (line 675). There is no cross-section "create todo" intent-dispatch mechanism.
For v0, the recommended approach is either:
  - **Omit "create todo" entirely** from v0 — limits v0 to: Open Settings, 7 section-switch
    commands (filtered to visible tabs), Open Keyboard Help. This is 2–9 commands, all clean.
  - OR dispatch `OPEN_CREATE_TODO_EVENT = "proclivity:create-todo"` — caught by `TodoList` to
    focus the `<input>` add-todo field. This requires a `useEffect` in `TodoList` listening for
    the event. Note: the event would need to specify which scope to target (Today? Active tab?).
    This is non-trivial because the active tab value lives in App(), not TodoList.

Given the brief says "4–6 commands at v0", omitting "create todo" (or making it just "focus
Today tab + nothing else") keeps v0 clean. The brief explicitly calls this out as one of the 4–6.
If included, the cleanest v0 scope is: dispatch event that focuses the Today tab's add-input.

### 3.8 Lazy-load pattern — exact idiom to follow

**Named-export unwrap pattern** (used by SettingsModal, ClosedTodosView):
```typescript
const CommandPalette = lazy(() =>
  import("@/components/palette/CommandPalette").then((m) => ({ default: m.CommandPalette })),
);
```

**Default-export pattern** (used by KeyboardHelpOverlay, MeshBackground, Calendar, Photos,
ChatPanel):
```typescript
const CommandPalette = lazy(
  () => import("@/components/palette/CommandPalette"),
);
```

Use the **default-export pattern** for CommandPalette — `KeyboardHelpOverlay` (the closest
architectural sibling) uses a default export. Keep cmdk's import ONLY inside
`CommandPalette.tsx`; do not import cmdk in App.tsx.

Suspense mount in App() return, outside `.app`, below KeyboardHelpOverlay (mirrors exact
placement of the help overlay):
```tsx
{/* Command palette — outside .app so it renders above all sections via cmdk's Dialog portal */}
<Suspense fallback={null}>
  <CommandPalette
    open={paletteOpen}
    onClose={() => setPaletteOpen(false)}
    onSwitchTab={setTab}
    onOpenHelp={() => setHelpOpen(true)}
    visibleTabs={visibleTabs}
  />
</Suspense>
```

### 3.9 `<Command.Dialog>` vs `<Modal>` — do NOT nest
`cmdk`'s `<Command.Dialog>` is a Radix Dialog wrapper. It brings its own focus trap via
`@radix-ui/react-focus-scope`. Nesting it inside `Modal.tsx` would create dual focus-traps.

Use `<Command.Dialog open={open} onOpenChange={...}>` directly. Do NOT wrap with `Modal`.

cmdk's `<Command.Dialog>` provides: focus-trap, Escape dismissal, backdrop click, focus
return to previously focused element — all the same amenities as `Modal.tsx`. Note that
`Modal.tsx` uses motion `m.div` for AnimatePresence animations; `Command.Dialog` does not
— the palette will have a non-animated open/close by default unless the implementer wraps
the dialog content with `m.div`. For v0, non-animated is acceptable (brief does not require
the m7 modal animation on the palette).

### 3.10 `shortcuts.ts` — add `mod+k` entry
```typescript
export const SHORTCUTS: readonly Shortcut[] = [
  {
    keys: "mod+slash",
    label: "Show keyboard shortcuts",
    category: "App",
  },
  {
    keys: "mod+k",
    label: "Open command palette",
    category: "App",
  },
  {
    keys: "escape",
    label: "Close panel / modal",
    category: "App",
  },
];
```
Per-command aliases (e.g. "Switch to Today") do NOT need SHORTCUTS entries — the KeyboardHelpOverlay
is for global hotkeys. The palette's own command labels are discoverable from the palette itself.
The `keywords[]` prop on `<Command.Item>` provides alias fuzzy-matching without SHORTCUTS pollution.

### 3.11 `mod+k` collision — clear
Grep result: **zero** existing `mod+k`, `meta+k`, or `ctrl+k` handlers in `src/`. The only
match in `shortcuts.ts` is a comment referencing the palette as a future milestone (line 6).
`preventDefault: true` will override Chrome's address-bar behavior on the new-tab page.

### 3.12 `src/components/palette/` directory convention
`src/components/help/` contains `KeyboardHelpOverlay.tsx` + `KeyboardHelpOverlay.css` (plus
LogViewer and NanoSection — unrelated). The palette dir should contain:
- `CommandPalette.tsx` (default export)
- `CommandPalette.css`

`src/lib/palette-commands.ts` goes in `src/lib/` (alongside `shortcuts.ts`) — not inside
the `palette/` component directory, since it's pure data (no JSX).

### 3.13 Initial chunk budget
Current initial chunk: `index.html-DJXFESv5.js` = **258,283 bytes minified / ~83.5 kB gz**.
Budget: 400 kB soft / 500 kB hard (per CLAUDE.md, revised 2026-05-20).
With cmdk fully lazy-loaded, the initial chunk grows only by the `lazy(() => import(...))` call
(~50 bytes) and the `useState(false)` + `useHotkeys` call (~30 bytes) — effectively zero growth.
The entire cmdk dep tree (~46 kB minified / 14.9 kB gz) lands in the `CommandPalette-*.js` lazy
chunk. The 258 kB initial chunk is well under the 400 kB soft ceiling.

### 3.14 `Tab` type availability
The `Tab` type (lines 131–139 of App.tsx) is a LOCAL type in `src/newtab/App.tsx` — not in
`src/types/index.ts`. The implementer has two options:
  a. Export it from App.tsx (`export type Tab = ...`) and import in `palette-commands.ts`
  b. Redeclare a `TabId` type in `palette-commands.ts` (duplication, but avoids tight coupling
     to App.tsx's internal type)
  
Option (a) is cleaner. Export the `Tab` type from App.tsx.

### 3.15 `<Command.Dialog>` Escape behavior and Modal.tsx Escape
`Modal.tsx`'s `handleKeyDown` (line 88–98) calls `e.stopPropagation()` on Escape. cmdk's
`<Command.Dialog>` uses Radix `@radix-ui/react-use-escape-keydown` which listens on
`document.keydown`. Since CommandPalette does NOT use `Modal.tsx`, the Escape handlers
are independent. No conflict.

However: if BOTH the palette and a Modal (e.g. SettingsModal) are open simultaneously
(edge case), Escape will close both via their respective Radix/custom handlers. This is
acceptable behavior for v0 — the palette closing settings simultaneously is fine.

---

## 4. Open Questions for the Implementer

1. **"Create todo" scoping:** Include or exclude from v0? If include: which scope (always
   Today? Active tab? Prompt for scope inside palette)? Easiest v0 path: dispatch event
   that switches to Today tab and focuses the add-input. This requires a
   `FOCUS_ADD_TODO_EVENT = "proclivity:focus-add-todo"` caught by `TodoList` with a
   `scope === "today"` guard. If this adds scope creep, omit "create todo" from v0.

2. **`Tab` type export:** Should `Tab` be exported from `App.tsx` as a named export for
   `palette-commands.ts` to import? Or should a separate `TabId` type be defined in
   `src/types/index.ts`? The latter is architecturally cleaner but requires a types PR.

3. **Settings state lift vs custom event:** The brief implies `onOpenSettings` would be a
   simple callback prop. It cannot be — `setSettingsOpen` is in Header's scope. The
   implementer must choose: custom event (4-line addition, recommended) OR lift state.
   Confirm which path before writing code.

4. **v0 command count:** With visible-tabs switching, the command count scales with user
   settings. If the user has all 7 tabs visible: Open Settings + 7 tab-switches + Open Help
   = 9 commands. Brief says "4–6 commands". If this is a hard constraint, hide some tabs or
   group them. Clarify whether 4–6 is a "typical user" count or an absolute cap.

5. **Palette open keybinding — `mod+k` vs `meta+k, ctrl+k`:** Brief uses `"meta+k, ctrl+k"`
   in the story text; m10 precedent uses `"mod+slash"`. Use `"mod+k"` (single string, react-
   hotkeys-hook resolves `mod` to metaKey on Mac / ctrlKey elsewhere). Do NOT use the
   two-alias form — it would create two hotkeys registrations for the same action.

---

## 5. External writes required

```yaml
external_writes_required:
  - "git push origin main"
```

No CWS publish required for m11.
