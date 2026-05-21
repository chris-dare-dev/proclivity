# Research synthesis — frontend-uplift-2026q2-m11

**Milestone:** UPL-18 — `cmdk` Cmd+K command palette, lazy-loaded
**Date:** 2026-05-20
**Author:** orchestrator (main session, Phase 1 fan-in)
**Sources:** brief-1.md (explore — 15 gotchas + file inventory + insertion-point analysis), brief-2.md (general — cmdk@1.1.1 verified, Radix peer-dep sizing, CSP-clean source inspection)

---

## 1. TL;DR for the implementer

The heaviest e4 milestone — but the heavy parts ALL go in a lazy chunk. Initial chunk grows by only the `lazy(() => import(...))` + `useState(false)` + `useHotkeys` boilerplate (≤100 bytes net).

**Key architectural finding (both briefs converge):** `setSettingsOpen` lives in `Header()` memo scope (App.tsx:183), NOT in `App()` scope. Since CommandPalette mounts in `App()` return as a sibling of Header, there's no prop-drilling path. **Use the `OPEN_SETTINGS_EVENT` custom-event pattern** (mirrors the existing `NAV_CLOSED_EVENT` shape) — 4-line addition to Header, no prop changes.

**Use `<Command.Dialog>` directly, NOT wrapped in `<Modal>`.** Radix Dialog (which `Command.Dialog` wraps) provides focus-trap + Escape + focus-return natively. Nesting in m7's `<Modal>` would create dual focus-traps and dual portals.

**v0 command set** — exclude "create todo" (no clean App-level intent dispatch path; brief-1 §3.7 confirmed `editingId` is internal to TodoList). v0 surfaces:
- Open Settings (via `OPEN_SETTINGS_EVENT` dispatch)
- Switch to <each VISIBLE tab> (via `setTab` callback; respects `visibleTabs` per brief-1 §3.6)
- Open Keyboard Help (via `setHelpOpen` callback)

That's 2 + N_visible_tabs commands (N ranges 0-7 based on user settings). With all defaults visible = 9 commands. Brief says "4-6"; treat as a guideline, not a hard cap.

**Path decision:** `delegated` — 7-8 unique paths touched (package.json, package-lock.json, App.tsx, shortcuts.ts, constants.ts, palette-commands.ts NEW, CommandPalette.tsx NEW, CommandPalette.css NEW). Dispatch ONE `milestone-implementer` Agent with `isolation: worktree`.

**Expected chunk delta:** initial chunk +≤0.5 kB (boilerplate only). Lazy `CommandPalette-*.js` chunk: ~46 kB minified / ~14.9 kB gz (cmdk + 26 transitive deps). Total npm dep additions: 27 new packages, all CSP-clean (verified in brief-2 §3.7).

---

## 2. Affected files (8 unique paths)

| File | Status | Change |
|---|---|---|
| `package.json` | MODIFY | Add `cmdk@^1.1.1` to dependencies |
| `package-lock.json` | MODIFY | 27 new entries (cmdk + 4 direct Radix + 22 transitive) |
| `src/newtab/App.tsx` | MODIFY | (a) export `Tab` type; (b) `const CommandPalette = lazy(...)`; (c) `const [paletteOpen, setPaletteOpen] = useState(false);`; (d) `useHotkeys("mod+k", () => setPaletteOpen((open) => !open), { preventDefault: true, description: "Open command palette" });`; (e) `<Suspense fallback={null}><CommandPalette open={...} onClose={...} onSwitchTab={setTab} onOpenHelp={() => setHelpOpen(true)} visibleTabs={visibleTabs} /></Suspense>` near KeyboardHelpOverlay mount; (f) INSIDE `Header()`: `useEffect` listening for `OPEN_SETTINGS_EVENT` → `setSettingsOpen(true)` (4-line addition) |
| `src/lib/shortcuts.ts` | MODIFY | Add `{ keys: "mod+k", label: "Open command palette", category: "App" }` (insertion point: between `mod+slash` and `escape` entries) |
| `src/storage/constants.ts` | MODIFY | Add `export const OPEN_SETTINGS_EVENT = "proclivity:open-settings";` constant (mirror NAV_CLOSED_EVENT shape) |
| `src/lib/palette-commands.ts` | NEW | Pure data + types: `PaletteCommand` interface with `id`, `label`, `keywords` (optional), `action` (a `(deps) => void` closure that takes the palette's dependency object) |
| `src/components/palette/CommandPalette.tsx` | NEW | Default-exported lazy component. Imports `Command` from `cmdk`. Renders `<Command.Dialog open={open} onOpenChange={...}><Command.Input ... /><Command.List><Command.Item .../>...</Command.List></Command.Dialog>`. Reads PALETTE_COMMANDS from `@/lib/palette-commands`. Dispatches actions on Enter / click. |
| `src/components/palette/CommandPalette.css` | NEW | Palette styles. Mirrors `KeyboardHelpOverlay.css` convention. Use theme tokens (`--panel`, `--border`, `--text`, `--text-dim`, `--accent`). |

Total: 8 unique paths (3 modified, 4 new, 1 modified inside App.tsx Header() scope — counted as part of App.tsx file).

---

## 3. Architecture decisions made during synthesis

### 3.1 Use `<Command.Dialog>` directly — do NOT wrap in `<Modal>`

Brief-1 §3.9 + brief-2 §3.4: `cmdk`'s `<Command.Dialog>` is a Radix Dialog wrapper. It brings focus-trap (`@radix-ui/react-focus-scope`), Escape dismissal (`@radix-ui/react-use-escape-keydown`), backdrop click, and focus-return (Radix Dialog default). Nesting in our `Modal.tsx` would create dual focus-traps and dual portals. The palette will have a **non-animated open/close** in v0 (Radix Dialog doesn't ship motion animation by default). Acceptable for v0 — the brief does not require the m7 modal animation on the palette.

### 3.2 `OPEN_SETTINGS_EVENT` custom-event pattern (NAV_CLOSED_EVENT shape)

Brief-1 §3.3 + brief-2 §4 Risk: `setSettingsOpen` is in `Header()` memo scope (App.tsx:183), not App() scope. CommandPalette mounts in App() as a sibling of Header — no prop path exists. The lowest-diff bridge is a custom event:

1. **`src/storage/constants.ts`**: `export const OPEN_SETTINGS_EVENT = "proclivity:open-settings";` (mirrors `NAV_CLOSED_EVENT`).
2. **`Header()` inside App.tsx**: `useEffect(() => { const handler = () => setSettingsOpen(true); window.addEventListener(OPEN_SETTINGS_EVENT, handler); return () => window.removeEventListener(OPEN_SETTINGS_EVENT, handler); }, []);`
3. **`CommandPalette.tsx`**: action handler dispatches `window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT));`.

Same topology as the existing `ClosedScopeCounter → NAV_CLOSED_EVENT → App.tsx` event bridge.

### 3.3 Export `Tab` type from App.tsx

Brief-1 §3.14: the `Tab` union is currently a local type at `src/newtab/App.tsx:131-139`. CommandPalette + palette-commands need it. Add `export` keyword to the `Tab` type declaration. Cleaner than redeclaring; Option (a) from brief-1.

### 3.4 v0 commands — exclude "create todo"

Brief-1 §3.7 + brief-2 §3.6: there's no App-level intent-dispatch path for "create todo." TodoList owns `editingId` locally; SprintManager owns its own copy. Wiring this requires a second custom-event bridge (`FOCUS_ADD_TODO_EVENT`) caught by TodoList with a scope guard. **Exclude from v0** to keep this milestone tight. Future milestone (or a v1 follow-up) can add it.

v0 command set:
- **"Open Settings"** → dispatches `OPEN_SETTINGS_EVENT` (CustomEvent on `window`)
- **"Switch to <tabLabel>"** → calls `onSwitchTab(tabId)` for each tab in `visibleTabs` (respects user's `sectionVisibility` settings per brief-1 §3.6 — not the raw `TABS` array)
- **"Open keyboard shortcuts"** → calls `onOpenHelp()` (which sets `helpOpen` true in App.tsx)

Command count: 2 + |visibleTabs| (range 2-9 based on settings; typical 7-9). Brief said "4-6" but with `visibleTabs` filtering and default settings showing 7 tabs, 9 total is unavoidable. Acceptable.

### 3.5 `mod+k` (single string), `preventDefault: true`

Brief-1 §3.2: mirror the m10 `mod+slash` pattern. Single string (`react-hotkeys-hook`'s `mod` token resolves to `metaKey` on Mac / `ctrlKey` elsewhere). `preventDefault: true` overrides Chrome's address-bar Cmd+K behavior in the new-tab context (probably a no-op anyway, but consistent with m10).

### 3.6 `description` synced with `shortcuts.ts` label

Per the m10 rect L1 lesson: `useHotkeys("mod+k", ..., { description: "Open command palette" })` must match `SHORTCUTS[mod+k].label` exactly. Both strings = `"Open command palette"`.

### 3.7 Default-export lazy pattern (mirror KeyboardHelpOverlay)

Brief-1 §3.8: `const CommandPalette = lazy(() => import("@/components/palette/CommandPalette"))`. CommandPalette is default-exported. All cmdk imports live ONLY inside CommandPalette.tsx — NOT in App.tsx. Mount via `<Suspense fallback={null}><CommandPalette .../></Suspense>` near the existing KeyboardHelpOverlay mount.

### 3.8 `palette-commands.ts` shape

Pure data module in `src/lib/`. Define a `PaletteCommand` interface and a `PALETTE_COMMANDS` array (or factory function that takes the deps object — see below).

Options for the action shape:

**Option A — closure that takes deps:**
```ts
export interface PaletteCommandDeps {
  switchTab: (tab: Tab) => void;
  openHelp: () => void;
  closePalette: () => void;
}
export interface PaletteCommand {
  id: string;
  label: string;
  keywords?: string[];
  action: (deps: PaletteCommandDeps) => void;
}
export const PALETTE_COMMANDS: readonly PaletteCommand[] = [
  { id: "settings", label: "Open Settings", keywords: ["preferences", "config"],
    action: ({ closePalette }) => { window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT)); closePalette(); } },
  { id: "help", label: "Open keyboard shortcuts", keywords: ["help", "shortcuts"],
    action: ({ openHelp, closePalette }) => { openHelp(); closePalette(); } },
  // Tab-switch commands generated inside CommandPalette from visibleTabs (see §3.9).
];
```

**Option B — flat array, tab-switches inline:** CommandPalette.tsx builds the action mapping inline rather than via a generic `PaletteCommand.action` shape.

**Decision:** Option A for the static commands (Settings, Help). Tab-switch commands are dynamic (depend on `visibleTabs`) and built inline in CommandPalette.tsx — they don't need a static registry entry.

### 3.9 Tab-switch commands generated from `visibleTabs`

Brief-1 §3.6: pass `visibleTabs` as a prop to CommandPalette. Inside CommandPalette, map over `visibleTabs` and emit one `<Command.Item>` per visible tab:

```tsx
{visibleTabs.map((tab) => (
  <Command.Item
    key={tab.id}
    value={`switch-${tab.id}`}
    keywords={[tab.label.toLowerCase()]}
    onSelect={() => { onSwitchTab(tab.id); onClose(); }}
  >
    Switch to {tab.label}
  </Command.Item>
))}
```

### 3.10 Palette closes after action

Every action closes the palette via `onClose()`. Don't leave the palette open after a tab-switch — the user expects modal-style "do thing → return to app".

### 3.11 Initial-chunk budget verification

Current initial chunk: 258.28 kB (post-m10). With cmdk fully lazy:
- The `lazy(() => import(...))` boilerplate, `useState(false)`, `useHotkeys(...)`, and `<Suspense><CommandPalette ... /></Suspense>` add ~100 bytes total.
- Expected new initial chunk: ~258.4 kB (negligible delta).
- Lazy `CommandPalette-*.js` chunk: ~46 kB minified / ~14.9 kB gz.
- Well under the CLAUDE.md 400 kB soft warn / 500 kB hard ceiling.

### 3.12 `mod+k` collision-free

Brief-1 §3.11 + brief-2: `grep -rn 'mod+k|meta+k|ctrl+k' src/` returns empty. No existing handler. Chrome's default Cmd+K behavior (focus address bar) is preempted by `preventDefault: true` on the new-tab page.

### 3.13 CSP-clean

Brief-2 §3.7: cmdk source verified clean. Radix Dialog and all 26 transitive deps inspected. `get-nonce` reads a `<script nonce>` attribute that doesn't exist in MV3 contexts — gracefully falls back to standard `<style>` injection. No `eval`, `Function`, `innerHTML`, or `dangerouslySetInnerHTML`.

---

## 4. external_writes_required

```yaml
external_writes_required:
  - "npm install cmdk"
  - "git push origin main"
```

The `npm install cmdk` is a local-only write (modifies package.json + package-lock.json + node_modules/). Recorded for audit; does not block Phase 4.

---

## 5. Implementation strategy (delegated path)

The implementer should follow this sequence:

1. **`npm install cmdk`** at `^1.1.1`. Build to confirm the deps tree is clean.

2. **Modify `src/storage/constants.ts`** — add `OPEN_SETTINGS_EVENT` constant adjacent to `NAV_CLOSED_EVENT`.

3. **Export `Tab` type from `src/newtab/App.tsx`** — add `export` keyword at the type declaration (line ~131).

4. **Create `src/lib/palette-commands.ts`** — `PaletteCommand` + `PaletteCommandDeps` types + `PALETTE_COMMANDS` static array (Settings + Help). Import `OPEN_SETTINGS_EVENT` from constants.

5. **Create `src/components/palette/CommandPalette.tsx`** (default export):
   - Props: `{ open, onClose, onSwitchTab, onOpenHelp, visibleTabs }` (typed).
   - Render `<Command.Dialog open={open} onOpenChange={(open) => !open && onClose()}><Command.Input placeholder="Type a command..." /><Command.List><Command.Empty>No results.</Command.Empty>` static `PALETTE_COMMANDS` mapped to `<Command.Item>`, then `visibleTabs` mapped to `<Command.Item>`</Command.List></Command.Dialog>`.
   - Each Item's `onSelect` calls the action + `onClose()`.

6. **Create `src/components/palette/CommandPalette.css`** — overlay backdrop styling, dialog panel styling (`--panel` / `--border`), input styling, list/item styling, selected-state styling (`--accent`). Mirror KeyboardHelpOverlay.css conventions.

7. **Modify `src/lib/shortcuts.ts`** — add `{ keys: "mod+k", label: "Open command palette", category: "App" }`.

8. **Modify `src/newtab/App.tsx`**:
   - Add `const CommandPalette = lazy(() => import("@/components/palette/CommandPalette"));` near other lazy imports.
   - Add `const [paletteOpen, setPaletteOpen] = useState(false);` near other useState calls.
   - Add `useHotkeys("mod+k", () => setPaletteOpen((open) => !open), { preventDefault: true, description: "Open command palette" });` after the existing `mod+slash` block.
   - Add `<Suspense fallback={null}><CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onSwitchTab={setTab} onOpenHelp={() => setHelpOpen(true)} visibleTabs={visibleTabs} /></Suspense>` near the KeyboardHelpOverlay mount.
   - Inside `Header()` memo, add the `useEffect` listening for `OPEN_SETTINGS_EVENT`.

9. **`npm run build`** — verify:
   - Initial chunk ≤ 260 kB (target essentially unchanged from 258.28).
   - A separate `CommandPalette-*.js` lazy chunk exists, sized ~14-15 kB gz.
   - No TS strict errors.

10. **Single commit** — `feat(deps): cmdk Cmd+K command palette (m11)` (sample subject, 38 chars after `feat(deps): ` prefix; under 50-char cap).

The post-implementation `grep -rn 'cmdk' src/` should match ONLY `src/components/palette/CommandPalette.tsx` (no leakage of cmdk imports into App.tsx or any non-lazy file).

---

## 6. Implementation acceptance criteria

1. `package.json` includes `cmdk@^1.1.1`.
2. `npm run build` passes clean (strict TS zero errors). Initial chunk ≤ 260 kB.
3. **Lazy-chunk discipline:** `grep -l cmdk dist/assets/*.js` returns the `CommandPalette-*.js` chunk ONLY (NOT the initial `index.html-*.js` chunk).
4. `src/storage/constants.ts` exports `OPEN_SETTINGS_EVENT = "proclivity:open-settings"`.
5. `src/newtab/App.tsx` exports the `Tab` type union.
6. `src/lib/palette-commands.ts` defines `PaletteCommand`, `PaletteCommandDeps`, and `PALETTE_COMMANDS` (with Settings + Help entries, each with `keywords[]` for fuzzy aliases).
7. `src/components/palette/CommandPalette.tsx`:
   - Default export.
   - Uses `<Command.Dialog>` directly (NOT wrapped in `<Modal>`).
   - Static commands from `PALETTE_COMMANDS` rendered first.
   - Tab-switch commands generated inline from `visibleTabs` prop.
   - Every command's `onSelect` calls its action + `onClose()`.
8. `src/lib/shortcuts.ts` has the new `mod+k` entry.
9. App.tsx:
   - `mod+k` hotkey wired with `preventDefault: true` + matching description.
   - CommandPalette mounted under `<Suspense fallback={null}>` near KeyboardHelpOverlay.
   - Header() memo has the `OPEN_SETTINGS_EVENT` listener.
10. **Manual smoke** in dev:
    - Press Cmd+K → palette opens.
    - Type "set" → "Open Settings" is filtered/highlighted; Enter → settings modal opens, palette closes.
    - Type "today" → "Switch to Today" appears; Enter → switches to Today tab, palette closes.
    - Press Escape → palette closes.
    - Press Cmd+K while palette is open → palette closes (toggle).
    - In Settings → toggle a section's visibility off → re-open palette → that tab is missing from switch commands.

---

## 7. Riskiest assumption + alternative

**Risk (brief-2 §4):** the `OPEN_SETTINGS_EVENT` bridge introduces a second cross-component event topology (after `NAV_CLOSED_EVENT`). If the implementer over-uses this pattern for "create todo" and other future commands, the codebase accrues an undocumented event bus. The pattern is sound for ONE more event (settings), but should not become the default.

**Mitigation:** Document the pattern in the commit body. For v0, only `OPEN_SETTINGS_EVENT` is added. "Create todo" is intentionally deferred to a v1 milestone where the architecture (lift state, Context, or proper bus) can be evaluated.

**Alternative if cmdk's lazy split fails:** brief-1 §3.13 predicts the lazy chunk holds cleanly. If Vite/Rollup hoists cmdk into the initial chunk (some Vite versions surprise here — m7 had this exact failure mode), fall back to a custom `<dialog>` + `<input>` + manual fuzzy filter (brief-2 Alt 3). Adds ~100 lines of TSX but saves the 14.9 kB gz.

---

## 8. Open questions for the implementer (≤5)

1. **Animation on the palette?** Brief-1 §3.9 notes Radix Dialog doesn't ship motion animation by default. For v0, accept the non-animated open/close. If polish is desired, wrap the dialog's panel content with motion `m.div` (would require importing `m` + `useReducedMotion` into CommandPalette.tsx — adds ~200 bytes to the lazy chunk, no initial-chunk impact). **Recommendation: v0 non-animated; revisit if visual review flags it.**

2. **Command count vs "4-6" target.** Brief-1 §OQ4 + brief-2 §4: with all 7 default-visible tabs + Settings + Help = 9 commands. The roadmap brief said "4-6 commands at v0." Treat the 4-6 as a guideline, not a hard cap — the natural set IS 9 if all tabs are visible. Document in the commit body.

3. **`OPEN_SETTINGS_EVENT` CustomEvent vs DOMEvent.** `window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT))` is idiomatic. The Header's `useEffect` listens via `window.addEventListener`. Both should work; verify the listener type matches the dispatch type.

4. **`Tab` type re-export site.** Adding `export` to App.tsx's `Tab` declaration is the cheapest fix (brief-1 OQ2). The cleaner architectural path is to move `Tab` to `src/types/index.ts`. **Recommendation: cheap fix (export from App.tsx) for v0; if/when a 3rd consumer needs the type, hoist to `src/types/`.**

5. **OSS scout flag for Phase 3.** Set `--include-oss=1` because we're adding cmdk + 4 direct Radix peer-deps + 22 transitive deps. The OSS scout should walk each peer for license / CVE / maintenance / CSP-clean verification.

---

## 9. Scope assessment

- **Path:** delegated (8 unique paths > 5-file inline threshold)
- **Estimated LOC:** ~250-300 (CommandPalette.tsx ~120, palette-commands.ts ~40, CommandPalette.css ~60, App.tsx ~25, shortcuts.ts ~5, constants.ts ~3, package.json ~1, package-lock.json ~auto-gen)
- **Worktree:** YES (delegated-path convention)
- **`--allow-large-diff`:** NO
- **Novel architecture:** Slightly — first use of cmdk + Radix Dialog + custom-event bridge for Settings. Implementer should follow synthesis closely.
- **OSS scout:** YES — `--include-oss` enabled (new deps, ~27 packages)
