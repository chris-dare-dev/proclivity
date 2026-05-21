---
milestone_id: "frontend-uplift-2026q2-m11"
researcher: "general-purpose"
agent_type: "external-and-writes"
external_writes_required:
  - "git push origin main"
sources:
  - url: "https://bundlephobia.com/api/size?package=cmdk"
    sha256: "16646c231653836be20d96f2facbbc55ed7d5fe669a31ebff3ff328f1aabfae2"
    takeaway: "cmdk@1.1.1 total bundle: 14,922 bytes gz / 46,012 bytes minified including all 26 transitive deps."
  - url: "https://registry.npmjs.org/cmdk/latest"
    sha256: "80a2aab25b2125ebcbaf92909304628de0cae68b68eea4e6612da3a407422b9d"
    takeaway: "cmdk@1.1.1 published 2025-03-14; MIT license; peerDeps: react@^18||^19, react-dom@^18||^19."
  - url: "https://github.com/pacocoursey/cmdk/blob/main/README.md"
    sha256: "d53cf18fb121516a977eda7d9001664b1097f45398054923e8142544c01dce87"
    takeaway: "cmdk uses keywords prop per Item for alias/fuzzy matching; built-in command-score fuzzy ranking; tested with VoiceOver + Chrome DevTools."
  - url: "https://raw.githubusercontent.com/pacocoursey/cmdk/main/cmdk/src/index.tsx"
    sha256: "34672487750f03e8b2ff38be17db717894b950cf7ec8eb45ba1458968021b210"
    takeaway: "Items use role=option/aria-selected; list uses role=listbox; input uses role=combobox; no eval/Function/innerHTML — CSP-clean."
injection_attempts: 0
---

# External Research Brief — frontend-uplift-2026q2-m11

## 1. TL;DR (≤5 lines)

cmdk@1.1.1 (MIT, published 2025-03-14) is React 18/19 compatible with a real all-in gz weight of **14.9 kB** (not 15-20 kB — the brief's estimate is close; exact is 14.9 kB). The brief overstates the Radix peer count: cmdk's direct `package.json` deps are only 4 packages (`@radix-ui/react-id`, `@radix-ui/react-dialog`, `@radix-ui/react-primitive`, `@radix-ui/react-compose-refs`), but these bring 22 transitive packages totalling the 14.9 kB gz. Zero Radix packages currently exist in the lockfile — all are new additions. `tslib` is already installed. The riskiest assumption is the architecture for the "open settings" command: `setSettingsOpen` lives inside `Header()` memo scope, not `App()` scope, requiring a custom event (same pattern as `NAV_CLOSED_EVENT`) or a state lift to expose it from the CommandPalette's lazy chunk.

---

## 2. External writes required

```yaml
external_writes_required:
  - "git push origin main"
```

Note: `npm install cmdk` is a local filesystem write (updates `package.json` + `package-lock.json`), not an external write in the pipeline sense. The Chrome Web Store publish is NOT required for m11.

---

## 3. Best-practice findings

### 3.1 cmdk version and license

- **Latest version:** 1.1.1 (published 2025-03-14)
- **Prior versions:** 1.0.3, 1.0.4, 1.1.0, 1.1.1 — the 1.x line is stable
- **License:** MIT confirmed
- **React compat:** peerDeps `react@"^18 || ^19 || ^19.0.0-rc"` — React 18.3.1 (project's current version) is squarely in range
- **Direct deps (4):** `@radix-ui/react-id`, `@radix-ui/react-dialog`, `@radix-ui/react-primitive`, `@radix-ui/react-compose-refs`
- **Maintenance:** 5 open GitHub issues (low cadence); last release 2025-03-14; active but slow-moving. Acceptable for a stable utility.
- Source URL: https://registry.npmjs.org/cmdk/latest

### 3.2 Bundle size breakdown (verified via bundlephobia JSON API)

| Package | Approx minified size | Notes |
|---|---|---|
| cmdk | 24.2 kB | Core package |
| @radix-ui/react-dialog | 12.7 kB | Focus trap + portal overlay |
| @radix-ui/react-dismissable-layer | 8.5 kB | Click-outside dismiss |
| @radix-ui/react-focus-scope | 7.5 kB | Focus trap implementation |
| react-remove-scroll | 12.9 kB | Body scroll lock on open |
| react-remove-scroll-bar | 6.1 kB | Scrollbar width compensation |
| tslib | 21.4 kB | **Already in node_modules** |
| @radix-ui/react-primitive | 5.0 kB | Radix base component |
| @radix-ui/react-presence | 4.1 kB | Animated mount/unmount |
| @radix-ui/react-use-controllable-state | 4.0 kB | Controlled/uncontrolled state |
| aria-hidden | 3.5 kB | a11y tree management |
| @radix-ui/react-slot | 3.2 kB | AsChild pattern |
| use-sidecar | 2.8 kB | Code-split sidecar |
| @radix-ui/react-context | 2.6 kB | React context factory |
| @radix-ui/react-portal | 2.1 kB | DOM portal |
| react-style-singleton | 2.0 kB | CSS injection |
| use-callback-ref | 1.9 kB | Ref callback util |
| **All others** | ~5.6 kB | Small helpers |

**Bundlephobia verified total: 14,922 bytes gzip / 46,012 bytes minified** (all 26 packages combined, excluding React peer). The brief's "15-20 kB gz" estimate was close; exact figure is 14.9 kB gz.

**Effective new cost:** tslib (21.4 kB minified) is already installed. Actual new bytes on disk are ~108 kB minified / ~14.9 kB gz. All of these land in the lazy `CommandPalette-*.js` chunk — zero bytes add to the initial chunk.

Zero `@radix-ui/*` packages are currently in the lockfile (confirmed: `grep radix package-lock.json` returns 0 results). All Radix packages are genuinely new additions.

### 3.3 Lazy-load pattern — confirmed correct

The project has established the exact pattern for cmdk:

```typescript
// App.tsx — add alongside other lazy imports
const CommandPalette = lazy(
  () => import("@/components/palette/CommandPalette"),
);
```

Existing precedents (all use `<Suspense fallback={null}>`):
- `KeyboardHelpOverlay` — lazy-loaded, `open` + `onClose` props, mounted in App() return outside `.app` via Modal portal
- `SettingsModal` — lazy-loaded, `open` + `onClose` props
- `MeshBackground`, `ChatPanel`, `QuickPrompt`, `Calendar`, `ClosedTodosView`, `Photos` — all lazy

The `CommandPalette` component must import cmdk **only inside** `src/components/palette/CommandPalette.tsx`. No cmdk import in App.tsx. This is already how every lazy component works (SettingsModal imports Radix only in its own chunk).

### 3.4 Focus management — Radix Dialog + cmdk

Verified from cmdk source (`index.tsx`):
- `Command.Dialog` is `RadixDialog.DialogProps & CommandProps` — it IS a Radix Dialog overlay
- Radix Dialog provides: (a) focus trap via `@radix-ui/react-focus-scope`, (b) Escape dismissal via `@radix-ui/react-use-escape-keydown`, (c) focus return via `focusScope.paused` restoration on close
- cmdk's `Command.Dialog` does NOT nest inside proclivity's `Modal.tsx` — it creates its own overlay. No conflict.
- `<Command.Dialog open={open} onOpenChange={...}>` is the standard usage pattern
- ARIA roles: `role="combobox"` on input, `role="listbox"` on list, `role="option"` on items, `role="group"` on groups — correct combobox pattern

Focus return on close: Radix Dialog restores focus to the previously focused element (the standard WAI-ARIA dialog pattern). No custom focus-return logic needed.

### 3.5 cmdk filtering and keyword aliases

- **Default algorithm:** `command-score` library (bundled inside cmdk). Scores: continuous match = 1.0, word-boundary jump = 0.9/0.8, character jump = 0.17, transposition penalty = 0.1. Not pure substring — it's weighted fuzzy with word-boundary preference.
- **Keyword aliases:** `<Command.Item keywords={["preferences", "config", "gear"]}>Open Settings</Command.Item>` — keywords are trimmed, scored like value text but don't appear in the UI. Confirmed from source: keywords are passed to the filter function as a third argument.
- **Performance floor:** cmdk iterates all items on every keystroke. With 4-6 commands, cost is immeasurable. Documented threshold (from cmdk README): performance becomes noticeable above ~1000 items without virtualization. V0 command set of 4-6 is trivially fast.
- **`shouldFilter={false}`:** available if the implementer wants to filter externally, but unnecessary for v0.

### 3.6 v0 command set — source-of-truth analysis

Verified against App.tsx state architecture:

| Command | Action | Source | Complexity |
|---|---|---|---|
| Open Settings | `setSettingsOpen(true)` | **Header() memo scope** — NOT in App() scope | HARD — needs event or lift |
| Switch to Today/Sprint/Long-term/Gantt/Calendar/Reminders/Closed | `setTab("today")` etc. | App() scope — `setTab` available | Easy via callback prop |
| Open keyboard help | `setHelpOpen(true)` | App() scope — `setHelpOpen` available | Easy via callback prop |
| Create todo | No App-level hook exists | TodoList manages `editingId` internally | HARD — needs custom event |

**Key architectural finding:** `setSettingsOpen` is declared in `Header()` memo component (line 183), NOT in `App()`. The CommandPalette will be mounted in `App()` return (outside `.app`, same as KeyboardHelpOverlay). There are two viable approaches:

**Option A — Custom events (matches NAV_CLOSED_EVENT pattern):** define `OPEN_SETTINGS_EVENT = "proclivity:open-settings"` in `constants.ts`. CommandPalette dispatches it; Header's `useEffect` catches it and calls `setSettingsOpen(true)`. Same pattern as `ClosedScopeCounter` → `NAV_CLOSED_EVENT` → App.tsx. **Lowest diff surface.**

**Option B — Lift `settingsOpen` + `setSettingsOpen` to App() scope:** pass them down to Header as props. Larger refactor; changes memo component signature. Requires audit of Header's prop boundary.

For "create todo": the simplest v0 approach is `OPEN_CREATE_TODO_EVENT = "proclivity:create-todo"` dispatched from CommandPalette, caught by `TodoList.tsx` (the Today/Sprint section that holds `editingId` state) to set `editingId` to a sentinel like `"NEW"`. This is the same cross-component event topology.

Alternatively, "create todo" could switch to Today tab and focus the add-todo input — if an add-todo affordance exists. Check Today.tsx for an "add todo" button.

### 3.7 CSP compliance

Verified from cmdk source (`index.tsx`): no `eval()`, no `new Function()`, no `innerHTML`, no `dangerouslySetInnerHTML`. Uses React refs, DOM attribute manipulation, and Radix Portal (appends to `document.body`). Radix Dialog source has identical clean pattern. **MV3 CSP `script-src 'self'` is satisfied.**

`get-nonce` (a transitive dep of `react-style-singleton`) is noteworthy: it reads `document.querySelector('script[nonce]')` to propagate Content-Security-Policy nonces to injected `<style>` tags. In Chrome extensions, the new-tab page runs with MV3 CSP but does NOT inject nonces — `get-nonce` will return null and gracefully fall back to standard `<style>` injection. This is not a violation; it is the expected behavior in nonce-less environments.

---

## 4. Riskiest assumption + mitigation

**Riskiest assumption:** The milestone brief assumes CommandPalette can call `setSettingsOpen(true)` as if it has direct access to Header's state. It does not — `setSettingsOpen` is local to `Header()` (a `memo`-wrapped component in App.tsx), and CommandPalette will be mounted as a sibling of Header in App()'s return, with no prop-drilling path.

**Concrete risk:** If the implementer naively passes `onOpenSettings={() => setSettingsOpen(true)}` from App() to CommandPalette, TypeScript will fail because `setSettingsOpen` is not in App() scope. If the implementer tries to pass it as a prop to Header, they must change Header's memo signature and audit downstream re-renders. Either path requires an explicit architectural decision.

**Mitigation:** The lowest-risk path is the custom event approach, directly mirroring `NAV_CLOSED_EVENT`: add `OPEN_SETTINGS_EVENT = "proclivity:open-settings"` to `constants.ts`, dispatch it from `CommandPalette`, and add a `useEffect` in `Header()` that listens and calls `setSettingsOpen(true)`. This is a 4-line addition to Header, no prop changes, no re-render surface widening.

**Alternative for "create todo":** The simplest v0 scoping is to omit "create todo" entirely and instead include only `setTab(...)` + `setHelpOpen` + settings event commands. That constrains v0 to 7 commands (6 tabs + help + settings), all of which have clean action paths. "Create todo" can be deferred to v1 when a proper event bridge or context API is in place.

---

## 5. Alternative paths (≤3)

**Alt 1 — Lift settings state to App() scope (full lift):** Move `settingsOpen`, `setSettingsOpen`, `pendingInitialPane`, `setPendingInitialPane` from `Header()` up to `App()`, pass as props. Cleaner long-term architecture (CommandPalette gets a prop directly), but changes the Header memo boundary. This is the "right" refactor if the command palette is expected to grow with many more settings-related commands.

**Alt 2 — useContext for palette actions:** Create a `PaletteActionsContext` that vends `openSettings`, `switchTab`, `openHelp`. App() wraps the tree with the provider; Header subscribes to `openSettings` from context. Elegant for a growing command registry, but over-engineered for 4-6 v0 commands — introduce context only if the command set grows past ~10 actions.

**Alt 3 — Skip cmdk, use a custom combobox:** Build a `<dialog>` + `<input>` + manual fuzzy filter with ~0 external deps. Saves 14.9 kB gz. Appropriate only if the chunk budget is critical. With the CLAUDE.md ceiling raised to 400/500 kB and cmdk landing in a lazy chunk, the budget concern is moot. Reject this path for v0.

---

## 6. Open questions for the implementer (≤5)

1. **Settings event vs lift:** Which approach for `setSettingsOpen` — custom event `OPEN_SETTINGS_EVENT` (4-line addition, follows NAV_CLOSED_EVENT precedent) OR lift `settingsOpen` to App() scope (larger refactor, cleaner prop flow)? The event approach is recommended for minimal diff, but the implementer should confirm.

2. **"Create todo" scope:** Is "create todo" in or out of v0? If in, which section does it target (Today? whichever is active?) and what is the trigger mechanism? If out, the v0 command list is: Open Settings + 7 tab-switches + Open Keyboard Help = 9 commands (or fewer if some tabs are hidden).

3. **Palette trigger element:** After CommandPalette closes, Radix Dialog returns focus to the previously focused element. Is that correct behavior, or should focus explicitly return to `document.body`? For a new-tab page (no persistent focus target), `document.body` is acceptable — verify Radix's default behavior in the extension context.

4. **`mod+k` vs `meta+k, ctrl+k`:** The brief uses both formulations. The m10 pattern uses `mod+slash` for Cmd+/. Using `mod+k` is consistent with m10's pattern and resolves to `metaKey` on Mac + `ctrlKey` on Windows/Linux natively in react-hotkeys-hook v5. Confirm the implementer uses `mod+k` (not the two-alias form) for consistency with the existing shortcut.

5. **Palette dismissal and Escape conflict:** proclivity's `Modal.tsx` and Radix Dialog both handle Escape internally. If the palette is open alongside another modal (unlikely but possible), both ESC handlers will fire simultaneously. Verify Radix Dialog's stopPropagation behavior on Escape — it should consume the event via `@radix-ui/react-use-escape-keydown` before the outer handler fires.
