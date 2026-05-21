---
milestone_id: "frontend-uplift-2026q2-m10"
researcher: "general-purpose"
agent_type: "external-and-writes"
external_writes_required:
  - "git push origin main"
sources:
  - url: "https://github.com/JohannesKlauss/react-hotkeys-hook"
    sha256: "6d29ab2bc3c5a6e56b6b65c550f26e122fc1a75c79f8ffa2d77f08720fe89ea1"
    takeaway: "v5.3.2 released 2026-05-05, MIT, 3.5k stars, 85 releases — actively maintained"
  - url: "https://raw.githubusercontent.com/JohannesKlauss/react-hotkeys-hook/main/packages/react-hotkeys-hook/src/lib/parseHotkeys.ts"
    sha256: "a58cc221b26aa7d414bbb2b91fc57ecad68f8d0f0b5448ade4358fdc93042502"
    takeaway: "'mod' IS in reservedModifierKeywords; isMacOS() is defined inline using navigator.userAgent"
  - url: "https://raw.githubusercontent.com/JohannesKlauss/react-hotkeys-hook/main/packages/react-hotkeys-hook/src/lib/validators.ts"
    sha256: "191717e16130f68112da2d6c5ccb36e7b4ef9aeb5e5356cc1ffa6da6ce95e6e4"
    takeaway: "mod resolves to metaKey on macOS and ctrlKey on other platforms — confirmed in isHotkeyMatchingKeyboardEvent"
  - url: "https://bundlephobia.com/api/size?package=react-hotkeys-hook"
    sha256: "0999437b7a2d792813ed15061e2817b050888573d111db3006fb082288cf014c"
    takeaway: "v5.3.2: gzip 2918 bytes (~2.9 KB), size 7819 bytes unminified, dependencyCount=0"
  - url: "https://registry.npmjs.org/react-hotkeys-hook/latest"
    sha256: "74f05a68db9ef6da7117197f67e2d1d071e74b816bfb56e3140a757b283698fc"
    takeaway: "version 5.3.2, license MIT, dependencies null (zero-dep confirmed), peerDeps react>=16.8.0"
  - url: "https://react-hotkeys-hook.vercel.app/docs/api/use-hotkeys"
    sha256: "2a4eaf5965c5c7dcca6f26e6a11d14612617b6614bc43a50b0e018249a2982d3"
    takeaway: "Full Options type confirmed: enabled, enableOnFormTags, enableOnContentEditable, preventDefault, scopes, description, ignoreEventWhen"
injection_attempts: 0
---

# External Research Brief — frontend-uplift-2026q2-m10

## 1. TL;DR

- `react-hotkeys-hook` v5.3.2 is the latest (released 2026-05-05), MIT, **zero transitive deps**, **~2.9 KB gzip** confirmed via Bundlephobia API. Peer deps require only `react >= 16.8.0` — proclivity's React 18.3 is fully covered.
- `mod+/` is the canonical cross-platform string. The library's `validators.ts` explicitly maps `mod` → `metaKey` on macOS and `ctrlKey` elsewhere. The brief's claim `"meta+slash, ctrl+slash"` also works but `mod+slash` is cleaner (single binding, no delimiter needed).
- The sole ad-hoc `document.addEventListener("keydown", ...)` in `src/` is in `ChatPanel.tsx` (Escape closes the panel). `Modal.tsx` already uses `onKeyDown` on its backdrop div (not `document`), so it is NOT a target for `useHotkeys` migration unless desired.
- The help overlay's `src/lib/shortcuts.ts` registry should use a flat const array with a `description` field — the `description` option on `useHotkeys` is designed exactly for this. Option 3 (React-context auto-registry) is the right long-term design but is out of scope for m10.
- Initial chunk delta: ~2.9 KB gzip from the library + ~0.5 KB for the registry. Help overlay is lazy-loaded via `React.lazy()` — no impact on initial chunk.

## 2. External sources consulted

- **URL:** `https://github.com/JohannesKlauss/react-hotkeys-hook`
  **SHA256:** `6d29ab2bc3c5a6e56b6b65c550f26e122fc1a75c79f8ffa2d77f08720fe89ea1`
  **Takeaway:** v5.3.2 released 2026-05-05, MIT license, 85 total releases, 3.5k stars, actively maintained.

- **URL:** `https://raw.githubusercontent.com/JohannesKlauss/react-hotkeys-hook/main/packages/react-hotkeys-hook/src/lib/parseHotkeys.ts`
  **SHA256:** `a58cc221b26aa7d414bbb2b91fc57ecad68f8d0f0b5448ade4358fdc93042502`
  **Takeaway:** `'mod'` is in `reservedModifierKeywords`; `isMacOS()` is defined in the same file using `navigator.userAgent`.

- **URL:** `https://raw.githubusercontent.com/JohannesKlauss/react-hotkeys-hook/main/packages/react-hotkeys-hook/src/lib/validators.ts`
  **SHA256:** `191717e16130f68112da2d6c5ccb36e7b4ef9aeb5e5356cc1ffa6da6ce95e6e4`
  **Takeaway:** `mod` resolves to `metaKey` on macOS and `ctrlKey` on all other platforms — the comment in the source reads: `// Mod is a special key name that is checking for meta on macOS and ctrl on other platforms`.

- **URL:** `https://bundlephobia.com/api/size?package=react-hotkeys-hook`
  **SHA256:** `0999437b7a2d792813ed15061e2817b050888573d111db3006fb082288cf014c`
  **Takeaway:** v5.3.2 gzip=2918 bytes (~2.9 KB), unminified=7819 bytes, `dependencyCount=0`, `hasSideEffects=false`, ESM module type.

- **URL:** `https://registry.npmjs.org/react-hotkeys-hook/latest`
  **SHA256:** `74f05a68db9ef6da7117197f67e2d1d071e74b816bfb56e3140a757b283698fc`
  **Takeaway:** version=5.3.2, license=MIT, dependencies=null (zero-dep confirmed independently of bundlephobia), peerDependencies=`{react: ">=16.8.0", react-dom: ">=16.8.0"}`.

- **URL:** `https://react-hotkeys-hook.vercel.app/docs/api/use-hotkeys`
  **SHA256:** `2a4eaf5965c5c7dcca6f26e6a11d14612617b6614bc43a50b0e018249a2982d3`
  **Takeaway:** Confirmed full function signature and complete Options interface including `ignoreEventWhen` (new in v5) and `description` field designed for shortcut registries.

## 3. Best-practice findings

### 3.1 Library version and maintenance

`react-hotkeys-hook` v5.3.2 is the latest stable release as of 2026-05-05. The library has 85 releases and 3.5k GitHub stars. The npm registry entry confirms license=MIT and zero transitive dependencies. The v5.0.0 breaking change (from the CHANGELOG) was:
1. **ESM-only** — CommonJS dropped. Vite + proclivity's `@crxjs/vite-plugin` handle ESM natively; no toolchain change required.
2. **Callback signature** standardized to `(KeyboardEvent, HotkeysEvent)` — this was already the v4 signature; no migration burden for net-new code.

React peerDep range is `>=16.8.0`, covering React 18.3 and React 19 without caret-pinning issues.

### 3.2 `useHotkeys` API signature (v5.3.2)

```typescript
function useHotkeys<T extends Element>(
  keys: string | string[],
  callback: (event: KeyboardEvent, handler: HotkeysEvent) => void,
  options?: Options,
  deps?: DependencyList
): React.RefCallback<T | null>
```

The return value is a `RefCallback` — attach to a DOM element to scope the listener to that element. When no ref is needed (global listener), discard the return value.

Complete `Options` type (from `types.ts` source):

| Option | Type | Default | Note |
|---|---|---|---|
| `enabled` | `Trigger` | `true` | Boolean or predicate function |
| `enableOnFormTags` | `FormTags[] \| boolean` | `false` | Pass `true` or `["INPUT","TEXTAREA"]` |
| `enableOnContentEditable` | `boolean` | `false` | For contentEditable elements |
| `ignoreEventWhen` | `(e: KeyboardEvent) => boolean` | `undefined` | NEW in v5 — more flexible than `enableOnFormTags` |
| `preventDefault` | `Trigger` | `false` | Blocks browser default for matched keystrokes |
| `enabled` | `Trigger` | `true` | Controls if the callback fires |
| `scopes` | `string \| string[]` | `undefined` | Requires `<HotkeysProvider>` |
| `description` | `string` | `undefined` | Human-readable label — load-bearing for registry |
| `keyup` | `boolean` | `false` | Listen on keyup instead |
| `keydown` | `boolean` | `true` | |
| `splitKey` | `string` | `+` | Key combination separator |
| `delimiter` | `string` | `,` | Multiple hotkeys separator |
| `ignoreModifiers` | `boolean` | `false` | |
| `useKey` | `boolean` | `false` | Match produced char vs physical key code |
| `sequenceTimeoutMs` | `number` | `1000` | |
| `metadata` | `Record<string, unknown>` | `undefined` | |

### 3.3 Cross-platform key normalization

Confirmed from `parseHotkeys.ts` and `validators.ts` source:

| String | Resolves to | Notes |
|---|---|---|
| `mod+slash` | Cmd+/ on macOS, Ctrl+/ on Win/Linux | The canonical cross-platform choice — single binding |
| `meta+slash` | Cmd+/ on Mac ONLY | Won't fire on Win/Linux even if user presses Ctrl+/ |
| `ctrl+slash` | Ctrl+/ on all platforms | Won't fire on Mac when user presses Cmd+/ |
| `meta+slash, ctrl+slash` | Cmd+/ on Mac AND Ctrl+/ elsewhere | Works, but `mod+slash` is cleaner |

**Recommendation:** use `useHotkeys("mod+slash", ...)` — one binding, correct cross-platform behavior, no comma-delimiter needed.

Note: `hotkeys-js` (the older v2-era underlying library) did NOT have a `mod` alias. `react-hotkeys-hook` v5 implements `mod` natively in its own `validators.ts`, independent of the underlying `hotkeys-js` library. The brief's fallback `"meta+slash, ctrl+slash"` also works correctly but is redundant when `mod+slash` is available.

### 3.4 React 18/19 compatibility

- peerDeps: `react >= 16.8.0` — covers React 18.3 (current) and React 19.
- No React 19 concurrent-mode gotchas identified in the changelog or source. The hook uses `useEffect` internally which is compatible with React 18 Strict Mode double-invocation (cleanup + re-attach).
- ESM-only (v5.0.0+) is not a concern for Vite.

### 3.5 Help overlay UX patterns (2026)

Based on 2026 SOTA patterns:

- **Trigger key:** Cmd+/ (not `?`) is the dominant choice for explicit "show keyboard shortcuts" in 2026 productivity apps. The `?` key is still used in Linear and GitHub but requires no modifier, which means it fires while typing in text fields unless carefully gated. Cmd+/ is cleaner in an app that has text inputs (proclivity's todo fields, calendar, chat). The brief's choice of Cmd+/ is correct.
- **Overlay shape:** List-by-category (Navigation / Editing / App) with a two-column key-label layout is the 2026 SOTA (Raycast, Notion, Linear all use category grouping). A single-column list works for a small shortcut count but becomes unwieldy beyond ~10 entries.
- **OS-specific key labels:** `react-hotkeys-hook` provides `isMacOS()` from `parseHotkeys.ts` as an exported helper (it IS exported from `index.ts`). Use this to render ⌘ on Mac and Ctrl on other platforms in the help overlay UI. Without this, all users see the same "mod+/" string which is confusing.

### 3.6 Source-of-truth shortcut registry design

Three options evaluated:

**Option 1 — flat const array:**
```typescript
// src/lib/shortcuts.ts
export const SHORTCUTS = [
  { keys: "mod+slash", label: "Show keyboard shortcuts", category: "App" },
  { keys: "escape", label: "Close modal / panel", category: "App" },
] as const;
```
Pros: trivially simple, zero abstractions. Cons: drift risk — if a component changes its binding, the registry is not automatically updated.

**Option 2 — keyed Record:**
```typescript
export const SHORTCUTS: Record<string, ShortcutDef> = {
  SHOW_HELP: { keys: "mod+slash", label: "Show keyboard shortcuts", category: "App" },
};
```
Pros: stable IDs for deduplication and future i18n. Cons: same drift risk as Option 1.

**Option 3 — React context auto-registry:**
Components call `useRegisterShortcut({ keys, label, category })` at mount, which adds to a context-held `Map`. The help overlay reads from this Map.
Pros: zero drift — the registry always reflects what's actually bound. Cons: ~60–100 lines of additional code; context re-renders on every mount; slightly more complex testing.

**Recommendation for m10:** Use **Option 1** (flat const array). The shortcut count for m10 is tiny (Escape + Cmd+/), drift risk is negligible, and Option 3 can be retrofitted later when the shortcut count grows (Cmd+K palette in a future milestone). However, the implementer should use the `description` option in every `useHotkeys` call and keep it in sync with the const array — this provides a lightweight consistency check without the full context machinery.

### 3.7 Codebase keydown inventory

`grep -rn 'addEventListener.*keydown' src/` returns exactly one result:

- `src/components/chat/ChatPanel.tsx:53` — bare `document.addEventListener("keydown", handleKeyDown)` for Escape-to-close.

All other keyboard handling is done via `onKeyDown` React synthetic events on specific DOM elements (Modal.tsx backdrop, form inputs, DraggableCard, etc.). These are **not** candidates for `useHotkeys` migration — they are properly scoped to their elements and React-idiomatic. The brief is correct that only `ChatPanel.tsx`'s `document.addEventListener` should be migrated.

**Note:** `Modal.tsx` handles Escape via `onKeyDown` on the backdrop div (line 88–97). This is already correct behavior — `useHotkeys("escape", ...)` would actually be a downgrade here because it fires on any escape press globally, not just when the modal has focus. The existing `onKeyDown` approach is safer for nested-modal scenarios. **Do NOT migrate Modal.tsx's Escape handler to useHotkeys.**

### 3.8 Bundle delta

After `npm install react-hotkeys-hook`:
- Library addition: +2918 bytes gzip to initial chunk.
- `src/lib/shortcuts.ts` registry: ~0.5 KB (few entries at m10).
- `KeyboardHelpOverlay.tsx` + associated CSS: lazy-loaded via `React.lazy()` — zero impact on initial chunk.
- Expected total initial chunk delta: **+~3.4 KB gzip** (well within the 400 kB soft ceiling and 500 kB hard ceiling).

## 4. external_writes_required

```yaml
external_writes_required:
  - "git push origin main"
```

Notes:
- `npm install react-hotkeys-hook` is a local-only operation (modifies `package.json`, `package-lock.json`, and `node_modules/`). It does not constitute an external write in the pipeline's sense.
- No Chrome Web Store publish is involved.
- No service endpoints are added or called.

## 5. Riskiest assumption + mitigation

**Riskiest assumption:** That `Modal.tsx`'s existing `onKeyDown` Escape handler should be replaced with `useHotkeys("escape", ...)` as part of the "replace every ad-hoc keydown listener" mandate in s17.

**Why it is risky:** The brief says "replace every ad-hoc `keydown` listener with `useHotkeys`" but `Modal.tsx` does NOT use `document.addEventListener` — it uses `onKeyDown` on the backdrop div. If the implementer over-interprets the story and migrates Modal.tsx to a global `useHotkeys("escape", ...)`, the result would be: (a) Escape fires even when no modal is open (incorrect), (b) nested-modal stacking breaks (the global listener fires once for all open modals simultaneously), (c) the `e.stopPropagation()` call that prevents Escape propagation is lost.

**Mitigation:** The acceptance criterion for s17 should be scoped to `document.addEventListener("keydown", ...)` calls only. `onKeyDown` React handlers are not ad-hoc and should NOT be migrated. The implementer check: `grep -rn 'addEventListener.*keydown' src/` must return empty after s17 — NOT `grep -rn 'onKeyDown' src/`.

## 6. Alternative paths

**Alt 1 — Skip s17 (ChatPanel migration), ship only s18 (help overlay).**
The only `document.addEventListener("keydown", ...)` is in ChatPanel for Escape. It is already correct and lifecycle-safe (cleanup in the `useEffect` return). The migration saves ~5 lines of code, adds a new dependency, and the risk of misscoping the migration is real. If the bundle delta is unacceptable for any reason, s18 alone using a plain `useEffect` for `mod+slash` is viable. Downside: no shared shortcut registry until s17 is shipped.

**Alt 2 — Use native browser `globalThis.addEventListener("keydown", ...)` for the help overlay trigger instead of `react-hotkeys-hook`.**
The help overlay's toggle is the only new global shortcut in m10. A simple `useEffect` with `globalThis.addEventListener("keydown", (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "/") ... })` avoids the new dependency. Downside: no shortcut registry, no `description` metadata, no `enableOnFormTags` defaulting — the library's value compounds over future milestones (Cmd+K, etc.).

**Alt 3 — Use `mod+slash` (single string) instead of `meta+slash, ctrl+slash` (comma-delimited two strings).**
This is not an alternative path but a clarification: the brief specifies `"meta+slash, ctrl+slash"` in the s18 story. `"mod+slash"` is strictly equivalent and cleaner. The implementer should use `"mod+slash"`. The comma-delimited form also works and may be preferred if the implementer wants explicit control per platform.

## 7. Acceptance criteria the implementer must meet

1. `npm install react-hotkeys-hook` installs v5.3.2 (or the latest compatible ^5.x.x); `npm run build` passes; initial chunk delta is confirmed under 400 kB soft ceiling and 500 kB hard ceiling.
2. After s17: `grep -rn 'addEventListener.*keydown' src/` returns empty (only `document.addEventListener` at `ChatPanel.tsx` is the migration target; `onKeyDown` React handlers are untouched).
3. `useHotkeys("escape", handler, { enableOnFormTags: true })` replaces the bare `document.addEventListener` in `ChatPanel.tsx`; modal Escape behavior is unchanged.
4. `src/lib/shortcuts.ts` exports a typed flat const array with at minimum: `mod+slash` (show help) and `escape` (close panel/modal) entries, each with `keys`, `label`, and `category` fields.
5. `KeyboardHelpOverlay.tsx` is lazy-loaded via `React.lazy()`, uses `<AnimatePresence>` with the m7 pattern (scale 0.96→1, 180 ms, reduced-motion: instant), has `role="dialog"` + `aria-labelledby` + focus-trap, and renders shortcuts grouped by category.
6. Pressing `mod+/` (Cmd+/ on Mac, Ctrl+/ on Win/Linux) in App.tsx toggles the help overlay open/close; pressing Escape while the overlay is open closes it. The help overlay displays ⌘ on macOS and Ctrl on other platforms using `isMacOS()` from `react-hotkeys-hook`.
7. `useHotkeys("mod+slash", ...)` in App.tsx uses `preventDefault: true` to prevent `/` from inserting a character in any focused input field while the shortcut fires.
