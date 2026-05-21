# Implement synthesis — frontend-uplift-2026q2-m11

## Built

- **AC1 package.json cmdk@^1.1.1**: Installed via `npm install cmdk@^1.1.1`; 31 packages added (cmdk + 4 direct Radix peers + 22 transitive + 4 other). `package.json` updated: `"cmdk": "^1.1.1"`.
- **AC4 OPEN_SETTINGS_EVENT constant**: Added `export const OPEN_SETTINGS_EVENT = "proclivity:open-settings"` adjacent to `NAV_CLOSED_EVENT` in `src/storage/constants.ts:86-100`.
- **AC5 Tab type exported**: Added `export` keyword to `Tab` type declaration in `src/newtab/App.tsx:131` (was a local type; now a named export so CommandPalette and palette-commands can import it).
- **AC6 palette-commands.ts**: Created `src/lib/palette-commands.ts` with `PaletteCommandDeps` interface, `PaletteCommand` interface (`id`, `label`, `keywords?: readonly string[]`, `action`), and `PALETTE_COMMANDS` array (Settings + Help entries with keywords for fuzzy aliases).
- **AC7 CommandPalette.tsx**: Created `src/components/palette/CommandPalette.tsx` as a default-export lazy component. Uses `<Command.Dialog>` directly (not wrapped in `<Modal>`). Renders "Actions" group from `PALETTE_COMMANDS` and "Navigation" group from `visibleTabs` prop. Every `onSelect` calls its action + `onClose()`.
- **AC7 CommandPalette.css**: Created `src/components/palette/CommandPalette.css` with `[cmdk-*]` selector styles using theme tokens (`--panel`, `--border`, `--text`, `--text-dim`, `--accent`, `--accent-on`, `--radius`). `[cmdk-item][data-selected="true"]` for selection highlight. `var(--text-dim)` for muted text (not `--text-muted`).
- **AC8 shortcuts.ts mod+k entry**: Inserted `{ keys: "mod+k", label: "Open command palette", category: "App" }` between `mod+slash` and `escape` entries in `src/lib/shortcuts.ts:30-34`.
- **AC9 App.tsx mod+k hotkey**: Added `const [paletteOpen, setPaletteOpen] = useState(false)` and `useHotkeys("mod+k", () => setPaletteOpen((open) => !open), { preventDefault: true, description: "Open command palette" })` at `src/newtab/App.tsx:344-354`.
- **AC9 App.tsx CommandPalette lazy import**: Added `const CommandPalette = lazy(() => import("@/components/palette/CommandPalette"))` at `src/newtab/App.tsx:131-135`.
- **AC9 App.tsx Suspense mount**: Added `<Suspense fallback={null}><CommandPalette open={paletteOpen} onClose={...} onSwitchTab={setTab} onOpenHelp={() => setHelpOpen(true)} visibleTabs={visibleTabs} /></Suspense>` after KeyboardHelpOverlay mount at `src/newtab/App.tsx:667-679`.
- **AC9 Header() OPEN_SETTINGS_EVENT listener**: Added `useEffect` inside `Header()` memo that listens for `OPEN_SETTINGS_EVENT` and calls `setSettingsOpen(true)` at `src/newtab/App.tsx:211-216`.
- **AC2 build passes**: `npm run build` clean, zero TS errors. Initial chunk 259.22 kB (was 258.28 kB, +0.94 kB boilerplate).
- **AC3 lazy-chunk discipline**: `grep -l cmdk dist/assets/*.js` returns ONLY `CommandPalette-DsNpE4RH.js`. No cmdk in initial chunk.

## Branching note

Committed to `main` directly per CLAUDE.md § Branching ("All work — including Claude-assisted work — runs directly on `main`."). Assigned worktree branch `worktree-agent-a6f7f0a0443e356cc` left at base SHA `b8ea1f29198249b4b749b3c038ed3b1335b11034` as expected.

## Architecture decisions made during implementation

1. **`exactOptionalPropertyTypes` fix on `keywords` prop**: TypeScript strict mode rejected `keywords={cmd.keywords ? [...cmd.keywords] : undefined}` because `Command.Item`'s props have `keywords?: string[]` (not `string[] | undefined`). Used spread pattern `{...(cmd.keywords !== undefined ? { keywords: [...cmd.keywords] } : {})}` to conditionally include the prop only when defined — the canonical pattern for `exactOptionalPropertyTypes: true`.

2. **`keywords` type in `PaletteCommand`**: Declared as `readonly string[] | undefined` (optional field) to satisfy `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`. The spread pattern in CommandPalette.tsx handles the optional-to-required conversion correctly.

3. **No deviations from synthesis**: All 8 acceptance criteria implemented as specified. The `keywords` fix was a type-precision correction, not an architectural deviation.

## Files touched

| File | LOC delta | Role |
|---|---|---|
| `package.json` | +1 | Add `cmdk@^1.1.1` dependency |
| `package-lock.json` | +599 (auto-gen) | 31 new package entries |
| `src/storage/constants.ts` | +14 | Add `OPEN_SETTINGS_EVENT` constant |
| `src/newtab/App.tsx` | +47 | Export Tab type, lazy import, paletteOpen state, mod+k hotkey, Suspense mount, Header() OPEN_SETTINGS_EVENT listener |
| `src/lib/shortcuts.ts` | +5 | Add mod+k entry between mod+slash and escape |
| `src/lib/palette-commands.ts` | +54 (NEW) | PaletteCommandDeps, PaletteCommand types, PALETTE_COMMANDS array |
| `src/components/palette/CommandPalette.tsx` | +89 (NEW) | Default-export lazy palette component |
| `src/components/palette/CommandPalette.css` | +100 (NEW) | [cmdk-*] selector styles with theme tokens |

**Total meaningful LOC**: ~310 (excluding auto-gen package-lock.json). Under 350-LOC abort threshold.

## Deferred

- **"Create todo" command**: No App-level intent-dispatch path exists for cross-section todo creation (`editingId` lives in `TodoList` and `SprintManager` local state). Deferred to v1 milestone where a proper event bridge (`FOCUS_ADD_TODO_EVENT`) or React Context can be evaluated (synthesis §3.4, brief-1 §3.7).
- **Palette open/close animation**: `Command.Dialog` doesn't ship motion animation by default. Non-animated v0 is acceptable per synthesis §3.1 open question. Can be added in a polish milestone by wrapping the dialog panel with `m.div`.
- **Tab type to `src/types/index.ts`**: Exported from App.tsx for v0 (cheapest fix). If a 3rd consumer needs the type, hoist to `src/types/` (synthesis §8 OQ4).

## external_writes_required

- git push origin main

## Test deltas

None — m11 follows m1 L5 carry-over (no unit tests added for UI components in this pipeline phase). Smoke test criteria from synthesis §6 AC10 apply for manual verification.

## Check matrix results

- **build (npm run build)**: PASS — TS zero errors, initial chunk 259.22 kB raw / 83.84 kB gz (budget: 400 kB soft / 500 kB hard). CommandPalette lazy chunk 47.95 kB raw / 15.96 kB gz. `grep -l cmdk dist/assets/*.js` = `CommandPalette-DsNpE4RH.js` only.
- **workflows**: SKIP — no `.github/workflows/**` touched
- **lfs**: SKIP — no `.gitattributes` touched
- **git status**: clean (only untracked milestone notes dir and researcher's lessons from other agents)

## Commit subject length check

Subject: `feat(deps): cmdk Cmd+K command palette (m11)`
After prefix `feat(deps): ` = `cmdk Cmd+K command palette (m11)` = 33 chars. Under 50-char cap. ✓
