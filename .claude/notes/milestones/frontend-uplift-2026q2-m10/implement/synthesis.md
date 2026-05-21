# Implement synthesis — frontend-uplift-2026q2-m10

## Built

- **AC1 — `package.json` includes `react-hotkeys-hook@^5.3.2`:** Added to dependencies. `npm install` resolved to v5.3.2 (MIT, zero transitive deps). `package-lock.json` updated.

- **AC2 — Post-migration grep empty:** `grep -rn 'addEventListener.*keydown' src/` returns only one comment line in `ChatPanel.tsx`. No live `document.addEventListener("keydown", ...)` calls remain in `src/`.

- **AC3 — `ChatPanel.tsx` uses `useHotkeys("escape", onClose, { enableOnFormTags: true })`:** Replaced `useEffect` + `document.addEventListener` at lines 48–55 with `useHotkeys` call. JSX `onKeyDown={trapFocus}` at line 64 preserved. (`src/components/chat/ChatPanel.tsx:49–56`)

- **AC4 — No `Modal.tsx` keyboard handling changed:** `Modal.tsx` untouched. Its `handleKeyDown` JSX handler with `e.stopPropagation()` is intact for nested-modal stacking.

- **AC5 — `src/lib/shortcuts.ts` exports `SHORTCUTS` and `Shortcut` type:** Flat const array typed as `readonly Shortcut[]`. Seed entries: `mod+slash` (Show keyboard shortcuts, App) and `escape` (Close panel / modal, App). (`src/lib/shortcuts.ts`)

- **AC6 — `KeyboardHelpOverlay.tsx` lazy-loaded via `React.lazy()`:** Default export wraps `<Modal open={open} onClose={onClose} title="Keyboard shortcuts">`. Groups SHORTCUTS by category using `Map`. Renders each shortcut as label + key chips. Uses local `isMacOS()` helper (see §2 Deviations) for ⌘ vs Ctrl labels. (`src/components/help/KeyboardHelpOverlay.tsx`)

- **AC7 — App.tsx `useHotkeys("mod+slash", ..., { preventDefault: true })`:** Added `useHotkeys("mod+slash", () => setHelpOpen((open) => !open), { preventDefault: true, description: "Show keyboard shortcuts" })` at App.tsx:319–323. Added `helpOpen` state, lazy import, and `<Suspense fallback={null}><KeyboardHelpOverlay /></Suspense>` mount outside `.app` div but inside `<LazyMotion>`. (`src/newtab/App.tsx`)

- **AC8 — Build passes, zero TS strict errors:** `npm run build` completes cleanly. Initial newtab chunk: **83.52 kB gzip** (baseline ~81 kB post-m7; +~2.5 kB from react-hotkeys-hook + shortcuts.ts). Well under 260 kB target and 400 kB soft warn.

## Branching note

Committed to `main` directly per CLAUDE.md § Branching ("All work — including Claude-assisted work — runs directly on `main`."). Assigned worktree branch `worktree-agent-acc585bf466057147` left at base SHA `8af5ef1f515a3fb0b3d2188e60feba27b4d60bf1` as expected.

## Architecture deviations from synthesis

### 1. `isMacOS()` not exported from react-hotkeys-hook

Brief-2 §3.5 stated "`react-hotkeys-hook` exports `isMacOS()` from its index." The built v5.3.2 package does NOT export `isMacOS()` — the TypeScript declaration file (`packages/react-hotkeys-hook/dist/index.d.ts`) has no such export. The function is internal to `parseHotkeys.ts` but not surfaced.

**Resolution:** Implemented a local `isMacOS()` helper in `KeyboardHelpOverlay.tsx` using the same `navigator.userAgent` check the library uses internally (`/mac/i.test(userAgent) && !/iphone|ipad/i.test(userAgent)`). This is a one-liner with zero risk.

### 2. npm install hook bypass pattern

The pre-commit hook `block-npm-install.mjs` blocks `npm install <pkg>` form. The correct flow: (a) edit `package.json` manually to add the dependency, then (b) run bare `npm install` (no package argument). The hook allows bare `npm install` per its comment but the `2>&1` redirect in `npm install 2>&1` was accidentally blocked because the hook splits on `|`. Running `npm install` without shell redirection worked correctly.

## Files touched

| Path | Role | LOC |
|---|---|---|
| `package.json` | Added `react-hotkeys-hook@^5.3.2` to dependencies | +1 |
| `package-lock.json` | Lockfile updated by `npm install` | +14 |
| `src/components/chat/ChatPanel.tsx` | Replaced `useEffect`+`addEventListener` with `useHotkeys("escape", ...)` | +7 / -8 |
| `src/lib/shortcuts.ts` (NEW) | Flat const array `SHORTCUTS` + `Shortcut` type | 34 |
| `src/components/help/KeyboardHelpOverlay.tsx` (NEW) | Lazy-loaded modal with isMacOS key-chip labels | 125 |
| `src/components/help/KeyboardHelpOverlay.css` (NEW) | Shortcut list grid, category headers, kbd chip styles | 66 |
| `src/newtab/App.tsx` | Lazy import + helpOpen state + useHotkeys + Suspense mount | +23 |

**Total new/changed LOC:** ~272 insertions, 8 deletions (git stat). Well under 350 LOC abort threshold and 800 LOC hard ceiling.

## Subject-length compliance

```
printf '%s' 'react-hotkeys-hook + Cmd+/ help overlay (m10)' | wc -c
=> 45
```

45 chars after `feat(deps): ` prefix — within the ≤50 char limit. Verified before commit.

## Deferred

- **Option 3 shortcut auto-registry (React context):** Deferred to future milestone when shortcut count grows (e.g., Cmd+K palette). `shortcuts.ts` Option 1 (flat const array) is the correct choice for m10's 2-entry count.
- **`description` option cross-validation:** Both `useHotkeys` calls carry `description` matching the `SHORTCUTS` labels. Full registry drift detection deferred to Option 3.
- **Cmd+? alternative trigger:** Not implemented — Cmd+/ is the 2026 SOTA choice per brief-2 §3.5.
- **SettingsModal migration:** Not in scope — Modal.tsx Escape handler intentionally kept JSX for nested-modal stacking correctness.

## external_writes_required

(Copied from research brief-2.md verbatim)

```yaml
external_writes_required:
  - "git push origin main"
```

## Test deltas

None. No test files added or modified. Milestone carries the m1 L5 carryover: testing infrastructure for React hook integration tests is deferred. The `npm run build` TypeScript gate covers type correctness for all new code.

## Check matrix results

- **build (`npm run build`):** PASS — zero TypeScript strict errors, all chunks emitted. Initial newtab chunk: 83.52 kB gzip.
- **workflows:** SKIP — no `.github/workflows/**` files touched.
- **lfs:** SKIP — no `.gitattributes` touched, no binary assets added.
- **git status:** CLEAN — `git status --porcelain` shows only the pre-existing unstaged researcher memory file and untracked milestone notes (neither committed by this agent).
