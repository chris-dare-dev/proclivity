# Research synthesis — frontend-uplift-2026q2-m4

**Milestone:** UPL-2 v0 — CSS `[data-leaving]` section-fade cross-dissolve
**Date:** 2026-05-20
**Author:** orchestrator (main session, Phase 1 fan-in)
**Sources:** brief-1.md (explore — 8 gotchas, codebase map), brief-2.md (general — VTA / inert / fill-mode insights)

---

## 1. TL;DR for the implementer

A CSS-only cross-dissolve on tab switches. Two files; ~80–120 LOC. Inline path.

- **State machine in App.tsx** — mirror the m5 `staggeredTab` pattern: `leavingTab: Tab | null` state, `useRef<number>` timeout, `useLayoutEffect([tab])` to set + schedule clear. 250 ms timeout (matches stagger precedent + small safety buffer past the 220 ms CSS transition).
- **Widen `hidden` predicate** on each of the 7 tabpanels from `tab !== id` to `tab !== id && leavingTab !== id`, so the leaving panel stays mounted for the fade-out window.
- **Add `data-leaving` AND `inert`** to each tabpanel (`leavingTab === id`). `inert` is the load-bearing a11y guard — `pointer-events: none` blocks mouse but NOT Tab key, and brief-2 §3.2 documents that adversary will flag missing `inert` as HIGH. Add it.
- **CSS:** `.content { position: relative }`. `.content > [data-leaving="true"] { position: absolute; inset: 0; opacity: 0; transition: opacity 220ms ease-out; pointer-events: none }`. `@keyframes tabpanel-fade-in { from { opacity: 0 } to { opacity: 1 } }` applied to `.content > div:not([hidden]):not([data-leaving]):not([data-staggered])` with `animation-fill-mode: both` — see §3.5 for the staggered-tab carve-out and §3.4 for the fill-mode necessity.
- **Dual-guard reduced-motion** on both new rules (theme.css global reset would catch it anyway, but local audit-clarity guards are the convention per sections.css comment).

**Path decision:** `inline` — 2 files, ~100 LOC. Within the ≤5 files AND ≤300 LOC threshold.

**Expected chunk delta:** essentially zero (a few lines of JSX + CSS). Baseline 234.54 kB post-m5; target ≤ 240 kB.

---

## 2. Affected files (2)

1. **`src/newtab/App.tsx`** — additions only, no edits to existing logic:
   - Add `const [leavingTab, setLeavingTab] = useState<Tab | null>(null);` and `const leavingTimeoutRef = useRef<number | undefined>(undefined);` next to the existing `staggeredTab` block (App.tsx:322–324).
   - Add a second `useLayoutEffect([tab])` that captures the OLD `tab` value via a `useRef<Tab>` (held between renders) — see §3.1 for the exact mechanism. Set `leavingTab` to the previous tab, schedule a 250 ms clear with cancel-on-reschedule.
   - For each of the 7 tabpanel `<div>`s (today, sprint, long, gantt, reminders, calendar, closed): widen the `hidden` predicate, add `data-leaving`, add `inert`.

2. **`src/newtab/App.css`** — additions:
   - Modify `.content` (currently `min-height: 400px`) to ALSO have `position: relative`.
   - Add `.content > [data-leaving="true"] { position: absolute; inset: 0; opacity: 0; transition: opacity 220ms ease-out; pointer-events: none; }` (a11y backup; `inert` blocks Tab; pointer-events blocks click).
   - Add `@keyframes tabpanel-fade-in { from { opacity: 0 } to { opacity: 1 } }`.
   - Add `.content > div:not([hidden]):not([data-leaving]):not([data-staggered]) { animation: tabpanel-fade-in 220ms ease-out both; }` — the `:not([data-staggered])` carve-out prevents double-fade on Today/Sprint/LongTerm where m5's stagger already provides a fade-in feel (see §3.5).
   - Add the dual-guard reduced-motion block matching the m5-s9 / closed-scope-counter pattern.

---

## 3. Architecture decisions made during synthesis

### 3.1 Capturing the OLD `tab` value

The spec wants `setLeavingTab(currentTabBefore)` synchronously when `tab` changes. Two clean patterns:

**Option A — `usePrevious` via `useRef`:**
```tsx
const prevTabRef = useRef<Tab>(tab);
useLayoutEffect(() => {
  const prev = prevTabRef.current;
  if (prev !== tab) {
    setLeavingTab(prev);
    if (leavingTimeoutRef.current !== undefined) {
      window.clearTimeout(leavingTimeoutRef.current);
    }
    leavingTimeoutRef.current = window.setTimeout(() => {
      setLeavingTab((current) => (current === prev ? null : current));
      leavingTimeoutRef.current = undefined;
    }, 250);
  }
  prevTabRef.current = tab;
  return () => {
    if (leavingTimeoutRef.current !== undefined) {
      window.clearTimeout(leavingTimeoutRef.current);
      leavingTimeoutRef.current = undefined;
    }
  };
}, [tab]);
```

**Option B — capture in the click handler directly** by changing the `setTab(t.id)` call site to `handleTabChange(t.id)` where the handler reads `tab` (the closure variable at click time) and batches `setLeavingTab(tab)` + `setTab(newTab)`. React 18 auto-batches, so both states update in one render.

**Decision:** Option A. Keeps the entire state machine in one declarative `useLayoutEffect` block (mirrors the `staggeredTab` shape), doesn't require rewriting every `setTab` call site (there are ~3 — the `<nav>` map onClick, the visibleTabs effect, the NAV_CLOSED_EVENT handler, and the Calendar `onTabChange`). All four become Option-A-compatible automatically.

### 3.2 `inert` is mandatory for v0

Brief-2 §3.2 confirms `pointer-events: none` does NOT block Tab key. During the 220 ms window where `hidden=false` is reasserted on the leaving panel, descendants are Tab-reachable. `inert` is the canonical attribute that closes this — removes element from focus order, click events, AND the a11y tree while keeping it visually present. Adversary critic will almost certainly flag its absence.

**TypeScript caveat:** React 18.3+ types include `inert` on `HTMLAttributes`. If the strict build complains, fall back to `ref` + `el.toggleAttribute("inert", leavingTab === id)` in a layout effect. Try the direct JSX prop first; only escalate if TS rejects.

### 3.3 `position: relative` on `.content` is required (not optional)

Brief-1 G3: without `position: relative`, `position: absolute; inset: 0` on a tabpanel child escapes to `.app` (which IS `position: relative`) — filling the entire app area including header and tabs. This is a hard requirement.

### 3.4 `animation-fill-mode: both` on the INCOMING fade-in is the real flash-of-content fix

Brief-2 §4 has the critical insight: the LEAVING panel transitions from its current rendered opacity (1) to 0 via CSS transition — no flash risk. The INCOMING panel is the risk: if React commits `hidden=false` and the panel renders at the default opacity (1) for one paint frame before the `@keyframes tabpanel-fade-in` `from { opacity: 0 }` takes hold, the user sees a flash.

`animation-fill-mode: both` causes the animation to apply its `from` state at t=0 BEFORE the first frame, ensuring the incoming panel paints at opacity 0 immediately. This is the load-bearing flash-of-content defense — NOT `useLayoutEffect` (which only matters for the `data-leaving` attribute on the LEAVING panel).

### 3.5 Stagger interaction — narrow `tabpanel-fade-in` selector to exclude `[data-staggered]` panels

Brief-1 G6: when the user switches to Today/Sprint/LongTerm, the panel fades in AND the stagger fires. Two concurrent fade-ups produce a visually unpolished compound opacity (parent at 0.3 × child at 1.0 = 0.3, then both pop to 1.0 when the panel completes).

**Decision:** apply `tabpanel-fade-in` only to panels WITHOUT `[data-staggered]`. The stagger animation itself provides the fade-in feel for those panels. CSS selector:
```css
.content > div:not([hidden]):not([data-leaving]):not([data-staggered]) {
  animation: tabpanel-fade-in 220ms ease-out both;
}
```

Gantt, Reminders, Calendar, Closed get the panel-level fade-in. Today/Sprint/LongTerm get the stagger only.

### 3.6 Height-jump during transition — accept the existing `min-height: 400px` floor

Brief-1 G4 + brief-2 §3.4: when the leaving panel becomes `position: absolute`, the content area collapses to the incoming panel's intrinsic height. The existing `.content { min-height: 400px }` provides a partial floor.

**Decision:** accept for v0. The grid-stacking alternative (`display: grid; grid-area: 1/1`) is the cleaner long-term path but is out of scope for a CSS-only cross-dissolve v0.

### 3.7 Timeout duration: 250 ms (not 220 ms)

Brief-1 G1: matching the stagger precedent + small safety buffer past the 220 ms CSS transition. 250 ms means `hidden=` reasserts ~30 ms after the CSS fade-out completes — graceful, no race risk.

### 3.8 View Transitions API is the v1 path, not v0

Brief-2 §3.1 + Path C: VTA is the SOTA 2026 approach but requires feature-detection, `flushSync` + React 18 concurrent-renderer integration, and a fallback wrapper. Defer to a future v1 milestone. The milestone scope explicitly says "CSS-only Path a."

---

## 4. external_writes_required

```yaml
external_writes_required:
  - "git push origin main"
```

---

## 5. Implementation strategy (inline path)

1. **CSS first** — `.content` + `[data-leaving]` rule + `@keyframes tabpanel-fade-in` + incoming-panel selector + dual-guard. Build to confirm no name collisions and no Vite errors.
2. **App.tsx state machine** — add `leavingTab` + `prevTabRef` + `leavingTimeoutRef` + the `useLayoutEffect`. Build.
3. **Tabpanel attributes** — for each of the 7 panels, widen `hidden` predicate + add `data-leaving` + add `inert`. Build.
4. **Manual smoke** — verify in dev:
   - Tab switch produces a visible cross-dissolve (220 ms).
   - No flash-of-content on the incoming side.
   - Under DevTools forced reduced-motion, switches are instant.
   - Rapid clicks (5 in 500 ms) don't leave panels in stale state.
   - Tab key during the 220 ms window cannot focus the leaving panel's descendants.
   - Today/Sprint/LongTerm still get the m5 stagger (not double-fading).

Commit grouping: ONE commit (`feat(motion): section-fade cross-dissolve on tab switches (m4-s11)`). Stay within mid-flight scope thresholds.

---

## 6. Implementation acceptance criteria

1. **`.content`** has `position: relative` (added to existing `min-height: 400px` rule).
2. **All 7 tabpanel `<div>`s** have:
   - `hidden={tab !== "<id>" && leavingTab !== "<id>"}` (widened predicate).
   - `data-leaving={leavingTab === "<id>" ? "true" : undefined}`.
   - `inert={leavingTab === "<id>" || undefined}` (or equivalent attribute-toggle).
3. **`leavingTab` state** is `Tab | null`, initial `null`. `prevTabRef` tracks the previous `tab` between renders. A single `useLayoutEffect([tab])` cancels any pending timeout, sets `leavingTab=prev` if `prev !== tab`, and schedules a 250 ms clear via `useRef<number>` timeout. Cleanup cancels on unmount.
4. **`@keyframes tabpanel-fade-in`** declared in App.css (no collision; brief-1 confirms).
5. **`.content > [data-leaving="true"]`** has `position: absolute; inset: 0; opacity: 0; transition: opacity 220ms ease-out; pointer-events: none;`.
6. **`.content > div:not([hidden]):not([data-leaving]):not([data-staggered])`** has `animation: tabpanel-fade-in 220ms ease-out both;` — `animation-fill-mode: both` is mandatory (prevents incoming flash-of-content).
7. **Dual reduced-motion guards** — both `[data-reduced-motion="true"]` and `@media (prefers-reduced-motion: reduce)` blocks null both the transition and the keyframe animation.
8. **Manual smoke**: cross-dissolve visible at 220 ms; no flash; reduced-motion collapses to instant; rapid clicks stable; Tab key cannot escape into leaving panel (via `inert`).
9. **`npm run build`** passes, strict TS zero errors. Initial chunk ≤ 240 kB (baseline 234.54).

---

## 7. Riskiest assumption + alternative

**Risk:** the incoming-panel `animation-fill-mode: both` is the single load-bearing flash-of-content defense. If this is omitted or browser support deviates, a one-frame opacity-1 flash will occur on every tab switch — observable but mild.

**Mitigation:** brief-2 §4 proposes a defensive backup — set `opacity: 0` as the *default* style on `.content > div:not([hidden]):not([data-leaving])` so the initial paint is opacity 0 before the animation even begins. This is belt-and-suspenders; only add if the primary `fill-mode: both` proves insufficient in manual smoke.

**Alternative if cross-dissolve trips a critic finding:** fall back to **reveal-only** per the roadmap's documented fallback. Drop the `[data-leaving]` predicate widening, the `position: absolute` rule, and the `inert` attribute. Keep only `@keyframes tabpanel-fade-in` on the incoming panel with `hidden=` flipping instantly on the outgoing one. Less polished but zero flash-of-content / a11y risk.

---

## 8. Open questions for the implementer (≤5)

1. **`inert` JSX prop vs ref-setAttribute fallback** — try the direct prop first. If strict TS rejects, fall back to `ref + useLayoutEffect + el.toggleAttribute("inert", leavingTab === id)`.
2. **Stagger interaction confirmation** — synthesis §3.5 prescribes excluding `[data-staggered]` from the panel-level fade-in. Confirm in manual smoke that Today/Sprint/LongTerm get a clean stagger without a competing parent fade.
3. **Reduced-motion guard form** — under reduced-motion, what should the leaving panel do? Options: (a) instant hide (set `transition: none` so opacity goes to 0 immediately), or (b) collapse to zero-duration transition (effectively the same). Either works. Use (a) for clarity.
4. **First-paint behaviour** — `leavingTab` starts at `null`. On initial mount, `prevTabRef.current === tab` so no leaving state fires. The incoming `today` panel matches `:not([hidden]):not([data-leaving]):not([data-staggered])` only if `data-staggered` is undefined — but the m5 state machine seeds `staggeredTab=tab` so `today` has `data-staggered="true"` on first paint, AND IT DOESN'T get the panel-level fade-in (correct — the stagger covers it). All other initial tabs are hidden, so they don't animate either.
5. **`flushSync` for View Transitions API** — explicitly OUT of scope for v0; the spec is CSS-only Path a. Mention only as a v1 future path.

---

## 9. Scope assessment

- **Path:** inline (≤5 files, ~100 LOC)
- **Estimated LOC:** 80–120
- **Worktree:** NO
- **`--allow-large-diff`:** NO
- **Novel architecture:** NO — mirrors the m5 staggeredTab state machine precedent
