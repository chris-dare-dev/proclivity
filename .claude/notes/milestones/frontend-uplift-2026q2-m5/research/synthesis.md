# Research synthesis — frontend-uplift-2026q2-m5

**Milestone:** UPL-3 stagger-reveal + UPL-16 mobile header fix
**Date:** 2026-05-20
**Author:** orchestrator (main session, Phase 1 fan-in)
**Sources:** brief-1.md (explore, codebase-context), brief-2.md (general, external + best-practice)

---

## 1. TL;DR for the implementer

Two pure-CSS stories with a tiny App.tsx state-machine add:

1. **s9 — Stagger-reveal** — `@keyframes stagger-fade-up` in `sections.css`, scoped by `[data-staggered="true"] .todo-list li`. Per-item delay via inline `style={{ "--stagger-idx": Math.min(idx, 9) }}` on each `<li>` (cap at 10). `App.tsx` owns the toggle: on `setTab(t)`, set `staggeredTab=t`; clear ~250 ms later via `useEffect` + `useRef<number>` (cancellable). The initial load should also fire the stagger (use `useState<Tab>(initialTab)` as the staggered seed). Dual-guard reduced-motion on the keyframe rule (mirror `sections.css` `.closed-scope-counter` block).

2. **s10 — Mobile header** — `.clock` → `font-size: clamp(28px, 6vw, 56px)`; `.tabs` → `overflow-x: auto; scrollbar-width: thin`; `.tab` → `flex-shrink: 0`. All in `App.css`. Calibration validated by brief-2 against MDN's 2:1 zoom rule (56/28 = 2.0, exact).

**Path decision:** `inline` — ~5 files, ~150-220 LOC mostly CSS + small TSX. Within the ≤300 LOC AND ≤5 files inline threshold.

**Expected chunk delta:** essentially zero (CSS-only + a few lines of state-machine TSX). Baseline is 234.02 kB post-m3; target ≤ 240 kB.

---

## 2. Affected files (5 files)

1. **`src/newtab/App.tsx`** — add `staggeredTab` `useState<Tab>` (init = current tab so first paint stagger fires); add `useRef<number | undefined>` for the 250 ms timeout; on tab change set `staggeredTab=t` and reset/schedule the timeout. Each tabpanel `<div>` receives `data-staggered={staggeredTab === t.id ? "true" : undefined}`. Wire-up location is the `setTab` call + tabpanel render (brief-1 §App.tsx).

2. **`src/newtab/App.css`** — modify `.clock` `font-size`; add `overflow-x: auto; scrollbar-width: thin` to `.tabs`; add `flex-shrink: 0` to `.tab`. Three discrete edits (brief-1 lines 30-35, 88-93).

3. **`src/sections/sections.css`** — add `@keyframes stagger-fade-up` + `[data-staggered="true"] .todo-list li { animation: stagger-fade-up 220ms cubic-bezier(0.2, 0, 0, 1) both; animation-delay: calc(var(--stagger-idx, 0) * 55ms); }` + dual-guard block. Mirror the `.closed-scope-counter` pattern at lines 234-252.

4. **`src/sections/TodoList.tsx`** — at the `.todo-list` `<ul>` mapping site (line 251), inject `style={{ "--stagger-idx": Math.min(idx, 9) } as React.CSSProperties}` on the `<TodoItem>` wrapper element (or on a wrapping `<li>` if TodoItem renders the `<li>` itself — brief-1 §3.1 flagged this needs verification).

5. **`src/sections/sprint/SprintManager.tsx`** — same `--stagger-idx` injection on the active-sprint `<ul>` at line 1242.

**Possible 6th file** if `TodoItem` is what renders the `<li>` (not a wrapper in TodoList): pass `index` prop OR set the style on `<TodoItem>` itself and let it forward. Implementer chooses; either keeps file count ≤ 5.

---

## 3. Architecture decisions

1. **`data-staggered` lives on the tabpanel `<div>` in App.tsx, not in section components.** App.tsx owns both tab state and `hidden=` — single source of truth. CSS selector chain is `[data-staggered="true"] .todo-list li`. Works for Today, LongTerm (shared `TodoList`), and Sprint (`SprintManager`'s active-sprint `<ul>`).

2. **Cap-at-10 is CSS-correct via `Math.min(idx, 9)` injected by React.** Brief-2 flagged that 7 might "feel snappier" (last item at 550 ms vs 715 ms) but the milestone spec is 10 — keep 10 per spec; the difference is small and tightening later is trivial.

3. **`useRef` + `clearTimeout` cleanup is mandatory** (brief-2 §4 risk) — rapid tab switching within 250 ms must cancel the pending timeout so the next activation starts clean. Standard React debounce pattern.

4. **Initial-load stagger fires.** Default `staggeredTab` = current tab so first paint plays the cascade. Brief-1 §4.1 recommendation; brief-2 implicitly agrees.

5. **`scrollbar-width: thin` is universal-on, not mobile-only.** No media query — proclivity is desktop-first but the thin scrollbar is unobtrusive on desktop too (and the row only overflows at narrow widths anyway).

6. **Card mode exclusion needs an explicit CSS scope.** `TodoCardSection`'s narrow-viewport fallback `<ul>` is `<ul class="todo-list card-fallback-list">` (literally carrying the `.todo-list` class), so an un-scoped `[data-staggered="true"] .todo-list li` rule would also match the card-mode fallback rows — which don't get `--stagger-idx` from the call site, so they'd all animate at `delay=0` (simultaneous fade-up) instead of being excluded. The implementation scopes the selector with `:not(.card-fallback-list)` to make the exclusion explicit (m5 rect M3/M4).

---

## 4. external_writes_required

```yaml
external_writes_required:
  - "git push origin main"
```

(No new deps; pure CSS + minimal TSX state change.)

---

## 5. Implementation strategy (inline path)

1. **s10 first (lowest risk, pure CSS)** — three edits in `App.css`. Build. Verify chunk size unchanged.
2. **s9 CSS** — `@keyframes` + selector + dual-guard in `sections.css`. Build. Verify no name collision.
3. **s9 React state machine** — `staggeredTab` state + `useRef` timeout in `App.tsx`; `data-staggered` prop on tabpanel `<div>`. Build.
4. **s9 `--stagger-idx` injection** — at `TodoList.tsx` and `SprintManager.tsx` `<ul>` mapping sites. Build.
5. **Manual smoke** — verify in dev (`npm run dev`): stagger fires on first paint of Today, fires on switching to Sprint with archived rows expanded, doesn't replay on a useStore() update mid-tab, instant under DevTools-forced reduced-motion.

Commit grouping: ONE commit per story (`feat(a11y): UPL-16 mobile header fluid clock + scrollable tabs` + `feat(motion): UPL-3 stagger-reveal on todo list activation`). Stay within mid-flight scope thresholds (< 350 LOC, < 6 files).

---

## 6. Implementation acceptance criteria

1. **`.clock`** has `font-size: clamp(28px, 6vw, 56px)`. At 390 px → 28 px (clamp floor); at 1024 px+ → 56 px (clamp ceiling).
2. **`.tabs`** has `overflow-x: auto; scrollbar-width: thin`. **`.tab`** has `flex-shrink: 0`.
3. **`@keyframes stagger-fade-up`** declared in `sections.css` (no collision with existing keyframes).
4. **`[data-staggered="true"] .todo-list li`** applies the animation with `animation-delay: calc(var(--stagger-idx, 0) * 55ms)`.
5. **`[data-reduced-motion="true"] [data-staggered="true"] .todo-list li`** AND `@media (prefers-reduced-motion: reduce)` BOTH disable the animation (dual-guard).
6. **App.tsx** has `staggeredTab` state initialized to the default tab so first paint plays. Tab changes set `staggeredTab=t`; a `useRef`-tracked timeout clears it ~250 ms later (and is cancelled on rapid re-tab).
7. **Each `<li>` in Today/Sprint/LongTerm list mode** has `--stagger-idx` set via inline style, capped at 9 (`Math.min(idx, 9)`).
8. **`npm run build`** passes clean, strict TS zero errors. Initial chunk ≤ 240 kB (baseline 234.02).

---

## 7. Riskiest assumption + alternative

**Risk:** rapid tab switching may stack pending timeouts and leave `data-staggered` in the wrong state. Brief-2 §4 mitigation: `useRef` + `clearTimeout` cleanup.

**Alternative if state machine proves flaky:** scope the toggle to a `key` prop on the tabpanel — incrementing the key on tab change forces a remount of the panel, which re-fires the CSS animation natively without any data-attribute toggle. Heavier (causes section re-mount, loses per-section local state) but simpler. Fallback only.

---

## 8. Open questions for the implementer (≤5)

1. **`TodoItem` `<li>` ownership** — does `TodoItem` render the `<li>` itself, or does `TodoList` wrap it in `<li>`? Brief-1 §3.1 said `<TodoItem>` is rendered directly without an index prop; verify via `Read` on TodoItem.tsx before deciding where to put the inline style. Recommended: inject on the wrapping `<TodoItem index={idx} />` and let TodoItem forward to its root element, OR set the style on the `.todo-item` `<li>` if TodoItem renders the `<li>`.
2. **Stagger cap-at-10 vs 7** — keep 10 per spec. Brief-2's 7-item suggestion is defer-to-future.
3. **`ArchivedSprintRow` nested `<ul>` collision** — brief-1 §3 Q4: archived sprint rows have their own `.todo-list`. When Sprint tab activates with an archived row expanded, those items also animate. Either accept it (minor) or scope: `[data-staggered="true"] .sprint > .todo-list li` to limit to the active-sprint list only. Implementer choice — both are defensible.
4. **First-paint stagger toggle** — set initial state to the default tab, OR set in `useEffect` with empty deps. Either works; useState init is one fewer effect.
5. **Reduced-motion guard form** — brief-1 §2 cites `sections.css` lines 234-252 as the pattern. The full dual-guard means both `[data-reduced-motion="true"] [data-staggered="true"] .todo-list li { animation: none; }` AND `@media (prefers-reduced-motion: reduce) { [data-staggered="true"] .todo-list li { animation: none; } }`.

---

## 9. Scope assessment

- **Path:** inline (≤5 files, ≤300 LOC mostly CSS)
- **Estimated LOC:** 100-200
- **Worktree:** NO (inline path)
- **`--allow-large-diff`:** NO
- **Novel architecture:** NO — established CSS-stagger + clamp patterns
