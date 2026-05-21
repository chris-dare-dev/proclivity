### `frontend-uplift-2026q2-m11` — UPL-18 cmdk Cmd+K command palette (lazy-loaded)

The heaviest single piece in epic e4 — `cmdk` is ~15–20 KB gz per the challenger's revised estimate, with 4 Radix peer-deps. The `React.lazy()` boundary is MANDATORY so the palette code never appears in the initial chunk. V0 surfaces 4–6 commands; the full action registry is a deferred v1.

**Stories:**

**`frontend-uplift-2026q2-e4-s19` — UPL-18: `cmdk` Cmd+K palette, lazy-loaded, 4–6 commands at v0** (M)

Given the app has no fast keyboard surface for cross-section navigation or quick actions (open settings, switch section, create todo, open help) — every action requires mouse navigation or tab-cycling — and competitive tools (Linear, Raycast, Cron, Notion) all anchor on Cmd+K palettes as the keyboard primitive
When the developer runs `npm install cmdk@latest`, creates `src/components/palette/CommandPalette.tsx` as a lazy-loaded component (`const CommandPalette = lazy(() => import("@/components/palette/CommandPalette"))` from App.tsx), defines a small `src/lib/palette-commands.ts` registry with the v0 commands (open settings, switch to each section, create todo, open keyboard help), wraps the palette in `<Suspense fallback={null}>` so the lazy load doesn't render an empty modal slot, wires `useHotkeys("meta+k, ctrl+k", () => setPaletteOpen(open => !open))` in App.tsx, and verifies the palette uses `@radix-ui/react-dialog` (cmdk's peer) for its overlay (focus-trap, Escape, backdrop click — all free)
Then pressing Cmd+K (or Ctrl+K) opens a centered command palette that lists the 4–6 v0 commands; typing filters the list (cmdk's built-in fuzzy match); arrow keys + Enter select; Escape dismisses; selecting "open settings" dispatches the existing settings-open event; selecting a section command calls `setTab(...)` in App.tsx; `npm run build` passes with `cmdk` and its Radix peers in the dependency tree; `vite build --report` confirms the palette code is in a separate lazy chunk (NOT the initial newtab chunk), and the initial chunk delta is ≤ 1 KB (only the lazy-import boilerplate)

Specialist: A11y reviewer — `@radix-ui/react-dialog` provides focus-trap by default; verify Escape returns focus to the previously focused element; verify the command list is announced as a `role="listbox"` with each item as `role="option"` (cmdk's defaults); verify the palette doesn't trap keyboard navigation when closed

Specialist: Bundle-budget reviewer — run `vite build --report` and confirm the cmdk chunk lives in `dist/assets/CommandPalette-*.js` (or similar), NOT in `dist/assets/index.html-*.js` (the initial chunk); confirm the initial chunk delta is ≤ 1 KB despite cmdk's ~15–20 KB gz total weight

Specialist: OSS scout — license (cmdk is MIT, Radix peers are MIT), CVE, MV3 CSP compatibility (cmdk + Radix use React refs + Portal — no inline scripts), version-pin discipline; flag the 4 Radix peer-deps explicitly in the brief so the reviewer can size them individually

---
