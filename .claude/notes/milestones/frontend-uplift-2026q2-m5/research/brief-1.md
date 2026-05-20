# Research Brief 1 (Explore) — frontend-uplift-2026q2-m5

**Role:** codebase-context (Phase 1 / brief-1)
**Date:** 2026-05-20

---

## 1. TL;DR

- `Today`, `LongTerm`, and active `Sprint` tabs all render `<ul class="todo-list">` containing `<li>` (via `TodoItem`). The `<ul>` lives in `TodoList.tsx` (Today/LongTerm) and `SprintManager.tsx` (Sprint). The tabpanel `hidden=` toggle is owned **entirely by `App.tsx`** at the `<div id="tabpanel-*">` layer.
- The stagger animation (s9) should target `.todo-list > li` under `[data-staggered="true"]`. The `data-staggered` attribute must be toggled on the **tabpanel `<div>`** in `App.tsx` (not inside the section component), since App owns both the tab state and the `hidden` attribute.
- `s10` changes live in `App.css` only: `.clock` font-size and `.tabs` overflow/flex properties. No component changes needed.
- No `@keyframes` name collision risk: existing names are `mesh-fade-in`, `modal-fade-in`, `modal-slide-in`, `card-grid-fade-in`, `chat-dot-bounce`, `dirty-dot-pulse`, `quick-prompt-banner-in`, `settings-badge-pulse`. `stagger-fade-up` is free.
- The dual-guard pattern (`[data-reduced-motion="true"]` on `<html>` + `@media (prefers-reduced-motion: reduce)`) is already fully wired by `useThemeSync.ts` — the implementer just needs to add the guard block to the new CSS.

---

## 2. File inventory

### `src/newtab/App.tsx`

- **Tab state:** `const [tab, setTab] = useState<Tab>("today")` at line 314. Single source of truth for which tab is active.
- **Tabpanel rendering:** lines 403–499. Each section (Today, Sprint, LongTerm, Gantt, Reminders, Calendar, Closed) is wrapped in a `<div id="tabpanel-{id}" role="tabpanel" hidden={tab !== "{id}">`. The `hidden` attribute flip is the activation event.
- **`data-staggered` wire-up location:** the `setTab` call (line 314) is the right place to trigger a `useState` bool per tab, cleared after ~250 ms via `useEffect`. The tabpanel `<div>` should receive `data-staggered="true"` when the tab becomes active. The implementer will need a `Map<Tab, boolean>` or a single `staggeredTab` state that tracks which tab's stagger is currently live.
- **Header:** `memo(function Header)` owns `.header` (clock, greeting, date, settings/chat buttons). The `Header` component does NOT re-render on tab change — it only re-renders on `state.settings` or the 1-second clock tick. No cross-component entanglement with the stagger logic.

### `src/newtab/App.css`

- **`.clock`** (lines 30–35): `font-size: 56px; font-weight: 300; font-variant-numeric: tabular-nums; letter-spacing: -0.02em`. No `min-width`, `max-width`, `overflow`, or `white-space` rules. The `s10` change replaces the static `font-size: 56px` with `clamp(28px, 6vw, 56px)`.
- **`.tabs`** (lines 88–93): `display: flex; gap: 4px; border-bottom: 1px solid var(--border); margin-bottom: 24px`. **No `overflow` or `flex-wrap` rules.** Each `.tab` (lines 94–111) has `padding: 10px 14px; color: var(--text-dim); border-bottom: 2px solid transparent`. No `flex-shrink` on `.tab`. The `s10` changes are: add `overflow-x: auto; scrollbar-width: thin` to `.tabs`, and add `flex-shrink: 0` to `.tab`.
- **`.header-left .greeting`** (line 16): `font-size: 32px`. This is a separate element from `.clock` in `.header-right`; the greeting has its own static 32px size which is not touched by s10.
- **`@keyframes settings-badge-pulse`** (line 73) + dual-guard (lines 79–86): the canonical reference pattern for the guard block.

### `src/sections/TodoList.tsx`

- **`<ul className="todo-list">`** at line 251 (list mode). Each item is a `<TodoItem>` rendered directly — no `index` prop passed today, so `--stagger-idx` will need to be injected via inline style either on each `TodoItem` wrapper or by passing index down.
- **Card mode branch** (lines 193–219): routes through lazy-loaded `TodoCardSection` — the brief scopes s9 to list mode only (card mode has its own layout). No stagger needed in card mode.
- The `<ul>` is a direct child of the root `<div>` returned by `TodoList`; there is no intermediate section root in `TodoList` itself. The `data-staggered` attribute therefore CANNOT be placed on a `TodoList` internal element — it must live on the tabpanel `<div>` in `App.tsx` and the CSS selector must be `[data-staggered="true"] .todo-list li`.

### `src/sections/sprint/SprintManager.tsx`

- **Active sprint `<ul className="todo-list">`** at line 1242 (list mode). Same structure as `TodoList`. Also uses `TodoItem` with no explicit index. Sprint card mode also lazily loads `TodoCardSection`.
- The `<ul>` is nested deeper: `SprintManager` → (active sprint active state) → `<ul>`. The CSS ancestry chain from the tabpanel `<div>` is `[data-staggered="true"] .todo-list li`, which will match correctly.

### `src/sections/sections.css`

- **`.todo-list`** (lines 13–19): `list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px`. No existing animation.
- **`.todo-item`** (lines 20–33): the `<li>` element. No existing animation, no `transform`, no `opacity` override. The `stagger-fade-up` keyframe will animate from `opacity: 0; transform: translateY(8px)` to `opacity: 1; transform: translateY(0)` — no conflict.
- **Existing reduced-motion guard** (lines 234–252): full dual-guard block on `.closed-scope-counter` transitions — the pattern the implementer should mirror exactly.

### `src/hooks/useThemeSync.ts`

- **`data-reduced-motion` wiring** (lines 44–51, 87–101): the attribute is set on `document.documentElement` (`<html>`). Both user-pref (`rs.reducedMotion`) and OS-level (`prefers-reduced-motion: reduce`) are handled. Any CSS selector using `[data-reduced-motion="true"] .todo-list li` will automatically respect both override paths.

### `src/sections/photos.css`

- **`.photos-stage`** has `width: 100%; margin-bottom: 24px`. No fixed pixel height that would overflow at 390 px — uses `clamp()` already. Not a concern for s10.

---

## 3. Implementation notes / gotchas

### s9 — stagger-reveal

1. **`--stagger-idx` injection**: `TodoItem` receives the todo object but NOT its array index. The implementer must either (a) pass `index={idx}` from the map in `TodoList.tsx`/`SprintManager.tsx` and wire it as an inline style `style={{ "--stagger-idx": Math.min(idx, 9) } as React.CSSProperties}` on `<li>` or `<TodoItem>`, or (b) use CSS `:nth-child` — but CSS `:nth-child` cannot cap at 10 so the brief's approach (a) is required for the cap-at-10 invariant.

2. **Where to put `data-staggered`**: `App.tsx` must add a `data-staggered="true"` prop to the tabpanel `<div>`. The CSS selector chain will be: `[data-staggered="true"] .todo-list li`. This is clean since `.todo-list` only appears in list-mode sections.

3. **State management in App.tsx**: a lightweight approach is `const [staggeredTab, setStaggeredTab] = useState<Tab | null>(null)`. On `setTab(t)` also call `setStaggeredTab(t)`, then in a `useEffect` watching `staggeredTab`, `setTimeout(() => setStaggeredTab(null), 250)`. Each tabpanel then receives `data-staggered={staggeredTab === t.id ? "true" : undefined}`. This keeps the stagger scoped to the exact tab that just activated without a per-tab state entry.

4. **Initial page load**: the brief says "fires on tab activation." On first paint, the default tab is `"today"` but the user hasn't explicitly activated it. The brief is ambiguous — the implementer should check whether the initial load should also trigger the stagger. The safest default: also set `staggeredTab` to the initial `tab` value with an `initialState` so it fires on first render.

5. **Re-render replay risk**: the `setTab` change does NOT unmount the section — sections stay mounted (comment at App.tsx line 399: "Keep all sections mounted"). So the `data-staggered` toggle correctly fires the animation once per tab switch without the component re-mounting. The 250 ms clear window aligns with the max animation duration: `(9 * 55ms) + 220ms = 715ms` — **the 250 ms clear is SHORTER than the total animation for 10 items**. The brief says clear ~250 ms "so subsequent re-renders don't replay." This means the clear window is about suppressing re-trigger on storage updates, not waiting for animation to complete. The last-item animation will still complete because `animation-fill-mode: both` holds the final state. This is correct behavior.

6. **Sprint section structure**: SprintManager renders `<ul class="todo-list">` inside the `activeSprint.state === "active"` gate (line 1169). When the tab activates, this `<ul>` is already mounted (all sections are kept mounted), so the CSS animation will fire on the items in the DOM at the moment `data-staggered` is set. Items added AFTER the stagger cleared will not animate — which is correct per the brief.

### s10 — mobile layout fix

7. **`.tabs` flex math**: current `.tab` buttons have no `flex-shrink` defined (defaults to `1`, allowing shrink). Adding `flex-shrink: 0` will prevent squeezing but requires `overflow-x: auto` on `.tabs` to engage horizontal scroll. The existing `gap: 4px` on `.tabs` works fine with overflow scroll. The `margin-bottom: -1px` on `.tab` (line 101) that creates the active tab underline overlap with `border-bottom` will also be preserved — no conflict.

8. **`.clock` at 390 px**: `6vw` of 390 px = 23.4 px, which is below the 28 px floor, so `clamp(28px, 6vw, 56px)` will pin to 28 px at 390 px. At 1024 px, `6vw` = 61.4 px, which exceeds the 56 px ceiling, so it pins there. This is the desired behavior.

9. **`.greeting` at 390 px**: `.header-left .greeting` is `font-size: 32px` with no `clamp`. The header uses `justify-content: space-between` with the clock on the right. At 390 px, the `.app` container has `padding: 48px 32px`, leaving `390 - 64 = 326px` for the header. With a 28 px clock, the greeting has ~298 px available for its text. "Good morning, Name." at 32 px can clip on short displays. However, s10 brief does NOT specify changing the greeting size — the milestone only covers `.clock` and `.tabs`. The implementer should note this as a follow-up risk but not fix it in this milestone.

10. **`scrollbar-width: thin`**: supported in all modern browsers. Chrome ≥ 121 (Chromium MV3 target), Firefox, Safari 16.4+. No polyfill needed.

---

## 4. Open questions for the implementer

1. **Initial-load stagger**: should the stagger fire on first paint for the default "today" tab, or only on explicit user tab switches? The brief says "tab activation" — first paint could be considered an implicit activation. Recommend firing on load to make the feature visible on every new-tab open.

2. **Card mode exclusion**: the brief scopes s9 to list mode. Should the `data-staggered` attribute be omitted entirely when `layoutMode === "card"`, or simply ignored (the CSS selector `.todo-list li` won't match anything in card mode anyway)? The attribute can be left on the tabpanel regardless — it's harmless when card mode is active.

3. **`--stagger-idx` prop type**: `React.CSSProperties` doesn't include custom properties by default. The implementer will need a type cast: `style={{ "--stagger-idx": Math.min(idx, 9) } as React.CSSProperties}`. Confirm TypeScript strict mode is satisfied (it is, via the cast).

4. **ArchivedSprintRow also has `<ul className="todo-list">`** at line 609 of `SprintManager.tsx`. This is nested under the Sprint tabpanel so it will also get `[data-staggered="true"]` when the Sprint tab activates. Items in an expanded archived sprint row will animate if the row is already expanded when the tab activates. This may or may not be desirable — the implementer should decide whether to add a CSS scope guard (e.g. `.sprint-archived-tasks .todo-list li { animation: none }`) or accept the animation as acceptable.

5. **No `TodoItem` index prop currently exists**: adding `index` to `TodoItem`'s props interface (or just inline-style-injecting on the wrapping element in `TodoList` and `SprintManager`) requires a minimal interface change. Confirm the cleaner approach is to inject the style on the mapping site rather than threading an `index` prop through `TodoItem`.

---

## 5. External writes required

```yaml
external_writes_required:
  - "git push origin main"
```

No new npm dependencies. No Chrome Web Store publish. CSS-only animation + minimal App.tsx state addition.
